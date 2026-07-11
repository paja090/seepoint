import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, canViewSensitiveEmployeeData, getCurrentUser, roleLabel } from '@/lib/rbac';
import { dateOnly, money, statusLabel } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUser();
  if (!canAccess(user.role, 'employees')) return <AppShell><AccessDenied /></AppShell>;

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      assignedTasks: { orderBy: [{ scheduledDate: 'desc' }, { dueDate: 'desc' }], take: 20, include: { carrier: true, vehicle: true } },
      settlements: { orderBy: { periodFrom: 'desc' }, take: 20, include: { items: true } },
      vehicleReservations: { orderBy: { dateFrom: 'desc' }, take: 20, include: { vehicle: true } },
    },
  });
  if (!employee) notFound();

  const showSensitive = canViewSensitiveEmployeeData(user.role);

  return (
    <AppShell>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        description={`${employee.position ?? 'Bez pozice'} · ${roleLabel(employee.role)}`}
        actions={<Button href="/employees" variant="secondary">Zpět na zaměstnance</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Základní údaje</h2>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-slate-500">Kontakt</dt><dd className="font-semibold text-slate-900">{employee.email ?? '-'}<br />{employee.phone ?? '-'}</dd></div>
            <div><dt className="text-slate-500">Typ spolupráce</dt><dd className="font-semibold text-slate-900">{statusLabel(employee.employmentType)}</dd></div>
            <div><dt className="text-slate-500">Nástup</dt><dd className="font-semibold text-slate-900">{dateOnly(employee.startDate)}</dd></div>
            <div><dt className="text-slate-500">Konec</dt><dd className="font-semibold text-slate-900">{dateOnly(employee.endDate)}</dd></div>
            <div><dt className="text-slate-500">Stav</dt><dd className="mt-1"><StatusBadge value={employee.isActive ? 'ACTIVE' : 'INACTIVE'} /></dd></div>
            <div><dt className="text-slate-500">Citlivé údaje</dt><dd className="font-semibold text-slate-900">{showSensitive ? <>IČO: {employee.ico ?? '-'}<br />Narození: {dateOnly(employee.dateOfBirth)}</> : 'Skryto podle role'}</dd></div>
          </dl>
          {employee.note && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{employee.note}</p>}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Souhrn</h2>
          <p className="border-b border-slate-100 py-2 text-sm text-slate-700"><b className="text-slate-950">{employee.assignedTasks.length}</b> posledních úkolů</p>
          <p className="border-b border-slate-100 py-2 text-sm text-slate-700"><b className="text-slate-950">{employee.settlements.length}</b> vyúčtování</p>
          <p className="py-2 text-sm text-slate-700"><b className="text-slate-950">{employee.vehicleReservations.length}</b> rezervací vozidel</p>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Přiřazené úkoly</h2>
          {employee.assignedTasks.length === 0 ? <EmptyState title="Žádné úkoly." /> : employee.assignedTasks.map((task) => (
            <div className="border-b border-slate-100 py-3 text-sm last:border-0" key={task.id}>
              <div className="flex items-center justify-between gap-3"><b className="text-slate-950">{task.title}</b><StatusBadge value={task.status} /></div>
              <p className="mt-1 text-slate-500">{dateOnly(task.scheduledDate)} · {task.carrier?.code ?? task.location ?? 'Bez lokality'} · {task.vehicle?.name ?? 'Bez vozidla'}</p>
            </div>
          ))}
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-950">Vyúčtování</h2>
          {employee.settlements.length === 0 ? <EmptyState title="Žádné vyúčtování." /> : employee.settlements.map((settlement) => (
            <div className="border-b border-slate-100 py-3 text-sm last:border-0" key={settlement.id}>
              <div className="flex items-center justify-between gap-3"><b className="text-slate-950">{dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}</b><StatusBadge value={settlement.status} /></div>
              <p className="mt-1 text-slate-500">{money(settlement.totalAmount)} · položek {settlement.items.length}</p>
            </div>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}
