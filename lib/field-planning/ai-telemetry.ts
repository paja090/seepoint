import { prisma } from '@/lib/db';
import { getTenantContext, requireTenantContext, runWithTenantContext } from '@/lib/tenant-context';
import { loadProfile } from './data';
import { parseProfile } from './profile';
import { auditPlan, type PlannerActor, requirePlannerManager } from './service';
import type { CustomPlanningActivity, PlanningProfile } from './contracts';

export const DEFAULT_SEEPOINT_ACTIVITIES: Record<
  string,
  { label: string; defaultMinutes: number; category: string }
> = {
  BENCH_INSTALLATION: { label: 'Instalace lavičky', defaultMinutes: 15, category: 'Lavičky' },
  BENCH_DEINSTALLATION: { label: 'Deinstalace lavičky', defaultMinutes: 10, category: 'Lavičky' },
  HORIZON_INSTALLATION: { label: 'Instalace horizontu', defaultMinutes: 20, category: 'Horizonty' },
  HORIZON_DEINSTALLATION: { label: 'Deinstalace horizontu', defaultMinutes: 15, category: 'Horizonty' },
  TOWER_INSTALLATION: { label: 'Instalace velké věže (Tower)', defaultMinutes: 45, category: 'Věže' },
  TOWER_DEINSTALLATION: { label: 'Deinstalace velké věže', defaultMinutes: 30, category: 'Věže' },
  NAVIGATION_INSTALLATION: { label: 'Instalace navigačních cedulí', defaultMinutes: 15, category: 'Navigace' },
  NAVIGATION_DEINSTALLATION: { label: 'Deinstalace navigačních cedulí', defaultMinutes: 10, category: 'Navigace' },
  BILLBOARD_POSTING: { label: 'Lepení billboardu', defaultMinutes: 30, category: 'Billboardy' },
  BILLBOARD_DEINSTALLATION: { label: 'Deinstalace billboardu', defaultMinutes: 15, category: 'Billboardy' },
  ABOARD_INSTALLATION: { label: 'Instalace reklamního áčka / stojanu', defaultMinutes: 10, category: 'Áčka & Stojany' },
  ABOARD_DEINSTALLATION: { label: 'Deinstalace reklamního áčka / stojanu', defaultMinutes: 5, category: 'Áčka & Stojany' },
  CITYGALLERY_INSTALLATION: { label: 'Instalace CityGallery / CLV', defaultMinutes: 25, category: 'CityGallery' },
  CITYGALLERY_DEINSTALLATION: { label: 'Deinstalace CityGallery', defaultMinutes: 15, category: 'CityGallery' },
  ELECTION_BOARD_REMOVAL: { label: 'Svoz volebních desek a sololitů', defaultMinutes: 6, category: 'Svozy voleb' },
  ELECTION_BANNER_REMOVAL: { label: 'Svoz volebních bannerů (plachet)', defaultMinutes: 12, category: 'Svozy voleb' },
  ELECTION_REMOVAL: { label: 'Přesuny, svozy a deinstalace (obecné)', defaultMinutes: 7, category: 'Svozy voleb' },
  INSTALLATION: { label: 'Montáž nosičů a instalace ploch', defaultMinutes: 30, category: 'Obecné' },
  DEINSTALLATION: { label: 'Demontáž konstrukcí a nosičů', defaultMinutes: 20, category: 'Obecné' },
  REINSTALLATION: { label: 'Přemontáž a výměna plochy', defaultMinutes: 25, category: 'Obecné' },
  TRANSPORT: { label: 'Doprava materiálu na stavbu', defaultMinutes: 60, category: 'Logistika' },
  CHECK: { label: 'Kontrola a pasportizace', defaultMinutes: 20, category: 'Servis & Pasport' },
  REPAIR: { label: 'Oprava a servis nosičů', defaultMinutes: 30, category: 'Servis & Pasport' },
  OTHER: { label: 'Ostatní terénní práce', defaultMinutes: 15, category: 'Ostatní' },
};

export const WORK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(DEFAULT_SEEPOINT_ACTIVITIES).map(([k, v]) => [k, v.label])
);

