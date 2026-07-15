import type { OfferSurfaceOption } from './view-model';

export type SurfaceAvailabilityFilter = 'all' | 'available' | 'warning' | 'blocked';
export type SurfaceConflictSeverity = 'block' | 'warning';
export type SurfaceFilters = {
  query: string;
  mediaType: string;
  status: string;
  availability: SurfaceAvailabilityFilter;
  gpsOnly: boolean;
};

export function filterOfferSurfaces(
  surfaces: OfferSurfaceOption[],
  filters: SurfaceFilters,
  conflictMap: ReadonlyMap<string, SurfaceConflictSeverity>,
) {
  const needle = filters.query.trim().toLocaleLowerCase('cs');
  return surfaces.filter((surface) => {
    const conflict = conflictMap.get(surface.id);
    const searchText = [
      surface.carrier.code,
      surface.carrier.name,
      surface.name,
      surface.carrier.city,
      surface.carrier.locality,
      surface.carrier.street,
      surface.carrier.address,
      surface.carrier.description,
    ].filter(Boolean).join(' ').toLocaleLowerCase('cs');
    if (needle && !searchText.includes(needle)) return false;
    if (filters.mediaType && surface.mediaType !== filters.mediaType) return false;
    if (filters.status && surface.status !== filters.status) return false;
    if (filters.gpsOnly && (surface.carrier.latitude == null || surface.carrier.longitude == null)) return false;
    if (filters.availability === 'blocked' && conflict !== 'block') return false;
    if (filters.availability === 'warning' && conflict !== 'warning') return false;
    if (filters.availability === 'available' && conflict) return false;
    return true;
  });
}

export function paginateOfferSurfaces(surfaces: OfferSurfaceOption[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(surfaces.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  return {
    currentPage,
    pageCount,
    rows: surfaces.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}
