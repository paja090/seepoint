import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeImageMimeType,
  parseRequiredCoordinates,
  runPostSaveTasks,
  runWithRetry,
  stablePhotoUrl,
  storeMobilePhoto,
} from '../lib/mobile-photo-upload.ts';
import {
  MOBILE_PHOTO_DAMAGE_LABELS,
  MOBILE_PHOTO_DAMAGE_TYPES,
  isMobilePhotoDamageType,
} from '../lib/mobile-photo-damage.ts';
import { isSurfaceDetailClientCurrent } from '../lib/mobile-photo-nearby.ts';

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

test('mobile upload: transient chat failure is retried before becoming a warning', async () => {
  let attempts = 0;
  const result = await runWithRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary chat outage');
    return 'sent';
  }, 2);
  assert.equal(result, 'sent');
  assert.equal(attempts, 2);
});

test('mobile upload: persistent chat failure is still isolated from saved photo', async () => {
  let attempts = 0;
  const warnings = await runPostSaveTasks([
    {
      name: 'chat',
      run: () => runWithRetry(async () => {
        attempts += 1;
        throw new Error('chat unavailable');
      }, 2),
    },
  ]);
  assert.equal(attempts, 2);
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

test('mobile upload: damage options contain the requested field defects', () => {
  const values = new Set(MOBILE_PHOTO_DAMAGE_TYPES.map((item) => item.value));
  assert.equal(values.has('BENT_FRAME'), true);
  assert.equal(values.has('BROKEN_CONCRETE'), true);
  assert.equal(values.has('DAMAGED_BACKREST'), true);
  assert.equal(values.has('GRAFFITI'), true);
  assert.equal(MOBILE_PHOTO_DAMAGE_LABELS.BENT_FRAME, 'Křivý / ohnutý rám');
  assert.equal(isMobilePhotoDamageType('BROKEN_CONCRETE'), true);
  assert.equal(isMobilePhotoDamageType('UNSUPPORTED_DAMAGE'), false);
});

test('mobile nearby: client assigned in carrier detail is visible without an occupancy row', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');
  assert.equal(isSurfaceDetailClientCurrent({
    hasCurrentClient: true,
    status: 'AVAILABLE',
    currentRentStart: null,
    currentRentEnd: null,
  }, now), true);
  assert.equal(isSurfaceDetailClientCurrent({
    hasCurrentClient: true,
    status: 'OCCUPIED',
    currentRentStart: new Date('2026-01-01T00:00:00.000Z'),
    currentRentEnd: new Date('2026-08-12T23:59:59.000Z'),
  }, now), false);
  assert.equal(isSurfaceDetailClientCurrent({
    hasCurrentClient: true,
    status: 'OUT_OF_SERVICE',
    currentRentStart: null,
    currentRentEnd: null,
  }, now), false);
});
