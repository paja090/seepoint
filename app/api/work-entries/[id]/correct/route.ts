import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { canAccess } from '@/lib/rbac';
import { correctApprovedWorkEntry } from '@/lib/work-entry-actions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('workEntries');
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'workEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění opravovat záznamy práce.' }, { status: 403 });
  }

  const { id } = await params;

  let body: {
    quantity?: number;
    unitPrice?: number;
    note?: string;
    reason?: string;
  };

  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const { quantity, unitPrice, note, reason } = body;

  try {
    const result = await correctApprovedWorkEntry(
      id,
      { quantity, unitPrice, note },
      reason || '',
      user.id
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebyl nalezen')) {
      return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při opravě.' }, { status: 400 });
  }
}
