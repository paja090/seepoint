import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { getNavigationOrderDetail } from '@/lib/navigation/navigation-service';
import { transitionNavigationOrderStatus, NavigationWorkflowError } from '@/lib/navigation/workflow-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiAccess('offers', 'navigation');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;
  const id = (await params).id;

  try {
    const order = await getNavigationOrderDetail(id, user);
    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při načítání detailu navigační zakázky.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

    const order = await prisma.navigationOrder.findUnique({
      where: { id },
      include: {
        crmOrder: {
          include: {
            offer: {
              include: {
                navigationOffer: true,
              },
            },
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

    // 1. Update navigationOrder fields if provided
    const navOrderUpdates: Record<string, any> = {};
    if (body.rentStart !== undefined) navOrderUpdates.rentStart = body.rentStart ? new Date(body.rentStart) : null;
    if (body.rentEnd !== undefined) navOrderUpdates.rentEnd = body.rentEnd ? new Date(body.rentEnd) : null;
    if (body.installationDate !== undefined) navOrderUpdates.installationDate = body.installationDate ? new Date(body.installationDate) : null;
    if (body.deinstallationDate !== undefined) navOrderUpdates.deinstallationDate = body.deinstallationDate ? new Date(body.deinstallationDate) : null;
    if (body.targetNote !== undefined) navOrderUpdates.targetNote = body.targetNote ? String(body.targetNote).trim() : null;
    if (body.targetName !== undefined && String(body.targetName).trim()) navOrderUpdates.targetName = String(body.targetName).trim();
    if (body.targetAddress !== undefined) navOrderUpdates.targetAddress = body.targetAddress ? String(body.targetAddress).trim() : null;
    if (body.graphicsApprovedAt !== undefined) navOrderUpdates.graphicsApprovedAt = body.graphicsApprovedAt ? new Date(body.graphicsApprovedAt) : null;

    // 2. Update crmOrder fields if provided
    const crmOrderUpdates: Record<string, any> = {};
    if (body.clientOrderCode !== undefined) crmOrderUpdates.clientOrderCode = body.clientOrderCode ? String(body.clientOrderCode).trim() : null;
    if (body.internalNote !== undefined) crmOrderUpdates.internalNote = body.internalNote ? String(body.internalNote).trim() : null;
    if (body.note !== undefined) crmOrderUpdates.note = body.note ? String(body.note).trim() : null;

    // 3. Update navigationOffer fields if provided
    const navOfferUpdates: Record<string, any> = {};
    if (body.graphicArtworkUrl !== undefined) navOfferUpdates.graphicArtworkUrl = body.graphicArtworkUrl ? String(body.graphicArtworkUrl).trim() : null;
    if (body.clientArtworkUrl !== undefined) navOfferUpdates.clientArtworkUrl = body.clientArtworkUrl ? String(body.clientArtworkUrl).trim() : null;
    if (body.clientArtworkFileName !== undefined) navOfferUpdates.clientArtworkFileName = body.clientArtworkFileName ? String(body.clientArtworkFileName).trim() : null;

    const hasFieldUpdates =
      Object.keys(navOrderUpdates).length > 0 ||
      Object.keys(crmOrderUpdates).length > 0 ||
      Object.keys(navOfferUpdates).length > 0;

    if (!hasFieldUpdates && !body.status) {
      return NextResponse.json({ error: 'Nebyly předány žádné změny k uložení.' }, { status: 400 });
    }

    if (hasFieldUpdates) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        if (Object.keys(navOrderUpdates).length > 0) {
          await tx.navigationOrder.update({
            where: { id },
            data: navOrderUpdates,
          });
        }

        if (Object.keys(crmOrderUpdates).length > 0) {
          await tx.crmOrder.update({
            where: { id: order.crmOrderId },
            data: crmOrderUpdates,
          });
        }

        if (Object.keys(navOfferUpdates).length > 0 && order.crmOrder.offer?.navigationOffer) {
          await tx.navigationOffer.update({
            where: { id: order.crmOrder.offer.navigationOffer.id },
            data: navOfferUpdates,
          });
        }

        const changedFieldNames = [
          ...Object.keys(navOrderUpdates),
          ...Object.keys(crmOrderUpdates),
          ...Object.keys(navOfferUpdates),
        ];

        await tx.crmAuditLog.create({
          data: {
            organizationId: order.organizationId,
            userId: user.id,
            userEmail: user.email || 'system@seepoint.cz',
            action: 'UPDATE_NAVIGATION_ORDER',
            entityType: 'NavigationOrder',
            entityId: id,
            detailsJson: JSON.stringify({
              changedFields: changedFieldNames,
              revertReason: body.revertReason,
            }),
          },
        });
      });
    }

    // 4. Status transition if requested
    if (body.status) {
      await transitionNavigationOrderStatus(id, body.status, user.id, user.name);
    }

    const updated = await getNavigationOrderDetail(id, user);
    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    if (err instanceof NavigationWorkflowError) {
      let resolution: { type: string; label: string; tab?: string; url?: string } | undefined;
      if (err.code === 'MISSING_INSTALLATION_PHOTO') {
        resolution = {
          type: 'TAB_SWITCH',
          tab: 'photos',
          label: 'Přejít na nahrání fotografií',
        };
      } else if (err.code === 'MISSING_INVOICE') {
        resolution = {
          type: 'TAB_SWITCH',
          tab: 'billing',
          label: 'Přejít na správu fakturace',
        };
      } else if (err.code === 'PENDING_DEINSTALLATION') {
        resolution = {
          type: 'TAB_SWITCH',
          tab: 'installation',
          label: 'Zkontrolovat deinstalační úkoly',
        };
      }
      return NextResponse.json(
        {
          error: err.message,
          errorType: err.code,
          resolution,
        },
        { status: 400 }
      );
    }
    const msg = err instanceof Error ? err.message : 'Chyba při změně navigační zakázky.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
