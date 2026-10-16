import Link from 'next/link';
import { AlertTriangle, MapPin, MapPinned, Search } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { CarrierFilters } from '@/components/CarrierFilters';
import { MapView } from '@/components/MapView';
import { PageHeader, StatCard } from '@/components/ui';
import { parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarrier, getCarrierFilterOptions, getMapCarriers } from '@/lib/db';
import { getActiveCarrierTypes } from '@/lib/carrier-type-catalog';

export const dynamic = 'force-dynamic';

export default async function MapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageAccess('map');
  const canEdit = user.role === 'ADMIN' || user.role === 'MANAGER';
  const params = await searchParams;
  const filters = parseCarrierFilters(params);
  const selectedCarrierId = Array.isArray(params.carrier) ? params.carrier[0] : params.carrier;
  const [{ carriers, meta }, filterOptions, carrierTypes] = await Promise.all([
    getMapCarriers(filters),
    getCarrierFilterOptions(),
    getActiveCarrierTypes(),
  ]);

  let isolatedCarrier = selectedCarrierId ? carriers.find((c) => c.id === selectedCarrierId) : undefined;
  if (selectedCarrierId && !isolatedCarrier) {
    isolatedCarrier = await getCarrier(selectedCarrierId);
  }

  const isSingleCarrierIsolated = Boolean(selectedCarrierId && isolatedCarrier);
  const displayCarriers = isSingleCarrierIsolated && isolatedCarrier ? [isolatedCarrier] : carriers;

  const displayMeta = isSingleCarrierIsolated && isolatedCarrier
    ? {
        total: 1,
        returned: 1,
        limit: 1,
        page: 1,
        pageSize: 1,
        hasMore: false,
        missingGpsCount: isolatedCarrier.latitude && isolatedCarrier.longitude ? 0 : 1,
        archivedCount: isolatedCarrier.archivedAt ? 1 : 0,
      }
    : meta;

  return (
    <AppShell>
      <PageHeader
        title="Mapa nosičů"
        description="Prohlížejte reklamní nosiče své firmy podle polohy, klienta a obsazenosti."
      />

      {isSingleCarrierIsolated && isolatedCarrier && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-sky-300 bg-sky-50/90 p-4 text-sky-950 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-xs">
              <MapPin size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-sky-700">Vyfiltrovaná pozice</span>
                <span className="rounded bg-sky-200/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-900">
                  {isolatedCarrier.code}
                </span>
                {isolatedCarrier.structureCode && (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-800">
                    Sloup #{isolatedCarrier.structureCode}
                  </span>
                )}
              </div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isolatedCarrier.name}
              </h2>
              <p className="text-xs text-slate-600">
                {[isolatedCarrier.city, isolatedCarrier.address || isolatedCarrier.street].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <Link
            href="/map"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-100 hover:text-slate-950 transition"
          >
            <span>✕</span> Zobrazit všechny nosiče na mapě
          </Link>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<MapPinned size={20} />} label="Zobrazeno na mapě" tone="green" value={displayMeta.returned} description={isSingleCarrierIsolated ? 'Vybrán konkrétní nosič' : `z ${displayMeta.total} aktivních nosičů podle filtru`} />
        <StatCard icon={<Search size={20} />} label="Limit mapy" tone="blue" value={displayMeta.limit} description={isSingleCarrierIsolated ? 'Zobrazení pouze vybrané pozice' : 'Maximální počet současně zobrazených nosičů.'} />
        <StatCard icon={<AlertTriangle size={20} />} label="Bez GPS" tone="purple" value={displayMeta.missingGpsCount} description="Pro zobrazení na mapě doplňte polohu nosiče." />
        <StatCard label="Archivované" tone="zinc" value={displayMeta.archivedCount} description="Archivované nosiče zobrazíte změnou filtru Archiv." />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="2xl:sticky 2xl:top-24 2xl:self-start">
          <CarrierFilters action="/map" filters={filters} options={filterOptions} carrierTypes={carrierTypes} resultCount={displayMeta.total} />
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {isSingleCarrierIsolated && isolatedCarrier ? (
              <div>
                Mapa zobrazuje pouze vybraný nosič <strong>{isolatedCarrier.code}</strong>.
                <div className="mt-2">
                  <Link href="/map" className="font-bold text-sky-700 hover:underline">
                    ← Zobrazit všechny nosiče na mapě
                  </Link>
                </div>
              </div>
            ) : (
              <>
                Mapa zobrazuje <strong>{displayMeta.returned}</strong> z <strong>{displayMeta.total}</strong> aktivních nosičů podle filtru.
                <div className="mt-2 text-slate-500">Bez GPS: {displayMeta.missingGpsCount} · Archivovaných celkem: {displayMeta.archivedCount} · Limit mapy: {displayMeta.limit}</div>
                {displayMeta.hasMore && <div className="mt-2 font-semibold text-amber-700">Výsledek je omezený, zpřesněte filtr nebo navyšte limit.</div>}
              </>
            )}
          </section>
        </aside>
        <section className="min-w-0">
          <MapView initialCarriers={displayCarriers} canEdit={canEdit} carrierTypes={carrierTypes} />
        </section>
      </div>
    </AppShell>
  );
}
