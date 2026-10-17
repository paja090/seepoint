import { Prisma } from '@prisma/client';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canViewAllSettlements } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';
import { WorkStatisticsPanel } from '@/components/WorkStatisticsPanel';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'LOCKED', 'PAID', 'REJECTED'] as const;
const statusLabels: Record<typeof statuses[number], string> = {
  DRAFT: 'Koncept',
  SUBMITTED: 'Odesláno',
  APPROVED: 'Schváleno',
  LOCKED: 'Uzamčeno',
  PAID: 'Vyplaceno',
  REJECTED: 'Zamítnuto',
};
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function clean(value: string | string[] | undefined) {
  return first(value)?.trim() || undefined;
}

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('settlements');
  if (!canViewAllSettlements(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }
  const params = await searchParams;
  const status = clean(params.status);
  const employee = clean(params.employee)?.slice(0, 100);
  const where: Prisma.SettlementWhereInput = {};
  if (status && statuses.includes(status as typeof statuses[number])) {
    where.status = status as typeof statuses[number];
  }
  if (employee) {
    where.employee = {
      OR: [
        { firstName: { contains: employee, mode: 'insensitive' } },
        { lastName: { contains: employee, mode: 'insensitive' } },
      ],
    };
  }
  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      employee: true,
      items: { include: { task: true } },
    },
    orderBy: [{ periodFrom: 'desc' }],
    take: 500,
  });

  const allStatEntries = settlements.flatMap((s) =>
    s.items.map((item) => ({
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
  );

  const totalReimbursements = settlements.reduce((acc, s) => acc + Number(s.totalReimbursements), 0);
  const totalDeductions = settlements.reduce((acc, s) => acc + Number(s.totalDeductions), 0);
  const totalAdvances = settlements.reduce((acc, s) => acc + Number(s.totalAdvances), 0);
  const finalPayableAmount = settlements.reduce((acc, s) => acc + Number(s.finalPayableAmount), 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vyúčtování</h1>
          <p className="mt-1 text-sm text-slate-500">
            Přehled období, hodinových a úkolových prací, ostatních nákladů a stavu schvalování.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/work-entries"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
          >
            + Zapsat práci nebo náklad
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <WorkStatisticsPanel
          items={allStatEntries}
          financialExtras={{
            reimbursements: totalReimbursements,
            deductions: totalDeductions,
            advances: totalAdvances,
            finalPayable: finalPayableAmount,
          }}
          title="Souhrnná statistika zobrazených vyúčtování"
        />
      </div>

      <form className="card mb-6 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold">
          Zaměstnanec
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
            name="employee"
            maxLength={100}
            defaultValue={employee}
            placeholder="Jméno nebo příjmení..."
          />
        </label>
        <label className="text-sm font-semibold">
          Stav
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
            name="status"
            defaultValue={status ?? ''}
          >
            <option value="">Všechny stavy</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Filtrovat
          </button>
          {(employee || status) && (
            <Link
              href="/settlements"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <section className="card overflow-x-auto">
        <div className="mb-3 flex justify-between">
          <h2 className="text-xl font-bold">Seznam vyúčtování</h2>
          <p className="text-sm text-slate-500">Zobrazeno {settlements.length}</p>
        </div>
        {settlements.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím není evidované žádné vyúčtování.</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b py-2 pr-3">Zaměstnanec</th>
                <th className="border-b py-2 pr-3">Období</th>
                <th className="border-b py-2 pr-3">Stav</th>
                <th className="border-b py-2 pr-3">Za práci</th>
                <th className="border-b py-2 pr-3">Ostatní náklady</th>
                <th className="border-b py-2 pr-3">K výplatě</th>
                <th className="border-b py-2 pr-3">Položky</th>
                <th className="border-b py-2 pr-3 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => {
                const netAdj =
                  Number(settlement.totalReimbursements) -
                  Number(settlement.totalDeductions) -
                  Number(settlement.totalAdvances);
                return (
                  <tr className="border-b last:border-0 hover:bg-slate-50/50" key={settlement.id}>
                    <td className="py-3 pr-3">
                      <b>
                        {settlement.employee.firstName} {settlement.employee.lastName}
                      </b>
                    </td>
                    <td className="py-3 pr-3">
                      {dateOnly(settlement.periodFrom)} – {dateOnly(settlement.periodTo)}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill value={settlement.status} />
                    </td>
                    <td className="py-3 pr-3 font-medium">{money(settlement.totalWorkAmount)}</td>
                    <td
                      className={`py-3 pr-3 font-medium ${
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
                    <td className="py-3 pr-3 font-black text-slate-900">
                      {money(settlement.finalPayableAmount)}
                    </td>
                    <td className="py-3 pr-3">{settlement.items.length} položek</td>
                    <td className="py-3 pr-3 text-right">
                      <Link
                        className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                        href={`/settlements/${settlement.id}`}
                      >
                        Otevřít detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
