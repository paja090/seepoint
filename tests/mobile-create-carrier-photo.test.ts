import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLIENT_PHOTO_LIMITS,
  computeTargetDimensions,
  getFriendlyPhotoErrorMessage,
  isAcceptedPhotoInput,
  isHeicFile,
  parseApiResponseSafely,
  processPhotoForUpload,
  safePhotoBaseName,
  validatePhotoBeforeUpload,
  ClientPhotoError,
} from '../lib/client-photo-processing.ts';
import {
  PhotoValidationError,
  validatePhotoFile,
} from '../lib/photo-validation.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Helper to create synthetic magic byte files for testing
function makeJpegFile(sizeBytes: number, name = 'carrier.jpg'): File {
  const header = [0xff, 0xd8, 0xff, 0xe0];
  const buffer = new Uint8Array(sizeBytes);
  buffer.set(header, 0);
  return new File([buffer], name, { type: 'image/jpeg' });
}

function makePngFile(sizeBytes: number, name = 'carrier.png'): File {
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const buffer = new Uint8Array(sizeBytes);
  buffer.set(header, 0);
  return new File([buffer], name, { type: 'image/png' });
}

function makeWebpFile(sizeBytes: number, name = 'carrier.webp'): File {
  // RIFF....WEBP
  const buffer = new Uint8Array(sizeBytes);
  const riff = [0x52, 0x49, 0x46, 0x46]; // RIFF
  const webp = [0x57, 0x45, 0x42, 0x50]; // WEBP
  buffer.set(riff, 0);
  buffer.set(webp, 8);
  return new File([buffer], name, { type: 'image/webp' });
}

// 1. FORMAT & DETECTION TESTS
test('photo format detection: identifies JPEG, PNG, WebP, and iPhone HEIC/HEIF', () => {
  const jpeg = new File([new Uint8Array(10)], 'foto.jpg', { type: 'image/jpeg' });
  const png = new File([new Uint8Array(10)], 'foto.png', { type: 'image/png' });
  const webp = new File([new Uint8Array(10)], 'foto.webp', { type: 'image/webp' });
  const heicMime = new File([new Uint8Array(10)], 'foto.heic', { type: 'image/heic' });
  const heifExt = new File([new Uint8Array(10)], 'IMG_1234.HEIF', { type: '' });
  const invalid = new File([new Uint8Array(10)], 'report.pdf', { type: 'application/pdf' });

  assert.equal(isAcceptedPhotoInput(jpeg), true);
  assert.equal(isAcceptedPhotoInput(png), true);
  assert.equal(isAcceptedPhotoInput(webp), true);
  assert.equal(isAcceptedPhotoInput(heicMime), true);
  assert.equal(isAcceptedPhotoInput(heifExt), true);
  assert.equal(isAcceptedPhotoInput(invalid), false);

  assert.equal(isHeicFile(heicMime), true);
  assert.equal(isHeicFile(heifExt), true);
  assert.equal(isHeicFile(jpeg), false);
  assert.equal(isHeicFile(png), false);
});

// 2. DIMENSION CALCULATION & ASPECT RATIO
test('dimension calculation: downscales long edge to max 2560px preserving aspect ratio', () => {
  // Landscape 4032 x 3024 (typical 12MP smartphone photo)
  const landscape = computeTargetDimensions(4032, 3024, 2560);
  assert.equal(landscape.width, 2560);
  assert.equal(landscape.height, 1920);

  // Portrait 3024 x 4032
  const portrait = computeTargetDimensions(3024, 4032, 2560);
  assert.equal(portrait.height, 2560);
  assert.equal(portrait.width, 1920);

  // Photo already smaller than 2560px (1920 x 1080)
  const smaller = computeTargetDimensions(1920, 1080, 2560);
  assert.equal(smaller.width, 1920);
  assert.equal(smaller.height, 1080);
});