export interface WorkTypeTelemetryAggregate {
  workType: string;
  workTypeLabel: string;
  category?: string;
  isCustom?: boolean;
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
  ignoredTooFastCount: number;
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
  organizationId = 'default-org',
  customActivities: CustomPlanningActivity[] = [],
  ignoredTooFastCount = 0
): OrganizationFieldTelemetryReport {
  const observationsByWorkType = new Map<string, Array<{ planned: number; actual: number }>>();

  for (const obs of observations) {
    if (obs.actualMinutes < 1 || obs.actualMinutes > 480) continue;
    if (!observationsByWorkType.has(obs.workType)) {
      observationsByWorkType.set(obs.workType, []);
    }
    observationsByWorkType.get(obs.workType)!.push({
      planned: obs.plannedMinutes,
      actual: obs.actualMinutes,
    });
  }

  // Combine standard activities with custom activities
  const allLabels: Record<string, { label: string; category?: string; isCustom?: boolean }> = {};
  for (const [k, v] of Object.entries(DEFAULT_SEEPOINT_ACTIVITIES)) {
    allLabels[k] = { label: v.label, category: v.category, isCustom: false };
  }
  for (const ca of customActivities) {
    allLabels[ca.key] = { label: ca.label, category: ca.category || 'Vlastní činnosti', isCustom: true };
  }

  // Ensure standard work types appear even if no telemetry is yet measured
  for (const wt of Object.keys(allLabels)) {
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
    const meta = allLabels[workType] || { label: workType, category: 'Ostatní', isCustom: false };
    const defaultFromDef = DEFAULT_SEEPOINT_ACTIVITIES[workType]?.defaultMinutes ?? 20;
    const currentNorm = currentServiceMinutes[workType] ?? defaultFromDef;

    if (items.length === 0) {
      recommendedCalibration[workType] = currentNorm;
      aggregates.push({
        workType,
        workTypeLabel: meta.label,
        category: meta.category,
        isCustom: meta.isCustom,
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
      workTypeLabel: meta.label,
      category: meta.category,
      isCustom: meta.isCustom,
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
    ignoredTooFastCount,
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
      const currentServiceMinutes: Record<string, number> = {
        ...Object.fromEntries(
          Object.entries(DEFAULT_SEEPOINT_ACTIVITIES).map(([k, v]) => [k, v.defaultMinutes])
        ),
        ...(profile?.serviceMinutes ?? {}),
      };

      const rawObservations: RawFieldObservation[] = [];
      let ignoredTooFastCount = 0;

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
            mediaType: true,
            serviceMinutes: true,
            startedAt: true,
            completedAt: true,
          },
        });

        for (const ep of electionPoints) {
          if (ep.startedAt && ep.completedAt) {
            const diffMs = new Date(ep.completedAt).getTime() - new Date(ep.startedAt).getTime();
            if (diffMs < 60000) {
              ignoredTooFastCount++;
              continue; // Ignored if under 1 minute (forgot to click Zahájit)
            }
            const actual = Math.max(1, Math.round(diffMs / 60000));
            let specificWorkType = 'ELECTION_REMOVAL';
            if (ep.mediaType === 'BANNER') {
              specificWorkType = 'ELECTION_BANNER_REMOVAL';
            } else if (ep.mediaType === 'ACKO') {
              specificWorkType = 'ABOARD_DEINSTALLATION';
            } else if (ep.mediaType === 'BENCH') {
              specificWorkType = 'BENCH_DEINSTALLATION';
            } else if (ep.mediaType === 'TOWER' || ep.mediaType === 'MINI_TOWER') {
              specificWorkType = 'TOWER_DEINSTALLATION';
            } else if (ep.mediaType === 'CITY_POSTER') {
              specificWorkType = 'CITYGALLERY_DEINSTALLATION';
            } else if (ep.mediaType === 'PLOT') {
              specificWorkType = 'ELECTION_BOARD_REMOVAL';
            }
            const planned = ep.serviceMinutes || currentServiceMinutes[specificWorkType] || 6;
            rawObservations.push({ workType: specificWorkType, plannedMinutes: planned, actualMinutes: actual });
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
            if (diffMs < 60000) {
              ignoredTooFastCount++;
              continue;
            }
            actualMins = Math.max(1, Math.round(diffMs / 60000));
          } else if (we.unit === 'hod' || we.unit === 'h') {
            const hours = Number(we.quantity);
            if (hours > 0 && hours <= 12) {
              actualMins = Math.round(hours * 60);
            }
          }

          if (actualMins !== null) {
            const workTypeStr = String(we.workType);
            const planned = currentServiceMinutes[workTypeStr] ?? 30;
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
            entityStarts.delete(log.entityId);
            if (diffMs < 60000) {
              ignoredTooFastCount++;
              continue; // Ignored if under 1 minute (forgot to click Zahájit)
            }
            const mins = Math.max(1, Math.round(diffMs / 60000));
            if (mins >= 1 && mins <= 480) {
              const actionType = log.action.includes('POINT') ? 'NAVIGATION_INSTALLATION' : 'INSTALLATION';
              const planned = currentServiceMinutes[actionType] ?? 15;
              rawObservations.push({ workType: actionType, plannedMinutes: planned, actualMinutes: mins });
            }
          }
        }
      } catch {
        // Fallback gracefully if database is unreachable (e.g. in tests)
      }

      return aggregateFieldObservations(
        rawObservations,
        currentServiceMinutes,
        organizationId,
        profile?.customActivities ?? [],
        ignoredTooFastCount
      );
    }
  );
}

