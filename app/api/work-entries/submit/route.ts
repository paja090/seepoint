import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { submitWorkEntries } from '@/lib/work-entry-actions';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'myWorkEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění k odesílání výkazů práce.' }, { status: 403 });
  }

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  }

  const { ids } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Musíte vybrat alespoň jeden záznam k odeslání.' }, { status: 400 });
  }

  try {
    const actor = { id: user.id, email: user.email, role: user.role };
    await submitWorkEntries(ids, actor);

    return NextResponse.json({ success: true, message: 'Záznamy byly úspěšně odeslány ke schválení.' });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Nastala chyba při odesílání.' }, { status: 400 });
  }
}