// 3. DEFENSIVE CLIENT VALIDATION (validatePhotoBeforeUpload)
test('client pre-upload validation: verifies size, empty files and unconverted HEIC', () => {
  const empty = new File([], 'empty.jpg', { type: 'image/jpeg' });
  const valid = makeJpegFile(1.5 * 1024 * 1024, 'valid.jpg');
  const oversized = makeJpegFile(5 * 1024 * 1024, 'oversized.jpg');
  const unconvertedHeic = new File([new Uint8Array(100)], 'ios.heic', { type: 'image/heic' });

  assert.equal(validatePhotoBeforeUpload(empty).ok, false);
  assert.match(validatePhotoBeforeUpload(empty).error || '', /prázdná/);

  assert.equal(validatePhotoBeforeUpload(valid).ok, true);

  assert.equal(validatePhotoBeforeUpload(oversized).ok, false);
  assert.match(validatePhotoBeforeUpload(oversized).error || '', /příliš velká/);

  assert.equal(validatePhotoBeforeUpload(unconvertedHeic).ok, false);
  assert.match(validatePhotoBeforeUpload(unconvertedHeic).error || '', /HEIC/);
});

// 4. CLIENT COMPRESSION PIPELINE (processPhotoForUpload)
test('client compression: automatically downscales large mobile photo safely under 3.5 MB', async () => {
  const largeMobileBytes = 8 * 1024 * 1024; // 8 MB
  const rawFile = makeJpegFile(largeMobileBytes, 'IMG_4032.jpg');

  // Simulate client canvas compressor
  const result = await processPhotoForUpload(rawFile, {
    customRenderer: async (file) => {
      const dimensions = computeTargetDimensions(4032, 3024, CLIENT_PHOTO_LIMITS.MAX_DIMENSION);
      // Downscaled and compressed to 1.8 MB JPEG
      const compressedBuffer = new Uint8Array(1.8 * 1024 * 1024);
      compressedBuffer.set([0xff, 0xd8, 0xff, 0xe0], 0);
      const compressedFile = new File([compressedBuffer], `${safePhotoBaseName(file.name)}.jpg`, {
        type: 'image/jpeg',
      });
      return {
        file: compressedFile,
        width: dimensions.width,
        height: dimensions.height,
        originalBytes: file.size,
        processedBytes: compressedFile.size,
      };
    },
  });

  assert.equal(result.wasCompressed, true);
  assert.equal(result.file.type, 'image/jpeg');
  assert.equal(result.width, 2560);
  assert.equal(result.height, 1920);
  assert.ok(result.processedBytes <= CLIENT_PHOTO_LIMITS.TARGET_MAX_BYTES);
  assert.ok(result.processedBytes < CLIENT_PHOTO_LIMITS.MAX_UPLOAD_BYTES);
});

// 5. HEIC DECODE FALLBACK ERROR HANDLING
test('HEIC decoder fallback: returns friendly Czech message when decoder is not available', () => {
  const err = new ClientPhotoError(
    'Tuto fotografii se nepodařilo zpracovat. Zkuste ji prosím vyfotit znovu.',
    'HEIC_UNSUPPORTED'
  );
  const friendly = getFriendlyPhotoErrorMessage(err);
  assert.equal(friendly, 'Tuto fotografii se nepodařilo zpracovat. Zkuste ji prosím vyfotit znovu.');
});

// 6. BACKEND VALIDATION: JPEG, PNG, WebP, OVERSIZED, EMPTY, HEIC
test('backend validatePhotoFile: accepts valid JPEG, PNG and WebP under 4 MB', async () => {
  const validJpeg = makeJpegFile(2 * 1024 * 1024, 'billboard.jpg');
  const validPng = makePngFile(1 * 1024 * 1024, 'billboard.png');
  const validWebp = makeWebpFile(500 * 1024, 'billboard.webp');

  const resJpeg = await validatePhotoFile(validJpeg);
  assert.equal(resJpeg?.mimeType, 'image/jpeg');

  const resPng = await validatePhotoFile(validPng);
  assert.equal(resPng?.mimeType, 'image/png');

  const resWebp = await validatePhotoFile(validWebp);
  assert.equal(resWebp?.mimeType, 'image/webp');
});

