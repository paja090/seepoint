import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { prisma } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

const occupancyStatuses = ['AVAILABLE', 'NEGOTIATION', 'RESERVED', 'OCCUPIED', 'FINISHED', 'CANCELLED', 'OUT_OF_SERVICE'] as const;
const mediaTypes = ['NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | string[] | undefined) {
  return first(value)?.trim() || undefined;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isOccupancyStatus(value: string | undefined): value is typeof occupancyStatuses[number] {
  return Boolean(value && occupancyStatuses.includes(value as typeof occupancyStatuses[number]));
}

function isMediaType(value: string | undefined): value is typeof mediaTypes[number] {
  return Boolean(value && mediaTypes.includes(value as typeof mediaTypes[number]));
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildWhere(params: SearchParams) {
  const q = clean(params.q);
  const client = clean(params.client);
  const city = clean(params.city);
  const status = clean(params.status);
  const mediaType = clean(params.mediaType);
  const dateFrom = parseDate(clean(params.dateFrom));
  const dateTo = parseDate(clean(params.dateTo));
  const where: Prisma.OccupancyWhereInput = {
    surface: { carrier: { archivedAt: null } },
  };

  if (q) {
    where.OR = [
      { campaignName: { contains: q, mode: 'insensitive' } },
      { clientName: { contains: q, mode: 'insensitive' } },
      { surface: { name: { contains: q, mode: 'insensitive' } } },
      { surface: { carrier: { code: { contains: q, mode: 'insensitive' } } } },
      { surface: { carrier: { name: { contains: q, mode: 'insensitive' } } } },
      { surface: { carrier: { city: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  if (client) where.clientName = { contains: client, mode: 'insensitive' };
  if (isOccupancyStatus(status)) where.status = status;
  if (dateFrom && dateTo) Object.assign(where, { dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } });
  else if (dateFrom) where.dateTo = { gte: dateFrom };
  else if (dateTo) where.dateFrom = { lte: dateTo };

  const surfaceFilter: Prisma.AdvertisingSurfaceWhereInput = {};
  if (isMediaType(mediaType)) surfaceFilter.mediaType = mediaType;
  if (city) surfaceFilter.carrier = { city: { contains: city, mode: 'insensitive' }, archivedAt: null };
  if (Object.keys(surfaceFilter).length > 0) {
    where.surface = {
      ...(typeof where.surface === 'object' ? where.surface : {}),
      ...surfaceFilter,
    };
  }

  return where;
}

export default async function Occupancy({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const activeFilters = Object.entries(params)
    .map(([key, value]) => [key, clean(value)] as const)
    .filter(([, value]) => Boolean(value));

  try {
    const where = buildWhere(params);
    const [total, rows] = await Promise.all([
      prisma.occupancy.count({ where }),
      prisma.occupancy.findMany({
        where,
        include: { client: true, surface: { include: { carrier: true } } },
        orderBy: [{ dateTo: 'asc' }, { dateFrom: 'asc' }],
        take: 500,
      }),
    ]);

    return (
      <AppShell>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Obsazenost</h1>
          <p className="mt-1 text-sm text-slate-500">Přehled kampaní, rezervací a jednání nad reklamními plochami.</p>
        </div>

        <form className="card mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6" method="get">
          <label className="text-sm font-medium">Hledání
            <input className="mt-1 w-full rounded-lg border px-3 py-2" name="q" defaultValue={clean(params.q) ?? ''} placeholder="Kampaň, klient, kód" />
          </label>
          <label className="text-sm font-medium">Klient
            <input className="mt-1 w-full rounded-lg border px-3 py-2" name="client" defaultValue={clean(params.client) ?? ''} />
          </label>
          <label className="text-sm font-medium">Město
            <input className="mt-1 w-full rounded-lg border px-3 py-2" name="city" defaultValue={clean(params.city) ?? ''} />
          </label>
          <label className="text-sm font-medium">Typ média
            <select className="mt-1 w-full rounded-lg border px-3 py-2" name="mediaType" defaultValue={clean(params.mediaType) ?? ''}>
              <option value="">Všechna média</option>
              {mediaTypes.map((type) => <option key={type} value={type}>{mediaTypeLabel(type)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Stav
            <select className="mt-1 w-full rounded-lg border px-3 py-2" name="status" defaultValue={clean(params.status) ?? ''}>
              <option value="">Všechny stavy</option>
              {occupancyStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">Od
              <input className="mt-1 w-full rounded-lg border px-3 py-2" name="dateFrom" type="date" defaultValue={clean(params.dateFrom) ?? ''} />
            </label>
            <label className="text-sm font-medium">Do
              <input className="mt-1 w-full rounded-lg border px-3 py-2" name="dateTo" type="date" defaultValue={clean(params.dateTo) ?? ''} />
            </label>
          </div>
          <div className="md:col-span-3 xl:col-span-6 flex flex-wrap items-center gap-2">
            <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" type="submit">Filtrovat</button>
            <a className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" href="/occupancy">Vymazat filtry</a>
          </div>
        </form>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Stav dat: načteno. Nalezeno <strong>{total}</strong> záznamů, zobrazeno <strong>{rows.length}</strong>.
          <span className="ml-3 text-slate-500">Aktivní filtry: {activeFilters.length ? activeFilters.map(([key, value]) => `${key}=${value}`).join(', ') : 'žádné'}</span>
        </section>

        <section className="card overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Zatím není evidována žádná obsazenost.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b">
                  <th className="py-2 pr-3">Kampaň</th>
                  <th className="py-2 pr-3">Klient</th>
                  <th className="py-2 pr-3">Nosič</th>
                  <th className="py-2 pr-3">Plocha</th>
                  <th className="py-2 pr-3">Termín</th>
                  <th className="py-2 pr-3">Stav</th>
                  <th className="py-2 pr-3">Cena</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b last:border-0" key={row.id}>
                    <td className="py-3 pr-3 font-semibold">{row.campaignName}</td>
                    <td className="py-3 pr-3">{row.client?.name ?? row.clientName}</td>
                    <td className="py-3 pr-3">{row.surface.carrier.code}<br /><span className="text-slate-500">{row.surface.carrier.city}</span></td>
                    <td className="py-3 pr-3">{row.surface.name}<br /><span className="text-slate-500">{mediaTypeLabel(row.surface.mediaType)}</span></td>
                    <td className="py-3 pr-3">{dateOnly(row.dateFrom)} – {dateOnly(row.dateTo)}</td>
                    <td className="py-3 pr-3"><StatusBadge value={row.status} /></td>
                    <td className="py-3 pr-3">{row.price ? `${row.price.toString()} Kč` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </AppShell>
    );
  } catch (error) {
    console.error('Occupancy page failed', error);
    return (
      <AppShell>
        <h1 className="mb-6 text-3xl font-bold">Obsazenost</h1>
        <section className="card border-red-200 bg-red-50">
          <h2 className="font-semibold text-red-900">Obsazenost se nepodařilo načíst</h2>
          <p className="mt-2 text-sm text-red-700">
            {isMissingDatabaseStructureError(error) ? productionMigrationMessage() : 'Zkuste stránku obnovit nebo zkontrolovat runtime logy.'}
          </p>
        </section>
      </AppShell>
    );
  }
}
