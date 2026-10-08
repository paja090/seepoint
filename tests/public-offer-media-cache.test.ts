import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { OfferValidationError } from '../lib/offers/domain';

test('public offer media is not cached and rejected tokens cannot retrieve assets', async t => {
  let revoked = false, redirect = false, reads = 0;
  const guard = () => { if (revoked) throw new OfferValidationError('Not found', 'NOT_FOUND'); };
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function(id: string, ...args: any[]) {
    if (id === '@/lib/offers/service') return {
      getPublicPhoto: async () => { guard(); return { id: 'photo', url: '', mimeType: 'image/png' }; },
      getPublicRow: async () => { guard(); return { createdByUserId: 'author' }; },
      getPublicClientLogo: async () => { guard(); reads++; return { buffer: Buffer.from('logo'), mimeType: 'image/png', fileName: 'logo.png' }; },
    };
    if (id === '@/lib/db') return { prisma: { photo: { findFirst: async () => ({ driveFileId: 'file', mimeType: 'image/png' }) } } };
    if (id === '@/lib/storage/photo-storage') return { readStoredPhoto: async () => { reads++; return redirect ? { redirectUrl: 'https://example.invalid/image.png' } : { body: 'photo', contentType: 'image/png' }; } };
    if (id === '@/lib/google-drive') return { GoogleDriveConfigurationError: class extends Error {}, downloadPhotoFromGoogleDrive: async () => { reads++; return new Response('portrait'); } };
    return original.call(this, id, ...args);
  };
  t.after(() => { loader._load = original; });
  const photo = await import('../app/api/proposals/[token]/photos/[photoId]/route');
  const logo = await import('../app/api/proposals/[token]/logo/route');
  const portrait = await import('../app/api/proposals/[token]/salesperson-photo/route');
  const args = { params: Promise.resolve({ token: 'test-token', photoId: 'photo' }) };
  const req = new Request('https://example.invalid/test');
  for (const route of [photo, logo, portrait]) {
    const res = await route.GET(req, args);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  }
  redirect = true;
  const res = await photo.GET(req, args);
  assert.equal(res.status, 307);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer');
  revoked = true;
  const previousReads = reads;
  for (const route of [photo, logo, portrait]) assert.equal((await route.GET(req, args)).status, 404);
  assert.equal(reads, previousReads);
});
