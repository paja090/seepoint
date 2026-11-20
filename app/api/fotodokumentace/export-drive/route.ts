import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import {
  GoogleDriveTargetAccessError,
  createRealizationDriveFolder,
  downloadPhotoFromGoogleDrive,
  resolveTargetDriveFolder,
  uploadPhotoBufferToDriveFolder,
} from '@/lib/google-drive';
import {
  mergeWorkOrderDriveExports,
  type WorkOrderDriveExportEntry,
} from '@/lib/work/photo-folder';
import { resolvePointClientName } from '@/lib/election-removal/point-metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function sanitizeExportFileName(rawName: string | null | undefined, index: number, mimeType?: string | null): string {
  const prefix = String(index + 1).padStart(2, '0');
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const base = (rawName || `foto_${prefix}`)
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 70);
  const safeBase = base || `foto_${prefix}`;
  return `${prefix}_${safeBase}.${ext}`;
}

async function readPhotoBytes(photo: {
  id: string;
  url: string;
  content: Uint8Array | Buffer | null;
  storageProvider: string;
  storageKey: string | null;
  driveFileId: string | null;
  mimeType: string | null;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (photo.content && photo.content.length > 0) {
    return { buffer: Buffer.from(photo.content), mimeType: photo.mimeType || 'image/jpeg' };
  }

  if (photo.url && photo.url.startsWith('data:')) {
    const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        buffer: Buffer.from(match[2], 'base64'),
        mimeType: match[1] || photo.mimeType || 'image/jpeg',
      };
    }
  }

  try {
    const stored = await readStoredPhoto({
      id: photo.id,
      storageProvider: photo.storageProvider,
      storageKey: photo.storageKey,
      driveFileId: photo.driveFileId,
      mimeType: photo.mimeType,
      url: photo.url,
      content: photo.content ? Buffer.from(photo.content) : null,
    });
    if (stored?.body) {
      let buffer: Buffer;
      if (Buffer.isBuffer(stored.body)) {
        buffer = stored.body;
      } else if (stored.body instanceof ArrayBuffer) {
        buffer = Buffer.from(stored.body);
      } else if (stored.body instanceof Uint8Array) {
        buffer = Buffer.from(stored.body);
      } else {
        buffer = Buffer.from(await new Response(stored.body as BodyInit).arrayBuffer());
      }
      if (buffer.length > 0) {
        return { buffer, mimeType: stored.contentType || photo.mimeType || 'image/jpeg' };
      }
    } else if (stored?.redirectUrl) {
      const remoteRes = await fetch(stored.redirectUrl, { cache: 'no-store' });
      if (remoteRes.ok) {
        const buffer = Buffer.from(await remoteRes.arrayBuffer());
        if (buffer.length > 0) {
          return {
            buffer,
            mimeType: remoteRes.headers.get('content-type') || photo.mimeType || 'image/jpeg',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[export-drive] readStoredPhoto failed for photo', photo.id, err);
  }

  if (photo.driveFileId) {
    try {
      const driveRes = await downloadPhotoFromGoogleDrive(photo.driveFileId);
      if (driveRes.ok) {
        const buffer = Buffer.from(await driveRes.arrayBuffer());
        if (buffer.length > 0) {
          return {
            buffer,
            mimeType: driveRes.headers.get('content-type') || photo.mimeType || 'image/jpeg',
          };
        }
      }
    } catch (err) {
      console.warn('[export-drive] Google Drive fallback read failed for photo', photo.id, err);
    }
  }

  return null;
}

/**
 * POST /api/fotodokumentace/export-drive
 * Manual export of realization/album photos from SeePoint OS Fotodokumentace
 * into a target Google Drive folder (e.g. linked in Plán práce ftdUrl) or into
 * a newly created folder on the organization's connected Google Drive.
 */
export async function POST(req: Request) {
  const auth = await requireApiAccess(['photoDocumentation', 'work']);
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId!;
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      workOrderId?: string | null;
      albumId?: string | null;
      source?: string | null;
      targetFolderUrl?: string | null;
      mode?: 'EXISTING_OR_SEARCH' | 'CREATE_NEW';
      newFolderName?: string | null;
      photoIds?: string[] | null;
      saveTargetUrlToWorkOrder?: boolean;
      markFtdSent?: boolean;
    };

    const mode = body.mode === 'CREATE_NEW' ? 'CREATE_NEW' : 'EXISTING_OR_SEARCH';
    const albumId = typeof body.albumId === 'string' ? body.albumId.trim() : null;
    const explicitWorkOrderId =
      typeof body.workOrderId === 'string' && body.workOrderId.trim()
        ? body.workOrderId.trim()
        : albumId && albumId.startsWith('wo::')
          ? albumId.replace(/^wo::/, '').trim()
          : null;

    const requestedPhotoIds = Array.isArray(body.photoIds)
      ? body.photoIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    const workOrder = explicitWorkOrderId
      ? await prisma.workOrder.findFirst({
          where: { id: explicitWorkOrderId, organizationId },
          select: {
            id: true,
            title: true,
            clientName: true,
            ftdUrl: true,
            ftdSent: true,
            planningConstraints: true,
            items: {
              select: {
                id: true,
                description: true,
                photos: {
                  where: { organizationId, isPrivate: false },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : null;

    if (explicitWorkOrderId && !workOrder) {
      return NextResponse.json({ error: 'Zakázka v Plánu práce nebyla nalezena.' }, { status: 404 });
    }

    type ExportPhotoRow = {
      id: string;
      url: string;
      fileName: string | null;
      mimeType: string | null;
      content: Uint8Array | Buffer | null;
      storageProvider: string;
      storageKey: string | null;
      driveFileId: string | null;
    };

    let photos: ExportPhotoRow[] = [];

    if (requestedPhotoIds.length > 0) {
      photos = await prisma.photo.findMany({
        where: {
          id: { in: requestedPhotoIds },
          organizationId,
          isPrivate: false,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          url: true,
          fileName: true,
          mimeType: true,
          content: true,
          storageProvider: true,
          storageKey: true,
          driveFileId: true,
          organizationId: true,
        },
      });
    } else if (workOrder) {
      photos = workOrder.items.flatMap((it) => it.photos);
    } else if (body.source === 'NAVIGATION' && albumId) {
      const report = await prisma.navigationDocumentationReport.findFirst({
        where: { id: albumId, organizationId },
        include: {
          items: {
            where: { isVisible: true },
            include: { selectedPhoto: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (report) {
        photos = report.items
          .map((it) => it.selectedPhoto)
          .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.isPrivate));
      }
    } else if (albumId) {
      const [campaignId, rawClient] = albumId.includes('::client::')
        ? albumId.split('::client::')
        : [albumId, null];
      const campaign = await prisma.electionCampaign.findFirst({
        where: { id: campaignId, organizationId },
        include: {
          points: {
            include: {
              photos: {
                where: { organizationId, isPrivate: false },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { label: 'asc' },
          },
        },
      });
      if (campaign) {
        const matchedPoints = rawClient
          ? campaign.points.filter(
              (p) =>
                (resolvePointClientName(p, campaign.clientName) || '').trim().toLowerCase() ===
                rawClient.trim().toLowerCase()
            )
          : campaign.points;
        photos = matchedPoints.flatMap((p) => p.photos);
      }
    }

    // Deduplicate by photo.id while preserving order
    const seenIds = new Set<string>();
    const uniquePhotos = photos.filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    if (uniquePhotos.length === 0) {
      return NextResponse.json(
        { error: 'Nebyly nalezeny žádné fotografie k odeslání na Google Disk.' },
        { status: 400 }
      );
    }

    let targetFolder;
    if (mode === 'CREATE_NEW') {
      const fallbackName = workOrder
        ? `${workOrder.title}${workOrder.clientName ? ` - ${workOrder.clientName}` : ''}`
        : 'SeePoint Fotodokumentace';
      const requestedName =
        typeof body.newFolderName === 'string' && body.newFolderName.trim()
          ? body.newFolderName.trim()
          : fallbackName;
      targetFolder = await createRealizationDriveFolder(requestedName);
    } else {
      const targetInput =
        (typeof body.targetFolderUrl === 'string' && body.targetFolderUrl.trim()) ||
        workOrder?.ftdUrl?.trim() ||
        '';
      if (!targetInput) {
        return NextResponse.json(
          {
            error:
              'Zadejte prosím odkaz nebo název cílové složky na Google Disku, případně zvolte vytvoření nové složky.',
            code: 'MISSING_TARGET',
            canCreateNewFolder: true,
          },
          { status: 400 }
        );
      }
      targetFolder = await resolveTargetDriveFolder(targetInput);
    }

    let uploadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failedReasons: string[] = [];
    const newEntries: Record<string, WorkOrderDriveExportEntry> = {};
    const nowIso = new Date().toISOString();

    for (let i = 0; i < uniquePhotos.length; i++) {
      const photo = uniquePhotos[i];
      try {
        const bytes = await readPhotoBytes(photo);
        if (!bytes) {
          failedCount += 1;
          failedReasons.push(`Fotografie ${photo.fileName || photo.id} není čitelná z úložiště.`);
          continue;
        }
        const exportName = sanitizeExportFileName(photo.fileName, i, bytes.mimeType);
        const uploaded = await uploadPhotoBufferToDriveFolder({
          accessToken: targetFolder.accessToken,
          targetFolderId: targetFolder.id,
          buffer: bytes.buffer,
          mimeType: bytes.mimeType,
          fileName: exportName,
          photoId: photo.id,
        });
        if (uploaded.alreadyExisted) {
          skippedCount += 1;
        } else {
          uploadedCount += 1;
        }
        newEntries[photo.id] = {
          driveFileId: uploaded.id,
          folderId: targetFolder.id,
          exportedAt: nowIso,
        };
      } catch (err) {
        failedCount += 1;
        failedReasons.push(err instanceof Error ? err.message : 'Chyba nahrávání souboru');
      }
    }

    if (uploadedCount === 0 && skippedCount === 0 && failedCount > 0) {
      return NextResponse.json(
        {
          error: failedReasons[0] || 'Nepodařilo se nahrát žádnou fotografii na Google Disk.',
          failedCount,
        },
        { status: 500 }
      );
    }

    let updatedWorkOrderFtdUrl = workOrder?.ftdUrl || null;
    if (workOrder) {
      const nextConstraints = mergeWorkOrderDriveExports(workOrder.planningConstraints, {
        folderId: targetFolder.id,
        folderName: targetFolder.name,
        folderUrl: targetFolder.webViewLink,
        exportedAt: nowIso,
        newEntries,
      });

      const shouldUpdateFtdUrl =
        body.saveTargetUrlToWorkOrder === true ||
        (mode === 'CREATE_NEW' && (!workOrder.ftdUrl || !workOrder.ftdUrl.trim()));

      if (shouldUpdateFtdUrl) {
        updatedWorkOrderFtdUrl = targetFolder.webViewLink;
      }

      await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: {
          planningConstraints: nextConstraints as Prisma.InputJsonValue,
          ...(shouldUpdateFtdUrl ? { ftdUrl: targetFolder.webViewLink } : {}),
          ...(body.markFtdSent === true ? { ftdSent: true } : {}),
        },
      });
    }

    await prisma.crmAuditLog.create({
      data: {
        organizationId,
        entityType: workOrder ? 'WorkOrder' : 'PhotoAlbum',
        entityId: workOrder?.id || albumId || 'export-drive',
        userId: auth.id,
        userEmail: auth.email,
        action: 'PHOTOS_EXPORTED_TO_DRIVE',
        detailsJson: JSON.stringify({
          mode,
          folderId: targetFolder.id,
          folderName: targetFolder.name,
          folderUrl: targetFolder.webViewLink,
          totalPhotos: uniquePhotos.length,
          uploadedCount,
          skippedCount,
          failedCount,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      folderId: targetFolder.id,
      folderName: targetFolder.name,
      folderUrl: targetFolder.webViewLink,
      totalPhotos: uniquePhotos.length,
      uploadedCount,
      skippedCount,
      failedCount,
      updatedWorkOrderFtdUrl,
      message:
        uploadedCount > 0
          ? `Nahráno ${uploadedCount} ${uploadedCount === 1 ? 'fotografie' : uploadedCount >= 2 && uploadedCount <= 4 ? 'fotografie' : 'fotografií'} do složky „${targetFolder.name}“${skippedCount > 0 ? ` (${skippedCount} již ve složce bylo)` : ''}.`
          : `Všechny fotografie (${skippedCount}) již v cílové složce „${targetFolder.name}“ existují.`,
    });
  } catch (error) {
    if (error instanceof GoogleDriveTargetAccessError) {
      const status = error.code === 'NOT_CONFIGURED' ? 400 : 403;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          canCreateNewFolder: error.canCreateNewFolder,
          serviceAccountEmail: error.serviceAccountEmail,
        },
        { status }
      );
    }

    console.error('[fotodokumentace/export-drive] Failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Odeslání fotografií na Google Disk se nezdařilo.',
      },
      { status: 500 }
    );
  }
}
