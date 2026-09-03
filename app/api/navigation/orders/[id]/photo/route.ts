import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { attachPointInstallationPhotos, NavigationServiceError, type StoredInstallationPhoto } from '@/lib/navigation/navigation-service';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { deleteStoredPhoto, storeTenantPhoto, type StoredTenantPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;
  const limited = await enforcePhotoUploadRateLimit(req, authResult);
  if (limited) return limited;
  const organizationId = authResult.organizationId || authResult.membership?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });
  const uploadedPhotos: StoredTenantPhoto[] = [];

  try {
    const navigationOrderId = (await params).id;
    const form = await req.formData();
    const navigationPointId = String(form.get('navigationPointId') ?? '');
    if (!navigationPointId) return NextResponse.json({ error: 'Chybí navigační bod.' }, { status: 400 });

    const beforePhoto = await validatePhotoFile(form.get('beforePhoto'), { required: false });
    const afterPhoto = await validatePhotoFile(form.get('afterPhoto'));
    const note = String(form.get('note') ?? '').trim().slice(0, 1000);
    const storedPhotos: StoredInstallationPhoto[] = [];

    for (const entry of [
      beforePhoto ? { ...beforePhoto, type: 'BEFORE_INSTALLATION' as const } : null,
      { ...afterPhoto!, type: 'AFTER_INSTALLATION' as const },
    ].filter(Boolean) as Array<{ file: File; mimeType: string; type: 'BEFORE_INSTALLATION' | 'AFTER_INSTALLATION' }>) {
      const photoId = randomUUID();
      const safeName = safePhotoFileName(entry.file.name, 'montaz.jpg');
      const storedName = `${navigationOrderId}-${navigationPointId}-${entry.type.toLowerCase()}-${Date.now()}-${safeName}`;
      const stored = await storeTenantPhoto({ organizationId, photoId, fileName: storedName, file: entry.file });
      uploadedPhotos.push(stored);
      storedPhotos.push({
        id: photoId,
        driveFileId: stored.driveFileId,
        fileName: storedName,
        mimeType: entry.mimeType,
        size: stored.bytes.byteLength,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        contentChecksum: stored.contentChecksum,
        content: stored.storageProvider === 'DATABASE' ? stored.bytes : undefined,
        type: entry.type,
        note: note || undefined,
      });
    }

    const result = await attachPointInstallationPhotos(
      navigationOrderId,
      navigationPointId,
      storedPhotos,
      { userId: authResult.id, userName: authResult.name || authResult.email },
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    await Promise.all(uploadedPhotos.map((photo) => deleteStoredPhoto(photo).catch(() => undefined)));
    if (err instanceof PhotoValidationError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    if (err instanceof NavigationServiceError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === 'NOT_FOUND' ? 404 : 400 });
    console.error('[navigation/photo] Uložení montážní fotografie selhalo', err);
    return NextResponse.json({ error: 'Fotografii realizace se nepodařilo uložit.' }, { status: 502 });
  }
}
