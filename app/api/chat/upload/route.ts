import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { deleteStoredPhoto, storeTenantPhoto, type StoredTenantPhoto } from '@/lib/storage/photo-storage';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });
  }

  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  const limited = await enforcePhotoUploadRateLimit(request, auth);
  if (limited) return limited;

  if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Použijte multipart/form-data formulář pro nahrání fotografie.' }, { status: 415 });
  }

  let stored: StoredTenantPhoto | undefined;
  try {
    const formData = await request.formData();
    const fileValue = formData.get('file');
    if (!fileValue || !(fileValue instanceof File) || fileValue.size === 0) {
      return NextResponse.json({ error: 'Chybí soubor fotografie.' }, { status: 400 });
    }

    const validated = await validatePhotoFile(fileValue);
    const photoId = randomUUID();
    const safeOriginalName = safePhotoFileName(validated!.file.name, 'chat.jpg');
    const storedName = `chat-${Date.now()}-${safeOriginalName}`;

    stored = await storeTenantPhoto({
      organizationId,
      photoId,
      fileName: storedName,
      file: validated!.file,
    });

    const photoUrl = `/api/photos/${photoId}/file`;

    await prisma.photo.create({
      data: {
        id: photoId,
        organizationId,
        url: photoUrl,
        driveFileId: stored.driveFileId,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        contentChecksum: stored.contentChecksum,
        content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : undefined,
        fileName: storedName,
        mimeType: validated!.mimeType,
        size: stored.bytes.byteLength,
        type: 'ARCHIVE',
        note: 'Příloha z týmového chatu',
        capturedByWorkerUserId: auth.id,
        capturedByWorkerName: auth.name || auth.email,
        aiStatus: 'SKIPPED',
      },
    });

    return NextResponse.json({
      ok: true,
      url: photoUrl,
      photoId,
      fileName: storedName,
      storageWarning: stored.warning,
    });
  } catch (error) {
    if (stored) {
      await deleteStoredPhoto(stored).catch(() => undefined);
    }
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[chat/upload] Nahrání fotografie do chatu selhalo:', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo nahrát.' }, { status: 500 });
  }
}