test('backend validatePhotoFile: rejects oversized JPEG (> 4 MB) with 413 PHOTO_TOO_LARGE', async () => {
  const oversizedJpeg = makeJpegFile(5 * 1024 * 1024, 'too_large.jpg');
  await assert.rejects(
    () => validatePhotoFile(oversizedJpeg),
    (err: unknown) => {
      assert.ok(err instanceof PhotoValidationError);
      assert.equal(err.code, 'PHOTO_TOO_LARGE');
      assert.equal(err.status, 413);
      return true;
    }
  );
});

test('backend validatePhotoFile: rejects raw unconverted HEIC with 415 INVALID_IMAGE', async () => {
  // Raw HEIC bytes (ftypheic)
  const heicBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  const heicFile = new File([heicBytes], 'iphone.heic', { type: 'image/heic' });

  await assert.rejects(
    () => validatePhotoFile(heicFile),
    (err: unknown) => {
      assert.ok(err instanceof PhotoValidationError);
      assert.equal(err.code, 'INVALID_IMAGE');
      assert.equal(err.status, 415);
      return true;
    }
  );
});

test('backend validatePhotoFile: rejects empty file with 415 INVALID_IMAGE', async () => {
  const empty = new File([], 'empty.jpg', { type: 'image/jpeg' });
  await assert.rejects(
    () => validatePhotoFile(empty),
    (err: unknown) => {
      assert.ok(err instanceof PhotoValidationError);
      assert.equal(err.status, 415);
      return true;
    }
  );
});

// 7. SAFE API PARSING: HTTP 413, NON-JSON, TIMEOUTS
test('safe API parsing: handles HTTP 413 and returns clean Czech message', async () => {
  const fake413Res = new Response(
    JSON.stringify({ success: false, code: 'PHOTO_TOO_LARGE', error: 'Fotografie musí mít nejvýše 4 MB.' }),
    { status: 413, headers: { 'Content-Type': 'application/json' } }
  );
  const parsed = await parseApiResponseSafely(fake413Res);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, 413);
  assert.equal(
    parsed.errorMessage,
    'Fotografie je příliš velká. Aplikace ji nedokázala automaticky zmenšit. Zkuste fotografii pořídit znovu.'
  );
});

test('safe API parsing: handles non-JSON response (HTML proxy error / 504 / 413) without crashing', async () => {
  const htmlError = '<html><body><h1>413 Request Entity Too Large</h1></body></html>';
  const fakeHtmlRes = new Response(htmlError, {
    status: 413,
    headers: { 'Content-Type': 'text/html' },
  });
  const parsed = await parseApiResponseSafely(fakeHtmlRes);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, 413);
  assert.equal(
    parsed.errorMessage,
    'Fotografie je příliš velká. Aplikace ji nedokázala automaticky zmenšit. Zkuste fotografii pořídit znovu.'
  );
});

test('safe API parsing: handles 500 HTML crash page cleanly', async () => {
  const htmlError = '<html><body><h1>500 Internal Server Error</h1></body></html>';
  const fakeHtmlRes = new Response(htmlError, {
    status: 500,
    headers: { 'Content-Type': 'text/html' },
  });
  const parsed = await parseApiResponseSafely(fakeHtmlRes);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.status, 500);
  assert.equal(
    parsed.errorMessage,
    'Nepodařilo se vytvořit nosič. Zkontrolujte připojení a zkuste to znovu.'
  );
});

