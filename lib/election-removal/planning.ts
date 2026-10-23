import { convertElectionPointToJob } from './planning-job';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getTenantContext,
  requireTenantContext,
  runWithTenantContext,
} from '@/lib/tenant-context';
import {
  type PlanningJob,
  type PlanningInput,
  type PlanningResult,
} from '@/lib/field-planning/contracts';
import { loadProfile } from '@/lib/field-planning/data';
import { planFieldWork } from '@/lib/field-planning/planning-engine';
import { googleTravelProvider } from '@/lib/field-planning/travel';
import {
  DEFAULT_VEHICLE_CAPACITY_SLOTS,
  DEFAULT_WAREHOUSE_UNLOAD_MINUTES,
} from './constants';
import { fieldAvailability } from './availability';
import { approveFieldDraft, persistFieldDraft } from './approval';
import { parseProfile, zonedTime } from '@/lib/field-planning/profile';
import { plannerTransaction } from '@/lib/field-planning/service';
import { validateFieldPlanInput } from './plan-input';

/**
 * Transforms an ElectionRemovalPoint record into a PlanningJob for the routing engine.
 *
 * CRITICAL RULE:
 * Each physical removal medium is a distinct job with its own ID and service minutes.
 * Even if 2 points share the exact same GPS, they remain distinct individual jobs.
 */
export { convertElectionPointToJob } from './planning-job';

/**
 * Loads campaign details, pending points, active workers, and vehicles for route planning.
 */
export async function loadElectionPlanningResources(
  campaignId: string,
  targetDateStr?: string,
  explicitOrganizationId?: string
) {
  const organizationId =
    explicitOrganizationId ||
    getTenantContext()?.organizationId ||
    requireTenantContext().organizationId;

  return runWithTenantContext({ organizationId, userId: getTenantContext()?.userId, source: 'session' }, async () => {
    const [campaign, employees, vehicles, profile, fieldPlans] = await Promise.all([
      prisma.electionCampaign.findFirst({
        where: { id: campaignId, organizationId },
        include: {
          points: {
            include: { steps: { orderBy: { sequence: 'asc' } } },
            where: {
              status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ISSUE'] },
            },
            orderBy: [{ layerName: 'asc' }, { label: 'asc' }],
          },
        },
      }),
      prisma.employee.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.vehicle.findMany({
        where: {
          organizationId,
          status: { notIn: ['SERVICE', 'OUT_OF_SERVICE'] },
        },
        orderBy: { name: 'asc' },
      }),
      loadProfile(),
      prisma.fieldPlan.findMany({
        where: {
          organizationId,
          electionCampaignId: campaignId,
          status: { in: ['APPROVED', 'ACTIVE', 'DRAFT'] },
        },
        orderBy: { date: 'desc' },
        select: { id: true, date: true, status: true, version: true },
      }),
    ]);

    if (!campaign) {
      throw new Error('Volební kampaň nebyla nalezena.');
    }
    if (!profile?.enabled) throw new Error('Nejdříve zapněte plánování a potvrďte vlastní depo v Nastavení depa.');

    const planningDate = targetDateStr || (campaign.targetDate ? campaign.targetDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    const dayStart = new Date(`${planningDate}T00:00:00Z`);
    const dayEnd = new Date(`${planningDate}T23:59:59.999Z`);
    const [absences, plannerBlocks] = await Promise.all([
      prisma.employeeAbsence.findMany({
        where: { organizationId, status: 'APPROVED', dateFrom: { lte: dayEnd }, dateTo: { gte: dayStart } },
        select: { employeeId: true },
      }),
      prisma.plannerBlock.findMany({
        where: { organizationId, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
        select: { userId: true, title: true },
      }),
    ]);
    const absentEmpIds = new Set(absences.map(a => a.employeeId));
    const busyUserMap = new Map(plannerBlocks.map(b => [b.userId, b.title]));

    return {
      campaign,
      fieldPlans,
      points: campaign.points,
      employees: employees.map((e) => {
        let busyReason: string | undefined;
        if (absentEmpIds.has(e.id)) busyReason = 'Absence';
        else if (e.userId && busyUserMap.has(e.userId)) {
          const title = busyUserMap.get(e.userId);
          busyReason = title ? `Plánovač: ${title}` : 'Zaneprázdněn v Plánovači';
        }
        return {
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          role: e.role,
          position: e.position,
          busyReason,
        };
      }),
      vehicles: vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        registrationNumber: v.registrationNumber,
        capacitySlots: v.capacitySlots,
        equipment: v.equipment,
      })),
      profile,
    };
  });
}

