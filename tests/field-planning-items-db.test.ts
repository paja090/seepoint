import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { runWithTenantContext } from '../lib/tenant-context';
import { approvePlan, generatePlan, getPlan, saveProfile } from '../lib/field-planning/service';
import { loadPlanningData } from '../lib/field-planning/data';
import { executeStop, myRoute } from '../lib/field-planning/execution';
import { manageWorkItem } from '../lib/field-planning/manage-items';
import { itemJobId } from '../lib/field-planning/item-jobs';
const enabled = process.env.FIELD_PLANNER_TEST_DATABASE === 'codex-field-planner-20260914' && new URL(process.env.DATABASE_URL || 'http://invalid').hostname.startsWith('ep-fancy-grass-atulv9uv');
test('Generic Field Planner real Postgres without Navigation', { skip: !enabled }, async t => {
  const suffix = randomUUID(); const org = await prisma.organization.create({ data: { name: 'Billboard fixture', slug: `items-${suffix}`, plan: 'BUSINESS', enabledModules: { navigation: false } } });
  const other = await prisma.organization.create({ data: { name: 'Other fixture', slug: `items-b-${suffix}`, plan: 'BUSINESS' } });
  const manager = await prisma.user.create({ data: { name: 'Manager fixture', email: `items-manager-${suffix}@example.invalid`, role: 'MANAGER' } });
  const worker = await prisma.user.create({ data: { name: 'Worker fixture', email: `items-worker-${suffix}@example.invalid`, role: 'WORKER' } });
  const actor = { id: manager.id, email: manager.email, role: 'MANAGER' }, workerActor = { id: worker.id, email: worker.email, role: 'WORKER' };
  const scoped = <T>(fn: () => T, organizationId = org.id) => runWithTenantContext({ organizationId, source: 'test' }, async () => await fn());
  const date = new Date().toISOString().slice(0, 10);
  try {
    const employee = await scoped(() => prisma.employee.create({ data: { firstName: 'Billboard', lastName: suffix, userId: worker.id, role: 'WORKER' } }));
    const vehicle = await scoped(() => prisma.vehicle.create({ data: { name: 'Fixture van' } }));
    await scoped(() => saveProfile({ timezone: 'UTC', country: 'SK', depot: { latitude: 48, longitude: 17 }, endLocation: { latitude: 48, longitude: 17 }, workdayStart: '00:01', workdayEnd: '23:59', breakMinutes: 0, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { INSTALLATION: 1 }, fallbackSpeedKph: 40, fallbackDistanceFactor: 1.3, maximumJobsPerRoute: 30, vehicleRequired: true, requireHumanApproval: true, enabled: true }, actor));
    const carrier = await scoped(() => prisma.advertisingCarrier.create({ data: { code: `bill-${suffix}`, name: 'Billboard', city: 'Fixture', type: 'BILLBOARD', latitude: 48, longitude: 17 } }));
    const order = await scoped(() => prisma.workOrder.create({ data: { title: '20 billboards', description: 'Fixture instructions', clientName: 'Fixture', workType: 'INSTALLATION', scheduledAt: new Date(`${date}T00:00:00Z`), estimatedHours: 40 } }));
    const ids: string[] = [];
    await t.test('manager adds 20 stable work items without creating Navigation or CRM', async () => {
      for (let i = 0; i < 20; i++) ids.push((await scoped(() => manageWorkItem(order.id, { action: 'save', carrierId: carrier.id, description: `Panel ${i}`, requestKey: randomUUID() }, actor))).id);
      assert.equal(await scoped(() => prisma.workOrder.count()), 1); assert.equal(await scoped(() => prisma.navigationPoint.count()), 0); assert.equal(await scoped(() => prisma.crmRealization.count()), 0);
      const data = await scoped(() => loadPlanningData(date)); assert.equal(data.jobs.length, 20); assert.equal(data.jobs.reduce((n, j) => n + j.serviceMinutes!, 0), 20); assert.ok(!JSON.stringify(data.profile).includes('navigation'));
    });
    await t.test('disabled navigation and cross-tenant references hard reject', async () => {
      await assert.rejects(scoped(() => loadPlanningData(date, { jobIds: ['navigation-point:forbidden'] })), /FORBIDDEN/);
      await assert.rejects(scoped(() => manageWorkItem(order.id, { action: 'save', carrierId: carrier.id, requestKey: randomUUID() }, actor), other.id), /dostupná/);
      const foreign = await scoped(() => prisma.advertisingCarrier.create({ data: { name: 'Foreign', code: suffix, city: 'Fixture', type: 'BILLBOARD' } }), other.id);
      await assert.rejects(scoped(() => manageWorkItem(order.id, { action: 'save', carrierId: foreign.id, requestKey: randomUUID() }, actor)), /Cross-tenant/);
      await assert.rejects(scoped(() => manageWorkItem(order.id, { action: 'save', carrierId: carrier.id, requestKey: randomUUID() }, workerActor)), /FORBIDDEN/);
    });
    const crews = [{ id: 'crew', employeeIds: [employee.id], vehicleId: vehicle.id }]; const raw = { date, crews, jobIds: ids.map(itemJobId), requestKey: randomUUID() };
    let plan = await scoped(() => generatePlan(raw, actor));
    await t.test('generate retry is idempotent; GPS change invalidates draft', async () => {
      assert.equal((await scoped(() => generatePlan(raw, actor))).id, plan.id);
      await scoped(() => prisma.advertisingCarrier.update({ where: { id: carrier.id }, data: { latitude: 48.0001 } }));
      await assert.rejects(scoped(() => approvePlan(plan.id, actor, true)), /změnily/);
      plan = await scoped(() => generatePlan({ ...raw, requestKey: randomUUID() }, actor));
    });
    await t.test('approval rejects worker and foreign tenant, concurrent retry creates one assignment and reservation', async () => {
      await assert.rejects(scoped(() => approvePlan(plan.id, workerActor, true)), /FORBIDDEN/);
      await assert.rejects(scoped(() => getPlan(plan.id), other.id), /NOT_FOUND/);
      await assert.rejects(scoped(() => approvePlan(plan.id, actor, true), other.id), /NOT_FOUND/);
      await assert.rejects(scoped(() => generatePlan({ ...raw, requestKey: randomUUID(), parentPlanId: plan.id }, actor), other.id), /NOT_FOUND/);
      await Promise.all([1, 2].map(() => scoped(() => approvePlan(plan.id, actor, true))));
      assert.equal(await scoped(() => prisma.workAssignment.count()), 1); assert.equal(await scoped(() => prisma.vehicleReservation.count()), 1);
    });
    const stop = plan.result.crews[0].stops[0]; const command = { planId: plan.id, workOrderId: order.id, jobId: stop.jobId };
    await t.test('worker sees minimal 20-item DTO; individual photo completes only one item', async () => {
      const dto = await scoped(() => myRoute(worker.id)); assert.equal(dto.routes[0].stops.length, 20); assert.doesNotMatch(JSON.stringify(dto), /unitPrice|estimatedHours|internalNote|employeeIds/);
      await scoped(() => executeStop({ ...command, action: 'start' }, workerActor));
      await assert.rejects(scoped(() => executeStop({ ...command, action: 'complete' }, workerActor)), /fotografií/);
      await scoped(() => executeStop({ ...command, action: 'photo' }, workerActor, undefined, [{ id: randomUUID(), driveFileId: null, fileName: 'fixture.jpg', mimeType: 'image/jpeg', size: 3, storageProvider: 'DATABASE', storageKey: suffix, contentChecksum: suffix, content: new Uint8Array([1, 2, 3]), type: 'AFTER_INSTALLATION' }]));
      assert.equal(await scoped(() => prisma.workOrderItem.count({ where: { executionStatus: 'DONE' } })), 1);
      assert.equal((await scoped(() => prisma.workOrder.findUniqueOrThrow({ where: { id: order.id } }))).status, 'IN_PROGRESS');
      const photo = await scoped(() => prisma.photo.findFirstOrThrow()); assert.equal(photo.workOrderItemId, stop.workOrderItemId); assert.equal(photo.crmRealizationId, null);
      await scoped(() => executeStop({ ...command, action: 'complete' }, workerActor)); assert.equal(await scoped(() => prisma.photo.count()), 1);
    });
    await t.test('item issue creates blocker without deleting siblings; manager resolves exact item', async () => {
      const next = plan.result.crews[0].stops[1]; const issue = { ...command, jobId: next.jobId, action: 'problem', problemType: 'Poškození', note: 'Damaged panel', requestKey: randomUUID() };
      await scoped(() => executeStop(issue, workerActor)); await scoped(() => executeStop(issue, workerActor));
      assert.equal(await scoped(() => prisma.workOrderItem.count({ where: { issueNote: { not: null } } })), 1); assert.equal(await scoped(() => prisma.workOrderItem.count()), 20);
      await scoped(() => manageWorkItem(order.id, { action: 'resolve', id: next.workOrderItemId, description: 'Opraveno technikem' }, actor));
      assert.equal(await scoped(() => prisma.workOrderItem.count({ where: { issueNote: { not: null } } })), 0);
    });
    await t.test('replan excludes completed item and preserves completed photo/history', async () => {
      const updated = await scoped(() => generatePlan({ ...raw, requestKey: randomUUID(), parentPlanId: plan.id, crews: crews.map(c => ({ ...c, startLocation: { latitude: 48, longitude: 17 } })) }, actor));
      assert.equal(updated.result.crews.flatMap(c => c.stops).length, 19); assert.ok(!updated.result.crews.flatMap(c => c.stops).some(s => s.jobId === stop.jobId));
      assert.equal(await scoped(() => prisma.photo.count()), 1);
    });
    await t.test('surface-only CRM item keeps canonical realization and exact photo linkage', async () => {
      const secondWorker = await prisma.user.create({ data: { name: 'CRM installer', email: 'crm-items-' + suffix + '@example.invalid', role: 'WORKER' } });
      const secondActor = { id: secondWorker.id, email: secondWorker.email, role: 'WORKER' };
      const e = await scoped(() => prisma.employee.create({ data: { firstName: 'CRM', lastName: suffix, userId: secondWorker.id, role: 'WORKER' } }));
      const v = await scoped(() => prisma.vehicle.create({ data: { name: 'CRM van' } }));
      const surface = await scoped(() => prisma.advertisingSurface.create({ data: { carrierId: carrier.id, name: 'Panel A' } }));
      const client = await scoped(() => prisma.client.create({ data: { name: 'CRM fixture', normalizedName: suffix } }));
      const crm = await scoped(() => prisma.crmOrder.create({ data: { title: 'CRM fixture', orderNumber: suffix, clientId: client.id } }));
      const wo = await scoped(() => prisma.workOrder.create({ data: { title: 'CRM work', description: 'Install panel', clientName: 'CRM fixture', crmOrderId: crm.id, workType: 'INSTALLATION', scheduledAt: new Date(date + 'T00:01:00Z') } }));
      const realization = await scoped(() => prisma.crmRealization.create({ data: { crmOrderId: crm.id, workOrderId: wo.id, carrierId: carrier.id, surfaceId: surface.id, status: 'SCHEDULED' } }));
      const item = await scoped(() => manageWorkItem(wo.id, { action: 'save', surfaceId: surface.id, crmRealizationId: realization.id, requestKey: randomUUID() }, actor));
      const linked = await scoped(() => generatePlan({ date, requestKey: randomUUID(), jobIds: [itemJobId(item.id)], crews: [{ id: 'crm-crew', employeeIds: [e.id], vehicleId: v.id }] }, actor));
      await scoped(() => approvePlan(linked.id, actor, true));
      assert.equal((await scoped(() => prisma.crmRealization.findUniqueOrThrow({ where: { id: realization.id } }))).assignedUserId, secondWorker.id);
      const action = { planId: linked.id, workOrderId: wo.id, jobId: itemJobId(item.id) };
      await scoped(() => executeStop({ ...action, action: 'start' }, secondActor));
      assert.equal((await scoped(() => prisma.crmRealization.findUniqueOrThrow({ where: { id: realization.id } }))).status, 'INSTALLATION_IN_PROGRESS');
      await scoped(() => executeStop({ ...action, action: 'photo' }, secondActor, undefined, [{ id: randomUUID(), driveFileId: null, fileName: 'crm.jpg', mimeType: 'image/jpeg', size: 3, storageProvider: 'DATABASE', storageKey: suffix, contentChecksum: suffix, content: new Uint8Array([1, 2, 3]), type: 'AFTER_INSTALLATION' }]));
      const proof = await scoped(() => prisma.photo.findFirstOrThrow({ where: { workOrderItemId: item.id } }));
      assert.equal(proof.crmRealizationId, realization.id); assert.equal(proof.surfaceId, surface.id);
      assert.equal((await scoped(() => prisma.crmRealization.findUniqueOrThrow({ where: { id: realization.id } }))).status, 'PHOTOGRAPHED');
      assert.equal((await scoped(() => prisma.workOrderItem.findUniqueOrThrow({ where: { id: item.id } }))).executionStatus, null);
      assert.equal((await scoped(() => prisma.workOrder.findUniqueOrThrow({ where: { id: wo.id } }))).ftdSent, false);
    });
  } finally { await prisma.$disconnect(); }
});
