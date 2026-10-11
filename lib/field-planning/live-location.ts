import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import type { LiveCrewLocation, PlannedCrew, PlanningResult } from './contracts';
import { getPlan, plannerTransaction } from './service';
import type { PlannerActor } from './service';

export interface LiveLocationInput {
  planId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

export function isValidLocationInput(input: unknown): input is LiveLocationInput {
  if (!input || typeof input !== 'object') return false;
  const i = input as Record<string, unknown>;
  if (typeof i.planId !== 'string' || !i.planId.trim()) return false;
  if (typeof i.latitude !== 'number' || !Number.isFinite(i.latitude) || i.latitude < -90 || i.latitude > 90) return false;
  if (typeof i.longitude !== 'number' || !Number.isFinite(i.longitude) || i.longitude < -180 || i.longitude > 180) return false;
  if (i.accuracy !== undefined && i.accuracy !== null && (typeof i.accuracy !== 'number' || !Number.isFinite(i.accuracy) || i.accuracy < 0)) return false;
  if (i.speed !== undefined && i.speed !== null && (typeof i.speed !== 'number' || !Number.isFinite(i.speed) || i.speed < 0)) return false;
  if (i.heading !== undefined && i.heading !== null && (typeof i.heading !== 'number' || !Number.isFinite(i.heading) || i.heading < 0 || i.heading > 360)) return false;
  return true;
}

export function isLocationRecent(updatedAt: string | Date, maxAgeMinutes = 15): boolean {
  const date = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const time = date.getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= maxAgeMinutes * 60 * 1000;
}

/**
 * Worker submits their live GPS coordinates while executing an approved route.
 * Coordinates are upserted into CrmAuditLog as a single persistent live-state record per crew.
 */
export async function recordCrewLocation(
  input: LiveLocationInput,
  actor: PlannerActor,
  db = prisma
): Promise<{ ok: boolean; crewId: string }> {
  if (!isValidLocationInput(input)) {
    throw new Error('Neplatné GPS souřadnice.');
  }

  return plannerTransaction(async (tx) => {
    const { organizationId } = requireTenantContext();
    const plan = await getPlan(input.planId, tx);
    const employee = await tx.employee.findFirst({
      where: { organizationId, userId: actor.id, isActive: true },
    });

    if (!employee) throw new Error('FORBIDDEN: profil montážníka nebyl nalezen.');
    if (!['APPROVED', 'ACTIVE', 'COMPLETED'].includes(plan.status)) {
      throw new Error('FORBIDDEN: trasa není ve schváleném stavu.');
    }

    const result = plan.planningSummary as unknown as PlanningResult;
    const crew = result.crews.find((c) => c.employeeIds.includes(employee.id));
    if (!crew) throw new Error('FORBIDDEN: nejste členem posádky této trasy.');

    const eventId = `fp-crew-loc-${plan.id}-${crew.id}`;
    const payload = {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      speed: input.speed ?? null,
      heading: input.heading ?? null,
      updatedAt: new Date().toISOString(),
      workerName: `${employee.firstName} ${employee.lastName}`.trim(),
    };

    const existing = await tx.crmAuditLog.findUnique({
      where: { id: eventId, organizationId },
    });

    if (existing) {
      await tx.crmAuditLog.update({
        where: { id: eventId, organizationId },
        data: {
          userId: actor.id,
          userEmail: actor.email,
          action: 'FIELD_CREW_LOCATION_PING',
          detailsJson: JSON.stringify(payload),
          createdAt: new Date(),
        },
      });
    } else {
      await tx.crmAuditLog.create({
        data: {
          id: eventId,
          organizationId,
          entityType: 'FieldCrewLocation',
          entityId: `${plan.id}-${crew.id}`,
          userId: actor.id,
          userEmail: actor.email,
          action: 'FIELD_CREW_LOCATION_PING',
          detailsJson: JSON.stringify(payload),
        },
      });
    }

    return { ok: true, crewId: crew.id };
  }, db);
}

/**
 * Loads current live locations for all crews in a specific plan.
 */
export async function loadPlanCrewLocations(
  planId: string,
  organizationId: string,
  db = prisma
): Promise<Record<string, LiveCrewLocation>> {
  const prefix = `${planId}-`;
  const logs = await db.crmAuditLog.findMany({
    where: {
      organizationId,
      entityType: 'FieldCrewLocation',
      entityId: { startsWith: prefix },
    },
    select: {
      entityId: true,
      detailsJson: true,
      createdAt: true,
    },
  });

  const locations: Record<string, LiveCrewLocation> = {};
  for (const log of logs) {
    const crewId = log.entityId.slice(prefix.length);
    if (!crewId || !log.detailsJson) continue;
    try {
      const parsed = JSON.parse(log.detailsJson);
      if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        const updatedAt = parsed.updatedAt || log.createdAt.toISOString();
        locations[crewId] = {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          accuracy: parsed.accuracy ?? null,
          speed: parsed.speed ?? null,
          heading: parsed.heading ?? null,
          updatedAt,
          isRecent: isLocationRecent(updatedAt, 15),
          workerName: parsed.workerName ?? null,
        };
      }
    } catch {
      // ignore parse error
    }
  }

  return locations;
}

/**
 * Enriches PlannedCrew array with live locations.
 */
export async function enrichCrewsWithLiveLocations(
  crews: PlannedCrew[],
  planId: string,
  organizationId: string,
  db = prisma
): Promise<PlannedCrew[]> {
  const locations = await loadPlanCrewLocations(planId, organizationId, db);
  return crews.map((c) => ({
    ...c,
    liveLocation: locations[c.id] ?? null,
  }));
}
