import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import { storeTenantPhoto } from '@/lib/storage/photo-storage';
import { safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';

export const runtime = 'nodejs';

/**
 * POST /api/election-removal/points/[id]/photos
 * Nahrání fotodokumentace k demontovanému volebnímu médiu (fotka po deinstalaci).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    const point = await prisma.electionRemovalPoint.findFirst({
      where: { id, organizationId: auth.organizationId },
    });

    if (!point) {
      return NextResponse.json(
        { error: 'Bod demontáže nebyl nalezen.' },
        { status: 404 }
      );
    }

    const form = await req.formData();
    const fileEntry = form.get('file');
    const validated = await validatePhotoFile(fileEntry);
    if (!validated) {
      return NextResponse.json(
        { error: 'Nebyl nahrán žádný soubor fotografie.' },
        { status: 400 }
      );
    }

    const file = validated.file;
    const note = form.get('note') ? String(form.get('note')).trim() : null;
    const latitudeStr = form.get('latitude') ? String(form.get('latitude')) : null;
    const longitudeStr = form.get('longitude') ? String(form.get('longitude')) : null;

    const photoId = randomUUID();
    const fileName = `${point.id}-${Date.now()}-${safePhotoFileName(file.name, 'demontaz.jpg')}`;

    const stored = await storeTenantPhoto({
      organizationId: auth.organizationId,
      photoId,
      fileName,
      file,
    });

    const photo = await prisma.photo.create({
      data: {
        id: photoId,
        organizationId: auth.organizationId,
        electionRemovalPointId: point.id,
        url: `/api/photos/${photoId}/file`,
        fileName,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
        type: 'AFTER_DEINSTALLATION',
        note,
        capturedLatitude: latitudeStr ? parseFloat(latitudeStr) : null,
        capturedLongitude: longitudeStr ? parseFloat(longitudeStr) : null,
        capturedByWorkerUserId: auth.user.id,
        capturedByWorkerName: auth.user.name || auth.user.email,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        driveFileId: stored.driveFileId,
        contentChecksum: stored.contentChecksum,
        content:
          stored.storageProvider === 'DATABASE'
            ? Buffer.from(stored.bytes)
            : null,
      },
      select: {
        id: true,
        url: true,
        fileName: true,
        note: true,
        type: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, photo });
  } catch (error: unknown) {
    console.error('Chyba při nahrávání fotky demontáže:', error);
    const message =
      error instanceof Error ? error.message : 'Chyba při nahrávání fotografie.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
