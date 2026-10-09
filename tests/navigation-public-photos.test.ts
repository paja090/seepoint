/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';


test('report JSON, direct download and ZIP consistently exclude unapproved, private and foreign photos', async t => {
  let approved = true, privatePhoto = false, photoOrg = 'org-a';
  const photo = () => ({ id: 'photo', organizationId: photoOrg, isClientVisible: approved, isPrivate: privatePhoto,
    content: Buffer.from('APPROVED_IMAGE_BYTES'), url: '', fileName: 'test.jpg', mimeType: 'image/jpeg' });
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function(id: string, ...args: any[]) {
    if (id === '@/lib/public-tenant') return { enterPublicNavigationReportTenant: async () => ({ id: 'report', organizationId: 'org-a' }) };
    if (id === '@/lib/db') return { platformPrisma: {
      navigationDocumentationReport: { findFirst: async ({where}: any) => {
        assert.deepEqual(where, { id: 'report', organizationId: 'org-a' });
        return { status: 'PUBLISHED', title: 'Test', year: 2026, client: { name: 'Test' }, items: [{ id: 'item',
          selectedPhotoId: 'photo', selectedPhoto: photo(), snapshot: { photoUrl: 'https://example.invalid/stale-private-image' } }] };
      } },
      photo: { findFirst: async ({where}: any) => { assert.equal(where.organizationId, 'org-a'); return photoOrg === where.organizationId ? photo() : null; } },
    } };
    if (id === '@/lib/google-drive') return { GoogleDriveConfigurationError: class extends Error {}, downloadPhotoFromGoogleDrive: async () => { throw Error('Unexpected storage access'); } };
    return original.call(this, id, ...args);
  };
  t.after(() => { loader._load = original; });
  const json = await import('../app/api/client/navigation-documentation/[token]/route');
  const file = await import('../app/api/client/navigation-documentation/[token]/photos/[photoId]/route');
  const zip = await import('../app/api/client/navigation-documentation/[token]/download-zip/route');
  const request = new Request('https://example.invalid/test');
  const args = { params: Promise.resolve({ token: 'synthetic-test-token', photoId: 'photo' }) };
  const data = await (await json.GET(request, args)).json();
  assert.match(data.items[0].photoUrl, /\/photos\/photo$/);
  const photoResponse = await file.GET(request, args);
  assert.equal(photoResponse.status, 200);
  assert.equal(await photoResponse.text(), 'APPROVED_IMAGE_BYTES');
  const archive = await zip.GET(request, args);
  assert.equal(archive.status, 200);
  assert.equal(archive.headers.get('Cache-Control'), 'private, no-store');
  assert.ok(Buffer.from(await archive.arrayBuffer()).includes(Buffer.from('APPROVED_IMAGE_BYTES')));
  for (const mode of ['unapproved', 'private', 'foreign']) {
    approved = mode !== 'unapproved'; privatePhoto = mode === 'private'; photoOrg = mode === 'foreign' ? 'org-b' : 'org-a';
    assert.equal((await (await json.GET(request, args)).json()).items[0].photoUrl, null, mode);
    assert.equal((await file.GET(request, args)).status, 404, mode);
    assert.equal((await zip.GET(request, args)).status, 404, mode);
  }
});