/**
 * Adds a custom activity to the organization's planning profile.
 */
export async function addCustomActivityToProfile(
  activity: { label: string; defaultMinutes: number; category?: string },
  actor: PlannerActor,
  explicitOrgId?: string
): Promise<PlanningProfile> {
  requirePlannerManager(actor);
  const currentCtx = getTenantContext();
  const organizationId = explicitOrgId || currentCtx?.organizationId || requireTenantContext().organizationId;

  return runWithTenantContext(
    { organizationId, source: 'session', userId: actor.id },
    async () => {
      const row = await prisma.organizationFieldPlanningProfile.findUnique({ where: { organizationId } });
      if (!row) throw new Error('Profil plánování organizace nebyl nalezen.');
      const profile = parseProfile(row.configuration);
      const cleanKey =
        'CUSTOM_' +
        activity.label
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '_')
          .slice(0, 24) +
        '_' +
        Date.now().toString(36);

      const newCustomActivities: CustomPlanningActivity[] = [
        ...(profile.customActivities ?? []),
        {
          key: cleanKey,
          label: activity.label,
          defaultMinutes: activity.defaultMinutes,
          category: activity.category || 'Vlastní činnosti',
        },
      ];
      const updatedServiceMinutes = {
        ...profile.serviceMinutes,
        [cleanKey]: activity.defaultMinutes,
      };
      const updatedProfile: PlanningProfile = {
        ...profile,
        serviceMinutes: updatedServiceMinutes,
        customActivities: newCustomActivities,
      };
      await prisma.organizationFieldPlanningProfile.update({
        where: { organizationId },
        data: { configuration: JSON.parse(JSON.stringify(updatedProfile)) },
      });
      await prisma.crmAuditLog.create({
        data: {
          organizationId,
          entityType: 'FieldPlanProfile',
          entityId: row.id,
          userId: actor.id,
          userEmail: actor.email,
          action: 'FIELD_CUSTOM_ACTIVITY_ADDED',
          detailsJson: JSON.stringify({ key: cleanKey, label: activity.label, defaultMinutes: activity.defaultMinutes }),
        },
      });
      return updatedProfile;
    }
  );
}

/**
 * Removes a custom activity from the organization's planning profile.
 */
export async function deleteCustomActivityFromProfile(
  key: string,
  actor: PlannerActor,
  explicitOrgId?: string
): Promise<PlanningProfile> {
  requirePlannerManager(actor);
  const currentCtx = getTenantContext();
  const organizationId = explicitOrgId || currentCtx?.organizationId || requireTenantContext().organizationId;

  return runWithTenantContext(
    { organizationId, source: 'session', userId: actor.id },
    async () => {
      const row = await prisma.organizationFieldPlanningProfile.findUnique({ where: { organizationId } });
      if (!row) throw new Error('Profil plánování organizace nebyl nalezen.');
      const profile = parseProfile(row.configuration);
      const newCustomActivities = (profile.customActivities ?? []).filter((a) => a.key !== key);
      const updatedServiceMinutes = { ...profile.serviceMinutes };
      delete updatedServiceMinutes[key];
      const updatedProfile: PlanningProfile = {
        ...profile,
        serviceMinutes: updatedServiceMinutes,
        customActivities: newCustomActivities,
      };
      await prisma.organizationFieldPlanningProfile.update({
        where: { organizationId },
        data: { configuration: JSON.parse(JSON.stringify(updatedProfile)) },
      });
      await prisma.crmAuditLog.create({
        data: {
          organizationId,
          entityType: 'FieldPlanProfile',
          entityId: row.id,
          userId: actor.id,
          userEmail: actor.email,
          action: 'FIELD_CUSTOM_ACTIVITY_DELETED',
          detailsJson: JSON.stringify({ key }),
        },
      });
      return updatedProfile;
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
