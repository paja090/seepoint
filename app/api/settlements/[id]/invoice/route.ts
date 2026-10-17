import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildSettlementInvoiceData, generateSettlementInvoice } from '@/lib/settlement-invoice';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess(['settlements', 'mySettlements']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno.' }, { status: 404 });
    }

    const isPrivileged = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT';
    const isOwner = settlement.employee.userId === user.id || settlement.employee.email === user.email;

    if (!isPrivileged && !isOwner) {
      return NextResponse.json({ error: 'Nemáte oprávnění k tomuto vyúčtování.' }, { status: 403 });
    }

    const invoiceData = await buildSettlementInvoiceData(id);
    return NextResponse.json(invoiceData);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Nastala chyba při načítání dokladu vyúčtování.' }, { status: 500 });
  }
}

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

  let body: { closeMonth?: boolean } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  try {
    const actor = { id: user.id, email: user.email, role: user.role };
    const result = await generateSettlementInvoice(id, actor, { closeMonth: Boolean(body.closeMonth) });
    const invoiceData = await buildSettlementInvoiceData(id);

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      settlementStatus: result.settlement.status,
      invoiceData,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('nebylo nalezeno')) {
      return NextResponse.json({ error: 'Vyúčtování nebylo nalezeno.' }, { status: 404 });
    }
    if (err.message.includes('Nemáte oprávnění')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při generování vyúčtování.' }, { status: 400 });
  }
}
