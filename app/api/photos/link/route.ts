import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { verifyFileInFolder, isGoogleDriveMockEnabled } from '@/lib/google-drive';

export const runtime = 'nodejs';

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

    if (targetSurfaceId && !targetCarrierId) {
      const surf = await prisma.advertisingSurface.findUnique({ where: { id: targetSurfaceId }, select: { carrierId: true } });
      if (surf) targetCarrierId = surf.carrierId;
    }

    // Require carriers permission
    const auth = await requireApiAccess('carriers');
    if (isApiDenied(auth)) return auth;

    // Check if target exists
    const targetExists = targetCarrierId
      ? await prisma.advertisingCarrier.count({ where: { id: targetCarrierId } })
      : await prisma.advertisingSurface.count({ where: { id: targetSurfaceId! } });

    if (!targetExists) {
      return NextResponse.json({ error: 'Cílový nosič nebo plocha neexistuje.' }, { status: 404 });
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
    const targetType = type || 'CARRIER';

    // Perform transaction to compute sorting order and primary photo flags atomically
    const photo = await prisma.$transaction(async (tx) => {
      // Lock target to serialize concurrent links and prevent multiple primary photos
      if (targetCarrierId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingCarrier" WHERE id = ${targetCarrierId} FOR UPDATE`;
      } else if (targetSurfaceId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingSurface" WHERE id = ${targetSurfaceId} FOR UPDATE`;
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
          fileName,
          mimeType: mimeType || 'image/jpeg',
          size: size ? Number(size) : null,
          type: targetType,
          note: note ? String(note) : null,
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
