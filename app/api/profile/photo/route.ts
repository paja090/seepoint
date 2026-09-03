import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { deleteStoredPhoto, storeTenantPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function validatedExternalPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.employee) return NextResponse.json({ error: 'Nejste přihlášeni nebo nemáte zaměstnanecký profil.' }, { status: 401 });
  const limited = await enforcePhotoUploadRateLimit(request, user);
  if (limited) return limited;
  const organizationId = user.organizationId || user.membership?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });

  let stored: Awaited<ReturnType<typeof storeTenantPhoto>> | undefined;
  try {
    if (!(request.headers.get('content-type') || '').includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Použijte formulář pro nahrání fotografie.' }, { status: 415 });
    }

    const formData = await request.formData();
    const fileValue = formData.get('file');
    const urlInput = String(formData.get('photoUrl') || '').trim();
    if (fileValue instanceof File && fileValue.size > 0 && urlInput) {
      return NextResponse.json({ error: 'Vyberte soubor, nebo zadejte URL adresu, ne obojí současně.' }, { status: 400 });
    }

    const photoId = `avatar-${user.employee.id}-${randomUUID()}`;
    let photoUrl: string;
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let size: number | null = null;

    if (fileValue instanceof File && fileValue.size > 0) {
      const validated = await validatePhotoFile(fileValue);
      fileName = `${Date.now()}-${safePhotoFileName(validated!.file.name, 'profil.jpg')}`;
      mimeType = validated!.mimeType;
      stored = await storeTenantPhoto({ organizationId, photoId, fileName, file: validated!.file });
      size = stored.bytes.byteLength;
      photoUrl = `/api/photos/${photoId}/file`;
    } else {
      const externalUrl = validatedExternalPhotoUrl(urlInput);
      if (!externalUrl) return NextResponse.json({ error: 'Zadejte platnou HTTPS adresu fotografie.' }, { status: 400 });
      photoUrl = externalUrl;
    }

    const photo = await prisma.$transaction(async (tx) => {
      await tx.photo.updateMany({ where: { employeeId: user.employee!.id }, data: { isPrimary: false } });
      return tx.photo.create({
        data: {
          id: photoId,
          employeeId: user.employee!.id,
          url: photoUrl,
          fileName,
          mimeType,
          size,
          content: stored?.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : undefined,
          driveFileId: stored?.driveFileId,
          storageProvider: stored?.storageProvider || 'EXTERNAL_URL',
          storageKey: stored?.storageKey,
          contentChecksum: stored?.contentChecksum,
          isPrimary: true,
          type: 'EMPLOYEE_PROFILE',
          note: 'Profilová fotografie uživatele',
          capturedByWorkerUserId: user.id,
          capturedByWorkerName: `${user.employee!.firstName} ${user.employee!.lastName}`,
        },
      });
    });

    return NextResponse.json({ ok: true, photoUrl: photo.url, storageWarning: stored?.warning || null });
  } catch (error) {
    if (stored) await deleteStoredPhoto(stored).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('[profile/photo] Uložení profilové fotografie selhalo', error);
    return NextResponse.json({ error: 'Chyba při ukládání profilové fotografie.' }, { status: 500 });
  }
}
