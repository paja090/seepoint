import { randomUUID } from 'node:crypto';
import { safePhotoFileName, validatePhotoFile } from '../photo-validation';
import { deleteStoredPhoto, storeTenantPhoto, type StoredTenantPhoto } from '../storage/photo-storage';
import type { StoredInstallationPhoto } from './navigation-service';

/** Shared storage/validation for native Navigation and Field Planner installation. */
export async function uploadInstallationPhotos<T>(form: FormData, organizationId: string, orderId: string, pointId: string,
  commit: (photos: StoredInstallationPhoto[]) => Promise<T>): Promise<T> {
  const uploaded: StoredTenantPhoto[] = [];
  try {
    const beforeFile = form.get('beforePhoto');
    const before = await validatePhotoFile(beforeFile instanceof File && !beforeFile.size ? null : beforeFile, { required: false });
    const after = await validatePhotoFile(form.get('afterPhoto'));
    const photos: StoredInstallationPhoto[] = [];
    for (const entry of [before ? { ...before, type: 'BEFORE_INSTALLATION' as const } : null, { ...after!, type: 'AFTER_INSTALLATION' as const }]) {
      if (!entry) continue;
      const id = randomUUID();
      const fileName = `${orderId}-${pointId}-${entry.type.toLowerCase()}-${Date.now()}-${safePhotoFileName(entry.file.name, 'montaz.jpg')}`;
      const stored = await storeTenantPhoto({ organizationId, photoId: id, fileName, file: entry.file });
      uploaded.push(stored);
      photos.push({ id, fileName, mimeType: entry.mimeType, size: stored.bytes.byteLength, driveFileId: stored.driveFileId,
        storageProvider: stored.storageProvider, storageKey: stored.storageKey, contentChecksum: stored.contentChecksum,
        content: stored.storageProvider === 'DATABASE' ? stored.bytes : undefined, type: entry.type,
        note: String(form.get('note') ?? '').trim().slice(0, 1000) || undefined });
    }
    return await commit(photos);
  } catch (error) {
    await Promise.all(uploaded.map(photo => deleteStoredPhoto(photo).catch(() => undefined)));
    throw error;
  }
}
