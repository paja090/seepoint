import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, BriefcaseBusiness, CalendarCheck, CheckCircle2, Clock3, Mail, MapPin, Phone, ReceiptText, WalletCards } from 'lucide-react';
import { AccountAdmin } from '@/components/AccountAdmin';
import { AppShell } from '@/components/AppShell';
import { EmployeeBillingForm } from '@/components/EmployeeBillingForm';
import { EmployeeEditForm } from '@/components/EmployeeEditForm';
import { EmployeePhoto } from '@/components/EmployeePhoto';
import { EmployeeRates } from '@/components/EmployeeRates';
import { StatCard } from '@/components/ui';
import { prisma } from '@/lib/db';
import { dateOnly, money, StatusPill, statusLabel } from '@/lib/internal-format';
import { requirePageAccess } from '@/lib/page-auth';
import { AccessDenied, canAccess, canViewSensitiveEmployeeData, roleLabel } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

const rateLabels: Record<string, string> = { HOURLY: 'Hodinová', TASK: 'Úkolová', FIXED: 'Pevná' };

function normalizePositions(values: string[], fallback: string | null) {
  return [...new Set((values.length ? values : fallback ? [fallback] : []).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean))];
}

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
  const positions = normalizePositions(employee.positions, employee.position);
  const now = new Date();
  const currentRates = employee.rates.filter((rate) => rate.isActive && rate.validFrom <= now && (!rate.validTo || rate.validTo >= now));
  const completedTasks = employee.assignedTasks.filter((task) => task.status === 'DONE').length;
  const openTasks = employee.assignedTasks.filter((task) => task.status === 'TODO' || task.status === 'IN_PROGRESS').length;
  const latestSettlement = employee.settlements[0] ?? null;
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    <AppShell>
      <section className="card !p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 via-white to-orange-50/60 p-6 lg:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <EmployeePhoto employeeId={employee.id} photo={employee.photos[0] ? { id: employee.photos[0].id, url: employee.photos[0].url } : null} editable={user.role === 'ADMIN'} initials={`${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">{employee.firstName} {employee.lastName}</h1>
                <StatusPill value={employee.isActive ? 'ACTIVE' : 'CANCELLED'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(positions.length ? positions : ['Bez přiřazené pozice']).map((position) => <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm" key={position}>{position}</span>)}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                {employee.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4" />{employee.email}</span>}
                {employee.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" />{employee.phone}</span>}
                <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-4 w-4" />{roleLabel(employee.role)}</span>
                {employee.billingProfile?.city && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{employee.billingProfile.city}</span>}
              </div>
            </div>
            <Link className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50" href="/employees">Zpět na zaměstnance</Link>
          </div>
        </div>
        <nav aria-label="Sekce profilu" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 text-sm font-semibold sm:px-6">
          <a className="border-b-2 border-orange-500 px-3 py-4 text-orange-600" href="#overview">Přehled</a>
          <a className="border-b-2 border-transparent px-3 py-4 text-slate-600 hover:text-slate-950" href="#personal">Osobní údaje</a>
          <a className="border-b-2 border-transparent px-3 py-4 text-slate-600 hover:text-slate-950" href="#rates">Sazby</a>
          {user.role === 'ADMIN' && <a className="border-b-2 border-transparent px-3 py-4 text-slate-600 hover:text-slate-950" href="#billing">Fakturační údaje</a>}
          <a className="border-b-2 border-transparent px-3 py-4 text-slate-600 hover:text-slate-950" href="#work">Odvedená práce</a>
        </nav>
      </section>

      <div id="overview" className="mt-6 grid scroll-mt-6 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Otevřené úkoly" value={openTasks} description="Z posledních 20 přiřazených úkolů" icon={<Clock3 className="h-5 w-5" />} tone="orange" />
        <StatCard label="Hotové úkoly" value={completedTasks} description="Z posledních 20 přiřazených úkolů" icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Aktuální sazby" value={currentRates.length} description="Platné k dnešnímu dni" icon={<WalletCards className="h-5 w-5" />} tone="blue" />
        <StatCard label="Poslední vyúčtování" value={latestSettlement ? money(latestSettlement.totalAmount) : '—'} description={latestSettlement ? `${dateOnly(latestSettlement.periodFrom)} – ${dateOnly(latestSettlement.periodTo)}` : 'Zatím bez vyúčtování'} icon={<ReceiptText className="h-5 w-5" />} tone="purple" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Práce</p><h2 className="mt-1 text-xl font-bold">Aktuální úkoly</h2></div><CalendarCheck className="h-6 w-6 text-orange-500" /></div>
          <div className="mt-4">{employee.assignedTasks.length === 0 ? <p className="text-sm text-slate-500">Žádné přiřazené úkoly.</p> : employee.assignedTasks.slice(0, 5).map((task) => <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between" key={task.id}><div><p className="font-semibold text-slate-900">{task.title}</p><p className="text-sm text-slate-500">{dateOnly(task.scheduledDate)} · {task.carrier?.code ?? task.location ?? 'Bez lokality'} · {task.vehicle?.name ?? 'Bez vozidla'}</p></div><StatusPill value={task.status} /></div>)}</div>
        </section>
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Odměňování</p><h2 className="mt-1 text-xl font-bold">Aktuální sazby</h2></div><WalletCards className="h-6 w-6 text-blue-600" /></div>
          <div className="mt-4">{currentRates.length === 0 ? <p className="text-sm text-slate-500">K dnešnímu dni není aktivní žádná sazba.</p> : currentRates.slice(0, 5).map((rate) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0" key={rate.id}><div><span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold uppercase text-blue-700">{rateLabels[rate.type] ?? rate.type}</span><p className="mt-1 text-sm font-medium text-slate-700">{rate.name}</p></div><b className="whitespace-nowrap text-slate-950">{Number(rate.amount).toLocaleString('cs-CZ')} {rate.currency}{rate.unit ? ` / ${rate.unit}` : ''}</b></div>)}</div>
          <a className="mt-4 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900" href="#rates">Zobrazit historii sazeb →</a>
        </section>
      </div>

      <div id="personal" className="mt-6 grid scroll-mt-6 gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2"><div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-orange-500" /><h2 className="text-xl font-bold">Osobní a pracovní údaje</h2></div><dl className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div><dt className="text-slate-500">Kontakt</dt><dd className="mt-1 font-semibold">{employee.email ?? '—'}<br />{employee.phone ?? '—'}</dd></div><div><dt className="text-slate-500">Typ spolupráce</dt><dd className="mt-1 font-semibold">{statusLabel(employee.employmentType)}</dd></div><div><dt className="text-slate-500">Nástup</dt><dd className="mt-1 font-semibold">{dateOnly(employee.startDate)}</dd></div><div><dt className="text-slate-500">Konec</dt><dd className="mt-1 font-semibold">{dateOnly(employee.endDate)}</dd></div><div><dt className="text-slate-500">Pozice</dt><dd className="mt-1 font-semibold">{positions.join(', ') || '—'}</dd></div><div><dt className="text-slate-500">Citlivé údaje</dt><dd className="mt-1 font-semibold">{showSensitive ? <>IČO: {employee.ico ?? '—'}<br />Narození: {dateOnly(employee.dateOfBirth)}</> : 'Skryto podle role'}</dd></div></dl>{employee.note && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{employee.note}</p>}</section>
        <section className="card"><h2 className="text-xl font-bold">Rychlý souhrn</h2><p className="border-b border-slate-100 py-3 text-sm"><b>{employee.assignedTasks.length}</b> načtených úkolů</p><p className="border-b border-slate-100 py-3 text-sm"><b>{employee.settlements.length}</b> vyúčtování</p><p className="py-3 text-sm"><b>{employee.vehicleReservations.length}</b> rezervací vozidel</p></section>
      </div>

      {canManage && <AccountAdmin employeeId={employee.id} status={employee.user?.status ?? null} role={employee.user?.role ?? employee.role} rolesList={(employee.user?.roles as any) || (employee.roles as any) || []} lastLoginAt={employee.user?.lastLoginAt?.toISOString() ?? null} canSetAdmin={user.role === 'ADMIN'} />}
      {canManage && <EmployeeEditForm employee={{ id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email, phone: employee.phone, positions, note: employee.note, isActive: employee.isActive }} />}
      <div id="rates" className="scroll-mt-6"><EmployeeRates employeeId={employee.id} editable={user.role === 'ADMIN'} rates={employee.rates.map((rate) => ({ id: rate.id, name: rate.name, type: rate.type, amount: rate.amount.toString(), currency: rate.currency, unit: rate.unit, workType: rate.workType, carrierType: rate.carrierType, validFrom: rate.validFrom.toISOString().slice(0, 10), validTo: rate.validTo?.toISOString().slice(0, 10) ?? null, isActive: rate.isActive }))} /></div>
      {user.role === 'ADMIN' && <div id="billing" className="scroll-mt-6"><EmployeeBillingForm employeeId={employee.id} profile={employee.billingProfile} /></div>}
      <section id="work" className="card mt-6 scroll-mt-6"><h2 className="text-xl font-bold">Historie vyúčtování</h2><div className="mt-3">{employee.settlements.length === 0 ? <p className="text-sm text-slate-500">Žádné vyúčtování.</p> : employee.settlements.map((settlement) => <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between" key={settlement.id}><div><b>{dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}</b><p className="text-sm text-slate-500">{money(settlement.totalAmount)} · položek {settlement.items.length}</p></div><StatusPill value={settlement.status} /></div>)}</div></section>
    </AppShell>
  );
}
