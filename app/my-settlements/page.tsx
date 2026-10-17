import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';
import { WorkStatisticsPanel } from '@/components/WorkStatisticsPanel';
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
        orderBy: { periodFrom: 'desc' },
        take: 100,
      })
    : [];

  const latestSettlement = settlements[0];
  const statEntries = latestSettlement
    ? latestSettlement.items.map((item) => ({
        quantity: item.quantity?.toString() ?? '0',
        unit: item.unit ?? null,
        remunerationMethod: item.rateType ?? null,
        rateType: item.rateType ?? null,
        calculatedAmount: item.amount.toString(),
        amount: item.amount.toString(),
        workType: item.workType ?? 'OTHER',
        carrierTypeLabel: item.carrierTypeLabel ?? null,
        taskTitle: item.task?.title ?? null,
        description: item.description,
      }))
    : [];

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Moje vyúčtování</h1>
          <p className="mt-1 text-sm text-slate-500">
            Osobní přehled vyúčtování, odpracovaných hodin, úkolů a ostatních nákladů.
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
        <>
          {latestSettlement && (
            <div className="mb-6">
              <WorkStatisticsPanel
                items={statEntries}
                financialExtras={{
                  reimbursements: Number(latestSettlement.totalReimbursements),
                  deductions: Number(latestSettlement.totalDeductions),
                  advances: Number(latestSettlement.totalAdvances),
                  finalPayable: Number(latestSettlement.finalPayableAmount),
                }}
                title={`Aktuální vyúčtování (${dateOnly(latestSettlement.periodFrom)} – ${dateOnly(latestSettlement.periodTo)})`}
              />
            </div>
          )}

          <section className="card">
            <h2 className="mb-4 text-xl font-bold border-b pb-3">
              {employee.firstName} {employee.lastName}
            </h2>

            {settlements.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500 italic mb-3">
                  Zatím nemáte žádné vygenerované vyúčtování. Jakmile zapíšete první práci nebo náklad, období se vytvoří automaticky.
                </p>
                <Link
                  href="/my-work-entries"
                  className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  Zapsat první práci
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[650px]">
                  <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                    <tr>
                      <th className="py-2 pr-3">Období</th>
                      <th className="py-2 pr-3">Stav</th>
                      <th className="py-2 pr-3">Položky</th>
                      <th className="py-2 pr-3 text-right">Za práci</th>
                      <th className="py-2 pr-3 text-right">Ostatní náklady</th>
                      <th className="py-2 pr-3 text-right">K výplatě</th>
                      <th className="py-2 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => {
                      const netAdj =
                        Number(settlement.totalReimbursements) -
                        Number(settlement.totalDeductions) -
                        Number(settlement.totalAdvances);
                      return (
                        <tr
                          className="border-b last:border-0 hover:bg-slate-50/50 transition"
                          key={settlement.id}
                        >
                          <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                            {dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <StatusPill value={settlement.status} />
                          </td>
                          <td className="py-3 pr-3 text-slate-500 whitespace-nowrap">
                            {settlement.items.length} položek
                          </td>
                          <td className="py-3 pr-3 text-right font-medium text-slate-700 whitespace-nowrap font-mono">
                            {money(settlement.totalWorkAmount)}
                          </td>
                          <td
                            className={`py-3 pr-3 text-right font-medium whitespace-nowrap font-mono ${
                              netAdj < 0
                                ? 'text-red-600'
                                : netAdj > 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-400'
                            }`}
                          >
                            {netAdj === 0
                              ? '0 Kč'
                              : `${netAdj > 0 ? '+' : ''}${netAdj.toLocaleString('cs-CZ')} Kč`}
                          </td>
                          <td className="py-3 pr-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                            {money(settlement.finalPayableAmount)}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <Link
                              href={`/my-settlements/${settlement.id}`}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
                            >
                              Otevřít detail
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
