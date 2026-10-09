import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  const { id: clientId } = await params;

  try {
    const body = (await req.json().catch(() => null)) as {
      to?: string;
      subject?: string;
      message?: string;
      contactId?: string;
      crmOrderId?: string;
    } | null;

    const to = body?.to?.trim();
    const subject = body?.subject?.trim();
    const message = body?.message?.trim();

    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Vyplňte prosím příjemce, předmět a text zprávy.' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, active: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }

    const delivery = await sendTransactionalEmail({
      to,
      subject,
      message,
      template: 'client-crm-email',
      organizationId: user.organizationId,
      idempotencyKey: `crm-email-${clientId}-${Date.now()}`,
    });

    const communication = await prisma.$transaction(async (tx) => {
      const created = await tx.clientCommunication.create({
        data: {
          clientId,
          contactId: body?.contactId || null,
          authorUserId: user.id,
          crmOrderId: body?.crmOrderId || null,
          type: 'EMAIL',
          subject,
          content: message,
          isInternal: false,
        },
      });

      await tx.client.update({
        where: { id: clientId },
        data: { lastActivityAt: new Date() },
      });

      await tx.crmAuditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: 'SEND_CLIENT_EMAIL',
          entityType: 'Client',
          entityId: clientId,
          detailsJson: JSON.stringify({ communicationId: created.id, to }),
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, communication, delivery });
  } catch (err: unknown) {
    console.error('CRM client email sending failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: err instanceof Error ? err.message : 'E-mail se nepodařilo odeslat.' }, { status: 500 });
  }
}
