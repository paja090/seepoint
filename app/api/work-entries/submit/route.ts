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
  if (ids.length > 100 || ids.some((id) => typeof id !== 'string' || !id.trim() || id.length > 100)) {
    return NextResponse.json({ error: 'Najednou lze odeslat nejvýše 100 platných záznamů.' }, { status: 400 });
  }
  const uniqueIds = [...new Set(ids.map((id) => id.trim()))];

  try {
    const actor = { id: user.id, email: user.email, role: user.role };
    await submitWorkEntries(uniqueIds, actor);

    return NextResponse.json({ success: true, message: 'Záznamy byly úspěšně odeslány ke schválení.' });
  } catch (error: unknown) {
    const err = error as Error;
    const known = ['nebyly nalezeny', 'cizí záznam', 'koncepty a vrácené záznamy', 'Zaměstnanecký profil'];
    if (known.some((message) => err.message.includes(message))) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('Submit work entries failed', error);
    return NextResponse.json({ error: 'Záznamy se nepodařilo odeslat.' }, { status: 500 });
  }
}
