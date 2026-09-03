import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CrmClientValidationError, parseCommunicationInput } from '@/lib/crm/client-policy';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  const { id: clientId } = await params;

  try {
    const body = parseCommunicationInput(await req.json().catch(() => null));

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
        nextContactDate: body.nextContactDate,
        isInternal: body.isInternal,
      } });
      await tx.client.update({ where: { id: clientId }, data: { lastActivityAt: new Date() } });
      await tx.crmAuditLog.create({ data: {
        userId: user.id, userEmail: user.email, action: 'CREATE_CLIENT_COMMUNICATION',
        entityType: 'Client', entityId: clientId, detailsJson: JSON.stringify({ communicationId: created.id, type: created.type }),
      } });
      return created;
    });

    return NextResponse.json({ success: true, communication });
  } catch (err: unknown) {
    if (err instanceof CrmClientValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    if (err instanceof Error && err.message === 'INVALID_RELATION') return NextResponse.json({ error: 'Kontakt nebo zakázka nepatří tomuto klientovi.' }, { status: 400 });
    console.error('CRM communication creation failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Komunikaci se nepodařilo uložit.' }, { status: 500 });
  }
}
