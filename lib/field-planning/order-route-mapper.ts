import type { PlannedCrew } from './contracts';

export type WorkOrderRouteInfo = {
  planId: string;
  planDate: string;
  planStatus: string;
  crewId: string;
  crewName: string;
  vehicleName: string | null;
  workerNames: string[];
  routeOrder: number;
  arrivalAt: string;
  startAt: string;
};

export type TodayCrewRouteSummary = {
  planId: string;
  planDate: string;
  planStatus: string;
  crewId: string;
  crewName: string;
  vehicleName: string | null;
  workerNames: string[];
  totalStops: number;
  completedStops: number;
  departureAt: string;
  endAt: string;
};

export type PlanForMapping = {
  id: string;
  date: string;
  status: string;
  version: number;
  planningSummary: unknown;
};

export type OrderForMapping = {
  id: string;
  status: string;
  planningConstraints?: unknown;
};

/**
 * Maps field plans to individual work orders and computes today's crew summaries.
 */
export function extractOrderRouteMap(
  plans: PlanForMapping[],
  orders: OrderForMapping[],
  todayDateStr: string = new Date().toISOString().slice(0, 10),
  completedPointIds?: Set<string>,
  completedNavPointIds?: Set<string>
): {
  orderRouteMap: Map<string, WorkOrderRouteInfo>;
  todayRoutes: TodayCrewRouteSummary[];
} {
  const orderRouteMap = new Map<string, WorkOrderRouteInfo>();
  const doneOrderIds = new Set(orders.filter((o) => o.status === 'DONE').map((o) => o.id));

  // Build pointId -> orderId map for tasks created from dispatch intake
  const pointToOrderMap = new Map<string, string>();
  for (const o of orders) {
    const pId = (o.planningConstraints as { electionRemovalPointId?: string } | null)?.electionRemovalPointId;
    if (pId) pointToOrderMap.set(pId, o.id);
  }

  // Process plans (they should be ordered by version desc or we sort them)
  const sortedPlans = [...plans].sort((a, b) => b.version - a.version);

  for (const plan of sortedPlans) {
    const summary = plan.planningSummary as { crews?: PlannedCrew[] } | null;
    if (!summary?.crews || !Array.isArray(summary.crews)) continue;

    for (const crew of summary.crews) {
      const crewName = crew.name || (crew.names?.length ? crew.names.join(', ') : 'Trasa');
      const stops = crew.stops || [];

      for (const stop of stops) {
        const directOrderId = (stop as { workOrderId?: string; parentWorkOrderId?: string }).workOrderId ||
          (stop as { workOrderId?: string; parentWorkOrderId?: string }).parentWorkOrderId;
        const pointId = (stop as { electionRemovalPointId?: string }).electionRemovalPointId;
        const orderId = directOrderId || (pointId ? pointToOrderMap.get(pointId) : undefined);

        if (!orderId || (stop as { isWarehousePitstop?: boolean }).isWarehousePitstop) continue;

        const existing = orderRouteMap.get(orderId);
        // Priority rule:
        // 1. APPROVED, ACTIVE, COMPLETED overrides DRAFT
        // 2. Newer date takes precedence
        // 3. If neither exists, insert
        const isHigherPriority =
          !existing ||
          (existing.planStatus === 'DRAFT' && plan.status !== 'DRAFT') ||
          (existing.planStatus === plan.status && plan.date > existing.planDate);

        if (isHigherPriority) {
          orderRouteMap.set(orderId, {
            planId: plan.id,
            planDate: plan.date,
            planStatus: plan.status,
            crewId: crew.id,
            crewName,
            vehicleName: crew.vehicleName || null,
            workerNames: crew.names || [],
            routeOrder: stop.routeOrder ?? 1,
            arrivalAt: stop.arrivalAt || '',
            startAt: stop.startAt || '',
          });
        }
      }
    }
  }

  // Calculate today's crew summaries
  const todayPlans = sortedPlans.filter(
    (p) => p.date === todayDateStr && ['APPROVED', 'ACTIVE', 'COMPLETED', 'DRAFT'].includes(p.status)
  );

  const todayRoutes: TodayCrewRouteSummary[] = [];

  for (const plan of todayPlans) {
    const summary = plan.planningSummary as { crews?: PlannedCrew[] } | null;
    if (!summary?.crews || !Array.isArray(summary.crews)) continue;

    const isPlanCompleted = plan.status === 'COMPLETED';

    for (const crew of summary.crews) {
      const crewName = crew.name || (crew.names?.length ? crew.names.join(', ') : 'Trasa');
      const validStops = (crew.stops || []).filter(
        (s) => !(s as { isWarehousePitstop?: boolean }).isWarehousePitstop
      );

      if (validStops.length === 0) continue;

      const completedCount = isPlanCompleted
        ? validStops.length
        : validStops.filter((s) => {
            const oid =
              (s as { workOrderId?: string; parentWorkOrderId?: string }).workOrderId ||
              (s as { workOrderId?: string; parentWorkOrderId?: string }).parentWorkOrderId;
            const pId = (s as { electionRemovalPointId?: string }).electionRemovalPointId;
            const mappedOid = pId ? pointToOrderMap.get(pId) : undefined;
            if (oid && doneOrderIds.has(oid)) return true;
            if (mappedOid && doneOrderIds.has(mappedOid)) return true;
            if (pId && completedPointIds?.has(pId)) return true;
            const navId = (s as { navigationPointId?: string }).navigationPointId;
            if (navId && completedNavPointIds?.has(navId)) return true;
            return false;
          }).length;

      todayRoutes.push({
        planId: plan.id,
        planDate: plan.date,
        planStatus: plan.status,
        crewId: crew.id,
        crewName,
        vehicleName: crew.vehicleName || null,
        workerNames: crew.names || [],
        totalStops: validStops.length,
        completedStops: completedCount,
        departureAt: crew.departureAt || '',
        endAt: crew.endAt || '',
      });
    }
  }

  return { orderRouteMap, todayRoutes };
}
