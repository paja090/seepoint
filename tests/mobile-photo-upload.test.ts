import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeImageMimeType,
  parseRequiredCoordinates,
  runPostSaveTasks,
  stablePhotoUrl,
  storeMobilePhoto,
} from '../lib/mobile-photo-upload.ts';

test('mobile upload: successful Google Drive upload keeps a stable internal URL', async () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'camera.jpg', { type: 'image/jpeg' });
  const stored = await storeMobilePhoto(file, 'photo.jpg', 'photo-safe_1', async () => ({ id: 'drive-1' }));
  assert.equal(stored.storageProvider, 'GOOGLE_DRIVE');
  assert.equal(stored.driveFileId, 'drive-1');
  assert.equal(stored.driveWarning, false);
  assert.equal(stablePhotoUrl('photo-safe_1'), '/api/photos/photo-safe_1/file');
});

test('mobile upload: Google Drive failure retains binary DB fallback', async () => {
  const file = new File([new Uint8Array([4, 5, 6])], 'camera.jpg', { type: 'image/jpeg' });
  const stored = await storeMobilePhoto(file, 'photo.jpg', 'photo-2', async () => { throw new Error('drive unavailable'); });
  assert.equal(stored.storageProvider, 'LOCAL');
  assert.equal(stored.driveFileId, null);
  assert.equal(stored.driveWarning, true);
  assert.deepEqual([...stored.bytes], [4, 5, 6]);
});

test('mobile upload: missing or invalid GPS is rejected', () => {
  assert.equal(parseRequiredCoordinates(null, null), null);
  assert.equal(parseRequiredCoordinates('50.08', null), null);
  assert.equal(parseRequiredCoordinates('91', '18.2'), null);
  assert.deepEqual(parseRequiredCoordinates('49.8209', '18.2625'), { lat: 49.8209, lng: 18.2625 });
});

test('mobile upload: chat failure after persistence is only a warning', async () => {
  let historyCompleted = false;
  const warnings = await runPostSaveTasks([
    { name: 'history', run: async () => { historyCompleted = true; } },
    { name: 'chat', run: async () => { throw new Error('chat unavailable'); } },
  ]);
  assert.equal(historyCompleted, true);
  assert.deepEqual(warnings, ['chat']);
});

test('mobile upload: iOS HEIC/JPEG files with missing or specific MIME remain accepted', () => {
  assert.equal(normalizeImageMimeType(new File(['heic'], 'IMG_0001.HEIC')), 'image/heic');
  assert.equal(normalizeImageMimeType(new File(['heif'], 'IMG_0002.HEIF', { type: 'image/heif' })), 'image/heif');
  assert.equal(normalizeImageMimeType(new File(['jpeg'], 'image.jpg', { type: 'image/jpeg' })), 'image/jpeg');
});

test('mobile upload: iOS HEIC without a declared MIME is normalized before Drive upload', async () => {
  let uploadedMime = '';
  const file = new File(['heic'], 'IMG_0003.HEIC');
  await storeMobilePhoto(file, 'photo.heic', 'photo-ios', async (uploaded) => {
    uploadedMime = uploaded.type;
    return { id: 'drive-ios' };
  });
  assert.equal(uploadedMime, 'image/heic');
});

test('mobile upload: invalid photo ids cannot become URLs', () => {
  assert.throws(() => stablePhotoUrl(''), /Invalid photo id/);
  assert.throws(() => stablePhotoUrl('../photo'), /Invalid photo id/);
});
