import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

test('public report lookup only reads a matching active published token and never restores links', async t => {
  const hash = 'a'.repeat(64);
  let row: any = null, active = true, lookups = 0;
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function(id: string, ...args: any[]) {
    if (id === './db') return { platformPrisma: {
      navigationDocumentationReport: {
        findFirst: async ({ where }: any) => {
          lookups++;
          assert.equal(where.publicTokenHash, hash);
          assert.equal(where.OR, undefined);
          assert.deepEqual(where.status, { in: ['PUBLISHED', 'SENT'] });
          assert.deepEqual(where.publishedAt, { not: null });
          assert.ok(where.tokenExpiresAt.gt instanceof Date);
          return row && row.hash === hash && ['PUBLISHED', 'SENT'].includes(row.status)
            && row.publishedAt && row.expiry > where.tokenExpiresAt.gt ? { id: 'report', organizationId: 'org' } : null;
        },
        findMany: async () => { throw Error('Must not scan other reports'); },
        update: async () => { throw Error('Must not restore or publish on read'); },
      },
      organization: { findUnique: async () => ({ isActive: active }) },
    } };
    return original.call(this, id, ...args);
  };
  t.after(() => { loader._load = original; });
  const { enterPublicNavigationReportTenant: lookup } = await import('../lib/public-tenant');
  assert.equal(await lookup('report-id'), null);
  assert.equal(lookups, 0);
  assert.equal(await lookup(hash), null);
  row = { hash, status: 'PUBLISHED', publishedAt: new Date(), expiry: new Date(Date.now() + 60000) };
  assert.deepEqual(await lookup(hash), { id: 'report', organizationId: 'org' });
  for (const change of [{ hash: null }, { status: 'DRAFT' }, { status: 'REVIEW' }, { status: 'ARCHIVED' }, { publishedAt: null }, { expiry: new Date(0) }]) {
    const saved = row; row = { ...row, ...change }; assert.equal(await lookup(hash), null); row = saved;
  }
  active = false;
  assert.equal(await lookup(hash), null);
});
