import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canViewAllSettlements, AccessDenied } from '@/lib/rbac';
import { AppShell } from '@/components/AppShell';
import { SettlementDetailManager } from '@/components/SettlementDetailManager';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <AppShell>
        <section className="card">
          <h1 className="text-2xl font-bold">Přihlášení vyžadováno</h1>
          <p className="mt-2 text-sm text-slate-600">Pro zobrazení této stránky se musíte přihlásit.</p>
        </section>
      </AppShell>
    );
  }

  if (!canViewAllSettlements(user.role)) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const { id } = await params;

  // 1. Fetch settlement with items and adjustments
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      employee: true,
      items: {
        include: {
          task: true,
        },
        orderBy: { date: 'asc' },
      },
      adjustments: {
        orderBy: { createdAt: 'asc' },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!settlement) {
    return (
      <AppShell>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Detail vyúčtování</h1>
        </div>
        <section className="card">
          <h2 className="text-xl font-bold text-red-800">Vyúčtování nenalezeno</h2>
          <p className="mt-2 text-sm text-slate-500">
            Vyúčtování s ID {id} nebylo v systému nalezeno.
          </p>
          <div className="mt-4">
            <Link href="/settlements" className="text-sm font-semibold text-blue-600 hover:underline">
              ← Zpět na seznam vyúčtování
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  // 2. Fetch expenses inside the period
  const expenses = await prisma.workExpense.findMany({
    where: {
      workEntry: {
        employeeId: settlement.employeeId,
        workDate: {
          gte: settlement.periodFrom,
          lte: settlement.periodTo,
        },
      },
    },
    include: {
      workEntry: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const formattedSettlement = {
    id: settlement.id,
    periodFrom: settlement.periodFrom.toISOString(),
    periodTo: settlement.periodTo.toISOString(),
    periodYear: settlement.periodYear,
    periodMonth: settlement.periodMonth,
    status: settlement.status,
    note: settlement.note,
    totalWorkAmount: settlement.totalWorkAmount.toString(),
    totalReimbursements: settlement.totalReimbursements.toString(),
    totalDeductions: settlement.totalDeductions.toString(),
    totalAdvances: settlement.totalAdvances.toString(),
    finalPayableAmount: settlement.finalPayableAmount.toString(),
    employee: {
      id: settlement.employee.id,
      firstName: settlement.employee.firstName,
      lastName: settlement.employee.lastName,
      email: settlement.employee.email || '',
    },
    items: settlement.items.map((item) => ({
      id: item.id,
      date: item.date.toISOString(),
      description: item.description,
      quantity: item.quantity?.toString() ?? null,
      unit: item.unit,
      unitPrice: item.unitPrice?.toString() ?? null,
      amount: item.amount.toString(),
      appliedRate: item.appliedRate.toString(),
      rateType: item.rateType,
      rateSource: item.rateSource,
      workType: item.workType,
      task: item.task ? { title: item.task.title } : null,
      note: item.note,
    })),
    adjustments: settlement.adjustments.map((adj) => ({
      id: adj.id,
      type: adj.type,
      category: adj.category,
      description: adj.description,
      amount: adj.amount.toString(),
      reason: adj.reason,
      changedByUserId: adj.changedByUserId,
      createdAt: adj.createdAt.toISOString(),
    })),
    auditLogs: settlement.auditLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.userName,
      action: log.action,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    })),
    expenses: expenses.map((exp) => ({
      id: exp.id,
      type: exp.type,
      description: exp.description,
      amount: exp.amount.toString(),
      status: exp.status,
      rejectionReason: exp.rejectionReason,
      receiptUrl: exp.receiptPhotoId ? `/api/photos/${exp.receiptPhotoId}/file` : null,
      workDate: exp.workEntry.workDate.toISOString(),
    })),
  };

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/settlements" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition">
          ← Zpět na seznam vyúčtování
        </Link>
        <h1 className="text-3xl font-bold mt-1">Detail vyúčtování</h1>
      </div>

      <SettlementDetailManager
        settlement={formattedSettlement}
        currentUser={{ id: user.id, email: user.email, role: user.role }}
      />
    </AppShell>
  );
}
