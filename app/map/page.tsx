import { AppShell } from '@/components/AppShell';
import { CarrierFilters } from '@/components/CarrierFilters';
import { MapView } from '@/components/MapView';
import { parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarrierFilterOptions, getMapCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = parseCarrierFilters(params);
  const selectedCarrierId = Array.isArray(params.carrier) ? params.carrier[0] : params.carrier;
  const [{ carriers, meta }, filterOptions] = await Promise.all([getMapCarriers(filters), getCarrierFilterOptions()]);
  const selectedIndex = selectedCarrierId ? carriers.findIndex((carrier) => carrier.id === selectedCarrierId) : -1;
  const orderedCarriers = selectedIndex > 0 ? [carriers[selectedIndex], ...carriers.slice(0, selectedIndex), ...carriers.slice(selectedIndex + 1)] : carriers;

  return (
    <AppShell>
      <CarrierFilters action="/map" filters={filters} options={filterOptions} resultCount={meta.total} />
      <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Mapa zobrazuje <strong>{meta.returned}</strong> z <strong>{meta.total}</strong> aktivnich nosicu podle filtru.
        <span className="ml-3 text-slate-500">Bez GPS: {meta.missingGpsCount}, archivovanych celkem: {meta.archivedCount}, limit mapy: {meta.limit}.</span>
        {meta.hasMore && <span className="ml-3 font-semibold text-amber-700">Vysledek je omezeny, zpresnete filtr nebo zvyste limit.</span>}
      </section>
      <MapView initialCarriers={orderedCarriers} />
    </AppShell>
  );
}
