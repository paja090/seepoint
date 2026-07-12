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
  const vehicle = await prisma.vehicle.findUnique({ where: { id }, include: { reservations: { include: { employee: true }, orderBy: { dateFrom: 'desc' }, take: 20 }, serviceRecords: { orderBy: { date: 'desc' }, take: 20 }, workTasks: { include: { assignedTo: true }, orderBy: { scheduledDate: 'desc' }, take: 20 } } });
  if (!vehicle) notFound();
  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">{vehicle.name}</h1><p className="mt-1 text-sm text-slate-500">{vehicle.registrationNumber ?? 'Bez SPZ'} · {vehicle.type}</p></div><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/vehicles">Zpět na vozidla</Link></div>
      <section className="card"><h2 className="mb-3 text-xl font-bold">Provozní údaje</h2><dl className="grid gap-3 text-sm md:grid-cols-4"><div><dt className="text-slate-500">Stav</dt><dd><StatusPill value={vehicle.status} /></dd></div><div><dt className="text-slate-500">VIN</dt><dd className="font-semibold">{vehicle.vin ?? '-'}</dd></div><div><dt className="text-slate-500">STK do</dt><dd className="font-semibold">{dateOnly(vehicle.technicalInspectionUntil)}</dd></div><div><dt className="text-slate-500">Pojištění do</dt><dd className="font-semibold">{dateOnly(vehicle.insuranceUntil)}</dd></div></dl>{vehicle.note && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">{vehicle.note}</p>}</section>
      <div className="mt-6 grid gap-6 xl:grid-cols-3"><section className="card"><h2 className="mb-3 text-xl font-bold">Rezervace</h2>{vehicle.reservations.length === 0 ? <p className="text-sm text-slate-500">Žádné rezervace.</p> : vehicle.reservations.map((reservation) => <div className="border-b py-3 text-sm last:border-0" key={reservation.id}><div className="flex justify-between gap-2"><b>{reservation.employee.firstName} {reservation.employee.lastName}</b><StatusPill value={reservation.status} /></div><p className="text-slate-500">{dateOnly(reservation.dateFrom)} – {dateOnly(reservation.dateTo)} · {reservation.purpose}</p></div>)}</section><section className="card"><h2 className="mb-3 text-xl font-bold">Servis</h2>{vehicle.serviceRecords.length === 0 ? <p className="text-sm text-slate-500">Žádné servisní záznamy.</p> : vehicle.serviceRecords.map((record) => <div className="border-b py-3 text-sm last:border-0" key={record.id}><b>{record.title}</b><p className="text-slate-500">{dateOnly(record.date)} · {money(record.cost)} · {record.mileage ? `${record.mileage} km` : 'bez km'}</p></div>)}</section><section className="card"><h2 className="mb-3 text-xl font-bold">Úkoly</h2>{vehicle.workTasks.length === 0 ? <p className="text-sm text-slate-500">Žádné úkoly.</p> : vehicle.workTasks.map((task) => <div className="border-b py-3 text-sm last:border-0" key={task.id}><div className="flex justify-between gap-2"><b>{task.title}</b><StatusPill value={task.status} /></div><p className="text-slate-500">{dateOnly(task.scheduledDate)} · {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'bez pracovníka'}</p></div>)}</section></div>
    </AppShell>
  );
}
