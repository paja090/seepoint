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
    crmOrderId?: string | null;
    offerId?: string | null;
    navigationOrderId?: string | null;
    requiresReview?: boolean;
    processingStatus?: AiInboxStatus;
  };

  const existing = await prisma.aiInboxMessage.findFirst({
    where: { id: params.id, organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Zpráva nebyla nalezena.' }, { status: 404 });
  }

  let targetClientId = body.clientId;
  let targetOfferId = body.offerId;
  let targetNavigationOrderId = body.navigationOrderId;

  if (body.crmOrderId) {
    const linkedOrder = await prisma.crmOrder.findFirst({
      where: { id: body.crmOrderId, organizationId },
      select: { clientId: true, offerId: true, navigationOrder: { select: { id: true } } },
    });
    if (linkedOrder) {
      if (targetClientId === undefined && !existing.clientId) {
        targetClientId = linkedOrder.clientId;
      }
      if (targetOfferId === undefined && linkedOrder.offerId) {
        targetOfferId = linkedOrder.offerId;
      }
      if (targetNavigationOrderId === undefined && linkedOrder.navigationOrder) {
        targetNavigationOrderId = linkedOrder.navigationOrder.id;
      }
    }
  }

  const updated = await prisma.aiInboxMessage.update({
    where: { id: params.id },
    data: {
      clientId: targetClientId !== undefined ? targetClientId : undefined,
      crmOrderId: body.crmOrderId !== undefined ? body.crmOrderId : undefined,
      offerId: targetOfferId !== undefined ? targetOfferId : undefined,
      navigationOrderId: targetNavigationOrderId !== undefined ? targetNavigationOrderId : undefined,
      requiresReview: body.requiresReview !== undefined ? body.requiresReview : undefined,
      processingStatus: body.processingStatus !== undefined ? body.processingStatus : undefined,
    },
  });

  return NextResponse.json(updated);
}
