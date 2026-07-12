import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, canViewSensitiveEmployeeData, roleLabel } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, money, StatusPill, statusLabel } from '@/lib/internal-format';
import { AccountAdmin } from '@/components/AccountAdmin';
import { EmployeeEditForm } from '@/components/EmployeeEditForm';
import { EmployeeRates } from '@/components/EmployeeRates';
import { EmployeeBillingForm } from '@/components/EmployeeBillingForm';
import { EmployeePhoto } from '@/components/EmployeePhoto';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('employees');
  if (!canAccess(user.role, 'employees')) return <AppShell><AccessDenied /></AppShell>;

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      assignedTasks: { orderBy: [{ scheduledDate: 'desc' }, { dueDate: 'desc' }], take: 20, include: { carrier: true, vehicle: true } },
      settlements: { orderBy: { periodFrom: 'desc' }, take: 20, include: { items: true } },
      vehicleReservations: { orderBy: { dateFrom: 'desc' }, take: 20, include: { vehicle: true } },
      user: true,
      rates: { orderBy: { validFrom: 'desc' } },
      billingProfile: true,
      photos: { where: { type: 'EMPLOYEE_PROFILE' }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!employee) notFound();

  const showSensitive = canViewSensitiveEmployeeData(user.role);

  return (
    <AppShell>
      <section className="card mb-6"><div className="flex flex-col gap-5 md:flex-row md:items-start"><EmployeePhoto employeeId={employee.id} photo={employee.photos[0]?{id:employee.photos[0].id,url:employee.photos[0].url}:null} editable={user.role==='ADMIN'} initials={`${employee.firstName[0]??''}${employee.lastName[0]??''}`}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">{employee.firstName} {employee.lastName}</h1><div className="mt-2 flex flex-wrap gap-2">{(employee.positions.length?employee.positions:[employee.position??'Bez pozice']).map(position=><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700" key={position}>{position}</span>)}<StatusPill value={employee.isActive?'ACTIVE':'CANCELLED'}/></div><p className="mt-3 text-sm text-slate-500">{employee.email??'Bez e-mailu'} · {employee.phone??'Bez telefonu'} · {roleLabel(employee.role)}</p></div><Link className="rounded-lg border px-4 py-2 text-sm font-semibold" href="/employees">Zpět na zaměstnance</Link></div></div></div><nav className="mt-5 flex flex-wrap gap-2 border-t pt-4 text-sm font-semibold"><a className="rounded-lg bg-slate-950 px-3 py-2 text-white" href="#overview">Přehled</a><a className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" href="#rates">Sazby</a><a className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100" href="#billing">Fakturační údaje</a></nav></section>
      <div id="overview" className="grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2"><h2 className="mb-3 text-xl font-bold">Základní údaje</h2><dl className="grid gap-3 text-sm md:grid-cols-2"><div><dt className="text-slate-500">Kontakt</dt><dd className="font-semibold">{employee.email ?? '-'}<br />{employee.phone ?? '-'}</dd></div><div><dt className="text-slate-500">Typ spolupráce</dt><dd className="font-semibold">{statusLabel(employee.employmentType)}</dd></div><div><dt className="text-slate-500">Nástup</dt><dd className="font-semibold">{dateOnly(employee.startDate)}</dd></div><div><dt className="text-slate-500">Konec</dt><dd className="font-semibold">{dateOnly(employee.endDate)}</dd></div><div><dt className="text-slate-500">Stav</dt><dd><StatusPill value={employee.isActive ? 'ACTIVE' : 'CANCELLED'} /></dd></div><div><dt className="text-slate-500">Citlivé údaje</dt><dd className="font-semibold">{showSensitive ? <>IČO: {employee.ico ?? '-'}<br />Narození: {dateOnly(employee.dateOfBirth)}</> : 'Skryto podle role'}</dd></div></dl>{employee.note && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{employee.note}</p>}</section>
        <section className="card"><h2 className="mb-3 text-xl font-bold">Souhrn</h2><p className="border-b py-2 text-sm"><b>{employee.assignedTasks.length}</b> posledních úkolů</p><p className="border-b py-2 text-sm"><b>{employee.settlements.length}</b> vyúčtování</p><p className="py-2 text-sm"><b>{employee.vehicleReservations.length}</b> rezervací vozidel</p></section>
      </div>
      {(user.role === 'ADMIN' || user.role === 'MANAGER') && <AccountAdmin employeeId={employee.id} status={employee.user?.status ?? null} role={employee.user?.role ?? employee.role} lastLoginAt={employee.user?.lastLoginAt?.toISOString() ?? null} canSetAdmin={user.role === 'ADMIN'} />}
      {(user.role === 'ADMIN' || user.role === 'MANAGER') && <EmployeeEditForm employee={{ id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email, phone: employee.phone, positions: employee.positions.length?employee.positions:(employee.position?[employee.position]:[]), note: employee.note, isActive: employee.isActive }} />}
      <div id="rates" className="scroll-mt-6"><EmployeeRates employeeId={employee.id} editable={user.role === 'ADMIN'} rates={employee.rates.map(r => ({ id:r.id,name:r.name,type:r.type,amount:r.amount.toString(),currency:r.currency,unit:r.unit,workType:r.workType,validFrom:r.validFrom.toISOString().slice(0,10),validTo:r.validTo?.toISOString().slice(0,10)??null,isActive:r.isActive }))} /></div>
      {user.role === 'ADMIN' && <div id="billing" className="scroll-mt-6"><EmployeeBillingForm employeeId={employee.id} profile={employee.billingProfile} /></div>}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card"><h2 className="mb-3 text-xl font-bold">Přiřazené úkoly</h2>{employee.assignedTasks.length === 0 ? <p className="text-sm text-slate-500">Žádné úkoly.</p> : employee.assignedTasks.map((task) => <div className="border-b py-3 text-sm last:border-0" key={task.id}><div className="flex items-center justify-between gap-3"><b>{task.title}</b><StatusPill value={task.status} /></div><p className="text-slate-500">{dateOnly(task.scheduledDate)} · {task.carrier?.code ?? task.location ?? 'Bez lokality'} · {task.vehicle?.name ?? 'Bez vozidla'}</p></div>)}</section>
        <section className="card"><h2 className="mb-3 text-xl font-bold">Vyúčtování</h2>{employee.settlements.length === 0 ? <p className="text-sm text-slate-500">Žádné vyúčtování.</p> : employee.settlements.map((settlement) => <div className="border-b py-3 text-sm last:border-0" key={settlement.id}><div className="flex items-center justify-between gap-3"><b>{dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}</b><StatusPill value={settlement.status} /></div><p className="text-slate-500">{money(settlement.totalAmount)} · položek {settlement.items.length}</p></div>)}</section>
      </div>
    </AppShell>
  );
}
