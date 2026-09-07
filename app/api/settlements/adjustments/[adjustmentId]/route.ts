import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { deleteManualAdjustment } from '@/lib/settlement-actions';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ adjustmentId: string }> }
) {
  const user = await requireApiAccess('settlements');
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { adjustmentId } = await params;

  let body: { reason?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const { reason } = body;
  if (!reason) {
    return NextResponse.json({ error: 'Pro smazání korekce musíte vyplnit důvod.' }, { status: 400 });
  }

  try {
    const actor = { id: user.id, email: user.email, role: user.role };
    await deleteManualAdjustment(adjustmentId, reason, actor);

    return NextResponse.json({ success: true, message: 'Korekce byla úspěšně smazána.' });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nalezena')) {
      return NextResponse.json({ error: 'Korekce nebyla nalezena.' }, { status: 404 });
    }
    if (err.message.includes('Nemáte oprávnění')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při mazání korekce.' }, { status: 400 });
  }
}
