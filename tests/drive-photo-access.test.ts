import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

test('Drive photo route rejects foreign files before download and never publicly caches private photos', async t => {
  let user: { id: string; organizationId: string | null; role: string } | null = { id: 'admin-a', organizationId: 'org-a', role: 'ADMIN' };
  let linked = false;
  let storageOwned = false;
  let downloads = 0;
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function(id: string, ...args: any[]) {
    if (id === '@/lib/auth') return { getCurrentUser: async () => user };
    if (id === '@/lib/db') return { prisma: { photo: { findFirst: async (query: any) => {
      assert.equal(query.where.organizationId, 'org-a');
      assert.equal(query.where.driveFileId, 'file-id');
      return linked ? { id: 'photo-a', employeeId: null, type: 'EXPENSE_RECEIPT', workEntryId: null,
        workOrderItemId: null, isPrivate: true, carrierId: null, surfaceId: null, siteNavigationPoints: [] } : null;
    } } } };
    if (id === '@/lib/google-drive') return {
      GoogleDriveConfigurationError: class extends Error {},
      verifyFileInTenantStorage: async (_id: string, org: string) => { assert.equal(org, 'org-a'); return storageOwned; },
      downloadPhotoFromGoogleDrive: async () => { downloads++; return new Response('own-photo', { headers: { 'Content-Type': 'image/png' } }); },
    };
    return original.call(this, id, ...args);
  };
  t.after(() => { loader._load = original; });
  const { GET } = await import('../app/api/photos/drive/[id]/route');
  const get = () => GET(new Request('https://example.invalid/api/photos/drive/file-id'), { params: Promise.resolve({ id: 'file-id' }) });
  assert.equal((await get()).status, 404);
  assert.equal(downloads, 0, 'Foreign file bytes must never be requested');
  linked = true;
  const legacy = await get();
  assert.equal(legacy.status, 200, 'Existing own photos remain accessible without folder metadata');
  assert.equal(legacy.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(await legacy.text(), 'own-photo');
  user = { id: 'worker', organizationId: 'org-a', role: 'WORKER' };
  assert.equal((await get()).status, 403, 'Direct Drive URL must obey the same per-photo policy');
  assert.equal(downloads, 1);
  user = { id: 'admin-a', organizationId: 'org-a', role: 'ADMIN' };
  linked = false; storageOwned = true;
  assert.equal((await get()).status, 200, 'Own unlinked storage image remains accessible');
  user = { id: 'worker', organizationId: 'org-a', role: 'WORKER' };
  assert.equal((await get()).status, 403, 'Unlinked files have no employee access policy');
  assert.equal(downloads, 2);
  user = { id: 'owner', organizationId: null, role: 'ADMIN' };
  assert.equal((await get()).status, 403);
  user = null;
  assert.equal((await get()).status, 401);
  assert.equal(downloads, 2);
});
