import { Prisma } from '@prisma/client';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canViewAllSettlements } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkStatisticsPanel } from '@/components/WorkStatisticsPanel';
import { SettlementsManagerView } from '@/components/SettlementsManagerView';

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
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { periodFrom: 'desc' }],
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

  const formattedManagerSettlements = settlements.map((s) => ({
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
    employeeId: s.employeeId,
    employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
    employee: {
      firstName: s.employee.firstName,
      lastName: s.employee.lastName,
      email: s.employee.email,
    },
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
          <h1 className="text-3xl font-bold">Vyúčtování & Uzávěrky</h1>
          <p className="mt-1 text-sm text-slate-500">
            Přehled období, měsíčních uzávěrek, hodinových a úkolových prací, ostatních nákladů a podkladů k fakturaci.
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

      <SettlementsManagerView
        settlements={formattedManagerSettlements}
        filterEmployee={employee}
      />
    </AppShell>
  );
}
