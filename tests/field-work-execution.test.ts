import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { executeFieldStep } from '../lib/election-removal/step-execution';
import { runWithTenantContext } from '../lib/tenant-context';
import type { PlannedStop } from '../lib/field-planning/contracts';
import { classifyLegacyOperation } from '../lib/election-removal/legacy-classification';

function fixture() {
  const steps = [1,2].map(sequence => ({ id: 'step' + sequence, sequence, pointId: 'point', organizationId: 'org',
    assignedFieldPlanId: 'plan', assignedCrewId: 'crew', version: 0, quantity: 2, completedQuantity: 0,
    status: 'ASSIGNED', kind: sequence === 1 ? 'PICKUP' : 'DELIVERY', photoType: 'CONTROL', startedAt: null, completedAt: null, custodyNote: null }));
  const point = { id: 'point', organizationId: 'org', campaignId: 'campaign', status: 'ASSIGNED', startedAt: null, steps };
  const events = new Map<string, Record<string, unknown>>();
  let completedPoints = 0; let casFail = false;
  const tx = {
    electionRemovalPoint: { findFirst: async ({where}: {where: {organizationId: string}}) => where.organizationId === 'org' ? point : null,
      update: async ({data}: {data: object}) => Object.assign(point, data), count: async () => point.status === 'COMPLETED' ? 1 : 0 },
    fieldWorkStep: { findMany: async () => steps,
      updateMany: async ({where, data}: {where: {id: string; version: number};data: object}) => { const step = steps.find(s => s.id === where.id)!;
        if (casFail || step.version !== where.version) return { count: 0 }; const version = step.version + 1; Object.assign(step,data,{version}); return { count: 1 }; } },
    photo: { count: async () => 1 },
    electionCampaign: { update: async ({data}: {data: {completedPoints: number}}) => { completedPoints = data.completedPoints; } },
    crmAuditLog: { findUnique: async ({where}: {where: {id: string}}) => events.get(where.id) ?? null,
      create: async ({data}: {data: Record<string, unknown> & {id: string}}) => { if(events.has(data.id)) throw new Error('duplicate'); events.set(data.id,data); } },
  } as unknown as Prisma.TransactionClient;
  const actor = { id: 'user', email: 'worker@example.test', role: 'WORKER' };
  const execute = (sequence: number, action: string, key: string, extra: object = {}) => runWithTenantContext({ organizationId: 'org', source: 'test' }, () => executeFieldStep(tx,
    { electionRemovalPointId: 'point', fieldWorkStepId: 'step' + sequence } as PlannedStop, 'plan', 'crew', { action, requestKey: key, ...extra }, actor));
  return { execute, steps, point, events, completed: () => completedPoints, failCAS: () => { casFail = true; } };
}

test('real step service: partial completion and retry never double count; pickup does not complete transfer', async () => {
  const f = fixture();
  await assert.rejects(f.execute(2, 'start', 'start-delivery'), /předchozí/);
  await f.execute(1, 'start', 'start-pickup');
  await f.execute(1, 'complete', 'partial-key', { quantity: 1 });
  await f.execute(1, 'complete', 'partial-key', { quantity: 1 });
  assert.equal(f.steps[0].completedQuantity,1); assert.equal(f.point.status,'IN_PROGRESS'); assert.equal(f.completed(),0);
  await assert.rejects(f.execute(1,'complete','partial-key',{quantity:2}), /jinou změnu/);
  await f.execute(1,'complete','remainder-key',{quantity:1});
  assert.equal(f.steps[0].status,'COMPLETED'); assert.equal(f.point.status,'IN_PROGRESS');
  await f.execute(2,'start','start-delivery');
  await assert.rejects(f.execute(2,'complete','delivery-finish'), /příjemce/);
  await f.execute(2,'complete','delivery-finish',{custodyNote:'Sklad B, převzal Novák'});
  await f.execute(2,'complete','delivery-finish',{custodyNote:'Sklad B, převzal Novák'});
  assert.equal(f.completed(),1); assert.equal(f.point.status,'COMPLETED');
});
test('real step service rejects stale assignment and conflicting compare-and-swap', async () => {
  const f = fixture(); f.steps[0].assignedFieldPlanId = 'other-plan';
  await assert.rejects(f.execute(1,'start','start-key'), /FORBIDDEN/);
  f.steps[0].assignedFieldPlanId = 'plan'; f.failCAS();
  await assert.rejects(f.execute(1,'start','start-key'), /mezitím změnil/); assert.equal(f.events.size,0);
});
test('legacy classification uses explicit tags only; descriptions are not rewritten', () => {
  assert.equal(classifyLegacyOperation('Převoz lavičky').operationType,null);
  assert.equal(classifyLegacyOperation('[Operace: Jiná práce] původní popis').operationType,'OTHER');
  assert.equal(classifyLegacyOperation('[Operace: Převoz na jiné místo]').reviewRequired,true);
});


test('workers can report a blocked later step before pickup and other steps preserve its issue', async () => {
  const f = fixture();
  await f.execute(2, 'problem', 'problem-delivery', { problemType: 'Nedostupný nosič', note: 'Sklad je zavřený' });
  assert.equal(f.steps[1].status, 'ISSUE');
  await f.execute(1, 'start', 'start-pickup');
  assert.equal(f.point.status, 'ISSUE');
  assert.equal((f.point as unknown as {issueType:string}).issueType, 'Nedostupný nosič');
  await f.execute(1, 'complete', 'finish-pickup');
  await f.execute(2, 'complete', 'finish-delivery', { custodyNote: 'Převzal skladník' });
  assert.equal(f.point.status, 'COMPLETED');
  assert.equal((f.steps[1] as unknown as {issueNote:string|null}).issueNote, null);
});