export interface PlanRoutesPayload {
  parentPlanId?: string;
  routeMode?: 'SEPARATE_MEDIA' | 'MIXED';
  date: string;
  startTime?: string;
  endTime?: string;
  flexibleHours?: boolean;
  vehicleCapacitySlots?: number;
  warehouseUnloadMinutes?: number;
  filterMediaType?: string;
  crews: Array<{
    id: string;
    employeeIds: string[];
    vehicleId: string | null;
  }>;
  selectedPointIds?: string[];
  depot?: { latitude: number; longitude: number };
  saveDepotAsDefault?: boolean;
}

/**
 * Optimizes and plans election removal routes using the core routing engine.
 */
export async function optimizeElectionRemovalRoutes(
  campaignId: string,
  payload: PlanRoutesPayload,
  explicitOrganizationId?: string
): Promise<{
  input: PlanningInput;
  result: PlanningResult;
  draftPlanId: string;
}> {
  validateFieldPlanInput(payload);
  const organizationId =
    explicitOrganizationId ||
    getTenantContext()?.organizationId ||
    requireTenantContext().organizationId;

  return runWithTenantContext({ organizationId, userId: getTenantContext()?.userId, source: 'session' }, async () => {
    const { campaign, points, profile } = await loadElectionPlanningResources(
      campaignId,
      payload.date,
      organizationId
    );
    if (payload.selectedPointIds !== undefined) {
      if (!Array.isArray(payload.selectedPointIds) || !payload.selectedPointIds.length) {
        throw new Error('Nebyly vybrány žádné body k naplánování. Zvolte alespoň jeden bod v mapě nebo vyberte jiný typ výjezdu.');
      }
      if (payload.selectedPointIds.some((id) => typeof id !== 'string' || !points.some((p) => p.id === id))) {
        throw new Error('Výběr obsahuje nedostupnou práci nebo bod jiné akce.');
      }
    }

    const selectedPoints = payload.selectedPointIds?.length
      ? points.filter((p) => payload.selectedPointIds!.includes(p.id))
      : payload.filterMediaType && payload.filterMediaType !== 'ALL'
      ? points.filter((p) => {
          const op = p.operationType;
          if (payload.filterMediaType === 'BANNER_CHANGE') {
            return op === 'REPLACE_AD';
          }
          if (payload.filterMediaType === 'RELOCATION') {
            return op === 'RELOCATION';
          }
          if (payload.filterMediaType === 'WAREHOUSE') {
            return op === 'REMOVE_OBJECT';
          }
          if (op === 'REPLACE_AD') {
            return false;
          }
          return p.mediaType === payload.filterMediaType;
        })
      : points;

    if (selectedPoints.length === 0) {
      throw new Error('Kampaň neobsahuje žádné body vybraného média k naplánování.');
    }

    if (!payload.crews || payload.crews.length === 0) {
      throw new Error('Vyberte alespoň jednu pracovní posádku.');
    }

    // Apply vehicle capacity and warehouse unloading parameters
    profile.vehicleCapacitySlots = payload.vehicleCapacitySlots ?? DEFAULT_VEHICLE_CAPACITY_SLOTS;
    profile.routeMode = payload.routeMode ?? 'SEPARATE_MEDIA';
    profile.warehouseUnloadMinutes = payload.warehouseUnloadMinutes ?? DEFAULT_WAREHOUSE_UNLOAD_MINUTES;

    // Apply custom warehouse (depot) location if provided
    if (payload.depot) {
      profile.depot = { latitude: payload.depot.latitude, longitude: payload.depot.longitude };
      profile.endLocation = { latitude: payload.depot.latitude, longitude: payload.depot.longitude };

    }

    // Apply user-configured start time
    if (payload.startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.startTime)) {
      profile.workdayStart = payload.startTime;
    }

    // Apply user-configured end time
    if (payload.endTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(payload.endTime)) {
      profile.workdayEnd = payload.endTime;
    }

    // Flexible hours: allow overtime and expand max stops so points are never arbitrarily rejected
    if (payload.flexibleHours) {
      profile.flexibleHours = true;
      profile.overtimeMinutes = Math.max(profile.overtimeMinutes, 480);
      profile.maximumJobsPerRoute = Math.max(profile.maximumJobsPerRoute, 100);
      if (!payload.endTime) {
        profile.workdayEnd = '22:00';
      }
    }

    parseProfile(profile);
    if (payload.saveDepotAsDefault && payload.depot) {
      await plannerTransaction(async tx => {
        await tx.organizationFieldPlanningProfile.update({ where: { organizationId }, data: { configuration: profile as unknown as Prisma.InputJsonValue } });
        await tx.crmAuditLog.create({ data: { organizationId, entityType: 'OrganizationFieldPlanningProfile', entityId: organizationId,
          userId: getTenantContext()?.userId ?? 'system', userEmail: '', action: 'FIELD_DEPOT_UPDATED', detailsJson: JSON.stringify({ depot: profile.depot }) } });
      });
    }

    // Ensure start of planned route begins at configured start time in local timezone (never shifted by UTC offset)
    const planStartTime = payload.startTime || profile.workdayStart || '07:30';
    const startTimestamp = zonedTime(payload.date, planStartTime, profile.timezone);
    const planNow = new Date(startTimestamp).toISOString();

    // If parentPlanId is not explicitly specified, but selected points belong to an uncompleted plan of this campaign,
    // auto-adopt it as parentPlanId so the dispatcher can easily replan or reschedule it to a new date
    let effectiveParentPlanId = payload.parentPlanId;
    if (!effectiveParentPlanId) {
      const assignedPlanIds = Array.from(
        new Set(selectedPoints.map((p) => p.assignedFieldPlanId).filter(Boolean))
      ) as string[];

      if (assignedPlanIds.length === 1) {
        const candidatePlanId = assignedPlanIds[0];
        const existingPlan = await prisma.fieldPlan.findFirst({
          where: {
            id: candidatePlanId,
            organizationId,
            electionCampaignId: campaignId,
            status: { in: ['APPROVED', 'ACTIVE', 'DRAFT'] },
          },
        });
        if (existingPlan) {
          const startedCount = await prisma.fieldWorkStep.count({
            where: {
              organizationId,
              assignedFieldPlanId: candidatePlanId,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              OR: [{ status: 'ISSUE' }, { startedAt: { not: null } }, { completedQuantity: { gt: 0 } }, { kind: { in: ['DELIVERY', 'HANDOFF'] }, point: { steps: { some: { loadDelta: { gt: 0 }, completedQuantity: { gt: 0 } } } } }],
            },
          });
          if (startedCount === 0) {
            effectiveParentPlanId = candidatePlanId;
          }
        }
      }
    }

    const availability = await fieldAvailability(prisma, organizationId, payload.date, effectiveParentPlanId, profile.timezone);
    const planningJobs: PlanningJob[] = selectedPoints.map(pt => {
      const job = convertElectionPointToJob(pt, campaign);
      if (pt.assignedFieldPlanId && pt.assignedFieldPlanId !== effectiveParentPlanId) job.blockedReason = 'Práce již patří jinému výjezdu.';
      return job;
    });
    const planningInput: PlanningInput = {
      organizationId,
      date: payload.date,
      now: planNow,
      profile,
      jobs: planningJobs,
      employees: availability.employees,
      vehicles: availability.vehicles,
      crews: payload.crews,
    };

    const travel = googleTravelProvider(profile);
    const result = await planFieldWork(planningInput, travel);

    const draft = await persistFieldDraft(campaignId, planningInput, result, effectiveParentPlanId);
    return { input: planningInput, result, draftPlanId: draft.id };
  });
}

/**
 * Persists an approved election removal plan into FieldPlan and assigns all points.
 */
export async function approveAndSaveElectionPlan(
  campaignId: string,
  planningInput: PlanningInput,
  planningResult: PlanningResult,
  actor: { id: string; email: string; role: string },
  explicitOrganizationId?: string,
  draftId?: string
) {
  if (explicitOrganizationId && explicitOrganizationId !== requireTenantContext().organizationId) throw new Error('Cross-tenant reference rejected.');
  return approveFieldDraft(campaignId, planningInput, actor, draftId);
}
