import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CommunicationType } from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  const { id: clientId } = await params;

  try {
    const body = await req.json();
    if (!body.subject || !body.content) {
      return NextResponse.json({ error: 'Předmět a obsah záznamu jsou povinné.' }, { status: 400 });
    }
    if (body.type && !Object.values(CommunicationType).includes(body.type)) return NextResponse.json({ error: 'Neplatný typ komunikace.' }, { status: 400 });
    const nextContactDate = body.nextContactDate ? new Date(body.nextContactDate) : null;
    if (nextContactDate && Number.isNaN(nextContactDate.getTime())) return NextResponse.json({ error: 'Datum dalšího kontaktu není platné.' }, { status: 400 });

    const communication = await prisma.$transaction(async (tx) => {
      const clientExists = await tx.client.count({ where: { id: clientId, active: true } });
      if (!clientExists) throw new Error('CLIENT_NOT_FOUND');
      if (body.contactId && !await tx.clientContact.count({ where: { id: body.contactId, clientId, active: true } })) throw new Error('INVALID_RELATION');
      if (body.crmOrderId && !await tx.crmOrder.count({ where: { id: body.crmOrderId, clientId } })) throw new Error('INVALID_RELATION');
      const created = await tx.clientCommunication.create({ data: {
        clientId,
        contactId: body.contactId || null,
        authorUserId: user.id,
        crmOrderId: body.crmOrderId || null,
        type: body.type || 'PHONE_CALL',
        subject: body.subject.trim(),
        content: body.content.trim(),
        result: body.result?.trim() || null,
        nextStep: body.nextStep?.trim() || null,
        nextContactDate,
        isInternal: Boolean(body.isInternal),
      } });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      return created;
    });

    return NextResponse.json({ success: true, communication });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    if (err instanceof Error && err.message === 'INVALID_RELATION') return NextResponse.json({ error: 'Kontakt nebo zakázka nepatří tomuto klientovi.' }, { status: 400 });
    const errorMsg = err instanceof Error ? err.message : 'Chyba při uložení komunikace.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
