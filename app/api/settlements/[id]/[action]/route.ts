import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  lockSettlement,
  paySettlement,
} from '@/lib/settlement-actions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id, action } = await params;

  let body: { reason?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  try {
    const actor = { id: user.id, email: user.email, role: user.role };

    let result;
    switch (action) {
      case 'submit':
        result = await submitSettlement(id, actor);
        break;
      case 'approve':
        result = await approveSettlement(id, actor);
        break;
      case 'reject':
        if (!body.reason) {
          return NextResponse.json({ error: 'Pro zamítnutí vyúčtování musíte vyplnit důvod.' }, { status: 400 });
        }
        result = await rejectSettlement(id, body.reason, actor);
        break;
      case 'lock':
        result = await lockSettlement(id, actor);
        break;
      case 'pay':
        result = await paySettlement(id, actor);
        break;
      default:
        return NextResponse.json({ error: 'Neznámá akce vyúčtování.' }, { status: 400 });
    }

    return NextResponse.json({
      id: result.id,
      status: result.status,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebylo nalezeno')) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno.' }, { status: 404 });
    }
    if (err.message.includes('Nemáte oprávnění') || err.message.includes('Pouze manažer')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při provádění akce.' }, { status: 400 });
  }
}
