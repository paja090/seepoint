import { prisma } from '@/lib/db';
import { getTenantContext, requireTenantContext, runWithTenantContext } from '@/lib/tenant-context';
import { loadProfile } from './data';
import { parseProfile } from './profile';
import { auditPlan, type PlannerActor, requirePlannerManager } from './service';
import type { PlanningProfile } from './contracts';

export const WORK_TYPE_LABELS: Record<string, string> = {
  INSTALLATION: 'Montáž nosičů a instalace ploch',
  REINSTALLATION: 'Přemontáž a výměna plochy',
  DEINSTALLATION: 'Demontáž konstrukcí a nosičů',
  REPAIR: 'Oprava a servis nosičů',
  CHECK: 'Kontrola a pasportizace',
  TRANSPORT: 'Doprava materiálu na stavbu',
  NAVIGATION_INSTALLATION: 'Instalace navigačních cedulí',
  ELECTION_REMOVAL: 'Přesuny, svozy a deinstalace',
  OTHER: 'Ostatní terénní práce',
};

export interface WorkTypeTelemetryAggregate {
  workType: string;
  workTypeLabel: string;
  completedCount: number;
  plannedMinutesAvg: number;
  actualMinutesAvg: number;
  actualMinutesMedian: number;
  savedMinutesTotal: number;
  currentProfileMinutes: number;
  recommendedServiceMinutes: number;
  confidenceScore: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface OrganizationFieldTelemetryReport {
  organizationId: string;
  totalCompletedWithTimes: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  totalDiffMinutes: number;
  overallEfficiencyPercent: number;
  aggregates: WorkTypeTelemetryAggregate[];
  aiSummary: string;
  recommendedCalibration: Record<string, number>;
}

export interface RawFieldObservation {
  workType: string;
  plannedMinutes: number;
  actualMinutes: number;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

/**
 * Rounds recommended minutes to standard operational increments (e.g. 5 min intervals).
 */
export function roundToSensibleMinutes(minutes: number): number {
  if (minutes <= 12) return Math.max(3, Math.round(minutes));
  if (minutes <= 30) return Math.round(minutes / 5) * 5;
  return Math.round(minutes / 10) * 10;
}

/**
 * Pure aggregation engine for field observations.
 * Analyzes empirical durations, calculates medians, and computes AI calibration.
 */
export function aggregateFieldObservations(
  observations: RawFieldObservation[],
  currentServiceMinutes: Record<string, number>,
  organizationId = 'default-org'
): OrganizationFieldTelemetryReport {
  const observationsByWorkType = new Map<string, Array<{ planned: number; actual: number }>>();

  for (const obs of observations) {
    if (obs.actualMinutes < 2 || obs.actualMinutes > 480) continue;
    if (!observationsByWorkType.has(obs.workType)) {
      observationsByWorkType.set(obs.workType, []);
    }
    observationsByWorkType.get(obs.workType)!.push({
      planned: obs.plannedMinutes,
      actual: obs.actualMinutes,
    });
  }

  // Ensure standard work types appear even if no telemetry is yet measured
  const allKnownWorkTypes = Object.keys(WORK_TYPE_LABELS);
  for (const wt of allKnownWorkTypes) {
    if (!observationsByWorkType.has(wt)) {
      observationsByWorkType.set(wt, []);
    }
  }

  const aggregates: WorkTypeTelemetryAggregate[] = [];
  const recommendedCalibration: Record<string, number> = {};

  let totalPlannedMinutes = 0;
  let totalActualMinutes = 0;
  let totalMeasuredCount = 0;

  for (const [workType, items] of observationsByWorkType.entries()) {
    const currentNorm = currentServiceMinutes[workType] ?? 30;

    if (items.length === 0) {
      recommendedCalibration[workType] = currentNorm;
      aggregates.push({
        workType,
        workTypeLabel: WORK_TYPE_LABELS[workType] || workType,
        completedCount: 0,
        plannedMinutesAvg: currentNorm,
        actualMinutesAvg: currentNorm,
        actualMinutesMedian: currentNorm,
        savedMinutesTotal: 0,
        currentProfileMinutes: currentNorm,
        recommendedServiceMinutes: currentNorm,
        confidenceScore: 'LOW',
      });
      continue;
    }

    const actuals = items.map((i) => i.actual);
    const planneds = items.map((i) => i.planned);

    const sumActual = actuals.reduce((a, b) => a + b, 0);
    const sumPlanned = planneds.reduce((a, b) => a + b, 0);

    totalActualMinutes += sumActual;
    totalPlannedMinutes += sumPlanned;
    totalMeasuredCount += items.length;

    const avgActual = Math.round((sumActual / items.length) * 10) / 10;
    const avgPlanned = Math.round((sumPlanned / items.length) * 10) / 10;
    const medianActual = calculateMedian(actuals);

    let recommended: number;
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW';

    if (items.length >= 10) {
      confidence = 'HIGH';
      recommended = roundToSensibleMinutes(medianActual);
    } else if (items.length >= 3) {
      confidence = 'MEDIUM';
      const blended = medianActual * 0.7 + currentNorm * 0.3;
      recommended = roundToSensibleMinutes(blended);
    } else {
      confidence = 'LOW';
      const blended = medianActual * 0.5 + currentNorm * 0.5;
      recommended = roundToSensibleMinutes(blended);
    }

    recommendedCalibration[workType] = recommended;

    aggregates.push({
      workType,
      workTypeLabel: WORK_TYPE_LABELS[workType] || workType,
      completedCount: items.length,
      plannedMinutesAvg: avgPlanned,
      actualMinutesAvg: avgActual,
      actualMinutesMedian: medianActual,
      savedMinutesTotal: sumPlanned - sumActual,
      currentProfileMinutes: currentNorm,
      recommendedServiceMinutes: recommended,
      confidenceScore: confidence,
    });
  }

  aggregates.sort((a, b) => b.completedCount - a.completedCount || a.workTypeLabel.localeCompare(b.workTypeLabel));

  const totalDiff = totalPlannedMinutes - totalActualMinutes;
  const overallEfficiencyPercent =
    totalPlannedMinutes > 0
      ? Math.round((totalPlannedMinutes / Math.max(1, totalActualMinutes)) * 100)
      : 100;

  let aiSummary = '';
  if (totalMeasuredCount === 0) {
    aiSummary =
      'Zatím nebyly naměřeny žádné záznamy o skutečném čase montáží a terénních prací. Jakmile posádky v terénu začnou zaznamenávat čas prací, AI automaticky vyhodnotí jejich reálnou rychlost a nabídne vám zpřesněné normy pro plánování.';
  } else {
    const fasterWork = aggregates.filter((a) => a.completedCount > 0 && a.savedMinutesTotal > 0);
    const slowerWork = aggregates.filter((a) => a.completedCount > 0 && a.savedMinutesTotal < 0);

    const parts: string[] = [];
    if (totalDiff > 0) {
      parts.push(
        `Posádky v terénu pracují celkově o ${totalDiff} minut rychleji než předpokládají aktuální normy (celková efektivita ${overallEfficiencyPercent} %).`
      );
    } else if (totalDiff < 0) {
      parts.push(
        `Práce v terénu vyžadují v součtu o ${Math.abs(totalDiff)} minut více času než počítají tabulkové normy (efektivita ${overallEfficiencyPercent} %).`
      );
    } else {
      parts.push('Reálné časy prací v terénu přesně odpovídají stávajícím tabulkovým normám.');
    }

    if (fasterWork.length > 0) {
      const top = fasterWork[0];
      parts.push(
        `Nejvýraznější úspora nastává u činnosti „${top.workTypeLabel}“ (reálný medián ${top.actualMinutesMedian} min oproti normě ${top.currentProfileMinutes} min).`
      );
    }

    if (slowerWork.length > 0) {
      const top = slowerWork[0];
      parts.push(
        `Doporučujeme navýšit časovou rezervu pro „${top.workTypeLabel}“ (reálný medián ${top.actualMinutesMedian} min oproti normě ${top.currentProfileMinutes} min).`
      );
    }

    parts.push(
      'Kliknutím na „Aplikovat AI kalibraci“ můžete stávající odhady jedním krokem aktualizovat na reálné empirické časy.'
    );

    aiSummary = parts.join(' ');
  }

  return {
    organizationId,
    totalCompletedWithTimes: totalMeasuredCount,
    totalPlannedMinutes,
    totalActualMinutes,
    totalDiffMinutes: totalDiff,
    overallEfficiencyPercent,
    aggregates,
    aiSummary,
    recommendedCalibration,
  };
}

/**
 * Analyzes field execution telemetry across ALL work types in an organization.
 * Combines WorkEntry records, Navigation executions, and Election removals.
 */
export async function analyzeOrganizationFieldTelemetry(
  explicitOrgId?: string
): Promise<OrganizationFieldTelemetryReport> {
  const currentCtx = getTenantContext();
  const organizationId = explicitOrgId || currentCtx?.organizationId || 'default-org';

  return runWithTenantContext(
    { organizationId, source: currentCtx?.source || 'session', userId: currentCtx?.userId },
    async () => {
      let profile: PlanningProfile | null = null;
      try {
        profile = await loadProfile();
      } catch {
        profile = null;
      }
      const currentServiceMinutes = profile?.serviceMinutes ?? {
        INSTALLATION: 45,
        REINSTALLATION: 45,
        DEINSTALLATION: 30,
        REPAIR: 45,
        CHECK: 20,
        TRANSPORT: 60,
        NAVIGATION_INSTALLATION: 30,
        ELECTION_REMOVAL: 10,
        OTHER: 30,
      };

      const rawObservations: RawFieldObservation[] = [];

      try {
        // 1. Gather completed ElectionRemovalPoint records with timestamps
        const electionPoints = await prisma.electionRemovalPoint.findMany({
          where: {
            organizationId,
            status: 'COMPLETED',
            startedAt: { not: null },
            completedAt: { not: null },
          },
          select: {
            id: true,
            serviceMinutes: true,
            startedAt: true,
            completedAt: true,
          },
        });

        for (const ep of electionPoints) {
          if (ep.startedAt && ep.completedAt) {
            const diffMs = new Date(ep.completedAt).getTime() - new Date(ep.startedAt).getTime();
            const actual = Math.max(1, Math.round(diffMs / 60000));
            const planned = ep.serviceMinutes || currentServiceMinutes.ELECTION_REMOVAL || 10;
            rawObservations.push({ workType: 'ELECTION_REMOVAL', plannedMinutes: planned, actualMinutes: actual });
          }
        }

        // 2. Gather WorkEntry records with reported time spans or hours
        const workEntries = await prisma.workEntry.findMany({
          where: {
            organizationId,
            status: { in: ['SUBMITTED', 'APPROVED'] },
            OR: [
              { timeFrom: { not: null }, timeTo: { not: null } },
              { calculatedAmount: { gt: 0 } },
            ],
          },
          select: {
            id: true,
            workType: true,
            timeFrom: true,
            timeTo: true,
            quantity: true,
            unit: true,
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        });

        for (const we of workEntries) {
          let actualMins: number | null = null;
          if (we.timeFrom && we.timeTo) {
            const diffMs = new Date(we.timeTo).getTime() - new Date(we.timeFrom).getTime();
            actualMins = Math.max(1, Math.round(diffMs / 60000));
          } else if (we.unit === 'hod' || we.unit === 'h') {
            const hours = Number(we.quantity);
            if (hours > 0 && hours <= 12) {
              actualMins = Math.round(hours * 60);
            }
          }

          if (actualMins !== null) {
            const workTypeStr = String(we.workType);
            const planned = currentServiceMinutes[workTypeStr] ?? 45;
            rawObservations.push({ workType: workTypeStr, plannedMinutes: planned, actualMinutes: actualMins });
          }
        }

        // 3. Gather CRM Audit Logs
        const auditLogs = await prisma.crmAuditLog.findMany({
          where: {
            organizationId,
            action: {
              in: [
                'FIELD_POINT_STARTED',
                'FIELD_POINT_COMPLETED',
                'FIELD_ITEM_STARTED',
                'FIELD_ITEM_COMPLETED',
              ],
            },
          },
          select: {
            entityId: true,
            action: true,
            createdAt: true,
            detailsJson: true,
          },
          take: 1000,
          orderBy: { createdAt: 'asc' },
        });

        const entityStarts = new Map<string, Date>();
        for (const log of auditLogs) {
          if (log.action === 'FIELD_POINT_STARTED' || log.action === 'FIELD_ITEM_STARTED') {
            entityStarts.set(log.entityId, log.createdAt);
          } else if (
            (log.action === 'FIELD_POINT_COMPLETED' || log.action === 'FIELD_ITEM_COMPLETED') &&
            entityStarts.has(log.entityId)
          ) {
            const start = entityStarts.get(log.entityId)!;
            const diffMs = log.createdAt.getTime() - start.getTime();
            const mins = Math.max(1, Math.round(diffMs / 60000));
            if (mins >= 2 && mins <= 480) {
              const actionType = log.action.includes('POINT') ? 'NAVIGATION_INSTALLATION' : 'INSTALLATION';
              const planned = currentServiceMinutes[actionType] ?? 30;
              rawObservations.push({ workType: actionType, plannedMinutes: planned, actualMinutes: mins });
            }
            entityStarts.delete(log.entityId);
          }
        }
      } catch {
        // Fallback gracefully if database is unreachable (e.g. in tests)
      }

      return aggregateFieldObservations(rawObservations, currentServiceMinutes, organizationId);
    }
  );
}

/**
 * Applies calibrated service minutes into OrganizationFieldPlanningProfile.
 */
export async function applyFieldTelemetryCalibration(
  calibration: Record<string, number>,
  actor: PlannerActor,
  explicitOrgId?: string
): Promise<PlanningProfile> {
  requirePlannerManager(actor);
  const currentCtx = getTenantContext();
  const organizationId = explicitOrgId || currentCtx?.organizationId || requireTenantContext().organizationId;

  return runWithTenantContext(
    { organizationId, source: 'session', userId: actor.id },
    async () => {
      const row = await prisma.organizationFieldPlanningProfile.findUnique({
        where: { organizationId },
      });

      if (!row) {
        throw new Error('Profil plánování organizace nebyl nalezen.');
      }

      const profile = parseProfile(row.configuration);
      const updatedServiceMinutes: Record<string, number> = {
        ...profile.serviceMinutes,
      };

      for (const [workType, minutes] of Object.entries(calibration)) {
        if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440) {
          updatedServiceMinutes[workType] = Math.round(minutes);
        }
      }

      const updatedProfile: PlanningProfile = {
        ...profile,
        serviceMinutes: updatedServiceMinutes,
      };

      await prisma.organizationFieldPlanningProfile.update({
        where: { organizationId },
        data: {
          configuration: JSON.parse(JSON.stringify(updatedProfile)),
        },
      });

      await prisma.crmAuditLog.create({
        data: {
          organizationId,
          entityType: 'FieldPlanProfile',
          entityId: row.id,
          userId: actor.id,
          userEmail: actor.email,
          action: 'FIELD_PROFILE_CALIBRATED_BY_AI',
          detailsJson: JSON.stringify({
            calibratedTypesCount: Object.keys(calibration).length,
            calibration,
          }),
        },
      });

      return updatedProfile;
    }
  );
}
