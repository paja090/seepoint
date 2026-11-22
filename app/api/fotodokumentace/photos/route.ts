import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { storeTenantPhoto } from '@/lib/storage/photo-storage';
import { safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { randomUUID } from 'node:crypto';
import type { PhotoType } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * POST /api/fotodokumentace/photos
 * Nahrání fotografie do alba přímo z Fotodokumentace (z mobilu nebo PC).
 * Podporuje nahrání k vybranému bodu kampaně (ElectionRemovalPoint),
 * k reklamní ploše (AdvertisingSurface) nebo položce navigace (NavigationDocumentationItem).
 */
export async function POST(req: Request) {
  const auth = await requireApiAccess('photoDocumentation');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId!;
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  try {
    const form = await req.formData();
    const fileEntry = form.get('file');
    const validated = await validatePhotoFile(fileEntry);
    const file = validated!.file;

    const albumId = form.get('albumId') ? String(form.get('albumId')).trim() : null;
    const pointId = form.get('pointId') ? String(form.get('pointId')).trim() : null;
    const requestedBranchId = form.get('branchId') ? String(form.get('branchId')).trim() : null;
    const customName = form.get('fileName') ? String(form.get('fileName')).trim() : null;
    const rawType = form.get('type') ? String(form.get('type')).trim().toUpperCase() : 'CONTROL';
    const note = form.get('note') ? String(form.get('note')).trim().slice(0, 1000) : null;

    if (!albumId && !pointId) {
      return NextResponse.json({ error: 'Musí být určen bod nebo album pro přiřazení fotografie.' }, { status: 400 });
    }

    const photoId = randomUUID();
    const originalSafe = safePhotoFileName(customName || file.name, 'fotodokumentace.jpg');
    const fileName = customName ? (customName.includes('.') ? customName : `${customName}.jpg`) : originalSafe;
    const storedName = `${Date.now()}-${originalSafe}`;

    // 1. Store to Google Drive (or DB fallback)
    const stored = await storeTenantPhoto({
      organizationId,
      photoId,
      fileName: storedName,
      file,
    });

    // 2. Resolve target associations
    let carrierId: string | null = null;
    let surfaceId: string | null = null;
    let electionRemovalPointId: string | null = null;
    let navigationDocumentationItemId: string | null = null;
    let workOrderItemId: string | null = null;
    let resolvedWorkOrderId: string | null = null;
    let resolvedCrmRealizationId: string | null = null;
    let resolvedBranchId: string | null = null;

    if (requestedBranchId) {
      const validBranch = await prisma.clientBranch.findFirst({
        where: { id: requestedBranchId, organizationId, active: true },
        select: { id: true },
      });
      if (validBranch) {
        resolvedBranchId = validBranch.id;
      }
    }

    // Check if pointId is ElectionRemovalPoint, AdvertisingSurface, NavigationDocumentationItem, or WorkOrderItem
    if (pointId) {
      if (pointId.startsWith('wo-item-placeholder::')) {
        const placeholderWoId = pointId.replace('wo-item-placeholder::', '').trim();
        if (placeholderWoId) {
          const wo = await prisma.workOrder.findFirst({
            where: { id: placeholderWoId, organizationId },
            select: { id: true, title: true, quantity: true, status: true },
          });
          if (wo) {
            resolvedWorkOrderId = wo.id;
            const existingItem = await prisma.workOrderItem.findFirst({
              where: { workOrderId: wo.id, organizationId },
              select: {
                id: true,
                carrierId: true,
                surfaceId: true,
                branchId: true,
                crmRealizationId: true,
                crmRealization: { select: { branchId: true } },
              },
              orderBy: { createdAt: 'asc' },
            });
            if (existingItem) {
              workOrderItemId = existingItem.id;
              carrierId = existingItem.carrierId;
              surfaceId = existingItem.surfaceId;
              resolvedCrmRealizationId = existingItem.crmRealizationId;
              resolvedBranchId = resolvedBranchId ?? existingItem.branchId ?? existingItem.crmRealization?.branchId ?? null;
            } else {
              const createdItem = await prisma.workOrderItem.create({
                data: {
                  organizationId,
                  workOrderId: wo.id,
                  branchId: resolvedBranchId,
                  description: wo.title,
                  quantity: wo.quantity || 1,
                },
                select: { id: true },
              });
              workOrderItemId = createdItem.id;
            }
          }
        }
      } else {
        const electionPoint = await prisma.electionRemovalPoint.findFirst({
          where: { id: pointId, organizationId },
          select: { id: true, carrierId: true, surfaceId: true },
        });
        if (electionPoint) {
          electionRemovalPointId = electionPoint.id;
          carrierId = electionPoint.carrierId;
          surfaceId = electionPoint.surfaceId;
        } else {
          // Check if surface
          const cleanSurfaceId = pointId.startsWith('surface-') ? pointId.replace('surface-', '') : pointId;
          const surf = await prisma.advertisingSurface.findFirst({
            where: { id: cleanSurfaceId, organizationId },
            select: { id: true, carrierId: true },
          });
          if (surf) {
            surfaceId = surf.id;
            carrierId = surf.carrierId;
          } else {
            // Check if navigation item
            const navItem = await prisma.navigationDocumentationItem.findFirst({
              where: { id: pointId, organizationId },
              select: { id: true, carrierId: true },
            });
            if (navItem) {
              navigationDocumentationItemId = navItem.id;
              carrierId = navItem.carrierId;
            } else {
              // Check if WorkOrderItem
              const woItem = await prisma.workOrderItem.findFirst({
                where: { id: pointId, organizationId },
                select: {
                  id: true,
                  workOrderId: true,
                  carrierId: true,
                  surfaceId: true,
                  branchId: true,
                  crmRealizationId: true,
                  crmRealization: { select: { branchId: true } },
                },
              });
              if (woItem) {
                workOrderItemId = woItem.id;
                resolvedWorkOrderId = woItem.workOrderId;
                carrierId = woItem.carrierId;
                surfaceId = woItem.surfaceId;
                resolvedCrmRealizationId = woItem.crmRealizationId;
                resolvedBranchId = resolvedBranchId ?? woItem.branchId ?? woItem.crmRealization?.branchId ?? null;
              }
            }
          }
        }
      }
    }

    // If pointId wasn't matched or wasn't provided, try resolving from albumId
    if (!electionRemovalPointId && !surfaceId && !navigationDocumentationItemId && !workOrderItemId && albumId) {
      if (albumId.startsWith('wo::')) {
        const cleanWoId = albumId.replace(/^wo::/, '').trim();
        const wo = await prisma.workOrder.findFirst({
          where: { id: cleanWoId, organizationId },
          select: {
            id: true,
            title: true,
            quantity: true,
            items: {
              take: 1,
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                carrierId: true,
                surfaceId: true,
                branchId: true,
                crmRealizationId: true,
                crmRealization: { select: { branchId: true } },
              },
            },
          },
        });
        if (wo) {
          resolvedWorkOrderId = wo.id;
          if (wo.items.length > 0) {
            workOrderItemId = wo.items[0].id;
            carrierId = wo.items[0].carrierId;
            surfaceId = wo.items[0].surfaceId;
            resolvedCrmRealizationId = wo.items[0].crmRealizationId;
            resolvedBranchId = resolvedBranchId ?? wo.items[0].branchId ?? wo.items[0].crmRealization?.branchId ?? null;
          } else {
            const createdItem = await prisma.workOrderItem.create({
              data: {
                organizationId,
                workOrderId: wo.id,
                branchId: resolvedBranchId,
                description: wo.title,
                quantity: wo.quantity || 1,
              },
              select: { id: true },
            });
            workOrderItemId = createdItem.id;
          }
        }
      } else {
        const cleanCampaignId = albumId.includes('::client::') ? albumId.split('::client::')[0] : albumId;
        const campaign = await prisma.electionCampaign.findFirst({
          where: { id: cleanCampaignId, organizationId },
          select: {
            points: {
              take: 1,
              select: { id: true, carrierId: true, surfaceId: true },
            },
          },
        });
        if (campaign && campaign.points.length > 0) {
          electionRemovalPointId = campaign.points[0].id;
          carrierId = campaign.points[0].carrierId;
          surfaceId = campaign.points[0].surfaceId;
        }
      }
    }

    const photoType = (['AFTER_INSTALLATION', 'AFTER_DEINSTALLATION', 'CONTROL', 'CHECK', 'DAMAGE', 'INSTALLATION'].includes(rawType)
      ? rawType
      : 'CONTROL') as PhotoType;

    const created = await prisma.photo.create({
      data: {
        id: photoId,
        organizationId,
        carrierId,
        surfaceId,
        electionRemovalPointId,
        workOrderItemId,
        crmRealizationId: resolvedCrmRealizationId,
        branchId: resolvedBranchId,
        type: photoType,
        url: `/api/photos/${photoId}/file`,
        fileName,
        mimeType: file.type,
        size: file.size,
        note,
        isClientVisible: true,
        isPrivate: false,
        capturedByWorkerUserId: auth.id,
        capturedByWorkerName: auth.name || auth.email,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        driveFileId: stored.driveFileId,
        contentChecksum: stored.contentChecksum,
        content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : null,
        ...(navigationDocumentationItemId
          ? { navigationDocumentationItems: { connect: { id: navigationDocumentationItemId } } }
          : {}),
      },
    });

    if (resolvedWorkOrderId) {
      await prisma.workOrder.updateMany({
        where: { id: resolvedWorkOrderId, organizationId, status: { in: ['NEW', 'PLANNED'] } },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json({
      ok: true,
      photo: {
        id: created.id,
        url: created.url,
        type: created.type,
        fileName: created.fileName,
        createdAt: created.createdAt.toISOString(),
        capturedByWorkerName: created.capturedByWorkerName,
        pointId:
          electionRemovalPointId ||
          workOrderItemId ||
          (surfaceId ? `surface-${surfaceId}` : null) ||
          navigationDocumentationItemId,
      },
      warning: stored.warning,
    });
  } catch (error) {
    console.error('[fotodokumentace/photos] Upload failed:', error);
    const message = error instanceof Error ? error.message : 'Nahrání fotografie se nezdařilo.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
