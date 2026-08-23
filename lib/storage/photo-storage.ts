import 'server-only';
import { createHash } from 'node:crypto';
import { deletePhotoFromGoogleDrive, downloadPhotoFromGoogleDrive, uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { tenantStorageKey } from './tenant-storage-key';

export type PhotoStorageProvider = 'DATABASE' | 'GOOGLE_DRIVE' | 'EXTERNAL_URL' | 'SEEPOINT_STORAGE';

export type StoredTenantPhoto = {
  bytes: Uint8Array;
  contentChecksum: string;
  driveFileId: string | null;
  storageKey: string;
  storageProvider: PhotoStorageProvider;
  warning: string | null;
};

type ReadablePhoto = {
  body?: BodyInit;
  contentType?: string | null;
  redirectUrl?: string;
};

export function preferredPhotoStorageProvider(): PhotoStorageProvider {
  const configured = process.env.SEEPOINT_STORAGE_PROVIDER?.trim().toUpperCase();
  if (configured === 'DATABASE' || configured === 'GOOGLE_DRIVE' || configured === 'SEEPOINT_STORAGE') return configured;
  return 'GOOGLE_DRIVE';
}

export async function storeTenantPhoto(input: { organizationId: string; photoId: string; fileName: string; file: File }): Promise<StoredTenantPhoto> {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  if (!bytes.byteLength) throw new Error('Empty photo file');
  const storageKey = tenantStorageKey({ organizationId: input.organizationId, resource: 'photos', resourceId: input.photoId, fileName: input.fileName });
  const contentChecksum = createHash('sha256').update(bytes).digest('hex');
  const preferred = preferredPhotoStorageProvider();

  // SEEPOINT_STORAGE is intentionally fail-closed until a Blob/GCS adapter is
  // configured. This prevents silently writing tenant files to the wrong place.
  if (preferred === 'SEEPOINT_STORAGE') throw new Error('SeePoint object storage adapter is not configured.');
  if (preferred === 'DATABASE') return { bytes, contentChecksum, driveFileId: null, storageKey, storageProvider: 'DATABASE', warning: null };

  try {
    const uploaded = await uploadPhotoToGoogleDrive(input.file, input.fileName, input.photoId);
    if (!uploaded.id) throw new Error('Google Drive returned no file id');
    return { bytes, contentChecksum, driveFileId: uploaded.id, storageKey, storageProvider: 'GOOGLE_DRIVE', warning: null };
  } catch (error) {
    if (process.env.SEEPOINT_STORAGE_DATABASE_FALLBACK === 'false') throw error;
    console.error('[storage] Google Drive upload failed; using tenant-scoped database fallback', error);
    return { bytes, contentChecksum, driveFileId: null, storageKey, storageProvider: 'DATABASE', warning: 'google-drive' };
  }
}

export async function readStoredPhoto(photo: {
  id: string;
  url: string;
  content: Uint8Array | null;
  driveFileId: string | null;
  mimeType: string | null;
  storageKey?: string | null;
  storageProvider?: string | null;
}): Promise<ReadablePhoto | null> {
  if (photo.content?.byteLength) return { body: Uint8Array.from(photo.content).buffer, contentType: photo.mimeType };
  if (photo.url.startsWith('data:')) {
    const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    return { body: Uint8Array.from(Buffer.from(match[2], 'base64')).buffer, contentType: match[1] || photo.mimeType };
  }
  if (photo.driveFileId) {
    const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
    if (!file.ok || !file.body) return null;
    return { body: file.body, contentType: photo.mimeType ?? file.headers.get('Content-Type') };
  }
  if (/^https?:\/\//.test(photo.url) && !photo.url.includes(`/api/photos/${photo.id}`)) return { redirectUrl: photo.url };
  if (photo.storageProvider === 'SEEPOINT_STORAGE' && photo.storageKey) throw new Error('SeePoint object storage adapter is not configured.');
  return null;
}

export async function deleteStoredPhoto(photo: { driveFileId?: string | null; storageProvider?: string | null }) {
  if (photo.driveFileId || photo.storageProvider === 'GOOGLE_DRIVE') {
    if (photo.driveFileId) await deletePhotoFromGoogleDrive(photo.driveFileId);
  }
}
