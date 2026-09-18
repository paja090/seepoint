/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

test('Radar review endpoint remains usable after discovery quota and backfill quota are exhausted', async t => {
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const originalLoad = loader._load;
  const counts = new Map<string, number>();
  const reviews: string[] = [];
  let role = 'MANAGER';
  const prisma = { rateLimitBucket: {
    upsert: async ({ where }: any) => {
      const key = JSON.stringify(where);
      const count = (counts.get(key) || 0) + 1;
      counts.set(key, count); return { count };
    }, findMany: async () => [],
  } };
  loader._load = function (id: string, ...args: any[]) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db' || id === './db') return { prisma };
    if (id === '@/lib/api-auth') return { requireApiAccess: async () => ({ id: 'user', organizationId: 'org', role }), isApiDenied: () => false };
    if (id === '@/lib/opportunities/semantic-service') return {
      reviewSource: async (_org: string, _user: string, _source: string, action: string) => { reviews.push(action); return { ok: true }; },
      backfillSemanticPreview: async () => ({ processed: 20, proposals: 0, nextCursor: 'next' }),
    };
    return originalLoad.call(this, id, ...args);
  };
  t.after(() => { loader._load = originalLoad; });
  const { POST } = await import('../app/api/sales/radar/duplicates/route');
  const { enforceRateLimit, rateLimitPolicies } = await import('../lib/rate-limit');
  const { hashRateLimitIdentity } = await import('../lib/rate-limit-core');
  const request = (action: string) => new Request('http://localhost/api/sales/radar/duplicates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, sourceId: 'source' }) });
  const discovery = () => enforceRateLimit(request('MERGE'), hashRateLimitIdentity('org:user'), rateLimitPolicies.opportunityDiscovery);
  assert.equal(await discovery(), null);
  assert.equal(await discovery(), null);
  assert.equal((await discovery())?.status, 429);
  for (let i = 0; i < 6; i++) assert.equal((await POST(request('BACKFILL_PREVIEW'))).status, 200);
  assert.equal((await POST(request('BACKFILL_PREVIEW'))).status, 429);
  for (const action of ['MERGE', 'MERGE', 'MERGE', 'KEEP_SEPARATE', 'DETACH']) {
    assert.equal((await POST(request(action))).status, 200);
  }
  assert.deepEqual(reviews, ['MERGE', 'MERGE', 'MERGE', 'KEEP_SEPARATE', 'DETACH']);
  for (let i = reviews.length; i < 60; i++) assert.equal((await POST(request('MERGE'))).status, 200);
  const limited = await POST(request('MERGE'));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal(reviews.length, 60, 'blocked requests must not invoke the merge service');
  role = 'SALES';
  assert.equal((await POST(request('MERGE'))).status, 403);
});
