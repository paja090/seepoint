import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('vehicles');
  if (!canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell>;
  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      reservations: { include: { employee: true }, orderBy: { dateFrom: 'desc' }, take: 20 },
      serviceRecords: { orderBy: { date: 'desc' }, take: 20 },
      workTasks: { include: { assignedTo: true }, orderBy: { scheduledDate: 'desc' }, take: 20 },
      fuelExpenses: { include: { employee: true }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!vehicle) notFound();

  const totalFuelCost = vehicle.fuelExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{vehicle.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{vehicle.registrationNumber ?? 'Bez SPZ'} · {vehicle.type}</p>
        </div>
        <Link className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition" href="/vehicles">
          Zpět na vozidla
        </Link>
      </div>

      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Provozní údaje</h2>
        <dl className="grid gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-slate-500">Stav</dt><dd><StatusPill value={vehicle.status} /></dd></div>
          <div><dt className="text-slate-500">VIN</dt><dd className="font-semibold">{vehicle.vin ?? '-'}</dd></div>
          <div><dt className="text-slate-500">STK do</dt><dd className="font-semibold">{dateOnly(vehicle.technicalInspectionUntil)}</dd></div>
          <div><dt className="text-slate-500">Pojištění do</dt><dd className="font-semibold">{dateOnly(vehicle.insuranceUntil)}</dd></div>
        </dl>
        {vehicle.note && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">{vehicle.note}</p>}
      </section>

      {/* Fuel Expenses Section */}
      <section className="card mt-6 border-amber-200 bg-amber-50/40">
        <div className="flex items-center justify-between border-b border-amber-200/60 pb-3 mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">⛽ Účtenky za Palivo & Tankování</h2>
            <p className="text-xs text-slate-600">Provozní náklady na palivo nahrané z mobilního týmového chatu</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase text-amber-800">Celkem za palivo</span>
            <p className="text-lg font-black text-amber-950">{totalFuelCost.toLocaleString('cs-CZ')} Kč</p>
          </div>
        </div>

        {vehicle.fuelExpenses.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">Zatím nebyly k tomuto vozidlu nahrány žádné účtenky za palivo.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vehicle.fuelExpenses.map((expense) => (
              <div key={expense.id} className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-black text-amber-900">{Number(expense.amount).toLocaleString('cs-CZ')} Kč</span>
                    {expense.liters && <span className="text-xs text-slate-600 font-semibold ml-1">({Number(expense.liters)} l)</span>}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {expense.employee ? `${expense.employee.firstName} ${expense.employee.lastName}` : 'Montážník'} · {new Date(expense.createdAt).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>

                  {expense.receiptUrl && (
                    <a
                      href={expense.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900 font-bold hover:bg-amber-200 transition"
                      title="Zobrazit účtenku"
                    >
                      📷
                    </a>
                  )}
                </div>

                {expense.odometer && (
                  <p className="mt-2 text-xs font-mono font-bold text-slate-700 bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                    Stav tacho: {expense.odometer.toLocaleString('cs-CZ')} km
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card">
          <h2 className="mb-3 text-xl font-bold">Rezervace</h2>
          {vehicle.reservations.length === 0 ? <p className="text-sm text-slate-500">Žádné rezervace.</p> : vehicle.reservations.map((reservation) => <div className="border-b py-3 text-sm last:border-0" key={reservation.id}><div className="flex justify-between gap-2"><b>{reservation.employee.firstName} {reservation.employee.lastName}</b><StatusPill value={reservation.status} /></div><p className="text-slate-500">{dateOnly(reservation.dateFrom)} – {dateOnly(reservation.dateTo)} · {reservation.purpose}</p></div>)}
        </section>
        
        <section className="card">
          <h2 className="mb-3 text-xl font-bold">Servis</h2>
          {vehicle.serviceRecords.length === 0 ? <p className="text-sm text-slate-500">Žádné servisní záznamy.</p> : vehicle.serviceRecords.map((record) => <div className="border-b py-3 text-sm last:border-0" key={record.id}><b>{record.title}</b><p className="text-slate-500">{dateOnly(record.date)} · {money(record.cost)} · {record.mileage ? `${record.mileage} km` : 'bez km'}</p></div>)}
        </section>

        <section className="card">
          <h2 className="mb-3 text-xl font-bold">Úkoly</h2>
          {vehicle.workTasks.length === 0 ? <p className="text-sm text-slate-500">Žádné úkoly.</p> : vehicle.workTasks.map((task) => <div className="border-b py-3 text-sm last:border-0" key={task.id}><div className="flex justify-between gap-2"><b>{task.title}</b><StatusPill value={task.status} /></div><p className="text-slate-500">{dateOnly(task.scheduledDate)} · {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'bez pracovníka'}</p></div>)}
        </section>
      </div>
    </AppShell>
  );
}
