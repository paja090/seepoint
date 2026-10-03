import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { loadProfile, loadPlanningData } from '../lib/field-planning/data';
import { runWithTenantContext } from '../lib/tenant-context';

test('New organization has no implicit depot and cannot plan before configuration', async () => {
  const queries: unknown[] = [];
  const db = {
    organizationFieldPlanningProfile: {
      findUnique: async (query: unknown) => { queries.push(query); return null; },
    },
  } as unknown as Prisma.TransactionClient;
  await runWithTenantContext({ organizationId: 'test-new-agency', userId: 'test-admin', source: 'session' }, async () => {
    assert.equal(await loadProfile(db), null);
    await assert.rejects(loadPlanningData('2026-10-02', {}, db), /Nejdříve nastavte vlastní depo/);
  });
  assert.deepEqual(queries, [
    { where: { organizationId: 'test-new-agency' } },
    { where: { organizationId: 'test-new-agency' } },
  ]);
});
