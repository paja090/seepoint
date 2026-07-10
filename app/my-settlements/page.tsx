import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess, getCurrentUser } from '@/lib/rbac';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';

export const dynamic = 'force-dynamic';

export default async function MySettlementsPage() {
  const user = getCurrentUser();
  if (!canAccess(user.role, 'mySettlements')) return <AppShell><AccessDenied /></AppShell>;
  const employee = await prisma.employee.findFirst({ where: { OR: [{ userId: user.id }, { email: user.email }] } });
  const settlements = employee ? await prisma.settlement.findMany({ where: { employeeId: employee.id }, include: { items: { include: { task: true } } }, orderBy: { periodFrom: 'desc' }, take: 100 }) : [];
  return (
    <AppShell>
      <div className="mb-6"><h1 className="text-3xl font-bold">Moje vyúčtování</h1><p className="mt-1 text-sm text-slate-500">Osobní přehled vyúčtování pro přihlášeného pracovníka.</p></div>
      {!employee ? <section className="card"><h2 className="text-xl font-bold">Profil nenalezen</h2><p className="mt-2 text-sm text-slate-500">Pro mock uživatele {user.email} zatím není založený zaměstnanecký profil.</p></section> : <section className="card"><h2 className="mb-3 text-xl font-bold">{employee.firstName} {employee.lastName}</h2>{settlements.length === 0 ? <p className="text-sm text-slate-500">Zatím nemáte žádné vyúčtování.</p> : settlements.map((settlement) => <div className="border-b py-3 text-sm last:border-0" key={settlement.id}><div className="flex flex-wrap items-center justify-between gap-2"><b>{dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}</b><StatusPill value={settlement.status} /></div><p className="mt-1 text-slate-500">{money(settlement.totalAmount)} · položek {settlement.items.length}</p></div>)}</section>}
    </AppShell>
  );
}
