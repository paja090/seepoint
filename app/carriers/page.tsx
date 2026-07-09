import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CarrierFilters } from '@/components/CarrierFilters';
import { StatusBadge } from '@/components/StatusBadge';
import { carrierTypeLabel, mediaTypeLabel, parseCarrierFilters } from '@/lib/carrier-filters';
import { getCarrierFilterOptions, getCarriers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Carriers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCarrierFilters(await searchParams);
  const [carriers, filterOptions] = await Promise.all([
    getCarriers(filters),
    getCarrierFilterOptions(),
  ]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Reklamní nosiče</h1>
          <p className="mt-1 text-sm text-slate-500">Seznam používá stejná databázová data jako mapa a detail nosiče.</p>
        </div>
        <Link className="rounded-xl bg-slate-950 px-4 py-2 text-white" href="/map">Přidat v mapě</Link>
      </div>

      <CarrierFilters action="/carriers" filters={filters} options={filterOptions} resultCount={carriers.length} />

      <div className="card overflow-x-auto">
        {carriers.length === 0 ? (
          <p className="text-sm text-slate-500">Filtrům neodpovídá žádný nosič.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b">
                <th className="py-2 pr-3">Nosič</th>
                <th className="py-2 pr-3">Typ</th>
                <th className="py-2 pr-3">Média / klienti</th>
                <th className="py-2 pr-3">Město</th>
                <th className="py-2 pr-3">GPS</th>
                <th className="py-2 pr-3">Stav</th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((carrier) => {
                const clients = [...new Set(carrier.surfaces.map((surface) => surface.currentClient?.name).filter((name): name is string => Boolean(name)))];
                const mediaTypes = [...new Set(carrier.surfaces.map((surface) => mediaTypeLabel(surface.mediaType)))];
                return (
                  <tr className={`border-b last:border-0 ${carrier.archivedAt ? 'bg-slate-50 text-slate-500' : ''}`} key={carrier.id}>
                    <td className="py-3 pr-3">
                      <Link className="font-semibold text-slate-950 hover:underline" href={`/carriers/${carrier.id}`}>{carrier.name}</Link>
                      <br />
                      <span className="text-slate-500">{carrier.code}</span>
                      {carrier.archivedAt && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">Archiv</span>}
                    </td>
                    <td className="py-3 pr-3">{carrierTypeLabel(carrier.type)}</td>
                    <td className="py-3 pr-3">
                      <span>{mediaTypes.join(', ') || 'Bez ploch'}</span>
                      <br />
                      <span className="text-slate-500">{clients.join(', ') || 'Klient neuveden'}</span>
                    </td>
                    <td className="py-3 pr-3">{[carrier.city, carrier.locality ?? carrier.cadastralArea, carrier.street ?? carrier.address].filter(Boolean).join(' · ')}</td>
                    <td className="py-3 pr-3">{carrier.latitude && carrier.longitude ? 'Má GPS' : 'Bez GPS'}</td>
                    <td className="py-3 pr-3"><StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
