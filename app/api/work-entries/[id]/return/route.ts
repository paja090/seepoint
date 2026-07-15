import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { returnWorkEntry } from '@/lib/work-entry-actions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'workEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění vracet záznamy práce.' }, { status: 403 });
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
    const updated = await returnWorkEntry(id, reason || '');
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebyl nalezen')) {
      return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při vracení záznamu.' }, { status: 400 });
  }
}
