import type { ElectionCampaign, ElectionRemovalPoint, Prisma } from '@prisma/client';
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
  type PlanningProfile,
  type CrewInput,
  type PlanningResult,
} from '@/lib/field-planning/contracts';
import { loadProfile } from '@/lib/field-planning/data';
import { planFieldWork } from '@/lib/field-planning/planning-engine';
import { googleTravelProvider } from '@/lib/field-planning/travel';
import {
  DEFAULT_MEDIA_SERVICE_MINUTES,
  DEFAULT_BANNER_CHANGE_SERVICE_MINUTES,
  DEFAULT_RELOCATION_SERVICE_MINUTES,
  calculateServiceMinutes,
  calculateMediaLoadSlots,
  DEFAULT_VEHICLE_CAPACITY_SLOTS,
  DEFAULT_WAREHOUSE_UNLOAD_MINUTES,
} from './constants';
import { detectOperationTypeFromText } from './kml-parser';
import { plannerTransaction } from '@/lib/field-planning/service';
import { zonedTime } from '@/lib/field-planning/profile';

/**
 * Transforms an ElectionRemovalPoint record into a PlanningJob for the routing engine.
 *
 * CRITICAL RULE:
 * Each physical removal medium is a distinct job with its own ID and service minutes.
 * Even if 2 points share the exact same GPS, they remain distinct individual jobs.
 */
