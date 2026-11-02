import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import type { CommunicationType } from '@prisma/client';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro přístup k AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const message = await prisma.aiInboxMessage.findFirst({
    where: { id: params.id, organizationId },
    select: {
      id: true,
      clientId: true,
      crmOrderId: true,
      crmOrder: { select: { id: true, clientId: true, orderNumber: true } },
    },
  });

  if (!message) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    subject?: string;
    content?: string;
    type?: string;
    isInternal?: boolean;
  } | null;

  const content = body?.content?.trim();
  if (!content) {
    return NextResponse.json({ error: 'Text poznámky je povinný.' }, { status: 400 });
  }

  let clientId = message.clientId;
  const crmOrderId = message.crmOrderId || message.crmOrder?.id || null;

  if (!clientId && message.crmOrder?.clientId) {
    clientId = message.crmOrder.clientId;
  }

  if (!clientId) {
    return NextResponse.json(
      { error: 'Pro uložení týmové poznámky je nejprve potřeba zprávu přiřadit ke klientovi nebo zakázce.' },
      { status: 400 }
    );
  }

  const allowedTypes: CommunicationType[] = ['NOTE', 'EMAIL', 'PHONE_CALL', 'IN_PERSON_MEETING', 'ONLINE_MEETING', 'INTERNAL_NOTE'];
  const type: CommunicationType = allowedTypes.includes(body?.type as CommunicationType)
    ? (body?.type as CommunicationType)
    : 'NOTE';

  const subject = body?.subject?.trim() || (crmOrderId ? `Interní poznámka k zakázce` : 'Interní týmová poznámka');
  const isInternal = body?.isInternal ?? true;

  try {
    const created = await prisma.clientCommunication.create({
      data: {
        organizationId,
        clientId,
        crmOrderId,
        authorUserId: user.id,
        type,
        subject,
        content,
        isInternal,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.client.update({
      where: { id: clientId },
      data: { lastActivityAt: new Date() },
    });

    return NextResponse.json({ ok: true, communication: created });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při ukládání týmové poznámky';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
