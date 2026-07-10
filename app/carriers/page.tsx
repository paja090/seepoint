import Link from 'next/link';
import { MapPinned, Plus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { CarrierFilters } from '@/components/CarrierFilters';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, PageHeader, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
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
      <PageHeader
        title="Reklamní nosiče"
        description="Databázově filtrovaný seznam nosičů. Tabulka je stránkovaná, ale celkový počet se počítá nad celou databází."
        actions={<Button href="/map" variant="primary"><Plus size={16} className="mr-2" />Přidat v mapě</Button>}
      />

      <CarrierFilters action="/carriers" filters={filters} options={filterOptions} resultCount={meta.total} />

      <section className="mb-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          Zobrazeno <strong>{meta.returned}</strong> z <strong>{meta.total}</strong> nosičů.
          <span className="ml-2 text-slate-500">Stránka {meta.page}, limit {meta.limit}.</span>
        </p>
        <p className="text-slate-500">Archivovaných: {meta.archivedCount} · Bez GPS: {meta.missingGpsCount}</p>
        {meta.hasMore && <Link className="font-semibold text-sky-700 hover:underline" href={`/carriers?${nextParams.toString()}`}>Načíst další stránku</Link>}
      </section>

      <section className="card !p-0">
        {carriers.length === 0 ? (
          <div className="p-5"><EmptyState title="Filtrům neodpovídá žádný nosič." description="Zkuste zrušit část filtrů nebo hledat podle jiného kódu, města či klienta." /></div>
        ) : (
          <Table minWidth="min-w-[1160px]">
            <TableHead>
              <tr>
                <TableHeaderCell>Kód</TableHeaderCell>
                <TableHeaderCell>Název</TableHeaderCell>
                <TableHeaderCell>Typ média</TableHeaderCell>
                <TableHeaderCell>Město</TableHeaderCell>
                <TableHeaderCell>Lokalita / ulice</TableHeaderCell>
                <TableHeaderCell>Klient</TableHeaderCell>
                <TableHeaderCell>Stav nosiče</TableHeaderCell>
                <TableHeaderCell>Stav obsazenosti</TableHeaderCell>
                <TableHeaderCell>GPS</TableHeaderCell>
                <TableHeaderCell>Fotky</TableHeaderCell>
                <TableHeaderCell>Akce</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              {carriers.map((carrier) => {
                const clients = [...new Set(carrier.surfaces.map((surface) => surface.currentClient?.name).filter((name): name is string => Boolean(name)))];
                const mediaTypes = [...new Set(carrier.surfaces.map((surface) => mediaTypeLabel(surface.mediaType)))];
                const surfaceStatuses = [...new Set(carrier.surfaces.map((surface) => surface.status))];
                const hasGps = Boolean(carrier.latitude && carrier.longitude);
                return (
                  <tr className={carrier.archivedAt ? 'bg-slate-50 text-slate-500' : 'hover:bg-slate-50/60'} key={carrier.id}>
                    <TableCell><Link className="font-semibold text-slate-950 hover:underline" href={`/carriers/${carrier.id}`}>{carrier.code}</Link></TableCell>
                    <TableCell><b>{carrier.name}</b><br /><span className="text-slate-500">{carrierTypeLabel(carrier.type)}</span></TableCell>
                    <TableCell>{mediaTypes.join(', ') || 'Bez ploch'}</TableCell>
                    <TableCell>{carrier.city || '-'}</TableCell>
                    <TableCell>{[carrier.locality ?? carrier.cadastralArea, carrier.street ?? carrier.address].filter(Boolean).join(' · ') || '-'}</TableCell>
                    <TableCell>{clients.join(', ') || <span className="text-slate-400">Klient neuveden</span>}</TableCell>
                    <TableCell><StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} /></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{surfaceStatuses.length ? surfaceStatuses.map((status) => <StatusBadge key={status} value={status} />) : <span className="text-slate-400">Bez ploch</span>}</div></TableCell>
                    <TableCell>{hasGps ? <StatusBadge value={carrier.gpsStatus === 'VERIFIED' ? 'VERIFIED' : carrier.gpsStatus} /> : <StatusBadge value="MISSING" />}</TableCell>
                    <TableCell>{carrier.photos.length + carrier.surfaces.reduce((sum, surface) => sum + surface.photos.length, 0)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Link className="table-action" href={`/carriers/${carrier.id}`}>Detail</Link>
                        <Link className="table-action" href={`/map?carrier=${carrier.id}`}><MapPinned size={14} className="mr-1" />Mapa</Link>
                        <Link className="table-action" href={`/carriers/${carrier.id}`}>Upravit</Link>
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}
