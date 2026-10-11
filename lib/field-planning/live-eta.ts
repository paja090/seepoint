import type { MyRouteStop } from './contracts';

export interface RouteLiveETAOptions {
  now?: Date;
  targetDate?: string;
}

export interface RouteLiveETAResult {
  stops: MyRouteStop[];
  liveEstimatedEndAt: string;
  totalDelayMinutes: number;
  hasStarted: boolean;
  isOngoingShift: boolean;
}

/**
 * Recalculates live ETAs for a route and all its stops dynamically
 * based on actual departure, completed stops, active in-progress stops,
 * and current progression of time.
 */
export function computeRouteLiveETA(
  route: {
    departureAt: string;
    endAt: string;
    tripStartedAt?: string | null;
    tripCompletedAt?: string | null;
    stops: MyRouteStop[];
  },
  options?: RouteLiveETAOptions
): RouteLiveETAResult {
  const now = options?.now ?? new Date();
  const plannedDeparture = new Date(route.departureAt);
  const plannedEnd = new Date(route.endAt);

  // If trip is completed, end time is already known and final
  if (route.tripCompletedAt) {
    const finalEnd = new Date(route.tripCompletedAt);
    const totalDelay = Math.round((finalEnd.getTime() - plannedEnd.getTime()) / 60000);
    const stopsWithETA = route.stops.map((s) => {
      const actStart = s.startedAt ? new Date(s.startedAt) : new Date(s.startAt);
      const actEnd = s.completedAt ? new Date(s.completedAt) : new Date(s.endAt);
      const delay = Math.round((actStart.getTime() - new Date(s.startAt).getTime()) / 60000);
      return {
        ...s,
        liveEstimatedStartAt: actStart.toISOString(),
        liveEstimatedEndAt: actEnd.toISOString(),
        delayMinutes: delay,
      };
    });
    return {
      stops: stopsWithETA,
      liveEstimatedEndAt: route.tripCompletedAt,
      totalDelayMinutes: totalDelay,
      hasStarted: true,
      isOngoingShift: false,
    };
  }

  // Check if any stop has been started or done
  const firstStartedStop = route.stops.find(
    (s) => s.startedAt || s.status === 'IN_PROGRESS' || s.status === 'DONE'
  );

  const hasStarted = Boolean(route.tripStartedAt || firstStartedStop);
  let actualDeparture: Date;

  if (route.tripStartedAt) {
    actualDeparture = new Date(route.tripStartedAt);
  } else if (firstStartedStop?.startedAt) {
    const travelToFirst = (firstStartedStop.travelMinutes ?? 0) * 60000;
    actualDeparture = new Date(new Date(firstStartedStop.startedAt).getTime() - travelToFirst);
  } else {
    // Has not started yet
    // If target date is today and current time has passed planned departure, the trip will start at 'now' at the earliest
    const isToday = !options?.targetDate || options.targetDate === now.toISOString().slice(0, 10);
    if (isToday && now.getTime() > plannedDeparture.getTime()) {
      actualDeparture = now;
    } else {
      actualDeparture = plannedDeparture;
    }
  }

  let cursor = new Date(actualDeparture);

  const updatedStops: MyRouteStop[] = route.stops.map((s) => {
    const plannedStart = new Date(s.startAt);
    const plannedEnd = new Date(s.endAt);
    const plannedDuration =
      s.serviceMinutes ??
      Math.max(5, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60000));
    const travelMins = s.travelMinutes ?? 0;

    let liveStart: Date;
    let liveEnd: Date;

    if (s.status === 'DONE') {
      liveStart = s.startedAt ? new Date(s.startedAt) : plannedStart;
      liveEnd = s.completedAt
        ? new Date(s.completedAt)
        : new Date(liveStart.getTime() + plannedDuration * 60000);
      cursor = liveEnd;
    } else if (s.status === 'IN_PROGRESS') {
      liveStart = s.startedAt ? new Date(s.startedAt) : now;
      const elapsedMins = Math.max(0, Math.round((now.getTime() - liveStart.getTime()) / 60000));
      const remainingMins = Math.max(5, plannedDuration - elapsedMins);
      liveEnd = new Date(now.getTime() + remainingMins * 60000);
      cursor = liveEnd;
    } else if (s.status === 'CANCELLED') {
      liveStart = cursor;
      liveEnd = cursor;
    } else {
      // PLANNED or ISSUE
      liveStart = new Date(cursor.getTime() + travelMins * 60000);
      liveEnd = new Date(liveStart.getTime() + plannedDuration * 60000);
      cursor = liveEnd;
    }

    const delayMinutes = Math.round((liveStart.getTime() - plannedStart.getTime()) / 60000);

    return {
      ...s,
      liveEstimatedStartAt: liveStart.toISOString(),
      liveEstimatedEndAt: liveEnd.toISOString(),
      delayMinutes,
    };
  });

  // Calculate return trip back to warehouse
  const lastPlannedStop = route.stops.length > 0 ? route.stops[route.stops.length - 1] : null;
  const returnDriveMins = lastPlannedStop
    ? Math.max(0, Math.round((plannedEnd.getTime() - new Date(lastPlannedStop.endAt).getTime()) / 60000))
    : 0;

  const estimatedShiftEnd = new Date(cursor.getTime() + returnDriveMins * 60000);
  const totalDelayMinutes = Math.round((estimatedShiftEnd.getTime() - plannedEnd.getTime()) / 60000);

  return {
    stops: updatedStops,
    liveEstimatedEndAt: estimatedShiftEnd.toISOString(),
    totalDelayMinutes,
    hasStarted,
    isOngoingShift: hasStarted && !route.tripCompletedAt,
  };
}

/**
 * Formats time from ISO string using target timezone (HH:mm)
 */
export function formatLiveClock(isoDate?: string | null, timezone = 'Europe/Prague'): string {
  if (!isoDate) return '—';
  try {
    return new Date(isoDate).toLocaleTimeString('cs-CZ', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
