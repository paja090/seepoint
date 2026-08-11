import Link from 'next/link';
import { CalendarClock, Clock3, Handshake, ShieldAlert, TimerReset } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { Button, EmptyState, ErrorState, FilterBar, PageHeader, StatCard } from '@/components/ui';
import { mediaTypeLabel } from '@/lib/carrier-filters';
import { prisma } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';
import { clientResolutionFilter } from '@/lib/occupancy-client';
import { OccupancyTableWithBulk } from '@/components/OccupancyTableWithBulk';
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
  if (isOccupancyStatus(status) && status !== 'AVAILABLE') where.status = status;
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
  const selectedStatus = clean(params.status);

  try {
    const where = buildWhere(params);
    const today = new Date();
    const in7 = new Date(today); in7.setDate(today.getDate() + 7);
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);
    const [dbRows, occupiedCount, reservedCount, negotiationCount, ending7Count, ending30Count, clients, allSurfaces] = await Promise.all([
      prisma.occupancy.findMany({
        where,
        include: { client: true, surface: { include: { carrier: true } } },
        orderBy: [{ dateTo: 'asc' }, { dateFrom: 'asc' }],
        take: 500,
      }),
      prisma.occupancy.count({ where: { status: 'OCCUPIED' } }),
      prisma.occupancy.count({ where: { status: 'RESERVED' } }),
      prisma.occupancy.count({ where: { status: 'NEGOTIATION' } }),
      prisma.occupancy.count({ where: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in7 } } }),
      prisma.occupancy.count({ where: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, dateTo: { gte: today, lte: in30 } } }),
      prisma.client.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.advertisingSurface.findMany({
        where: { carrier: { archivedAt: null } },
        include: { carrier: true },
        orderBy: [{ carrier: { city: 'asc' } }, { name: 'asc' }],
        take: 500,
      }),
    ]);

    const occupiedSurfaceIds = new Set(
      dbRows
        .filter((r) => ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(r.status))
        .map((r) => r.surfaceId)
    );

    let tableRows = dbRows.map((row) => ({
      id: row.id,
      surfaceId: row.surfaceId,
      clientId: row.clientId,
      clientName: row.clientName,
      campaignName: row.campaignName,
      dateFrom: row.dateFrom.toISOString(),
      dateTo: row.dateTo.toISOString(),
      status: row.status as string,
      price: row.price?.toString() ?? null,
      client: row.client ? { name: row.client.name } : null,
      surface: {
        id: row.surface.id,
        name: row.surface.name,
        mediaType: row.surface.mediaType,
        carrier: {
          id: row.surface.carrier.id,
          code: row.surface.carrier.code,
          city: row.surface.carrier.city,
          name: row.surface.carrier.name,
        },
      },
    }));

    if (selectedStatus === 'AVAILABLE') {
      const freeSurfaces = allSurfaces.filter((s) => !occupiedSurfaceIds.has(s.id));
      tableRows = freeSurfaces.map((s) => ({
        id: `avail-${s.id}`,
        surfaceId: s.id,
        clientId: null,
        clientName: '🟢 Volná plocha k pronájmu',
        campaignName: 'VOLNÁ PLOCHA K PRONÁJMU',
        dateFrom: today.toISOString(),
        dateTo: in30.toISOString(),
        status: 'AVAILABLE',
        price: null,
        client: null,
        surface: {
          id: s.id,
          name: s.name,
          mediaType: s.mediaType,
          carrier: {
            id: s.carrier.id,
            code: s.carrier.code,
            city: s.carrier.city,
            name: s.carrier.name,
          },
        },
      }));
    }

    const surfaceOptions = allSurfaces.map((s) => ({
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
          title="Obsazenost & Volné Plochy k Kampaním"
          description="Přehled, filtrování volných reklamních ploch a hromadné rezervace kampaní pro obchodníky."
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
            <label className="text-sm font-medium">Stav<select className="input mt-1" name="status" defaultValue={clean(params.status) ?? ''}><option value="">Všechny stavy</option>{occupancyStatuses.map((item) => <option key={item} value={item}>{item === 'AVAILABLE' ? '🟢 AVAILABLE (Volné nosiče)' : item}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-sm font-medium">Od<input className="input mt-1" name="dateFrom" type="date" defaultValue={clean(params.dateFrom) ?? ''} /></label><label className="text-sm font-medium">Do<input className="input mt-1" name="dateTo" type="date" defaultValue={clean(params.dateTo) ?? ''} /></label></div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-3 xl:col-span-6"><Button type="submit">Filtrovat</Button><Button href="/occupancy" variant="secondary">Vymazat filtry</Button></div>
          </form>
        </FilterBar>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Nalezeno <strong>{tableRows.length}</strong> záznamů.
          <span className="ml-3 text-slate-500">Aktivní filtry: {activeFilters.length ? activeFilters.map(([key, value]) => `${key}=${value}`).join(', ') : 'žádné'}</span>
        </section>

        <section className="card !p-0">
          {tableRows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Žádné nosiče nevyhovují filtru."
                description="Zkuste zrušit filtry nebo změnit zadané město."
              />
            </div>
          ) : (
            <OccupancyTableWithBulk
              rows={tableRows}
              clients={clients}
            />
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
