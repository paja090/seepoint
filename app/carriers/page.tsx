import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CarrierFilters } from '@/components/CarrierFilters';
import { StatusBadge } from '@/components/StatusBadge';
import { carrierTypeLabel, mediaTypeLabel, parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarrierFilterOptions, getCarriersPage } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Carriers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseCarrierFilters(await searchParams);
  const [{ carriers, meta }, filterOptions] = await Promise.all([getCarriersPage(filters), getCarrierFilterOptions()]);
  const nextParams = new URLSearchParams();
  Object.entries({ ...filters, page: String((meta.page ?? 1) + 1), pageSize: String(meta.pageSize) }).forEach(([key, rawValue]) => {
    const value = typeof rawValue === 'number' ? String(rawValue) : rawValue;
    if (value) nextParams.set(key, value);
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Reklamni nosice</h1>
          <p className="mt-1 text-sm text-slate-500">Filtry bezi nad databazi, seznam je strankovany.</p>
        </div>
        <Link className="rounded-xl bg-slate-950 px-4 py-2 text-white" href="/map">Pridat v mape</Link>
      </div>

      <CarrierFilters action="/carriers" filters={filters} options={filterOptions} resultCount={meta.total} />
      <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Zobrazeno <strong>{meta.returned}</strong> z <strong>{meta.total}</strong> nosicu.
        <span className="ml-3 text-slate-500">Stranka {meta.page}, limit {meta.limit}. Archivovanych: {meta.archivedCount}, bez GPS: {meta.missingGpsCount}.</span>
        {meta.hasMore && <Link className="ml-3 font-semibold text-sky-700 hover:underline" href={`/carriers?${nextParams.toString()}`}>Nacist dalsi stranku</Link>}
      </section>

      <div className="card overflow-x-auto">
        {carriers.length === 0 ? <p className="text-sm text-slate-500">Filtrum neodpovida zadny nosic.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr className="border-b"><th className="py-2 pr-3">Nosic</th><th className="py-2 pr-3">Typ</th><th className="py-2 pr-3">Media / klienti</th><th className="py-2 pr-3">Mesto</th><th className="py-2 pr-3">GPS</th><th className="py-2 pr-3">Stav</th></tr></thead>
            <tbody>{carriers.map((carrier) => {
              const clients = [...new Set(carrier.surfaces.map((surface) => surface.currentClient?.name).filter((name): name is string => Boolean(name)))];
              const mediaTypes = [...new Set(carrier.surfaces.map((surface) => mediaTypeLabel(surface.mediaType)))];
              return <tr className={`border-b last:border-0 ${carrier.archivedAt ? 'bg-slate-50 text-slate-500' : ''}`} key={carrier.id}>
                <td className="py-3 pr-3"><Link className="font-semibold text-slate-950 hover:underline" href={`/carriers/${carrier.id}`}>{carrier.name}</Link><br /><span className="text-slate-500">{carrier.code}</span>{carrier.archivedAt && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">Archiv</span>}</td>
                <td className="py-3 pr-3">{carrierTypeLabel(carrier.type)}</td>
                <td className="py-3 pr-3"><span>{mediaTypes.join(', ') || 'Bez ploch'}</span><br /><span className="text-slate-500">{clients.join(', ') || 'Klient neuveden'}</span></td>
                <td className="py-3 pr-3">{[carrier.city, carrier.locality ?? carrier.cadastralArea, carrier.street ?? carrier.address].filter(Boolean).join(' - ')}</td>
                <td className="py-3 pr-3">{carrier.latitude && carrier.longitude ? 'Ma GPS' : 'Bez GPS'}</td>
                <td className="py-3 pr-3"><StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} /></td>
              </tr>;
            })}</tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
