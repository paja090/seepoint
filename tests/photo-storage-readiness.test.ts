import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PhotoValidationError, photoFileFromDataUrl, safePhotoFileName, validatePhotoFile } from '../lib/photo-validation';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('photo validation verifies magic bytes instead of trusting MIME or extension', async () => {
  const jpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], 'teren.jpg', { type: 'image/jpeg' });
  assert.equal((await validatePhotoFile(jpeg))?.mimeType, 'image/jpeg');

  const spoofed = new File(['<svg onload="alert(1)"></svg>'], 'teren.jpg', { type: 'image/jpeg' });
  await assert.rejects(() => validatePhotoFile(spoofed), (error: unknown) => {
    assert.ok(error instanceof PhotoValidationError);
    assert.equal(error.code, 'INVALID_IMAGE');
    assert.equal(error.status, 415);
    return true;
  });
});

test('photo validation rejects empty and oversized uploads and sanitizes names', async () => {
  const empty = new File([], 'empty.jpg', { type: 'image/jpeg' });
  await assert.rejects(() => validatePhotoFile(empty), PhotoValidationError);

  const oversized = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], 'large.jpg', { type: 'image/jpeg' });
  await assert.rejects(() => validatePhotoFile(oversized, { maxBytes: 3 }), (error: unknown) => {
    assert.ok(error instanceof PhotoValidationError);
    assert.equal(error.code, 'PHOTO_TOO_LARGE');
    return true;
  });
  const safeName = safePhotoFileName('../../nebezpečný soubor.jpg');
  assert.doesNotMatch(safeName, /[\\/]|\.\./);
  assert.match(safeName, /\.jpg$/);
});

test('legacy data URL photos are decoded with the same strict validation boundary', async () => {
  const dataUrl = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`;
  assert.equal((await validatePhotoFile(photoFileFromDataUrl(dataUrl)))?.mimeType, 'image/jpeg');
  assert.throws(() => photoFileFromDataUrl('data:image/svg+xml;base64,PHN2Zz4='), PhotoValidationError);
});

test('mobile upload separates survey uploads from carrier field captures', () => {
  const api = read('app/api/mobile-photos/upload/route.ts');
  assert.match(api, /requestedType === 'SURVEY'/);
  assert.match(api, /type: isSurveyUpload \? 'SURVEY'/);
  assert.match(api, /if \(requiresGps && !clientCoordinates\)/);
  assert.doesNotMatch(api, /carrier\?\.latitude \?\? 0/);
  assert.doesNotMatch(api, /organizationId \|\| 'default'/);
  assert.match(api, /deleteStoredPhoto\(stored\)/);
  assert.match(api, /validatePhotoFile/);
});

test('mobile field UI never substitutes carrier coordinates for capture coordinates', () => {
  const ui = read('components/navigation/MobilePhotoFieldAppView.tsx');
  assert.match(ui, /if \(!coords\)/);
  assert.match(ui, /fd\.append\('requireGps', 'true'\)/);
  assert.match(ui, /coords \? 'GPS razítko připraveno' : 'GPS zatím není dostupná'/);
  assert.match(ui, /!coords\s+\? 'Nejprve načíst GPS'/);
  assert.doesNotMatch(ui, /coords\?\.lat \?\? selectedCarrier\.latitude/);
  assert.doesNotMatch(ui, /coords\?\.lng \?\? selectedCarrier\.longitude/);
});

test('mobile carrier discovery is bounded, searchable and resistant to stale responses', () => {
  const api = read('app/api/mobile-photos/nearby/route.ts');
  const ui = read('components/navigation/MobilePhotoFieldAppView.tsx');
  assert.match(api, /Math\.min\(requestedLimit, 200\)/);
  assert.match(api, /take: limit/);
  assert.match(api, /contains: query, mode: 'insensitive'/);
  assert.match(api, /latitudeDelta/);
  assert.match(api, /limited: total > limitedResult\.length/);
  assert.match(ui, /carriersRequestRef/);
  assert.match(ui, /requestId === carriersRequestRef\.current/);
  assert.match(ui, /setTimeout\(\(\) => \{/);
  assert.match(ui, /params\.set\('q', trimmedQuery\)/);
  assert.match(ui, /Zobrazeno prvních/);
});

test('photo confirmation is authenticated, one-way and idempotent', () => {
  const api = read('app/api/mobile-photos/confirm/route.ts');
  assert.match(api, /requireApiAccess\('navigationProjects'\)/);
  assert.match(api, /alreadyConfirmed: true/);
  assert.match(api, /surfaceId: null/);
  assert.match(api, /updateMany/);
  assert.match(api, /Fotografie už je přiřazena k jiné ploše/);
});

test('installation photos share tenant storage and clean up failed writes', () => {
  const api = read('app/api/navigation/orders/[id]/photo/route.ts');
  const service = read('lib/navigation/navigation-service.ts');
  assert.match(api, /storeTenantPhoto/);
  assert.match(api, /deleteStoredPhoto/);
  assert.match(api, /validatePhotoFile/);
  assert.match(service, /storageProvider: stored\.storageProvider/);
  assert.match(service, /contentChecksum: stored\.contentChecksum/);
  assert.match(service, /Buffer\.from\(stored\.content\)/);
});

test('all active photo upload routes use the shared storage boundary or verified Drive logo flow', () => {
  for (const path of [
    'app/api/photos/route.ts',
    'app/api/mobile-photos/upload/route.ts',
    'app/api/mobile-photos/create-carrier/route.ts',
    'app/api/navigation/orders/[id]/photo/route.ts',
    'app/api/navigation/orders/[id]/issue/route.ts',
    'app/api/vehicles/[id]/photo/route.ts',
    'app/api/profile/photo/route.ts',
    'app/api/carriers/photo/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /storeTenantPhoto/);
    assert.match(source, /enforcePhotoUploadRateLimit/);
  }
  assert.match(read('app/api/clients/[id]/logo/route.ts'), /validatePhotoFile/);
});

test('standard photo upload restores the verified tenant at the route boundary', () => {
  const api = read('app/api/photos/route.ts');
  assert.match(api, /const organizationId = auth\.organizationId \|\| auth\.membership\?\.organizationId/);
  assert.match(api, /enterTenantContext\(\{ organizationId, userId: auth\.id, source: 'session' \}\)/);
  assert.match(api, /storeTenantPhoto\(\{ organizationId,/);
  assert.doesNotMatch(api, /storeTenantPhoto\(\{ organizationId: requireTenantContext\(\)\.organizationId/);
});

test('profile and vehicle photos use correct types and replacement-safe storage', () => {
  const profile = read('app/api/profile/photo/route.ts');
  const vehicle = read('app/api/vehicles/[id]/photo/route.ts');
  assert.match(profile, /type: 'EMPLOYEE_PROFILE'/);
  assert.match(profile, /storageProvider: stored\?\.storageProvider \|\| 'EXTERNAL_URL'/);
  assert.match(vehicle, /type: 'CHECK'/);
  assert.match(vehicle, /previousPhotoId/);
  assert.match(vehicle, /deleteStoredPhoto\(previousPhoto\)/);
});

test('legacy content and thumbnail endpoints converge on the authorized file route', () => {
  const file = read('app/api/photos/[id]/file/route.ts');
  assert.match(file, /canReadPhoto/);
  assert.match(file, /'Referrer-Policy': 'no-referrer'/);
  for (const path of ['app/api/photos/[id]/content/route.ts', 'app/api/photos/[id]/thumbnail/route.ts']) {
    assert.match(read(path), /\/file`/);
  }
});

