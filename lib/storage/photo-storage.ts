import 'server-only';
import { createHash } from 'node:crypto';
import { deletePhotoFromGoogleDrive, downloadPhotoFromGoogleDrive, uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { tenantStorageKey } from './tenant-storage-key';
import { getCachedThumbnail } from './thumbnail-cache';

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
  isFallback?: boolean;
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
  // 1. Database bytea content
  if (photo.content?.byteLength) {
    return { body: Uint8Array.from(photo.content).buffer, contentType: photo.mimeType };
  }

  // 2. Base64 data URL
  if (photo.url && photo.url.startsWith('data:')) {
    const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { body: Uint8Array.from(Buffer.from(match[2], 'base64')).buffer, contentType: match[1] || photo.mimeType };
    }
  }

  // 3. Google Drive file
  if (photo.driveFileId) {
    try {
      const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
      if (file.ok && file.body) {
        return { body: file.body, contentType: photo.mimeType ?? file.headers.get('Content-Type') };
      }
      console.warn(`[photo-storage] Google Drive download failed (status ${file.status}) for driveFileId=${photo.driveFileId}, photoId=${photo.id}`);
    } catch (driveErr) {
      console.warn(`[photo-storage] Google Drive download threw error for driveFileId=${photo.driveFileId}, photoId=${photo.id}:`, driveErr);
    }

    // Try direct Google Drive preview / thumbnail CDN
    try {
      const directGoogleUrls = [
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(photo.driveFileId)}&sz=w2000`,
        `https://lh3.googleusercontent.com/d/${encodeURIComponent(photo.driveFileId)}=s2000`,
      ];
      for (const fallbackUrl of directGoogleUrls) {
        try {
          const res = await fetch(fallbackUrl, {
            signal: AbortSignal.timeout(4000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          if (res.ok && res.body) {
            const buf = await res.arrayBuffer();
            if (buf.byteLength > 100) {
              return { body: buf, contentType: res.headers.get('Content-Type') || photo.mimeType || 'image/jpeg' };
            }
          }
        } catch {
          // Continue to next fallback
        }
      }
    } catch (fallbackErr) {
      console.warn(`[photo-storage] Direct Google CDN fallbacks failed for photoId=${photo.id}:`, fallbackErr);
    }
  }

  // 4. External URL or relative public asset
  if (photo.url) {
    const isAbsolute = /^https?:\/\//i.test(photo.url);
    const isSelfPhotoFileRoute =
      photo.url.includes(`/api/photos/${photo.id}`) ||
      photo.url.includes(`/api/field-survey/photos/${photo.id}`);

    if (isAbsolute && !isSelfPhotoFileRoute) {
      return { redirectUrl: photo.url };
    }

    if (
      photo.url.startsWith('/') &&
      !photo.url.startsWith('/api/photos/') &&
      !photo.url.startsWith('/api/field-survey/photos/')
    ) {
      return { redirectUrl: photo.url };
    }
  }

  // 5. Cached thumbnail fallback - prevents fatal error if thumbnail exists
  const cachedThumb =
    getCachedThumbnail(`photo:${photo.id}`) ||
    getCachedThumbnail(`field-survey-photo:${photo.id}`) ||
    (photo.driveFileId ? getCachedThumbnail(`drive:${photo.driveFileId}`) : null);

  if (cachedThumb) {
    return {
      body: Uint8Array.from(cachedThumb).buffer,
      contentType: 'image/webp',
      isFallback: true,
    };
  }

  if (photo.storageProvider === 'SEEPOINT_STORAGE' && photo.storageKey) {
    throw new Error('SeePoint object storage adapter is not configured.');
  }

  return null;
}

export async function deleteStoredPhoto(photo: { driveFileId?: string | null; storageProvider?: string | null }) {
  if (photo.driveFileId || photo.storageProvider === 'GOOGLE_DRIVE') {
    if (photo.driveFileId) await deletePhotoFromGoogleDrive(photo.driveFileId);
  }
}
