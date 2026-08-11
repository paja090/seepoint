import Link from 'next/link';
import { CalendarClock, Clock3, Handshake, ShieldAlert, TimerReset, Route } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, EmptyState, ErrorState, FilterBar, PageHeader, StatCard, Table, TableCell, TableHead, TableHeaderCell } from '@/components/ui';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { prisma } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';
import { clientResolutionFilter } from '@/lib/occupancy-client';
import { OccupancyClientPairing } from '@/components/OccupancyClientPairing';
import { QuickOccupancyBookingForm } from '@/components/QuickOccupancyBookingForm';

export const dynamic = 'force-dynamic';

const occupancyStatuses = ['AVAILABLE', 'NEGOTIATION', 'RESERVED', 'OCCUPIED', 'FINISHED', 'CANCELLED', 'OUT_OF_SERVICE'] as const;
const mediaTypes = ['NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }
function parseDate(value: string | undefined) { if (!value) return undefined; const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? undefined : date; }
function isOccupancyStatus(value: string | undefined): value is typeof occupancyStatuses[number] { return Boolean(value && occupancyStatuses.includes(value as typeof occupancyStatuses[number])); }
function isMediaType(value: string | undefined): value is typeof mediaTypes[number] { return Boolean(value && mediaTypes.includes(value as typeof mediaTypes[number])); }
function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }

function buildWhere(params: SearchParams) {
  const q = clean(params.q);
  const client = clean(params.client);
  const clientResolution = clientResolutionFilter(clean(params.clientResolution));
  const city = clean(params.city);
  const status = clean(params.status);
  const mediaType = clean(params.mediaType);
  const dateFrom = parseDate(clean(params.dateFrom));
  const dateTo = parseDate(clean(params.dateTo));
  const surfaceWhere: Prisma.AdvertisingSurfaceWhereInput = { carrier: { archivedAt: null } };
  const where: Prisma.OccupancyWhereInput = {};

  if (q) where.OR = [
    { campaignName: { contains: q, mode: 'insensitive' } },
    { clientName: { contains: q, mode: 'insensitive' } },
    { surface: { name: { contains: q, mode: 'insensitive' } } },
    { surface: { carrier: { code: { contains: q, mode: 'insensitive' } } } },
    { surface: { carrier: { name: { contains: q, mode: 'insensitive' } } } },
    { surface: { carrier: { city: { contains: q, mode: 'insensitive' } } } },
  ];
  if (client) where.clientName = { contains: client, mode: 'insensitive' };
  if (clientResolution === 'resolved') where.clientId = { not: null };
  if (clientResolution === 'unresolved') where.clientId = null;
  if (isOccupancyStatus(status)) where.status = status;
  if (dateFrom && dateTo) Object.assign(where, { dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } });
  else if (dateFrom) where.dateTo = { gte: dateFrom };
  else if (dateTo) where.dateFrom = { lte: dateTo };
  if (isMediaType(mediaType)) surfaceWhere.mediaType = mediaType;
  if (city) surfaceWhere.carrier = { city: { contains: city, mode: 'insensitive' }, archivedAt: null };
  where.surface = surfaceWhere;
  return where;
}

