import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, type PrintProductionStatus } from '@prisma/client';
import { createProductionJob, transitionProductionJob } from '../lib/production/production-service';
import { runWithTenantContext } from '../lib/tenant-context';
import { prisma } from '../lib/db';

function fixture(initial: PrintProductionStatus = 'IN_PRINT') {
  let state = { status: initial, approved: false, crm: 'WAITING_FOR_PRODUCTION', audits: 0, creates: 0 };
  let failCrm = false;
  const tx = {
    offer: { findUnique: async ({ where }: { where: { id: string; organizationId: string } }) => where.id === 'offer-a' && where.organizationId === 'a' ? { id: 'offer-a', clientId: 'client-a' } : null },
    client: { findUnique: async ({ where }: { where: { id: string; organizationId: string } }) => where.id === 'client-a' && where.organizationId === 'a' ? { id: 'client-a' } : null },
    printProductionJob: {
      findUnique: async ({ where }: { where: { id: string; organizationId: string } }) => where.id === 'job-a' && where.organizationId === 'a' ? { id: 'job-a', organizationId: 'a', status: state.status, offerId: 'offer-a', artworkUrl: null, clientApprovedAt: state.approved ? new Date() : null } : null,
      updateMany: async ({ where, data }: { where: { status: PrintProductionStatus }; data: { status: PrintProductionStatus; clientApprovedAt?: Date } }) => {
        if (state.status !== where.status) return { count: 0 };
        state.status = data.status; state.approved = Boolean(data.clientApprovedAt) || state.approved; return { count: 1 };
      },
      count: async () => 0,
      create: async () => { state.creates++; return { id: 'job-a', status: 'PREPARATION' }; },
    },
    crmOrder: { findFirst: async () => ({ id: 'order-a' }) },
    crmRealization: { updateMany: async () => { if (failCrm) throw new Error('CRM failed'); state.crm = 'PRODUCED'; return { count: 1 }; } },
    crmAuditLog: { create: async () => { state.audits++; return {}; } },
  } as unknown as Prisma.TransactionClient;
  const db = { $transaction: async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => {
    const before = { ...state };
    try { return await callback(tx); } catch (error) { state = before; throw error; }
  } } as unknown as typeof prisma;
  return { tx, db, state: () => state, failCrm: () => { failCrm = true; } };
}
const tenant = <T>(fn: () => T) => runWithTenantContext({ organizationId: 'a', source: 'test' }, fn);
const input = { title: 'Job', formatType: 'CLP', materialType: 'CITYLIGHT_PAPER', quantity: 1, offerId: 'offer-a' };

test('create rejects foreign Offer, foreign Client and inconsistent client before writing', async () => {
  const f = fixture();
  for (const raw of [{ ...input, offerId: 'offer-b' }, { ...input, offerId: undefined, clientId: 'client-b' }, { ...input, clientId: 'client-b' }]) {
    await assert.rejects(tenant(() => createProductionJob(raw, {}, f.db)));
  }
  assert.equal(f.state().creates, 0);
  await tenant(() => createProductionJob(input, {}, f.db));
  assert.equal(f.state().creates, 1); assert.equal(f.state().audits, 1);
});
test('production and CRM use caller transaction and roll back together on CRM failure', async () => {
  const f = fixture(); f.failCrm();
  await assert.rejects(tenant(() => f.db.$transaction(tx => transitionProductionJob(tx, 'job-a', 'DELIVERED_TO_WAREHOUSE', {}))), /CRM failed/);
  assert.equal(f.state().status, 'IN_PRINT'); assert.equal(f.state().crm, 'WAITING_FOR_PRODUCTION'); assert.equal(f.state().audits, 0);
  const success = fixture();
  await tenant(() => success.db.$transaction(tx => transitionProductionJob(tx, 'job-a', 'DELIVERED_TO_WAREHOUSE', {})));
  assert.equal(success.state().crm, 'PRODUCED'); assert.equal(success.state().audits, 1);
});
test('public approval is restricted to offer, tenant, current state and cannot replay', async () => {
  const f = fixture('CLIENT_APPROVAL');
  const approve = (id: string, offerId: string) => tenant(() => f.db.$transaction(tx => transitionProductionJob(tx, id, 'IN_PRINT', {}, { name: 'Client', offerId })));
  await assert.rejects(approve('job-b', 'offer-a'));
  await assert.rejects(approve('job-a', 'offer-b'));
  await approve('job-a', 'offer-a');
  await assert.rejects(approve('job-a', 'offer-a'));
  assert.equal(f.state().audits, 1);
  const prep = fixture('PREPARATION');
  await assert.rejects(tenant(() => transitionProductionJob(prep.tx, 'job-a', 'IN_PRINT', {}, { offerId: 'offer-a', name: 'Client' })));
});
