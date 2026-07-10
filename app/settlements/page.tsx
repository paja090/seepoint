import { Prisma } from '@prisma/client';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canViewAllSettlements, getCurrentUser } from '@/lib/rbac';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED'] as const;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function clean(value: string | string[] | undefined) { return first(value)?.trim() || undefined; }

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = getCurrentUser();
  if (!canViewAllSettlements(user.role)) return <AppShell><AccessDenied /></AppShell>;
  const params = await searchParams;
  const status = clean(params.status);
  const employee = clean(params.employee);
  const where: Prisma.SettlementWhereInput = {};
  if (status && statuses.includes(status as typeof statuses[number])) where.status = status as typeof statuses[number];
  if (employee) where.employee = { OR: [{ firstName: { contains: employee, mode: 'insensitive' } }, { lastName: { contains: employee, mode: 'insensitive' } }] };
  const settlements = await prisma.settlement.findMany({ where, include: { employee: true, items: { include: { task: true } } }, orderBy: [{ periodFrom: 'desc' }], take: 500 });
  return (
    <AppShell>
      <div className="mb-6"><h1 className="text-3xl font-bold">Vyúčtování</h1><p className="mt-1 text-sm text-slate-500">Základní evidence období, položek a stavu schvalování.</p></div>
      <form className="card mb-6 grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Zaměstnanec<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="employee" defaultValue={employee} /></label><label className="text-sm font-semibold">Stav<select className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="status" defaultValue={status ?? ''}><option value="">Všechny stavy</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex items-end"><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrovat</button></div></form>
      <section className="card overflow-x-auto"><div className="mb-3 flex justify-between"><h2 className="text-xl font-bold">Seznam vyúčtování</h2><p className="text-sm text-slate-500">Zobrazeno {settlements.length}</p></div>{settlements.length === 0 ? <p className="text-sm text-slate-500">Zatím není evidované žádné vyúčtování.</p> : <table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="border-b py-2 pr-3">Zaměstnanec</th><th className="border-b py-2 pr-3">Období</th><th className="border-b py-2 pr-3">Stav</th><th className="border-b py-2 pr-3">Částka</th><th className="border-b py-2 pr-3">Položky</th><th className="border-b py-2 pr-3">Poznámka</th></tr></thead><tbody>{settlements.map((settlement) => <tr className="border-b last:border-0" key={settlement.id}><td className="py-3 pr-3"><b>{settlement.employee.firstName} {settlement.employee.lastName}</b></td><td className="py-3 pr-3">{dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}</td><td className="py-3 pr-3"><StatusPill value={settlement.status} /></td><td className="py-3 pr-3">{money(settlement.totalAmount)}</td><td className="py-3 pr-3">{settlement.items.length}</td><td className="py-3 pr-3">{settlement.note ?? '-'}</td></tr>)}</tbody></table>}</section>
    </AppShell>
  );
}
