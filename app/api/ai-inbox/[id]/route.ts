import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { getAiInboxMessageDetail } from '@/lib/ai-inbox/service';
import { prisma } from '@/lib/db';
import type { AiInboxStatus } from '@prisma/client';

export async function GET(
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

  const message = await getAiInboxMessageDetail(organizationId, params.id);
  if (!message) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  return NextResponse.json(message);
}

export async function PATCH(
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

  const body = await request.json() as {
    clientId?: string | null;
    requiresReview?: boolean;
    processingStatus?: AiInboxStatus;
  };

  const existing = await prisma.aiInboxMessage.findFirst({
    where: { id: params.id, organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  const updated = await prisma.aiInboxMessage.update({
    where: { id: params.id },
    data: {
      clientId: body.clientId !== undefined ? body.clientId : undefined,
      requiresReview: body.requiresReview !== undefined ? body.requiresReview : undefined,
      processingStatus: body.processingStatus !== undefined ? body.processingStatus : undefined,
    },
  });

  return NextResponse.json(updated);
}
