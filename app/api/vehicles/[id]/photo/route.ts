import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { deleteStoredPhoto, storeTenantPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function photoIdFromUrl(url: string | null) {
  const match = url?.match(/^\/api\/photos\/([a-zA-Z0-9_-]+)\/file$/);
  return match?.[1] || null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('vehicles');
  if (isApiDenied(auth)) return auth;
  const limited = await enforcePhotoUploadRateLimit(request, auth);
  if (limited) return limited;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });

  await ensureVehicleSchema();
  let stored: Awaited<ReturnType<typeof storeTenantPhoto>> | undefined;
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true, photoUrl: true } });
    if (!vehicle) return NextResponse.json({ error: 'Vozidlo nebylo nalezeno.' }, { status: 404 });

    const formData = await request.formData();
    const validated = await validatePhotoFile(formData.get('file'));
    const file = validated!.file;
    const photoId = `vehicle-${randomUUID()}`;
    const fileName = `${Date.now()}-${safePhotoFileName(file.name, `vozidlo-${id}.jpg`)}`;
    stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
    const photoUrl = `/api/photos/${photoId}/file`;
    const previousPhotoId = photoIdFromUrl(vehicle.photoUrl);

    const previousPhoto = await prisma.$transaction(async (tx) => {
      await tx.photo.create({
        data: {
          id: photoId,
          fileName,
          mimeType: validated!.mimeType,
          size: stored!.bytes.byteLength,
          content: stored!.storageProvider === 'DATABASE' ? Buffer.from(stored!.bytes) : undefined,
          driveFileId: stored!.driveFileId,
          storageProvider: stored!.storageProvider,
          storageKey: stored!.storageKey,
          contentChecksum: stored!.contentChecksum,
          url: photoUrl,
          type: 'CHECK',
          note: `Fotografie vozidla ${id}`,
          capturedByWorkerUserId: auth.id,
          capturedByWorkerName: auth.name || auth.email,
        },
      });
      await tx.vehicle.update({ where: { id }, data: { photoUrl } });
      if (!previousPhotoId || previousPhotoId === photoId) return null;
      const old = await tx.photo.findUnique({ where: { id: previousPhotoId }, select: { id: true, driveFileId: true, storageProvider: true } });
      if (old) await tx.photo.delete({ where: { id: old.id } });
      return old;
    });

    if (previousPhoto) await deleteStoredPhoto(previousPhoto).catch((error) => console.error('[vehicles/photo] Úklid staré fotografie selhal', error));
    return NextResponse.json({ photoUrl, storageWarning: stored.warning });
  } catch (error) {
    if (stored) await deleteStoredPhoto(stored).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('[vehicles/photo] Nahrání fotografie selhalo', error);
    return NextResponse.json({ error: 'Nahrání fotografie vozidla selhalo.' }, { status: 500 });
  }
}
