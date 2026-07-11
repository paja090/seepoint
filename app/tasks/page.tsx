import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canViewAllTasks } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statuses = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('tasks');
  if (!canViewAllTasks(user.role)) return <AppShell><AccessDenied /></AppShell>;

  const params = await searchParams;
  const q = clean(params.q);
  const status = clean(params.status);
  const priority = clean(params.priority);
  const where: Prisma.WorkTaskWhereInput = {};
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { location: { contains: q, mode: 'insensitive' } }, { workOrder: { title: { contains: q, mode: 'insensitive' } } }];
  if (status && statuses.includes(status as typeof statuses[number])) where.status = status as typeof statuses[number];
  if (priority && priorities.includes(priority as typeof priorities[number])) where.priority = priority as typeof priorities[number];

  const tasks = await prisma.workTask.findMany({
    where,
    include: { assignedTo: true, createdBy: true, carrier: true, vehicle: true, workOrder: true },
    orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }, { dueDate: 'asc' }],
    take: 500,
  });

  return (
    <AppShell>
      <div className="mb-6"><h1 className="text-3xl font-bold">Úkoly</h1><p className="mt-1 text-sm text-slate-500">Interní úkoly pro zaměstnance. Úkoly vytvořené z plánu práce mají odkaz zpět na zakázku.</p></div>
      <form className="card mb-6 grid gap-3 md:grid-cols-4"><label className="text-sm font-semibold">Hledání<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="q" defaultValue={q} placeholder="Název, popis, lokalita" /></label><label className="text-sm font-semibold">Stav<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="status" defaultValue={status ?? ''}><option value="">Všechny stavy</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-sm font-semibold">Priorita<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="priority" defaultValue={priority ?? ''}><option value="">Všechny priority</option>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex items-end"><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrovat</button></div></form>
      <section className="card overflow-x-auto"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Seznam úkolů</h2><p className="text-sm text-slate-500">Zobrazeno {tasks.length}</p></div>{tasks.length === 0 ? <p className="text-sm text-slate-500">Zatím není evidovaný žádný úkol.</p> : <table className="w-full min-w-[1100px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="border-b py-2 pr-3">Úkol</th><th className="border-b py-2 pr-3">Zdroj</th><th className="border-b py-2 pr-3">Pracovník</th><th className="border-b py-2 pr-3">Termín</th><th className="border-b py-2 pr-3">Nosič</th><th className="border-b py-2 pr-3">Vozidlo</th><th className="border-b py-2 pr-3">Priorita</th><th className="border-b py-2 pr-3">Stav</th></tr></thead><tbody>{tasks.map((task) => <tr className="border-b last:border-0" key={task.id}><td className="py-3 pr-3"><b>{task.title}</b><br /><span className="text-slate-500">{task.description ?? task.note ?? '-'}</span></td><td className="py-3 pr-3">{task.workOrder ? <Link className="font-semibold text-sky-700 hover:underline" href={`/work/${task.workOrder.id}`}>Plán práce</Link> : <span className="text-slate-500">Interní</span>}<br /><span className="text-slate-500">{task.workOrder?.title ?? '-'}</span></td><td className="py-3 pr-3">{task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Nespárováno'}</td><td className="py-3 pr-3">{dateOnly(task.scheduledDate)}<br /><span className="text-slate-500">do {dateOnly(task.dueDate)}</span></td><td className="py-3 pr-3">{task.carrier?.code ?? task.location ?? '-'}</td><td className="py-3 pr-3">{task.vehicle?.name ?? '-'}</td><td className="py-3 pr-3"><StatusPill value={task.priority} /></td><td className="py-3 pr-3"><StatusPill value={task.status} /></td></tr>)}</tbody></table> }</section>
    </AppShell>
  );
}
