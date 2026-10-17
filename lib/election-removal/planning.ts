import type { ElectionRemovalPoint, FieldWorkStep, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getTenantContext,
  requireTenantContext,
  runWithTenantContext,
} from '@/lib/tenant-context';
import {
  electionRemovalJobId,
  type PlanningJob,
  type PlanningInput,
  type PlanningResult,
} from '@/lib/field-planning/contracts';
import { loadProfile } from '@/lib/field-planning/data';
import { planFieldWork } from '@/lib/field-planning/planning-engine';
import { googleTravelProvider } from '@/lib/field-planning/travel';
import {
  calculateServiceMinutes,
  calculateMediaLoadSlots,
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
export function convertElectionPointToJob(
  point: ElectionRemovalPoint & { steps?: FieldWorkStep[] },
  campaign: { id: string; name: string; targetDate: Date | null; createdAt: Date }
): PlanningJob {
  const operationType = point.operationType ?? 'OTHER';
  const legacyOperation = operationType === 'REPLACE_AD' || operationType === 'REMOVE_AD' || operationType === 'INSTALL_AD' ? 'BANNER_CHANGE' : operationType === 'RELOCATION' ? 'RELOCATION' : operationType === 'OTHER' ? 'OTHER' : 'FULL_REMOVAL';
  const steps = point.steps?.filter(s => s.status !== 'COMPLETED').sort((a, b) => a.sequence - b.sequence) ?? [];
  const first = steps[0];
  const delivery = steps[1];

  const calculated = calculateServiceMinutes(point.mediaType, point.quantity, null, legacyOperation);
  const serviceMinutes = first?.serviceMinutes ?? point.serviceMinutes ?? calculated.totalMinutes;
  const loadSlots = first ? Math.max(0, first.loadDelta) : calculateMediaLoadSlots(point.mediaType, legacyOperation, point.quantity);

  return {
    id: first ? `field-step:${first.id}` : electionRemovalJobId(point.id),
    fieldWorkStepId: first?.id,
    delivery: delivery ? { id: delivery.id, title: delivery.label, location: { latitude: delivery.latitude, longitude: delivery.longitude }, serviceMinutes: delivery.serviceMinutes } : undefined,
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: point.id,
    organizationId: point.organizationId,
    title: first?.label ?? `${point.label} (${point.layerName || point.mediaType})`,
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status:
      point.status === 'COMPLETED'
        ? 'DONE'
        : point.status === 'CANCELLED'
        ? 'CANCELLED'
        : 'PLANNED',
    scheduledAt: (campaign.targetDate ?? campaign.createdAt).toISOString(),
    deadlineAt: point.deadlineAt?.toISOString(),
    campaignDateFrom: (campaign.targetDate ?? campaign.createdAt).toISOString(),
    location: {
      latitude: first?.latitude ?? point.latitude,
      longitude: first?.longitude ?? point.longitude,
    },
    serviceMinutes,
    constraints: { windowStart: point.windowStart?.toISOString(), windowEnd: point.windowEnd?.toISOString(), requiredWorkers: point.requiredWorkers, requiredPositions: point.requiredPositions, requiredEquipment: point.requiredEquipment, vehicleRequired: loadSlots > 0 },
    blockedReason:
      point.reviewRequired || !first ? 'Vyžaduje kontrolu: doplňte strukturované zadání a kroky.' : point.startedAt && first.kind !== 'HANDOFF' ? 'Zahájenou práci nelze přeplánovat bez explicitního předání.' : point.status === 'ISSUE'
        ? point.issueNote || 'Hlášen problém na stanovišti'
        : undefined,
    updatedAt: point.updatedAt.toISOString() + steps.map(s => '/' + s.updatedAt.toISOString()).join(''),
    electionCampaignId: campaign.id,
    electionRemovalPointId: point.id,
    mediaType: point.mediaType,
    quantity: point.quantity,
    operationType,
    loadSlots,
  };
}

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
    const [campaign, employees, vehicles, profile] = await Promise.all([
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

    const availability = await fieldAvailability(prisma, organizationId, payload.date, payload.parentPlanId, profile.timezone);
    const planningJobs: PlanningJob[] = selectedPoints.map(pt => {
      const job = convertElectionPointToJob(pt, campaign);
      if (pt.assignedFieldPlanId && pt.assignedFieldPlanId !== payload.parentPlanId) job.blockedReason = 'Práce již patří jinému výjezdu.';
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

    const draft = await persistFieldDraft(campaignId, planningInput, result, payload.parentPlanId);
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
  explicitOrganizationId?: string
) {
  if (explicitOrganizationId && explicitOrganizationId !== requireTenantContext().organizationId) throw new Error('Cross-tenant reference rejected.');
  return approveFieldDraft(campaignId, planningInput, actor);
}
