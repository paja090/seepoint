/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readStoredPhoto } from '../lib/storage/photo-storage';
import { setCachedThumbnail, getCachedThumbnail } from '../lib/storage/thumbnail-cache';

test('readStoredPhoto falls back to cached thumbnail when Google Drive returns 404/403', async () => {
  const photoId = 'photo-fail-drive-1';
  const dummyWebpBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  setCachedThumbnail(`photo:${photoId}`, dummyWebpBytes);

  const stored = await readStoredPhoto({
    id: photoId,
    url: `/api/photos/${photoId}/file`,
    content: null,
    driveFileId: 'missing-drive-file-id-404',
    mimeType: 'image/jpeg',
  });

  assert.ok(stored, 'readStoredPhoto must return a readable photo via cached thumbnail fallback');
  assert.equal(stored.contentType, 'image/webp');
  assert.ok(stored.body, 'Body must be populated from thumbnail');
  const buffer = Buffer.from(stored.body as ArrayBuffer);
  assert.equal(buffer.toString('hex'), dummyWebpBytes.toString('hex'));
});

test('readStoredPhoto handles relative public URLs and http:// without error', async () => {
  const relativePhoto = await readStoredPhoto({
    id: 'p-relative',
    url: '/offer/media-city-poster.png',
    content: null,
    driveFileId: null,
    mimeType: 'image/png',
  });
  assert.ok(relativePhoto);
  assert.equal(relativePhoto.redirectUrl, '/offer/media-city-poster.png');

  const httpPhoto = await readStoredPhoto({
    id: 'p-http',
    url: 'http://cdn.example.com/carrier-photo.jpg',
    content: null,
    driveFileId: null,
    mimeType: 'image/jpeg',
  });
  assert.ok(httpPhoto);
  assert.equal(httpPhoto.redirectUrl, 'http://cdn.example.com/carrier-photo.jpg');

  // Self photo URL must not redirect in a loop
  const selfPhoto = await readStoredPhoto({
    id: 'p-self',
    url: '/api/photos/p-self/file',
    content: null,
    driveFileId: null,
    mimeType: 'image/jpeg',
  });
  assert.equal(selfPhoto, null, 'Self photo file route must not self-redirect');
});

test('GET /api/photos/[id]/file serves cached thumbnail when full storage fails instead of 404 error JSON', async t => {
  const photoId = 'photo-broken-drive';
  const dummyWebp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  setCachedThumbnail(`photo:${photoId}`, dummyWebp);

  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function(id: string, ...args: any[]) {
    if (id === '@/lib/auth') {
      return { getCurrentUser: async () => ({ id: 'u1', organizationId: 'org-test', role: 'ADMIN' }) };
    }
    if (id === '@/lib/db') {
      return {
        prisma: {
          photo: {
            findUnique: async () => ({
              id: photoId,
              url: `/api/photos/${photoId}/file`,
              driveFileId: 'drive-nonexistent',
              storageKey: null,
              storageProvider: 'GOOGLE_DRIVE',
              content: null,
              fileName: 'plakat.jpg',
              mimeType: 'image/jpeg',
              employeeId: null,
              type: 'CARRIER',
              workEntryId: null,
              workOrderItemId: null,
              isPrivate: false,
              carrierId: null,
              surfaceId: null,
              siteNavigationPoints: [],
            }),
          },
        },
      };
    }
    return original.call(this, id, ...args);
  };
  t.after(() => { loader._load = original; });

  const { GET } = await import('../app/api/photos/[id]/file/route');
  const response = await GET(new Request(`https://localhost/api/photos/${photoId}/file`), {
    params: Promise.resolve({ id: photoId }),
  });

  assert.equal(response.status, 200, 'Must return 200 OK using fallback rather than 404');
  assert.equal(response.headers.get('Content-Type'), 'image/webp');
  assert.equal(response.headers.get('X-Photo-Fallback'), 'cached-thumbnail');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.toString('hex'), dummyWebp.toString('hex'));
});