export function convertElectionPointToJob(
  point: ElectionRemovalPoint,
  campaign: { id: string; name: string; targetDate: Date | null; createdAt: Date }
): PlanningJob {
  const rawText = `${point.layerName || ''} ${point.mediaTypeRaw || ''} ${point.description || ''}`;
  const operationType = detectOperationTypeFromText(rawText);

  const calculated = calculateServiceMinutes(point.mediaType, point.quantity, null, operationType);
  const serviceMinutes = point.serviceMinutes ?? calculated.baseMinutes;
  const loadSlots = calculateMediaLoadSlots(point.mediaType, operationType, point.quantity);

  return {
    id: electionRemovalJobId(point.id),
    sourceType: 'ELECTION_REMOVAL_POINT',
    sourceId: point.id,
    organizationId: point.organizationId,
    title: `${point.label} (${point.layerName || point.mediaType})`,
    workType: 'ELECTION_REMOVAL',
    priority: 'NORMAL',
    status:
      point.status === 'COMPLETED'
        ? 'DONE'
        : point.status === 'CANCELLED'
        ? 'CANCELLED'
        : 'PLANNED',
    scheduledAt: (campaign.targetDate ?? campaign.createdAt).toISOString(),
    campaignDateFrom: (campaign.targetDate ?? campaign.createdAt).toISOString(),
    location: {
      latitude: point.latitude,
      longitude: point.longitude,
    },
    serviceMinutes,
    constraints: {},
    blockedReason:
      point.status === 'ISSUE'
        ? point.issueNote || 'Hlášen problém na stanovišti'
        : undefined,
    updatedAt: point.updatedAt.toISOString(),
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

  return runWithTenantContext({ organizationId, source: 'session' }, async () => {
    const [campaign, employees, vehicles, profile] = await Promise.all([
      prisma.electionCampaign.findFirst({
        where: { id: campaignId, organizationId },
        include: {
          points: {
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

    // Provide fallback profile if organization depot profile is not configured yet
    const effectiveProfile: PlanningProfile = profile ?? {
      timezone: 'Europe/Prague',
      country: 'CZ',
      depot: { latitude: 50.08804, longitude: 14.42076 }, // Praha centrum výchozí
      endLocation: { latitude: 50.08804, longitude: 14.42076 },
      workdayStart: '07:30',
      workdayEnd: '16:00',
      breakMinutes: 30,
      overtimeMinutes: 60,
      strategy: 'BALANCED',
      serviceMinutes: {
        ELECTION_REMOVAL: 10,
      },
      fallbackSpeedKph: 50,
      fallbackDistanceFactor: 1.3,
      maximumJobsPerRoute: 50,
      vehicleRequired: false,
      requireHumanApproval: true,
      enabled: true,
    };

    return {
      campaign,
      points: campaign.points,
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        role: e.role,
        position: e.position,
      })),
      vehicles: vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        registrationNumber: v.registrationNumber,
      })),
      profile: effectiveProfile,
    };
  });
}

export interface PlanRoutesPayload {
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
}> {
  const organizationId =
    explicitOrganizationId ||
    getTenantContext()?.organizationId ||
    requireTenantContext().organizationId;

  return runWithTenantContext({ organizationId, source: 'session' }, async () => {
    const { campaign, points, profile } = await loadElectionPlanningResources(
      campaignId,
      payload.date,
      organizationId
    );

    const selectedPoints = payload.selectedPointIds?.length
      ? points.filter((p) => payload.selectedPointIds!.includes(p.id))
      : payload.filterMediaType && payload.filterMediaType !== 'ALL'
      ? points.filter((p) => {
          const rawText = `${p.layerName || ''} ${p.label || ''} ${p.description || ''}`;
          const op = detectOperationTypeFromText(rawText);
          if (payload.filterMediaType === 'BANNER_CHANGE') {
            return op === 'BANNER_CHANGE';
          }
          if (payload.filterMediaType === 'RELOCATION') {
            return op === 'RELOCATION';
          }
          if (payload.filterMediaType === 'WAREHOUSE') {
            return op === 'FULL_REMOVAL';
          }
          if (op === 'BANNER_CHANGE') {
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
    profile.warehouseUnloadMinutes = payload.warehouseUnloadMinutes ?? DEFAULT_WAREHOUSE_UNLOAD_MINUTES;

    // Apply custom warehouse (depot) location if provided
    if (
      payload.depot &&
      typeof payload.depot.latitude === 'number' &&
      typeof payload.depot.longitude === 'number' &&
      !Number.isNaN(payload.depot.latitude) &&
      !Number.isNaN(payload.depot.longitude) &&
      payload.depot.latitude !== 0 &&
      payload.depot.longitude !== 0
    ) {
      profile.depot = { latitude: payload.depot.latitude, longitude: payload.depot.longitude };
      profile.endLocation = { latitude: payload.depot.latitude, longitude: payload.depot.longitude };

      if (payload.saveDepotAsDefault) {
        try {
          await prisma.organizationFieldPlanningProfile.upsert({
            where: { organizationId },
            create: {
              organizationId,
              configuration: profile as unknown as Prisma.InputJsonValue,
            },
            update: {
              configuration: profile as unknown as Prisma.InputJsonValue,
            },
          });
        } catch (saveDepotErr) {
          console.warn('Nepodařilo se uložit výchozí depo organizace:', saveDepotErr);
        }
      }
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

    // Ensure start of planned route begins at configured start time in local timezone (never shifted by UTC offset)
    const planStartTime = payload.startTime || profile.workdayStart || '07:30';
    const startTimestamp = zonedTime(payload.date, planStartTime, profile.timezone);
    const planNow = new Date(startTimestamp).toISOString();

    // Load all employees and vehicles in full format for the engine
    const [allEmployees, allVehicles] = await Promise.all([
      prisma.employee.findMany({ where: { organizationId, isActive: true } }),
      prisma.vehicle.findMany({ where: { organizationId } }),
    ]);

    const planningJobs: PlanningJob[] = selectedPoints.map((pt) =>
      convertElectionPointToJob(pt, campaign)
    );

    const planningEmployees = allEmployees.map((e) => ({
      id: e.id,
      organizationId,
      name: `${e.firstName} ${e.lastName}`.trim(),
      userId: e.userId,
      isActive: e.isActive,
      positions: e.position ? [e.position] : [],
      roles: [e.role],
      available: true,
    }));

    const planningVehicles = allVehicles.map((v) => ({
      id: v.id,
      organizationId,
      name: v.name,
      status: v.status,
      reserved: false,
    }));

    const planningInput: PlanningInput = {
      organizationId,
      date: payload.date,
      now: planNow,
      profile,
      jobs: planningJobs,
      employees: planningEmployees,
      vehicles: planningVehicles,
      crews: payload.crews,
    };

    const travel = googleTravelProvider(profile);
    const result = await planFieldWork(planningInput, travel);

    return {
      input: planningInput,
      result,
    };
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
  const organizationId =
    explicitOrganizationId ||
    getTenantContext()?.organizationId ||
    requireTenantContext().organizationId;

  return runWithTenantContext(
    { organizationId, userId: actor.id, source: 'session' },
    () =>
      plannerTransaction(async (tx) => {
    // Generate latest version
    const latest = await tx.fieldPlan.findFirst({
      where: { organizationId, date: planningInput.date },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;
    const requestKey = `election-${campaignId}-${planningInput.date}-v${version}`;

    // Create the FieldPlan
    const fieldPlan = await tx.fieldPlan.create({
      data: {
        organizationId,
        date: planningInput.date,
        version,
        requestKey,
        requestHash: `el-${Date.now()}`,
        status: 'APPROVED',
        electionCampaignId: campaignId,
        createdByUserId: actor.id,
        approvedByUserId: actor.id,
        approvedAt: new Date(),
        planningInputSnapshot: JSON.parse(JSON.stringify(planningInput)),
        planningSummary: JSON.parse(JSON.stringify(planningResult)),
      },
    });

    // Update assigned points
    for (const crew of planningResult.crews) {
      for (const stop of crew.stops) {
        if (stop.electionRemovalPointId) {
          await tx.electionRemovalPoint.update({
            where: { id: stop.electionRemovalPointId, organizationId },
            data: {
              assignedFieldPlanId: fieldPlan.id,
              assignedCrewId: crew.id,
              plannedArrivalAt: new Date(stop.arrivalAt),
              plannedOrder: stop.routeOrder,
              status: 'ASSIGNED',
            },
          });
        }
      }
    }

    // Update election campaign status to PLANNED
    await tx.electionCampaign.update({
      where: { id: campaignId, organizationId },
      data: { status: 'PLANNED' },
    });

    return fieldPlan;
  }));
}
