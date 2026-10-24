import type { PlanningSource } from './contracts';
import { coordinates, dayInZone } from './profile';

export function planningStopHref(stop: PlanningSource & { workOrderId?: string; isWarehousePitstop?: boolean }): string | null {
  if (stop.isWarehousePitstop) return null;
  if (stop.electionCampaignId) return '/election-removal/' + encodeURIComponent(stop.electionCampaignId);
  if (stop.navigationOrderId) return '/navigation/orders/' + encodeURIComponent(stop.navigationOrderId);
  const orderId = stop.workOrderId || stop.parentWorkOrderId;
  return orderId ? '/work/' + encodeURIComponent(orderId) : null;
}

export function planningDayOffset(now: Date, timezone: string, offset: number): string {
  const day = dayInZone(now, timezone);
  // Calendar arithmetic after resolving the organization's day, independent of browser timezone/DST.
  return new Date(Date.parse(day + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
}

export function parseDepotInput(latitude: string, longitude: string) {
  if (!latitude.trim() || !longitude.trim()) return null;
  const depot = { latitude: Number(latitude.trim().replace(',', '.')), longitude: Number(longitude.trim().replace(',', '.')) };
  return coordinates(depot) ? depot : null;
}
