import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { attachPointInstallationPhotos, type StoredInstallationPhoto } from '@/lib/navigation/navigation-service';
import { deletePhotoFromGoogleDrive, GoogleDriveConfigurationError, uploadPhotoToGoogleDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validatePhoto(file: FormDataEntryValue | null, required: boolean) {
  if (!(file instanceof File)) {
    if (required) throw new Error('Fotografie po montáži je povinná.');
    return null;
  }
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Povolené formáty fotografií jsou JPEG, PNG a WebP.');
  if (!file.size || file.size > MAX_FILE_SIZE) throw new Error('Každá fotografie musí mít nejvýše 4 MB.');
  return file;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;
  const uploadedFileIds: string[] = [];

  try {
    const navigationOrderId = (await params).id;
    const form = await req.formData();
    const navigationPointId = String(form.get('navigationPointId') ?? '');
    if (!navigationPointId) return NextResponse.json({ error: 'Chybí navigační bod.' }, { status: 400 });

    const beforeFile = validatePhoto(form.get('beforePhoto'), false);
    const afterFile = validatePhoto(form.get('afterPhoto'), true)!;
    const note = String(form.get('note') ?? '').trim();
    const storedPhotos: StoredInstallationPhoto[] = [];

    for (const entry of [
      beforeFile ? { file: beforeFile, type: 'BEFORE_INSTALLATION' as const } : null,
      { file: afterFile, type: 'AFTER_INSTALLATION' as const },
    ].filter(Boolean) as Array<{ file: File; type: 'BEFORE_INSTALLATION' | 'AFTER_INSTALLATION' }>) {
      const photoId = randomUUID();
      const safeName = entry.file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100) || 'montaz.jpg';
      const stored = await uploadPhotoToGoogleDrive(
        entry.file,
        `${navigationOrderId}-${navigationPointId}-${entry.type.toLowerCase()}-${Date.now()}-${safeName}`,
        photoId,
      );
      uploadedFileIds.push(stored.id);
      storedPhotos.push({
        id: photoId,
        driveFileId: stored.id,
        fileName: stored.name,
        mimeType: stored.mimeType,
        size: stored.size,
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
    await Promise.all(uploadedFileIds.map((fileId) => deletePhotoFromGoogleDrive(fileId).catch(() => undefined)));
    const msg = err instanceof Error ? err.message : 'Chyba při nahrávání fotografie realizace.';
    const status = err instanceof GoogleDriveConfigurationError ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
