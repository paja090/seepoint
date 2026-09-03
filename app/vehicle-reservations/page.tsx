import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, StatusPill } from '@/lib/internal-format';
import { VehicleReservationModal } from '@/components/VehicleReservationModal';
import { ReservationStatusActions } from '@/components/ReservationStatusActions';
import { Prisma, type ReservationStatus } from '@prisma/client';
import { canAssignReservationToOthers, derivedVehicleStatus } from '@/lib/vehicle-reservations';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function VehicleReservationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('vehicles');
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  await ensureVehicleSchema();

  const params = await searchParams;
  const vehicleIdFilter = clean(params.vehicleId);
  const statusFilter = clean(params.status);

  const where: Prisma.VehicleReservationWhereInput = {};
  if (vehicleIdFilter) where.vehicleId = vehicleIdFilter;
  const reservationStatuses: ReservationStatus[] = ['RESERVED', 'ACTIVE', 'FINISHED', 'CANCELLED'];
  if (statusFilter && reservationStatuses.includes(statusFilter as ReservationStatus)) where.status = statusFilter as ReservationStatus;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [reservations, storedVehicles, employees] = await Promise.all([
    prisma.vehicleReservation.findMany({
      where,
      include: { vehicle: true, employee: true },
      orderBy: [{ dateFrom: 'desc' }],
      take: 500,
    }),
    prisma.vehicle.findMany({
      where: { status: { not: 'OUT_OF_SERVICE' } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        registrationNumber: true,
        status: true,
        reservations: {
          where: {
            OR: [
              { status: 'ACTIVE' },
              { status: 'RESERVED', dateFrom: { lte: today }, dateTo: { gte: today } },
            ],
          },
          select: { status: true, dateFrom: true, dateTo: true },
        },
      },
    }),
    prisma.employee.findMany({
      where: canAssignReservationToOthers(user.role)
        ? { isActive: true }
        : user.employee?.id ? { id: user.employee.id, isActive: true } : { id: '__none__' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const vehicles = storedVehicles.map((vehicle) => ({
    ...vehicle,
    status: derivedVehicleStatus(vehicle.status, vehicle.reservations, today),
  }));

  const activeReservationsCount = reservations.filter((r) => ['RESERVED', 'ACTIVE'].includes(r.status)).length;
  const finishedReservationsCount = reservations.filter((r) => r.status === 'FINISHED').length;

  return (
    <AppShell>
      {/* Header Bar */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rezervace vozidel & vozíků</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Plánování a rezervace aut, dodávek a trailerů na montáže a výjezdy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <VehicleReservationModal
            vehicles={vehicles}
            employees={employees}
            defaultVehicleId={vehicleIdFilter}
          />
          <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition" href="/vehicles">
            ← Zpět na seznam vozidel
          </Link>
        </div>
      </div>

      {/* Summary Stat Bar */}
      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Aktivní a plánované rezervace</span>
          <p className="mt-1 text-2xl font-black text-sky-900">{activeReservationsCount}</p>
          <span className="text-[10px] text-sky-700 font-semibold">rezervovaných aut & vozíků</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Dokončené výjezdy</span>
          <p className="mt-1 text-2xl font-black text-emerald-900">{finishedReservationsCount}</p>
          <span className="text-[10px] text-emerald-700 font-semibold">vyřízených rezervací</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Celkem v evidenci</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{reservations.length}</p>
          <span className="text-[10px] text-slate-400 font-semibold">záznamů historie</span>
        </div>
      </div>

      {/* Filters Form */}
      <form className="card mb-6 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-bold text-slate-700">
          Vozidlo
          <select className="input mt-1 w-full text-xs font-normal" name="vehicleId" defaultValue={vehicleIdFilter ?? ''}>
            <option value="">Všechna vozidla</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.registrationNumber || 'Bez SPZ'})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold text-slate-700">
          Stav rezervace
          <select className="input mt-1 w-full text-xs font-normal" name="status" defaultValue={statusFilter ?? ''}>
            <option value="">Všechny stavy</option>
            <option value="RESERVED">🟡 Naplánováno (Rezervováno)</option>
            <option value="ACTIVE">🔵 V provozu</option>
            <option value="FINISHED">🟢 Dokončeno</option>
            <option value="CANCELLED">🔴 Zrušeno</option>
          </select>
        </label>

        <div className="flex items-end">
          <button className="w-full rounded-xl bg-slate-950 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition">
            Filtrovat rezervace
          </button>
        </div>
      </form>

      {/* Reservations Table */}
      <section className="card overflow-x-auto p-0 border border-slate-200">
        {reservations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium">
            Zatím nebola nalezena žádná rezervace odpovídající zadanému filtru.
          </div>
        ) : (
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Vozidlo / Vozík</th>
                <th className="py-3 px-3">Pracovník / Řidič</th>
                <th className="py-3 px-3">Termín OD – DO</th>
                <th className="py-3 px-3">Účel výjezdu</th>
                <th className="py-3 px-3">Stav</th>
                <th className="py-3 px-3">Poznámka</th>
                <th className="py-3 px-4 text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {reservations.map((reservation) => {
                let typeIcon = '🚘';
                if (reservation.vehicle.type === 'VAN') typeIcon = '🚚';
                if (reservation.vehicle.type === 'TRAILER') typeIcon = '🪧';

                return (
                  <tr className="hover:bg-slate-50/80 transition" key={reservation.id}>
                    <td className="py-3 px-4">
                      <Link className="font-extrabold text-slate-900 hover:text-sky-700 text-sm block" href={`/vehicles/${reservation.vehicle.id}`}>
                        {typeIcon} {reservation.vehicle.name}
                      </Link>
                      <span className="font-mono text-[11px] text-slate-500 font-bold">
                        {reservation.vehicle.registrationNumber ?? 'Bez SPZ'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-slate-800 bg-sky-50 text-sky-950 px-2.5 py-1 rounded-xl border border-sky-200 inline-block">
                        👤 {reservation.employee.firstName} {reservation.employee.lastName}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">
                        🗓️ {dateOnly(reservation.dateFrom)} – {dateOnly(reservation.dateTo)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-slate-900 text-xs">
                        {reservation.purpose}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusPill value={reservation.status} />
                    </td>
                    <td className="py-3 px-3 max-w-[200px]">
                      {reservation.note ? (
                        <span className="text-slate-600 truncate block" title={reservation.note}>
                          {reservation.note}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ReservationStatusActions
                        reservationId={reservation.id}
                        currentStatus={reservation.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
