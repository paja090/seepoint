import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addManualAdjustment } from '@/lib/settlement-actions';
import { getOrCreateSettlement } from '@/lib/settlement-generation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess(['settlements', 'mySettlements', 'workEntries', 'myWorkEntries']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    amount?: string | number;
    description?: string;
    reason?: string;
    category?: string;
    adjustmentType?: 'REIMBURSEMENT' | 'BONUS' | 'DEDUCTION' | 'ADVANCE';
    isRecurring?: boolean;
    employeeId?: string;
    workDate?: string;
  };

  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const { amount, description, reason, category, adjustmentType, isRecurring, employeeId, workDate } = body;

  const finalReason =
    typeof reason === 'string' && reason.trim().length >= 5
      ? reason.trim()
      : typeof description === 'string' && description.trim().length >= 5
      ? `Zápis položky: ${description.trim()}`
      : 'Zápis ostatního nákladu / položky vyúčtování';

  if (amount === undefined || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Chybí povinné údaje (částka a popis).' }, { status: 400 });
  }

  try {
    let targetSettlementId = id;
    if (id === 'current') {
      const isPrivileged = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT';
      let resolvedEmployeeId = employeeId;
      if (!resolvedEmployeeId || !isPrivileged) {
        const emp = await prisma.employee.findFirst({
          where: { OR: [{ userId: user.id }, { email: user.email }] },
        });
        if (!emp) {
          return NextResponse.json({ error: 'Zaměstnanecký profil nebyl nalezen.' }, { status: 404 });
        }
        resolvedEmployeeId = emp.id;
      }
      const targetDate = workDate ? new Date(workDate) : new Date();
      const settlement = await prisma.$transaction(async (tx) =>
        getOrCreateSettlement({ employeeId: resolvedEmployeeId!, workDate: targetDate }, tx)
      );
      targetSettlementId = settlement.id;
    }

    const actor = { id: user.id, email: user.email, role: user.role };
    const adj = await addManualAdjustment(
      {
        settlementId: targetSettlementId,
        amount,
        description,
        reason: finalReason,
        category,
        adjustmentType,
        isRecurring,
      },
      actor
    );

    return NextResponse.json({
      id: adj.id,
      settlementId: targetSettlementId,
      amount: adj.amount.toString(),
      type: adj.type,
    }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebylo nalezeno')) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno.' }, { status: 404 });
    }
    if (err.message.includes('Nemáte oprávnění')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při vytváření položky.' }, { status: 400 });
  }
}
