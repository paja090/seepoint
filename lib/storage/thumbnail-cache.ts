import sharp from 'sharp';

/**
 * Lightweight in-memory LRU cache for resized WebP thumbnails so repeated views
 * or gallery scrolling don't re-fetch full photo bytes from PostgreSQL / Google Drive
 * or re-run Sharp image decoding on every request.
 */
const MAX_CACHE_ENTRIES = 300;
const thumbnailCache = new Map<string, Buffer>();

export function getCachedThumbnail(cacheKey: string): Buffer | null {
  const cached = thumbnailCache.get(cacheKey);
  if (!cached) return null;
  // Refresh LRU order
  thumbnailCache.delete(cacheKey);
  thumbnailCache.set(cacheKey, cached);
  return cached;
}

export function setCachedThumbnail(cacheKey: string, buffer: Buffer): void {
  if (thumbnailCache.has(cacheKey)) {
    thumbnailCache.delete(cacheKey);
  } else if (thumbnailCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (oldestKey) {
      thumbnailCache.delete(oldestKey);
    }
  }
  thumbnailCache.set(cacheKey, buffer);
}

/**
 * Generates a fast, compact WebP thumbnail (360x360 max, quality 72) and stores it in LRU cache.
 */
export async function generateWebpThumbnail(
  cacheKey: string,
  inputBuffer: Buffer
): Promise<Buffer> {
  const existing = getCachedThumbnail(cacheKey);
  if (existing) return existing;

  const resized = await sharp(inputBuffer)
    .rotate()
    .resize(360, 360, {
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: true,
    })
    .webp({ quality: 72, effort: 3 })
    .toBuffer();

  setCachedThumbnail(cacheKey, resized);
  return resized;
}
