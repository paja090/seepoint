import test from 'node:test';
import assert from 'node:assert/strict';
import { getTenantContext, runWithTenantContext } from '@/lib/tenant-context';

/** Mimics PrismaPromise: does nothing until `.then()` is called. */
function lazyQuery() {
  return {
    then<R1, R2>(onFulfilled?: (v: string | null) => R1, onRejected?: (e: unknown) => R2) {
      return Promise.resolve(getTenantContext()?.organizationId ?? null).then(onFulfilled, onRejected);
    },
  };
}

test('runWithTenantContext executes lazy (Prisma-like) queries inside the tenant scope', async () => {
  const orgId = await runWithTenantContext({ organizationId: 'org_public', source: 'public-token' }, () => lazyQuery());
  assert.equal(orgId, 'org_public');
  assert.equal(getTenantContext(), null);
});

test('runWithTenantContext still supports async callbacks and plain values', async () => {
  const fromAsync = await runWithTenantContext({ organizationId: 'org_a' }, async () => getTenantContext()?.organizationId);
  assert.equal(fromAsync, 'org_a');
  const plain = runWithTenantContext({ organizationId: 'org_b' }, () => getTenantContext()?.organizationId);
  assert.equal(plain, 'org_b');
});

test('runWithTenantContext propagates rejections from lazy queries', async () => {
  const failing = { then: (_ok: unknown, fail: (e: unknown) => void) => fail(new Error('boom')) };
  await assert.rejects(Promise.resolve(runWithTenantContext({ organizationId: 'org_c' }, () => failing)), /boom/);
});
