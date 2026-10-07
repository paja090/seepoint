import type { ElectionCampaign, ElectionRemovalPoint, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
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
import { DEFAULT_MEDIA_SERVICE_MINUTES } from './constants';
import { plannerTransaction } from '@/lib/field-planning/service';

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
  const serviceMinutes =
    point.serviceMinutes ??
    DEFAULT_MEDIA_SERVICE_MINUTES[point.mediaType] ??
    10;

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
  };
}

/**
 * Loads campaign details, pending points, active workers, and vehicles for route planning.
 */
export async function loadElectionPlanningResources(
  campaignId: string,
  targetDateStr?: string
) {
  const { organizationId } = requireTenantContext();

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
}

export interface PlanRoutesPayload {
  date: string;
  startTime?: string;
  crews: Array<{
    id: string;
    employeeIds: string[];
    vehicleId: string | null;
  }>;
  selectedPointIds?: string[];
}

/**
 * Optimizes and plans election removal routes using the core routing engine.
 */
export async function optimizeElectionRemovalRoutes(
  campaignId: string,
  payload: PlanRoutesPayload
): Promise<{
  input: PlanningInput;
  result: PlanningResult;
}> {
  const { organizationId } = requireTenantContext();
  const { campaign, points, profile } = await loadElectionPlanningResources(
    campaignId,
    payload.date
  );

  const selectedPoints = payload.selectedPointIds?.length
    ? points.filter((p) => payload.selectedPointIds!.includes(p.id))
    : points;

  if (selectedPoints.length === 0) {
    throw new Error('Kampaň neobsahuje žádné body k naplánování.');
  }

  if (!payload.crews || payload.crews.length === 0) {
    throw new Error('Vyberte alespoň jednu pracovní posádku.');
  }

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
    now: new Date().toISOString(),
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
}

/**
 * Persists an approved election removal plan into FieldPlan and assigns all points.
 */
export async function approveAndSaveElectionPlan(
  campaignId: string,
  planningInput: PlanningInput,
  planningResult: PlanningResult,
  actor: { id: string; email: string; role: string }
) {
  const { organizationId } = requireTenantContext();

  return plannerTransaction(async (tx) => {
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
  });
}
