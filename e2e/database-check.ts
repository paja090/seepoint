import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { runWithTenantContext } from '../lib/tenant-context';
import { createProductionJob, transitionProductionJob } from '../lib/production/production-service';

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').hostname;
  if (process.env.E2E_ALLOW_TEST_TENANT !== 'true' || !process.env.E2E_DATABASE_HOST || host !== process.env.E2E_DATABASE_HOST || process.env.VERCEL_ENV === 'production') throw new Error('Disposable database authorization required.');
  const orgA = process.env.E2E_ORG_A_ID!; const orgB = process.env.E2E_ORG_B_ID!;
  if (!orgA || !orgB || orgA === orgB) throw new Error('Two organizations required.');
  const within = <T>(organizationId: string, fn: () => T) => runWithTenantContext({ organizationId, source: 'test' }, async () => await fn());
  const actor = { id: process.env.E2E_USER_A_ID!, name: 'E2E' };
  const data = { title: 'Hardening transaction check', quantity: 1, formatType: 'EUROBILLBOARD', materialType: 'BLUEBACK_120G' };
  let passed = 0;
  const check = async (fn: () => Promise<unknown>) => { await fn(); passed++; };
  try {
    const foreignJob = await within(orgB, () => prisma.printProductionJob.create({ data: { organizationId: orgB, title: 'Foreign isolation fixture' } }));
    const foreignOffer = await within(orgB, () => prisma.offer.create({ data: { organizationId: orgB, clientId: process.env.E2E_FOREIGN_CLIENT_ID!, title: 'Foreign offer fixture' } }));
    await within(orgA, async () => {
      await check(async () => assert.equal(await prisma.printProductionJob.findUnique({ where: { id: foreignJob.id } }), null));
      await check(async () => assert.equal((await prisma.printProductionJob.updateMany({ where: { id: foreignJob.id }, data: { title: 'Must not write' } })).count, 0));
      await check(() => assert.rejects(createProductionJob({ ...data, offerId: foreignOffer.id }, actor)));
      await check(() => assert.rejects(createProductionJob({ ...data, clientId: process.env.E2E_FOREIGN_CLIENT_ID }, actor)));
      const job = await createProductionJob({ ...data, offerId: process.env.E2E_OFFER_ID }, actor);
      const transition = (status: 'CLIENT_APPROVAL' | 'IN_PRINT' | 'DELIVERED_TO_WAREHOUSE', approval?: { offerId: string; name: string }) => prisma.$transaction(tx => transitionProductionJob(tx, job.id, status, actor, approval), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await check(() => assert.rejects(transition('DELIVERED_TO_WAREHOUSE')));
      await check(() => transition('CLIENT_APPROVAL'));
      const approval = { offerId: process.env.E2E_OFFER_ID!, name: 'E2E Approver' };
      await check(() => transition('IN_PRINT', approval));
      await check(() => assert.rejects(transition('IN_PRINT', approval)));
      await check(async () => {
        await assert.rejects(prisma.$transaction(async tx => { await transitionProductionJob(tx, job.id, 'DELIVERED_TO_WAREHOUSE', actor); throw new Error('Injected rollback'); }));
        assert.equal((await prisma.printProductionJob.findUniqueOrThrow({ where: { id: job.id } })).status, 'IN_PRINT');
        assert.equal((await prisma.crmRealization.findFirstOrThrow({ where: { crmOrder: { offerId: process.env.E2E_OFFER_ID } } })).status, 'WAITING_FOR_PRODUCTION');
      });
      await check(async () => {
        await transition('DELIVERED_TO_WAREHOUSE');
        assert.equal((await prisma.crmRealization.findFirstOrThrow({ where: { crmOrder: { offerId: process.env.E2E_OFFER_ID } } })).status, 'PRODUCED');
        assert.equal(await prisma.crmAuditLog.count({ where: { entityId: job.id } }), 4);
      });
    });
    console.log(JSON.stringify({ tests: passed, passed, failed: 0, database: 'isolated disposable branch' }));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Database check failed'); process.exitCode = 1; });
