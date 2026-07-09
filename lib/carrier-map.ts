import type { Carrier } from './types';

export function carrierMapColor(carrier: Carrier) {
  if (carrier.archivedAt || carrier.status !== 'ACTIVE') return '#64748b';
  if (carrier.gpsStatus === 'MISSING' || !Number.isFinite(carrier.latitude) || !Number.isFinite(carrier.longitude)) return '#a855f7';
  if (carrier.surfaces.some((surface) => surface.status === 'OCCUPIED')) return '#ef4444';
  if (carrier.surfaces.some((surface) => surface.status === 'RESERVED')) return '#f97316';
  return '#22c55e';
}
