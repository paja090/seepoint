/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readZipSelection } from '../lib/fotodokumentace/zip-selection';

function request(ids?: string, method = 'POST') {
  return new Request('https://example.test/zip', method === 'POST'
    ? { method, body: new URLSearchParams(ids === undefined ? {} : { photoIds: ids }) }
    : undefined);
}

test('empty POST and explicit empty GET never expand to the full album', async () => {
  assert.equal(await readZipSelection(request(undefined, 'GET')), null);
  assert.deepEqual(await readZipSelection(request()), new Set());
  assert.deepEqual(await readZipSelection(request('')), new Set());
  assert.deepEqual(await readZipSelection(new Request('https://example.test/zip?photoIds=')), new Set());
  assert.deepEqual(await readZipSelection(request('one,one, two')), new Set(['one', 'two']));
});

test('campaign and surface ZIPs contain only requested authorized photos, never other client or period photos', async t => {
  const photos = ['shown', 'other-client', 'older-month'].map(id => ({ id, type: 'CONTROL', createdAt: new Date('2026-10-20'), content: Buffer.from('IMAGE_' + id) }));
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function(id: string, ...args: any[]) {
    if (id === '@/lib/public-tenant') return {
      enterPublicCampaignAlbumTenant: async () => ({ id: 'campaign', organizationId: 'org-a' }),
      enterPublicSurfaceAlbumTenant: async () => ({ clientName: 'Client', organizationId: 'org-a' }),
    };
    if (id === '@/lib/db') return { prisma: {
      electionCampaign: { findFirst: async ({ where, include }: any) => {
        assert.equal(where.organizationId, 'org-a');
        assert.equal(include.points.include.photos.where.isPrivate, false);
        return { name: 'Campaign', points: [{ label: 'Point', photos }] };
      } },
      advertisingSurface: { findMany: async ({ where, include }: any) => {
        assert.equal(where.organizationId, 'org-a');
        assert.equal(include.photos.where.isPrivate, false);
        return [{ name: 'Surface', photos }];
      } },
    } };
    if (id === '@/lib/google-drive') return { downloadPhotoFromGoogleDrive: async () => { throw Error('Unexpected download'); } };
    if (id === '@/lib/storage/photo-storage') return { readStoredPhoto: async () => { throw Error('Unexpected download'); } };
    return original.call(this, id, ...args);
  };
  t.after(() => { loader._load = original; });
  const zip = await import('../app/api/client/fotodokumentace/[token]/download-zip/route');
  for (const token of ['campaign-token', 'surface.token']) {
    const args = { params: Promise.resolve({ token }) };
    const response = await zip.POST(request('shown,foreign-id,shown'), args);
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.readUInt16LE(bytes.length - 12), 1, 'exactly one ZIP entry');
    assert.ok(bytes.includes(Buffer.from('IMAGE_shown')));
    assert.ok(!bytes.includes(Buffer.from('IMAGE_other-client')));
    assert.ok(!bytes.includes(Buffer.from('IMAGE_older-month')));
    assert.equal((await zip.POST(request(''), args)).status, 404);
    assert.equal((await zip.POST(request(), args)).status, 404);
    assert.equal((await zip.POST(request('foreign-id'), args)).status, 404);
  }
});
