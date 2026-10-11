import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { getNavigationOrderDetail } from '@/lib/navigation/navigation-service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAccess('offers', 'navigation');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  const id = (await params).id;

  try {
    const body = await req.json();
    const { contactPerson, contactEmail, contactPhone, assignedUserId } = body;

    const order = await prisma.navigationOrder.findUnique({
      where: { id },
      include: {
        crmOrder: {
          include: {
            client: true,
            contact: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Navigační zakázka nebyla nalezena.' }, { status: 404 });
    }

    if (user.role === 'SALES' && order.crmOrder.assignedUserId !== user.id) {
      const isOfferOwner = order.crmOrder.offerId
        ? Boolean(await prisma.offer.findFirst({ where: { id: order.crmOrder.offerId, createdByUserId: user.id } }))
        : false;
      if (!isOfferOwner) {
        return NextResponse.json({ error: 'K této navigační zakázce nemáte přístup.' }, { status: 403 });
      }
    }

    const orgId = user.organizationId || order.organizationId;

    if (assignedUserId) {
      const validMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: orgId,
          userId: assignedUserId,
          isActive: true,
        },
      });
      if (!validMember) {
        return NextResponse.json({ error: 'Vybraný obchodník není aktivním členem organizace.' }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Aktualizace údajů klienta v CRM
      await tx.client.update({
        where: { id: order.crmOrder.clientId },
        data: {
          contactPerson: contactPerson !== undefined ? (contactPerson?.trim() || null) : undefined,
          email: contactEmail !== undefined ? (contactEmail?.trim() || null) : undefined,
          phone: contactPhone !== undefined ? (contactPhone?.trim() || null) : undefined,
          lastActivityAt: new Date(),
        },
      });

      // 2. Pokud má zakázka přiřazen konkrétní kontakt (ClientContact), zaktualizujeme i ten
      if (order.crmOrder.contactId) {
        const trimmedPerson = (contactPerson || '').trim();
        const parts = trimmedPerson.split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || firstName;

        await tx.clientContact.update({
          where: { id: order.crmOrder.contactId },
          data: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            email: contactEmail !== undefined ? (contactEmail?.trim() || null) : undefined,
            phone: contactPhone !== undefined ? (contactPhone?.trim() || null) : undefined,
          },
        });
      }

      // 3. Aktualizace přiřazeného obchodníka na zakázce
      if (assignedUserId !== undefined) {
        await tx.crmOrder.update({
          where: { id: order.crmOrderId },
          data: {
            assignedUserId: assignedUserId || null,
          },
        });
      }

      // 4. Auditní záznam
      await tx.crmAuditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          action: 'UPDATE_CONTACT',
          entityType: 'NavigationOrder',
          entityId: order.id,
          detailsJson: JSON.stringify({
            contactPerson: contactPerson?.trim() || null,
            contactEmail: contactEmail?.trim() || null,
            contactPhone: contactPhone?.trim() || null,
            assignedUserId: assignedUserId || null,
            clientId: order.crmOrder.clientId,
          }),
        },
      });
    });

    const updatedOrder = await getNavigationOrderDetail(id, user);
    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: unknown) {
    console.error('[navigation/orders/contact] Contact update failed', err instanceof Error ? err.message : 'unknown');
    const msg = err instanceof Error ? err.message : 'Chyba při ukládání kontaktních údajů.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
