import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { PhotoType } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import { verifyFileInFolder, isGoogleDriveMockEnabled } from '@/lib/google-drive';

export const runtime = 'nodejs';
const LINKABLE_PHOTO_TYPES = new Set(['LOCATION', 'CARRIER', 'SURFACE', 'CAMPAIGN', 'INSTALLATION', 'CONTROL', 'DAMAGE', 'CHECK', 'ARCHIVE']);
const LINKABLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LINKED_PHOTO_SIZE = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => null);
    if (!input) {
      return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
    }

    const { driveFileId, carrierId, surfaceId, fileName, mimeType, size, type, note, isClientVisible } = input;

    if (!driveFileId || !fileName) {
      return NextResponse.json({ error: 'Identifikátor souboru a název jsou povinné.' }, { status: 400 });
    }

    let targetCarrierId = carrierId ? String(carrierId) : null;
    const targetSurfaceId = surfaceId ? String(surfaceId) : null;

    if (!targetCarrierId && !targetSurfaceId) {
      return NextResponse.json({ error: 'Fotografie musí patřit nosiči nebo ploše.' }, { status: 400 });
    }

    // Authenticate before looking up tenant data.
    const auth = await requireApiAccess('carriers');
    if (isApiDenied(auth)) return auth;

    if (targetSurfaceId && !targetCarrierId) {
      const surf = await prisma.advertisingSurface.findUnique({ where: { id: targetSurfaceId }, select: { carrierId: true } });
      if (surf) targetCarrierId = surf.carrierId;
    }

    if (!targetCarrierId || !await prisma.advertisingCarrier.count({ where: { id: targetCarrierId } })) {
      return NextResponse.json({ error: 'Cílový nosič nebo plocha neexistuje.' }, { status: 404 });
    }
    if (targetSurfaceId && !await prisma.advertisingSurface.count({ where: { id: targetSurfaceId, carrierId: targetCarrierId } })) {
      return NextResponse.json({ error: 'Cílová plocha nepatří k vybranému nosiči.' }, { status: 400 });
    }

    const targetType = String(type || 'CARRIER').toUpperCase();
    const targetMimeType = String(mimeType || '').toLowerCase();
    const targetSize = size == null ? null : Number(size);
    if (!LINKABLE_PHOTO_TYPES.has(targetType)) return NextResponse.json({ error: 'Neplatný typ fotografie.' }, { status: 400 });
    if (!LINKABLE_MIME_TYPES.has(targetMimeType)) return NextResponse.json({ error: 'Povolené formáty jsou JPEG, PNG a WebP.' }, { status: 415 });
    if (targetSize !== null && (!Number.isInteger(targetSize) || targetSize <= 0 || targetSize > MAX_LINKED_PHOTO_SIZE)) {
      return NextResponse.json({ error: 'Fotografie musí mít nejvýše 4 MB.' }, { status: 413 });
    }

    // Verify folder placement securely
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const mockEnabled = isGoogleDriveMockEnabled();

    if (!mockEnabled) {
      if (!folderId) {
        return NextResponse.json({ error: 'Google Drive složka není nakonfigurovaná.' }, { status: 503 });
      }
      const isValidFolder = await verifyFileInFolder(driveFileId, folderId);
      if (!isValidFolder) {
        return NextResponse.json(
          { error: 'Zvolený soubor se nenachází v povolené firemní složce Google Drive.' },
          { status: 403 }
        );
      }
    }

    // Check for duplicates
    const duplicate = await prisma.photo.findFirst({
      where: {
        carrierId: targetCarrierId,
        surfaceId: targetSurfaceId,
        driveFileId,
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Tato fotografie je již k nosiči/ploše připojena.' }, { status: 409 });
    }

    const photoId = randomUUID();

    // Perform transaction to compute sorting order and primary photo flags atomically
    const photo = await prisma.$transaction(async (tx) => {
      // Lock target to serialize concurrent links and prevent multiple primary photos
      if (targetCarrierId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingCarrier" WHERE "organizationId" = ${requireTenantContext().organizationId} AND id = ${targetCarrierId} FOR UPDATE`;
      } else if (targetSurfaceId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingSurface" WHERE "organizationId" = ${requireTenantContext().organizationId} AND id = ${targetSurfaceId} FOR UPDATE`;
      }

      const count = await tx.photo.count({
        where: {
          carrierId: targetCarrierId,
          surfaceId: targetSurfaceId,
        },
      });

      const hasPrimary = await tx.photo.count({
        where: {
          carrierId: targetCarrierId,
          surfaceId: targetSurfaceId,
          isPrimary: true,
        },
      });

      const isPrimary = hasPrimary === 0;

      return tx.photo.create({
        data: {
          id: photoId,
          url: `/api/photos/${photoId}/file`,
          driveFileId,
          storageProvider: 'GOOGLE_DRIVE',
          fileName: String(fileName).slice(0, 180),
          mimeType: targetMimeType,
          size: targetSize,
          type: targetType as PhotoType,
          note: note ? String(note).trim().slice(0, 1000) : null,
          sortOrder: count,
          isPrimary,
          isClientVisible: isClientVisible === true,
          carrierId: targetCarrierId,
          surfaceId: targetSurfaceId,
        },
      });
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error('Photo link failed:', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo propojit.' }, { status: 502 });
  }
}
