import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { runWithTenantContext } from '../lib/tenant-context';
import { approvePlan, cancelDraft, generatePlan, getPlan, json, saveProfile } from '../lib/field-planning/service';
import { loadPlanningData } from '../lib/field-planning/data';
import { executeStop, myRoute } from '../lib/field-planning/execution';
import { planFieldWork, estimatedLeg } from '../lib/field-planning/planning-engine';
import type { PlanningProfile, PlanningResult } from '../lib/field-planning/contracts';

// Real Postgres tests are opt-in and refuse the main endpoint. Only the disposable test branch is allowed.
const enabled = process.env.FIELD_PLANNER_TEST_DATABASE === 'codex-field-planner-20260914'
  && new URL(process.env.DATABASE_URL || 'http://invalid').hostname.startsWith('ep-fancy-grass-atulv9uv');
test('Field Planner real Postgres: isolation, approval races, execution and replanning', { skip: !enabled }, async t => {
  const suffix = randomUUID();
  const orgA = await prisma.organization.create({ data: { name: 'Field planning test A', slug: `fp-a-${suffix}`, plan: 'PRO' } });
  const orgB = await prisma.organization.create({ data: { name: 'Field planning test B', slug: `fp-b-${suffix}`, plan: 'PRO' } });
  const manager = await prisma.user.create({ data: { name: 'Field test manager', email: `fp-manager-${suffix}@example.invalid`, role: 'MANAGER' } });
  const worker = await prisma.user.create({ data: { name: 'Field test worker', email: `fp-worker-${suffix}@example.invalid`, role: 'WORKER' } });
  const actor = { id: manager.id, email: manager.email, role: 'MANAGER' };
  const workerActor = { id: worker.id, email: worker.email, role: 'WORKER' };
  const scoped = <T>(fn: () => T, organizationId = orgA.id) => runWithTenantContext({ organizationId, source: 'test' }, async () => await fn());
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const profile: PlanningProfile = { timezone: 'UTC', country: 'SK', depot: { latitude: 48, longitude: 17 }, endLocation: { latitude: 48, longitude: 17 },
    workdayStart: '00:01', workdayEnd: '23:59', breakMinutes: 0, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { INSTALLATION: 5 },
    fallbackSpeedKph: 40, fallbackDistanceFactor: 1.3, maximumJobsPerRoute: 50, vehicleRequired: true, requireHumanApproval: true, enabled: true };
  try {
    const employee = await scoped(() => prisma.employee.create({ data: { firstName: 'Test', lastName: suffix, userId: worker.id, role: 'WORKER' } }));
    const otherEmployee = await scoped(() => prisma.employee.create({ data: { firstName: 'Other', lastName: suffix, role: 'WORKER' } }), orgB.id);
    const vehicle = await scoped(() => prisma.vehicle.create({ data: { name: `Test ${suffix}` } }));
    const otherVehicle = await scoped(() => prisma.vehicle.create({ data: { name: `Other ${suffix}` } }), orgB.id);
    await scoped(() => saveProfile(profile, actor));
    const carrier = await scoped(() => prisma.advertisingCarrier.create({ data: { name: 'Fixture carrier', code: suffix, type: 'BILLBOARD', city: 'Fixture city', latitude: 48, longitude: 17 } }));
    const client = await scoped(() => prisma.client.create({ data: { name: 'Fixture client', normalizedName: suffix } }));
    const crm = await scoped(() => prisma.crmOrder.create({ data: { title: 'Fixture CRM', orderNumber: suffix, clientId: client.id } }));
    const createJob = (date: string) => scoped(() => prisma.workOrder.create({ data: { title: 'Fixture Work', description: 'Instructions only', clientName: 'Client', workType: 'INSTALLATION', scheduledAt: new Date(`${date}T00:01:00Z`), status: 'PLANNED', items: { create: { carrierId: carrier.id } } } }));
    const order = await createJob(tomorrow);
    const crews = [{ id: 'crew-test', employeeIds: [employee.id], vehicleId: vehicle.id }];
    const raw = { date: tomorrow, requestKey: randomUUID(), crews, jobIds: [order.id] };
    let planId = '';
    await t.test('Generate retries produce one persistent DRAFT and zero assignments or reservations', async () => {
      const [a, b] = await Promise.all([scoped(() => generatePlan(raw, actor)), scoped(() => generatePlan(raw, actor))]);
      assert.equal(a.id, b.id); assert.equal(a.status, 'DRAFT'); planId = a.id;
      assert.equal(await scoped(() => prisma.workAssignment.count()), 0); assert.equal(await scoped(() => prisma.vehicleReservation.count()), 0);
    });
    await t.test('Tenant B cannot read, approve, cancel or replan tenant A plan', async () => {
      await assert.rejects(scoped(() => getPlan(planId), orgB.id), /NOT_FOUND/);
      await assert.rejects(scoped(() => approvePlan(planId, actor, true), orgB.id), /NOT_FOUND/);
      await assert.rejects(scoped(() => cancelDraft(planId, actor), orgB.id), /NOT_FOUND/);
      await assert.rejects(scoped(() => generatePlan({ ...raw, requestKey: randomUUID(), parentPlanId: planId }, actor), orgB.id), /NOT_FOUND/);
    });
    await t.test('Cross-tenant crew worker and vehicle reject before writes', async () => {
      for (const crew of [{ ...crews[0], employeeIds: [otherEmployee.id] }, { ...crews[0], vehicleId: otherVehicle.id }]) {
        await assert.rejects(scoped(() => generatePlan({ ...raw, crews: [crew], requestKey: randomUUID() }, actor)));
      }
    });
    await t.test('L: worker cannot approve or generate', async () => {
      await assert.rejects(scoped(() => approvePlan(planId, workerActor, true)), /FORBIDDEN/);
      await assert.rejects(scoped(() => generatePlan({ ...raw, requestKey: randomUUID() }, workerActor)), /FORBIDDEN/);
    });
    await t.test('J: concurrent approve produces one assignment, WorkTask, reservation and approval audit', async () => {
      const [a, b] = await Promise.all([scoped(() => approvePlan(planId, actor, true)), scoped(() => approvePlan(planId, actor, true))]);
      assert.equal(a.status, 'APPROVED'); assert.equal(b.status, 'APPROVED');
      assert.equal(await scoped(() => prisma.workAssignment.count()), 1); assert.equal(await scoped(() => prisma.workTask.count()), 1); assert.equal(await scoped(() => prisma.vehicleReservation.count()), 1);
      assert.equal(await scoped(() => prisma.crmAuditLog.count({ where: { action: 'FIELD_PLAN_APPROVED' } })), 1);
    });
    await t.test('C/E: real inclusive absence and reservations enter availability', async () => {
      const day = new Date(`${tomorrow}T00:00:00Z`);
      await scoped(() => prisma.employeeAbsence.create({ data: { employeeId: employee.id, dateFrom: day, dateTo: day, status: 'APPROVED' } }));
      const data = await scoped(() => loadPlanningData(tomorrow));
      assert.equal(data.employees.find(e => e.id === employee.id)?.available, false); assert.equal(data.vehicles.find(v => v.id === vehicle.id)?.reserved, true);
    });
    await t.test('two competing plans cannot reserve the same worker and vehicle concurrently', async () => {
      const later = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const a = await createJob(later), b = await createJob(later);
      const proposals = await Promise.all([a, b].map(order => scoped(() => generatePlan({ date: later, requestKey: randomUUID(), crews, jobIds: [order.id] }, actor))));
      const approvals = await Promise.allSettled(proposals.map(p => scoped(() => approvePlan(p.id, actor, true))));
      assert.equal(approvals.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(await scoped(() => prisma.vehicleReservation.count({ where: { dateFrom: new Date(`${later}T00:00:00Z`) } })), 1);
    });
    await t.test('approval rechecks employee qualifications and rolls back changed plans', async () => {
      const later = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const o = await createJob(later);
      await scoped(() => prisma.employee.update({ where: { id: employee.id }, data: { positions: ['trained'] } }));
      await scoped(() => prisma.workOrder.update({ where: { id: o.id }, data: { planningConstraints: { requiredPositions: ['trained'] } } }));
      const proposal = await scoped(() => generatePlan({ date: later, requestKey: randomUUID(), crews, jobIds: [o.id] }, actor));
      await scoped(() => prisma.employee.update({ where: { id: employee.id }, data: { positions: [] } }));
      await assert.rejects(scoped(() => approvePlan(proposal.id, actor, true)), /Požadavky/);
      assert.equal((await scoped(() => getPlan(proposal.id))).status, 'DRAFT');
      assert.equal(await scoped(() => prisma.workAssignment.count({ where: { workOrderId: o.id } })), 0);
    });
    // Create today's snapshot directly using the public deterministic engine to avoid network and test timing drift.
    const todayOrder = await createJob(today); const todayOrder2 = await createJob(today);
    const realization = await scoped(() => prisma.crmRealization.create({ data: { crmOrderId: crm.id, workOrderId: todayOrder2.id, carrierId: carrier.id } }));
    const todayInput = await scoped(() => loadPlanningData(today, { crews, jobIds: [todayOrder.id, todayOrder2.id] }));
    const result = await planFieldWork(todayInput, async (a, b) => estimatedLeg(a, b, profile));
    const todayPlan = await scoped(() => prisma.fieldPlan.create({ data: { date: today, version: 1, organizationId: orgA.id, requestKey: randomUUID(), requestHash: 'fixture', createdByUserId: manager.id, planningInputSnapshot: json(todayInput), planningSummary: json(result) } }));
    await scoped(() => approvePlan(todayPlan.id, actor, true));
    await t.test('Worker DTO exposes own approved stops without commercial or other-employee fields', async () => {
      const dto = await scoped(() => myRoute(worker.id)); assert.equal(dto.routes[0].stops.length, 2);
      assert.doesNotMatch(JSON.stringify(dto), /price|margin|internalNote|employeeIds|contactPhone|userEmail/);
      assert.equal((await scoped(() => myRoute(manager.id))).routes.length, 0);
    });
    await t.test('Start and complete are idempotent and do not create approved payroll or FTD', async () => {
      await scoped(() => executeStop({ planId: todayPlan.id, workOrderId: todayOrder.id, action: 'start' }, workerActor));
      await Promise.all([1, 2].map(() => scoped(() => executeStop({ planId: todayPlan.id, workOrderId: todayOrder.id, action: 'complete' }, workerActor))));
      const updated = await scoped(() => prisma.workOrder.findUniqueOrThrow({ where: { id: todayOrder.id } }));
      assert.equal(updated.status, 'DONE'); assert.equal(updated.ftdSent, false); assert.equal(await scoped(() => prisma.workEntry.count()), 0);
    });
    await t.test('M: replan excludes completed work, retains source history and awaits approval', async () => {
      const r = await scoped(() => generatePlan({ date: today, parentPlanId: todayPlan.id, requestKey: randomUUID(), crews: [{ ...crews[0], startLocation: profile.depot }] }, actor));
      assert.equal(r.status, 'DRAFT'); assert.ok(r.result.crews.flatMap(c => c.stops).every(s => s.workOrderId !== todayOrder.id));
      assert.equal((await scoped(() => getPlan(todayPlan.id))).status, 'ACTIVE');
    });
    await t.test('N: concurrent field problem preserves business data and adds one realization blocker and audit', async () => {
      const request = { planId: todayPlan.id, workOrderId: todayOrder2.id, action: 'problem', problemType: 'Technický problém', note: 'Fixture blocked', requestKey: randomUUID() };
      await Promise.all([1, 2].map(() => scoped(() => executeStop(request, workerActor))));
      const r = await scoped(() => prisma.crmRealization.findUniqueOrThrow({ where: { id: realization.id } })); assert.match(r.claimNote!, /Fixture blocked/);
      assert.equal(await scoped(() => prisma.crmAuditLog.count({ where: { action: 'FIELD_EXECUTION_BLOCKED' } })), 1);
      assert.notEqual((await scoped(() => prisma.workOrder.findUniqueOrThrow({ where: { id: todayOrder2.id } }))).status, 'CANCELLED');
    });
    await t.test('O: Navigation completion respects authoritative point state', async () => {
      const nav = await scoped(() => prisma.navigationOrder.create({ data: { crmOrderId: crm.id, targetName: 'Fixture', targetLatitude: 48, targetLongitude: 17, status: 'INSTALACE', points: { create: { label: 'Fixture', latitude: 48, longitude: 17, navigationType: 'TEST' } } } }));
      await scoped(() => prisma.workOrder.update({ where: { id: todayOrder2.id }, data: { navigationOrderId: nav.id } }));
      await scoped(() => executeStop({ planId: todayPlan.id, workOrderId: todayOrder2.id, action: 'start' }, workerActor));
      await assert.rejects(scoped(() => executeStop({ planId: todayPlan.id, workOrderId: todayOrder2.id, action: 'complete' }, workerActor)), /Navigation/);
      assert.equal((await scoped(() => prisma.navigationOrder.findUniqueOrThrow({ where: { id: nav.id } }))).status, 'INSTALACE');
    });
  } finally { await prisma.$disconnect(); }
});
