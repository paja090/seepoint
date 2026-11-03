import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import type { PlanningResult, ScheduledRouteDay } from './contracts';

function shiftIsoDate(date: string, deltaDays: number): string {
  const base = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(base)) return date;
  return new Date(base + deltaDays * 86400000).toISOString().slice(0, 10);
}

export async function loadScheduledRouteDays(
  options: {
    aroundDate: string;
    fieldEnabled?: boolean;
    navigationEnabled?: boolean;
    employeeId?: string | null;
    includeDrafts?: boolean;
    daysBack?: number;
    daysForward?: number;
  },
  db: Prisma.TransactionClient = prisma
): Promise<ScheduledRouteDay[]> {
  if (!db?.fieldPlan?.findMany) return [];
  const { organizationId } = requireTenantContext();
  const fromDate = shiftIsoDate(options.aroundDate, -(options.daysBack ?? 14));
  const toDate = shiftIsoDate(options.aroundDate, options.daysForward ?? 60);
  const statuses: Array<'DRAFT' | 'APPROVED' | 'ACTIVE'> =
    options.includeDrafts === false ? ['APPROVED', 'ACTIVE'] : ['DRAFT', 'APPROVED', 'ACTIVE'];

  const rows = await db.fieldPlan.findMany({
    where: {
      organizationId,
      date: { gte: fromDate, lte: toDate },
      status: { in: statuses },
      ...(options.fieldEnabled === false ? { electionCampaignId: null } : {}),
    },
    select: {
      id: true,
      date: true,
      status: true,
      electionCampaignId: true,
      planningSummary: true,
    },
    orderBy: [{ date: 'asc' }, { version: 'desc' }],
    take: 250,
  });

  const byDate = new Map<
    string,
    {
      date: string;
      planCount: number;
      crewCount: number;
      stopCount: number;
      hasApproved: boolean;
      hasActive: boolean;
      hasDraft: boolean;
      crewNames: Set<string>;
      clientNames: Set<string>;
    }
  >();

  for (const row of rows) {
    const summary = row.planningSummary as unknown as Partial<PlanningResult> | null;
    const rawCrews = summary?.crews ?? [];

    if (
      options.fieldEnabled === false &&
      rawCrews.some(c => (c.stops ?? []).some(s => Boolean(s.electionRemovalPointId || s.fieldWorkStepId)))
    ) {
      continue;
    }
    if (
      options.navigationEnabled === false &&
      rawCrews.some(c => (c.stops ?? []).some(s => Boolean(s.navigationPointId)))
    ) {
      continue;
    }

    const matchingCrews = rawCrews.filter(c => {
      const realStops = (c.stops ?? []).filter(s => !s.isWarehousePitstop);
      if (realStops.length === 0) return false;
      if (options.employeeId) {
        return Array.isArray(c.employeeIds) && c.employeeIds.includes(options.employeeId);
      }
      return true;
    });

    if (matchingCrews.length === 0) continue;

    let entry = byDate.get(row.date);
    if (!entry) {
      entry = {
        date: row.date,
        planCount: 0,
        crewCount: 0,
        stopCount: 0,
        hasApproved: false,
        hasActive: false,
        hasDraft: false,
        crewNames: new Set<string>(),
        clientNames: new Set<string>(),
      };
      byDate.set(row.date, entry);
    }

    entry.planCount += 1;
    entry.crewCount += matchingCrews.length;
    if (row.status === 'APPROVED') entry.hasApproved = true;
    if (row.status === 'ACTIVE') entry.hasActive = true;
    if (row.status === 'DRAFT') entry.hasDraft = true;

    for (const crew of matchingCrews) {
      const realStops = (crew.stops ?? []).filter(s => !s.isWarehousePitstop);
      entry.stopCount += realStops.length;
      const label = crew.name?.trim() || (Array.isArray(crew.names) && crew.names.length > 0 ? crew.names.join(', ') : '');
      if (label && entry.crewNames.size < 4) entry.crewNames.add(label);
      for (const stop of realStops) {
        if (stop.clientName && entry.clientNames.size < 4) {
          entry.clientNames.add(stop.clientName);
        }
      }
    }
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      date: item.date,
      planCount: item.planCount,
      crewCount: item.crewCount,
      stopCount: item.stopCount,
      hasApproved: item.hasApproved,
      hasActive: item.hasActive,
      hasDraft: item.hasDraft,
      crewNames: [...item.crewNames],
      clientNames: [...item.clientNames],
    }));
}
