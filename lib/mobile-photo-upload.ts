export const IOS_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export type StoredMobilePhoto = {
  bytes: Uint8Array;
  driveFileId: string | null;
  storageProvider: 'GOOGLE_DRIVE' | 'LOCAL';
  driveWarning: boolean;
};

export function stablePhotoUrl(photoId: string) {
  if (!photoId || !/^[a-zA-Z0-9_-]+$/.test(photoId)) throw new Error('Invalid photo id');
  return `/api/photos/${encodeURIComponent(photoId)}/file`;
}

export function normalizeImageMimeType(file: Pick<File, 'type' | 'name'>) {
  const declared = file.type.trim().toLowerCase();
  if (IOS_IMAGE_MIME_TYPES.has(declared)) return declared;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function parseRequiredCoordinates(latitude: FormDataEntryValue | null, longitude: FormDataEntryValue | null) {
  const lat = typeof latitude === 'string' ? Number(latitude) : Number.NaN;
  const lng = typeof longitude === 'string' ? Number(longitude) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function storeMobilePhoto(file: File, fileName: string, photoId: string, uploadToDrive: (file: File, fileName: string, photoId: string) => Promise<{ id: string }>): Promise<StoredMobilePhoto> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error('Empty image file');
  try {
    const normalizedFile = file.type ? file : new File([bytes], file.name || fileName, { type: normalizeImageMimeType(file) });
    const uploaded = await uploadToDrive(normalizedFile, fileName, photoId);
    if (!uploaded.id) throw new Error('Google Drive returned no file id');
    return { bytes, driveFileId: uploaded.id, storageProvider: 'GOOGLE_DRIVE', driveWarning: false };
  } catch (error) {
    console.error('[mobile-photos/upload] Google Drive selhal, používám DB fallback', error);
    return { bytes, driveFileId: null, storageProvider: 'LOCAL', driveWarning: true };
  }
}

export async function runPostSaveTasks(tasks: Array<{ name: string; run: () => Promise<unknown> }>) {
  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const name = tasks[index]?.name ?? 'unknown';
      warnings.push(name);
      console.error(`[mobile-photos/upload] Následná operace ${name} selhala`, result.reason);
    }
  });
  return warnings;
}
