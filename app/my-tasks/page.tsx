import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, getCurrentUser } from '@/lib/rbac';
import { dateOnly, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
  const user = getCurrentUser();
  if (!canAccess(user.role, 'myTasks')) return <AppShell><AccessDenied /></AppShell>;

  const employee = await prisma.employee.findFirst({ where: { OR: [{ userId: user.id }, { email: user.email }] } });
  const tasks = employee ? await prisma.workTask.findMany({ where: { assignedToEmployeeId: employee.id }, include: { carrier: true, vehicle: true }, orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }, { dueDate: 'asc' }], take: 100 }) : [];

  return (
    <AppShell>
      <div className="mb-6"><h1 className="text-3xl font-bold">Moje úkoly</h1><p className="mt-1 text-sm text-slate-500">Osobní pracovní plán podle zaměstnaneckého profilu mock uživatele.</p></div>
      {!employee ? <section className="card"><h2 className="text-xl font-bold">Profil nenalezen</h2><p className="mt-2 text-sm text-slate-500">Pro mock uživatele {user.email} zatím není založený zaměstnanecký profil.</p></section> : <section className="card"><h2 className="mb-3 text-xl font-bold">{employee.firstName} {employee.lastName}</h2>{tasks.length === 0 ? <p className="text-sm text-slate-500">Nemáte přiřazené žádné úkoly.</p> : <div className="space-y-3">{tasks.map((task) => <div className="rounded-lg border p-3 text-sm" key={task.id}><div className="flex flex-wrap items-center justify-between gap-2"><b>{task.title}</b><StatusPill value={task.status} /></div><p className="mt-1 text-slate-500">{dateOnly(task.scheduledDate)} · do {dateOnly(task.dueDate)} · {task.carrier?.code ?? task.location ?? 'Bez lokality'} · {task.vehicle?.name ?? 'Bez vozidla'}</p>{task.description && <p className="mt-2">{task.description}</p>}</div>)}</div>}</section>}
    </AppShell>
  );
}
