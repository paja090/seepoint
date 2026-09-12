import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

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
    return NextResponse.json({ error: 'Nemáte oprávnění pro odesílání odpovědí v AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const message = await prisma.aiInboxMessage.findFirst({
    where: { id: params.id, organizationId },
  });

  if (!message) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  const body = await request.json() as {
    to?: string;
    subject?: string;
    message?: string;
  };

  const to = body.to?.trim() || message.fromEmail;
  const subject = body.subject?.trim() || `Re: ${message.subject}`;
  const replyContent = body.message?.trim();

  if (!to || !replyContent) {
    return NextResponse.json({ error: 'Příjemce a text odpovědi jsou povinné.' }, { status: 400 });
  }

  try {
    const delivery = await sendTransactionalEmail({
      to,
      subject,
      message: replyContent,
      template: 'ai-inbox-reply',
      organizationId,
      idempotencyKey: `ai-reply-${message.id}-${Date.now()}`,
    });

    if (message.clientId) {
      await prisma.clientCommunication.create({
        data: {
          organizationId,
          clientId: message.clientId,
          authorUserId: user.id,
          type: 'EMAIL',
          subject,
          content: replyContent,
          isInternal: false,
        },
      });
    }

    await prisma.aiInboxMessage.update({
      where: { id: message.id },
      data: {
        processingStatus: 'PROCESSED',
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
    });

    return NextResponse.json({ ok: true, delivery });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Chyba při odesílání e-mailu';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
