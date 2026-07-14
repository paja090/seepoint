import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { rejectWorkExpense } from '@/lib/work-expense-actions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'workEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění zamítat výdaje.' }, { status: 403 });
  }

  const { id } = await params;

  let body: { reason?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const { reason } = body;

  try {
    const updated = await rejectWorkExpense(id, reason || '', user.id);
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebyl nalezen')) {
      return NextResponse.json({ error: 'Výdaj nebyl nalezen.' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při zamítnutí výdaje.' }, { status: 400 });
  }
}