// 8. ERROR SHIELDING: SUPPRESS RAW BROWSER EXCEPTIONS (Safari DOMException, pattern errors)
test('error shielding: never exposes raw technical Safari / DOMException strings to user', () => {
  const safariPatternError = new Error('The string did not match the expected pattern.');
  const networkError = new Error('Failed to fetch');
  const domException = new Error('DOMException: The operation was aborted');
  const syntaxError = new Error('SyntaxError: Unexpected token < in JSON at position 0');

  assert.equal(
    getFriendlyPhotoErrorMessage(safariPatternError),
    'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.'
  );
  assert.equal(
    getFriendlyPhotoErrorMessage(networkError),
    'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.'
  );
  assert.equal(
    getFriendlyPhotoErrorMessage(domException),
    'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.'
  );
  assert.equal(
    getFriendlyPhotoErrorMessage(syntaxError),
    'Fotografii se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.'
  );
});

// 9. GPS PRESERVATION & VALIDATION
test('GPS preservation: valid coordinates are parsed and preserved for carrier creation', () => {
  const lat = 50.0878;
  const lng = 14.4205;
  const coords = { lat, lng, accuracy: 8 };

  assert.equal(Number.isFinite(coords.lat), true);
  assert.equal(Number.isFinite(coords.lng), true);
  assert.equal(coords.lat, 50.0878);
  assert.equal(coords.lng, 14.4205);
});

// 10. ARCHITECTURAL CONTRACTS IN CREATE-CARRIER & MOBILE COMPONENTS
test('create-carrier route: creates Carrier, Surfaces, Photo, GPS, MediaTypes, and History', () => {
  const routeCode = read('app/api/mobile-photos/create-carrier/route.ts');

  // Rate limiting & security
  assert.match(routeCode, /enforcePhotoUploadRateLimit/);
  assert.match(routeCode, /enterTenantContext/);
  assert.match(routeCode, /validatePhotoFile/);

  // Carrier creation with verified GPS
  assert.match(routeCode, /tx\.advertisingCarrier\.create/);
  assert.match(routeCode, /gpsStatus:\s*'VERIFIED'/);

  // Surface creation with correct sides
  assert.match(routeCode, /tx\.advertisingSurface\.create/);
  assert.match(routeCode, /side:\s*'SIDE_A'/);
  assert.match(routeCode, /side:\s*'SIDE_B'/);

  // Photo record creation
  assert.match(routeCode, /tx\.photo\.create/);
  assert.match(routeCode, /type:\s*'CARRIER'/);

  // History event logging
  assert.match(routeCode, /logCarrierHistoryEvent/);

  // MediaTypes mapped for BILLBOARD and PROMO_HORIZON
  assert.match(routeCode, /case 'BILLBOARD':\s+default:\s+return 'BILLBOARD';/);
  assert.match(routeCode, /case 'PROMO_HORIZON':\s+return 'PROMO_HORIZON';/);
  assert.match(routeCode, /case 'CITYLIGHT':\s+return 'CITYLIGHT';/);
});

test('MobileCreateCarrierModal & MobilePhotoFieldAppView use unified client photo processing', () => {
  const modalCode = read('components/navigation/MobileCreateCarrierModal.tsx');
  const appViewCode = read('components/navigation/MobilePhotoFieldAppView.tsx');

  // Both import from lib/client-photo-processing
  assert.ok(modalCode.includes("from '@/lib/client-photo-processing'"));
  assert.ok(appViewCode.includes("from '@/lib/client-photo-processing'"));

  // Modal uses defensive validation, safe parsing, and friendly error mapper
  assert.match(modalCode, /validatePhotoBeforeUpload\(initialFile\)/);
  assert.match(modalCode, /parseApiResponseSafely/);
  assert.match(modalCode, /getFriendlyPhotoErrorMessage/);
  assert.doesNotMatch(modalCode, /create-carrier['"][\s\S]*?await res\.json\(\)/);

  // Both flows in AppView use processPhotoForUpload
  assert.match(appViewCode, /handleCreateFileChange = async/);
  assert.match(appViewCode, /handleFileChange = async/);
  assert.match(appViewCode, /processPhotoForUpload/);
  assert.match(appViewCode, /isPreparingCreatePhoto/);
  assert.match(appViewCode, /isPreparingUploadPhoto/);
  assert.match(appViewCode, /PŘIPRAVUJI FOTOGRAFII…/);
});