export default async function Occupancy({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('occupancy');
  const params = await searchParams;
  const activeFilters = Object.entries(params).map(([key, value]) => [key, clean(value)] as const).filter(([, value]) => Boolean(value));

  try {
    const where = buildWhere(params);
    const today = new Date();
    const in7 = new Date(today); in7.setDate(today.getDate() + 7);
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);
    const [total, rows, occupiedCount, reservedCount, negotiationCount, ending7Count, ending30Count, clients, surfaces] = await Promise.all([
      prisma.occupancy.count({ where }),
      prisma.occupancy.findMany({
        where,
        include: { client: true, surface: { include: { carrier: true } } },
        orderBy: [{ dateTo: 'asc' }, { dateFrom: 'asc' }],
        take: 500,
      }),
      prisma.occupancy.count({ where: { ...where, status: 'OCCUPIED' } }),
      prisma.occupancy.count({ where: { ...where, status: 'RESERVED' } }),
      prisma.occupancy.count({ where: { ...where, status: 'NEGOTIATION' } }),
      prisma.occupancy.count({ where: { ...where, status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in7 } } }),
      prisma.occupancy.count({ where: { ...where, status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in30 } } }),
      prisma.client.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.advertisingSurface.findMany({
        where: { carrier: { archivedAt: null } },
        include: { carrier: true },
        orderBy: [{ carrier: { city: 'asc' } }, { name: 'asc' }],
        take: 300,
      }),
    ]);

    const surfaceOptions = surfaces.map((s) => ({
      id: s.id,
      name: s.name,
      mediaType: mediaTypeLabel(s.mediaType),
      carrierCode: s.carrier.code,
      carrierCity: s.carrier.city,
      carrierName: s.carrier.name,
    }));

    const currentUserName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;

    return (
      <AppShell>
        <PageHeader
          title="Obsazenost & Rezervace kampaní"
          description="Přehled a rychlá rezervace reklamních ploch pro obchodníky. Kontrola konfliktů, správa kampaní a převod na montáž."
          actions={<Button href="/offers" variant="secondary">Vytvořit nabídku</Button>}
        />

        {/* Quick Campaign Booking Form for Salespeople */}
        <QuickOccupancyBookingForm
          surfaces={surfaceOptions}
          clients={clients}
          currentUserName={currentUserName}
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<ShieldAlert size={20} />} label="Aktuálně obsazeno" tone="red" value={occupiedCount} />
          <StatCard icon={<Clock3 size={20} />} label="Rezervace" tone="orange" value={reservedCount} />
          <StatCard icon={<Handshake size={20} />} label="Jednání" tone="blue" value={negotiationCount} />
          <StatCard icon={<TimerReset size={20} />} label="Končí do 7 dnů" tone="orange" value={ending7Count} />
          <StatCard icon={<CalendarClock size={20} />} label="Končí do 30 dnů" tone="slate" value={ending30Count} />
        </div>

        <FilterBar>
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" method="get">
            <label className="text-sm font-medium">Hledání<input className="input mt-1" name="q" defaultValue={clean(params.q) ?? ''} placeholder="Kampaň, klient, kód" /></label>
            <label className="text-sm font-medium">Klient<input className="input mt-1" name="client" defaultValue={clean(params.client) ?? ''} /></label>
            <label className="text-sm font-medium">Přiřazení klienta<select className="input mt-1" name="clientResolution" defaultValue={clientResolutionFilter(clean(params.clientResolution))}><option value="all">Všechny</option><option value="resolved">Klient přiřazen</option><option value="unresolved">Klient neurčen</option></select></label>
            <label className="text-sm font-medium">Město<input className="input mt-1" name="city" defaultValue={clean(params.city) ?? ''} /></label>
            <label className="text-sm font-medium">Typ média<select className="input mt-1" name="mediaType" defaultValue={clean(params.mediaType) ?? ''}><option value="">Všechna média</option>{mediaTypes.map((type) => <option key={type} value={type}>{mediaTypeLabel(type)}</option>)}</select></label>
            <label className="text-sm font-medium">Stav<select className="input mt-1" name="status" defaultValue={clean(params.status) ?? ''}><option value="">Všechny stavy</option>{occupancyStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-sm font-medium">Od<input className="input mt-1" name="dateFrom" type="date" defaultValue={clean(params.dateFrom) ?? ''} /></label><label className="text-sm font-medium">Do<input className="input mt-1" name="dateTo" type="date" defaultValue={clean(params.dateTo) ?? ''} /></label></div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-3 xl:col-span-6"><Button type="submit">Filtrovat</Button><Button href="/occupancy" variant="secondary">Vymazat filtry</Button></div>
          </form>
        </FilterBar>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Nalezeno <strong>{total}</strong> záznamů, zobrazeno <strong>{rows.length}</strong>.
          <span className="ml-3 text-slate-500">Aktivní filtry: {activeFilters.length ? activeFilters.map(([key, value]) => `${key}=${value}`).join(', ') : 'žádné'}</span>
        </section>

        <section className="card !p-0">
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState title="Zatím není evidována žádná obsazenost." description="Jakmile obchodník vytvoří rezervaci, jednání nebo obsazenost ve formuláři výše, zobrazí se v této tabulce." /></div>
          ) : (
            <Table minWidth="min-w-[980px]">
              <TableHead>
                <tr>
                  <TableHeaderCell>Nosič</TableHeaderCell>
                  <TableHeaderCell>Plocha</TableHeaderCell>
                  <TableHeaderCell>Klient</TableHeaderCell>
                  <TableHeaderCell>Kampaň</TableHeaderCell>
                  <TableHeaderCell>Od</TableHeaderCell>
                  <TableHeaderCell>Do</TableHeaderCell>
                  <TableHeaderCell>Stav</TableHeaderCell>
                  <TableHeaderCell>Akce & Montáž</TableHeaderCell>
                </tr>
              </TableHead>
              <tbody>
                {rows.map((row) => (
                  <tr className="hover:bg-slate-50/60" key={row.id}>
                    <TableCell>
                      <Link className="font-semibold text-slate-950 hover:underline" href={`/carriers/${row.surface.carrier.id}`}>
                        {row.surface.carrier.code}
                      </Link>
                      <br />
                      <span className="text-slate-500">{row.surface.carrier.city}</span>
                    </TableCell>
                    <TableCell>
                      {row.surface.name}
                      <br />
                      <span className="text-slate-500">{mediaTypeLabel(row.surface.mediaType)}</span>
                    </TableCell>
                    <TableCell>
                      <OccupancyClientPairing
                        occupancyId={row.id}
                        surfaceId={row.surfaceId}
                        initialClientId={row.clientId}
                        initialClientName={row.clientName}
                        matchedClientName={row.client?.name}
                        clients={clients}
                      />
                    </TableCell>
                    <TableCell>
                      <b>{row.campaignName}</b>
                      {row.price && <span className="block text-xs font-bold text-emerald-700">{Number(row.price).toLocaleString('cs-CZ')} Kč</span>}
                    </TableCell>
                    <TableCell>{dateOnly(row.dateFrom)}</TableCell>
                    <TableCell>{dateOnly(row.dateTo)}</TableCell>
                    <TableCell><StatusBadge value={row.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link className="table-action" href={`/carriers/${row.surface.carrier.id}`}>
                          Detail
                        </Link>
                        {['OCCUPIED', 'RESERVED'].includes(row.status) && (
                          <Link
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                            href={`/work?carrierCode=${row.surface.carrier.code}&clientName=${encodeURIComponent(row.clientName || '')}&campaignDateFrom=${dateOnly(row.dateFrom)}&campaignDateTo=${dateOnly(row.dateTo)}`}
                            title="Vytvořit pracovní úkol / montáž v Plánu práce"
                          >
                            <Route size={12} />
                            <span>Montáž</span>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </AppShell>
    );
  } catch (error) {
    console.error('Occupancy page failed', error);
    return (
      <AppShell>
        <PageHeader title="Obsazenost" description="Přehled kampaní, rezervací a jednání nad reklamními plochami." />
        <ErrorState title="Obsazenost se nepodařilo načíst" description={isMissingDatabaseStructureError(error) ? productionMigrationMessage() : 'Zkuste stránku obnovit nebo zkontrolovat runtime logy.'} />
      </AppShell>
    );
  }
}
