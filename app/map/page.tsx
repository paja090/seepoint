import { AlertTriangle, MapPinned, Search } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { CarrierFilters } from '@/components/CarrierFilters';
import { MapView } from '@/components/MapView';
import { PageHeader, StatCard } from '@/components/ui';
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
      <PageHeader
        title="Mapa nosičů"
        description="Mapa načítá aktivní nosiče s GPS přes samostatný mapový dotaz. Filtry zůstávají server-side a metadata ukazují skutečný rozsah výsledku."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<MapPinned size={20} />} label="Zobrazeno na mapě" tone="green" value={meta.returned} description={`z ${meta.total} aktivních nosičů podle filtru`} />
        <StatCard icon={<Search size={20} />} label="Limit mapy" tone="blue" value={meta.limit} description="Výchozí limit mapy není 500." />
        <StatCard icon={<AlertTriangle size={20} />} label="Bez GPS" tone="purple" value={meta.missingGpsCount} description="Tyto nosiče nemají marker, dokud nedostanou polohu." />
        <StatCard label="Archivované" tone="zinc" value={meta.archivedCount} description="Archivované nosiče jsou mimo výchozí mapový dotaz." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <CarrierFilters action="/map" filters={filters} options={filterOptions} resultCount={meta.total} />
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            Mapa zobrazuje <strong>{meta.returned}</strong> z <strong>{meta.total}</strong> aktivních nosičů podle filtru.
            <div className="mt-2 text-slate-500">Bez GPS: {meta.missingGpsCount} · Archivovaných celkem: {meta.archivedCount} · Limit mapy: {meta.limit}</div>
            {meta.hasMore && <div className="mt-2 font-semibold text-amber-700">Výsledek je omezený, zpřesněte filtr nebo navyšte limit.</div>}
          </section>
        </aside>
        <section className="min-w-0">
          <MapView initialCarriers={orderedCarriers} />
        </section>
      </div>
    </AppShell>
  );
}
