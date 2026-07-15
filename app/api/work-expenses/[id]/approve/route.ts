import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { approveWorkExpense } from '@/lib/work-expense-actions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'workEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění schvalovat výdaje.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const updated = await approveWorkExpense(id, user.id);
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebyl nalezen')) {
      return NextResponse.json({ error: 'Výdaj nebyl nalezen.' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při schvalování výdaje.' }, { status: 400 });
  }
}