test('deleting a photo removes the database row before best-effort object cleanup', () => {
  const api = read('app/api/photos/[id]/route.ts');
  const transactionIndex = api.indexOf('await prisma.$transaction', api.indexOf('export async function DELETE'));
  const cleanupIndex = api.indexOf('await deleteStoredPhoto(photo)', transactionIndex);
  assert.ok(transactionIndex > 0 && cleanupIndex > transactionIndex);
  assert.match(api, /storageCleanupPending/);
  assert.doesNotMatch(api, /Skip Google Drive deletion for carrier/);
});

test('carrier photo count stays synchronized after gallery mutations', () => {
  const carrierDetail = read('components/CarrierDetail.tsx');
  const gallery = read('components/PhotoGallery.tsx');
  assert.match(carrierDetail, /onPhotoCountChange=\{setTotalPhotosCount\}/);
  assert.match(gallery, /onPhotoCountChange\?\.\(photos\.length\)/);
  assert.match(gallery, /\[onPhotoCountChange, photos\.length\]/);
});

test('carrier damage report validates, prepares and verifies photo uploads before closing', () => {
  const carrierDetail = read('components/CarrierDetail.tsx');
  assert.match(carrierDetail, /prepareImageForUpload\(manualDamageFile\)/);
  assert.match(carrierDetail, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(carrierDetail, /if \(!response\.ok\)/);
  assert.match(carrierDetail, /setManualDamageError/);
  assert.ok(
    carrierDetail.indexOf('if (!response.ok)') < carrierDetail.indexOf('setShowReportDamageModal(false)'),
    'the dialog must close only after the API response succeeds',
  );
});

test('carrier gallery preserves and displays field capture metadata', () => {
  const database = read('lib/db.ts');
  const upload = read('app/api/mobile-photos/upload/route.ts');
  const gallery = read('components/PhotoGallery.tsx');
  for (const field of ['capturedLatitude', 'capturedLongitude', 'capturedAccuracyMeters', 'capturedByWorkerName']) {
    assert.match(database, new RegExp(`${field}: true`));
    assert.match(upload, new RegExp(`${field}: photo\\.${field}`));
  }
  assert.match(gallery, /Pořízeno:/);
  assert.match(gallery, /Autor:/);
  assert.match(gallery, /GPS:/);
  assert.match(gallery, /www\.google\.com\/maps\?q=/);
  assert.match(gallery, /Europe\/Prague/);
});

test('Google Drive image picker loads bounded pages instead of one thousand files', () => {
  const api = read('app/api/google-drive/images/route.ts');
  const drive = read('lib/google-drive.ts');
  const gallery = read('components/PhotoGallery.tsx');
  assert.match(api, /Math\.min\(requestedLimit, 100\)/);
  assert.match(api, /listImagesInFolderPage/);
  assert.doesNotMatch(drive, /pageSize: '1000'/);
  assert.match(drive, /nextPageToken/);
  assert.match(gallery, /Načíst dalších 100/);
  assert.match(gallery, /driveNextPageToken/);
});
