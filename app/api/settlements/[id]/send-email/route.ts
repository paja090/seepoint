import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { sendSettlementInvoiceEmail } from '@/lib/settlement-invoice';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess(['settlements', 'mySettlements']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;

  let body: { recipientEmail?: string; customMessage?: string; scope?: 'WORK_ONLY' | 'ALL' } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const recipientEmail = body.recipientEmail?.trim();
  if (!recipientEmail) {
    return NextResponse.json({ error: 'E-mail příjemce je povinný.' }, { status: 400 });
  }

  try {
    const actor = {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const result = await sendSettlementInvoiceEmail({
      settlementId: id,
      recipientEmail,
      customMessage: body.customMessage,
      scope: body.scope,
      actor,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebylo nalezeno')) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno.' }, { status: 404 });
    }
    if (err.message.includes('Nemáte oprávnění')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při odesílání e-mailu.' }, { status: 400 });
  }
}
