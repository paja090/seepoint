import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'node:module';
import { hashPublicOfferToken } from '../lib/offers/token';

test('public lookup rejects IDs, unknown tokens, revoked links and unpublished offers without writes', async (t) => {
  let storedRow: unknown = null;
  const lookup = t.mock.fn(async (_args: { where: { publicTokenHash: string } }) => storedRow);
  const update = t.mock.fn(async () => { throw new Error('Public lookup must not publish or change a token'); });
  const scan = t.mock.fn(async () => { throw new Error('Public lookup must not scan other organizations'); });
  const db = { offer: { findUnique: lookup, update, findMany: scan } };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const originalLoad = loader._load;
  loader._load = function (id, ...args) {
    if (id === '@/lib/db' || id === './db') return { prisma: db, platformPrisma: db };
    return originalLoad.call(this, id, ...args);
  };
  t.after(() => { loader._load = originalLoad; });
  const { getPublicRow } = await import('../lib/offers/service');
  await assert.rejects(getPublicRow('cmumphtcs0001ld04qihb01n9'), /nebyla nalezena/);
  assert.equal(lookup.mock.callCount(), 0);

  const token = 'a'.repeat(43);
  await assert.rejects(getPublicRow(token), /nebyla nalezena/);
  assert.deepEqual(lookup.mock.calls[0].arguments[0].where, { publicTokenHash: hashPublicOfferToken(token) });
  storedRow = { publicTokenRevokedAt: new Date(), publishedAt: new Date() };
  await assert.rejects(getPublicRow(token), /nebyla nalezena/);
  storedRow = { publicTokenRevokedAt: null, publishedAt: null };
  await assert.rejects(getPublicRow(token), /nebyla nalezena/);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(scan.mock.callCount(), 0);
});
