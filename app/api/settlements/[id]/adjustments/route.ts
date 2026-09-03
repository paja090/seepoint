import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addManualAdjustment } from '@/lib/settlement-actions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;

  let body: {
    amount?: string | number;
    description?: string;
    reason?: string;
    category?: string;
  };

  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const { amount, description, reason, category } = body;

  if (amount === undefined || typeof description !== 'string' || typeof reason !== 'string') {
    return NextResponse.json({ error: 'Chybí povinné údaje pro korekci.' }, { status: 400 });
  }

  try {
    const actor = { id: user.id, email: user.email, role: user.role };
    const adj = await addManualAdjustment(
      {
        settlementId: id,
        amount,
        description,
        reason,
        category,
      },
      actor
    );

    return NextResponse.json({
      id: adj.id,
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
    return NextResponse.json({ error: err.message || 'Nastala chyba při vytváření korekce.' }, { status: 400 });
  }
}
