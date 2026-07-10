import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, getCurrentUser } from '@/lib/rbac';
import { dateOnly, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

export default async function VehicleReservationsPage() {
  const user = getCurrentUser();
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  const reservations = await prisma.vehicleReservation.findMany({ include: { vehicle: true, employee: true }, orderBy: [{ dateFrom: 'desc' }], take: 500 });
  return (
    <AppShell>
      <div className="mb-6"><h1 className="text-3xl font-bold">Rezervace vozidel</h1><p className="mt-1 text-sm text-slate-500">Přehled rezervací aut, dodávek a vozíků.</p></div>
      <section className="card overflow-x-auto">{reservations.length === 0 ? <p className="text-sm text-slate-500">Zatím není evidovaná žádná rezervace vozidla.</p> : <table className="w-full min-w-[880px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="border-b py-2 pr-3">Vozidlo</th><th className="border-b py-2 pr-3">Pracovník</th><th className="border-b py-2 pr-3">Termín</th><th className="border-b py-2 pr-3">Účel</th><th className="border-b py-2 pr-3">Stav</th><th className="border-b py-2 pr-3">Poznámka</th></tr></thead><tbody>{reservations.map((reservation) => <tr className="border-b last:border-0" key={reservation.id}><td className="py-3 pr-3"><b>{reservation.vehicle.name}</b><br /><span className="text-slate-500">{reservation.vehicle.registrationNumber ?? '-'}</span></td><td className="py-3 pr-3">{reservation.employee.firstName} {reservation.employee.lastName}</td><td className="py-3 pr-3">{dateOnly(reservation.dateFrom)} – {dateOnly(reservation.dateTo)}</td><td className="py-3 pr-3">{reservation.purpose}</td><td className="py-3 pr-3"><StatusPill value={reservation.status} /></td><td className="py-3 pr-3">{reservation.note ?? '-'}</td></tr>)}</tbody></table>}</section>
    </AppShell>
  );
}
