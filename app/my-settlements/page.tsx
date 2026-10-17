import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { MySettlementsView } from '@/components/MySettlementsView';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MySettlementsPage() {
  const user = await requirePageAccess('mySettlements');
  if (!canAccess(user.role, 'mySettlements')) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [{ userId: user.id }, { email: user.email }],
    },
  });

  const settlements = employee
    ? await prisma.settlement.findMany({
        where: { employeeId: employee.id },
        include: {
          items: {
            include: { task: true },
          },
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 100,
      })
    : [];

  const formattedSettlements = settlements.map((s) => ({
    id: s.id,
    periodYear: s.periodYear,
    periodMonth: s.periodMonth,
    periodFrom: s.periodFrom.toISOString(),
    periodTo: s.periodTo.toISOString(),
    status: s.status,
    totalWorkAmount: s.totalWorkAmount.toString(),
    totalReimbursements: s.totalReimbursements.toString(),
    totalDeductions: s.totalDeductions.toString(),
    totalAdvances: s.totalAdvances.toString(),
    finalPayableAmount: s.finalPayableAmount.toString(),
    note: s.note,
    items: s.items.map((i) => ({
      id: i.id,
      quantity: i.quantity?.toString() ?? null,
      unit: i.unit,
      rateType: i.rateType,
      amount: i.amount.toString(),
      workType: i.workType,
      description: i.description,
    })),
  }));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Moje vyúčtování</h1>
          <p className="mt-1 text-sm text-slate-500">
            Osobní přehled vyúčtování, odpracovaných hodin, úkolů, ostatních nákladů a podkladů k fakturaci.
          </p>
        </div>
        <Link
          href="/my-work-entries"
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
        >
          + Zapsat práci nebo náklad
        </Link>
      </div>

      {!employee ? (
        <section className="card">
          <h2 className="text-xl font-bold">Profil nenalezen</h2>
          <p className="mt-2 text-sm text-slate-500">
            Pro účet {user.email} zatím není založený zaměstnanecký profil.
          </p>
        </section>
      ) : (
        <MySettlementsView employee={employee} settlements={formattedSettlements} />
      )}
    </AppShell>
  );
}
