import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/db';
import { runWithTenantContext } from '../lib/tenant-context';
import { approvePlan, generatePlan, getPlan, saveProfile } from '../lib/field-planning/service';
import { loadPlanningData } from '../lib/field-planning/data';
import { executeStop, myRoute } from '../lib/field-planning/execution';
import { navigationJobId } from '../lib/field-planning/contracts';

const enabled = process.env.FIELD_PLANNER_TEST_DATABASE === 'codex-field-planner-20260914'
  && new URL(process.env.DATABASE_URL || 'http://invalid').hostname.startsWith('ep-fancy-grass-atulv9uv');
test('Navigation Field Planner real Postgres', { skip: !enabled }, async t => {
  const suffix = randomUUID();
  const org = await prisma.organization.create({ data: { name: 'Navigation planner fixture', slug: `nav-fp-${suffix}`, plan: 'PRO' } });
  const other = await prisma.organization.create({ data: { name: 'Other fixture', slug: `nav-fp-other-${suffix}`, plan: 'PRO' } });
  const worker = await prisma.user.create({ data: { name: 'Installer fixture', email: `nav-fp-${suffix}@example.invalid`, role: 'WORKER' } });
  const manager = await prisma.user.create({ data: { name: 'Manager fixture', email: `nav-fp-m-${suffix}@example.invalid`, role: 'MANAGER' } });
  const actor = { id: manager.id, email: manager.email, role: 'MANAGER' };
  const workerActor = { id: worker.id, email: worker.email, role: 'WORKER' };
  const scoped = <T>(fn: () => T, organizationId = org.id) => runWithTenantContext({ organizationId, source: 'test' }, async () => await fn());
  const date = new Date().toISOString().slice(0, 10);
  try {
    const employee = await scoped(() => prisma.employee.create({ data: { firstName: 'Installer', lastName: suffix, userId: worker.id, role: 'WORKER' } }));
    const vehicle = await scoped(() => prisma.vehicle.create({ data: { name: 'Installation van' } }));
    await scoped(() => saveProfile({ timezone: 'UTC', country: 'SK', depot: { latitude: 48, longitude: 17 }, endLocation: { latitude: 48, longitude: 17 }, workdayStart: '00:01', workdayEnd: '23:59', breakMinutes: 0, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { NAVIGATION_INSTALLATION: 5 }, fallbackSpeedKph: 40, fallbackDistanceFactor: 1.3, maximumJobsPerRoute: 30, vehicleRequired: true, requireHumanApproval: true, enabled: true }, actor));
    const createOrder = async (name: string, count: number) => scoped(async () => {
      const client = await prisma.client.create({ data: { name, normalizedName: `${name}-${suffix}` } });
      const crm = await prisma.crmOrder.create({ data: { clientId: client.id, title: name, orderNumber: `${name}-${suffix}` } });
      return prisma.navigationOrder.create({ data: { crmOrderId: crm.id, targetName: name, targetLatitude: 48, targetLongitude: 17, status: 'PRIPRAVENO_K_INSTALACI',
        points: { create: Array.from({ length: count }, (_, i) => ({ label: `${name} ${i + 1}`, address: 'Fixture city', latitude: 48 + i / 10000, longitude: 17, navigationType: 'SIGN', sortOrder: i })) } }, include: { points: true } });
    });
    const a = await createOrder('Client A', 5), b = await createOrder('Client B', 3);
    const ids = [...a.points, ...b.points].map(p => navigationJobId(p.id));
    const crews = [{ id: 'crew', employeeIds: [employee.id], vehicleId: vehicle.id }];
    const raw = { date, jobIds: ids, crews, requestKey: randomUUID() };
    let planId = '';
    await t.test('A/B/I: unlinked 5+3 points produce 8 DRAFT stops without WorkOrders, assignments, photos or carriers', async () => {
      const plan = await scoped(() => generatePlan(raw, actor)); planId = plan.id;
      assert.equal(plan.result.crews[0].stops.length, 8); assert.equal(plan.result.unassigned.length, 0);
      assert.equal(await scoped(() => prisma.workOrder.count()), 0); assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 0); assert.equal(await scoped(() => prisma.photo.count()), 0);
      assert.equal(await scoped(() => prisma.navigationPoint.count({ where: { installerUserId: { not: null } } })), 0);
    });
    await t.test('D: other tenant cannot select points, read or approve their plan', async () => {
      await assert.rejects(scoped(() => getPlan(planId), other.id), /NOT_FOUND/);
      await assert.rejects(scoped(() => approvePlan(planId, actor, true), other.id), /NOT_FOUND/);
      const config = await scoped(() => prisma.organizationFieldPlanningProfile.findUniqueOrThrow({ where: { organizationId: org.id } }));
      await scoped(() => saveProfile(config.configuration, actor), other.id);
      await assert.rejects(scoped(() => loadPlanningData(date, { jobIds: ids }), other.id), /organizaci/);
    });
    await t.test('E: GPS change after draft rejects approval and creates no carrier/reservation', async () => {
      await scoped(() => prisma.navigationPoint.update({ where: { id: a.points[0].id }, data: { latitude: 48.002 } }));
      await assert.rejects(scoped(() => approvePlan(planId, actor, true)), /změnily/);
      assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 0); assert.equal(await scoped(() => prisma.vehicleReservation.count()), 0);
      const plan = await scoped(() => generatePlan({ ...raw, requestKey: randomUUID() }, actor)); planId = plan.id;
    });
    await t.test('approval is concurrent-idempotent and uses existing Navigation installer assignment without carriers', async () => {
      await Promise.all([1, 2].map(() => scoped(() => approvePlan(planId, actor, true))));
      assert.equal(await scoped(() => prisma.navigationPoint.count({ where: { installerUserId: worker.id } })), 8);
      assert.equal(await scoped(() => prisma.vehicleReservation.count()), 1); assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 0);
      assert.equal(await scoped(() => prisma.workOrder.count()), 0);
    });
    await t.test('G: own worker receives 8 minimal point DTOs; other worker sees none and cannot execute', async () => {
      const dto = await scoped(() => myRoute(worker.id)); assert.equal(dto.routes[0].stops.length, 8);
      assert.doesNotMatch(JSON.stringify(dto), /unitPrice|subtotal|internalNote|employeeIds|installerUserId/);
      assert.equal((await scoped(() => myRoute(manager.id))).routes.length, 0);
      await assert.rejects(scoped(() => executeStop({ planId, workOrderId: '', jobId: ids[0], action: 'start' }, actor)), /FORBIDDEN/);
    });
    await t.test('H/I: start does not create carrier; photo uses canonical installation and completes only one point', async () => {
      const request = { planId, workOrderId: '', jobId: ids[0] };
      await scoped(() => executeStop({ ...request, action: 'start' }, workerActor));
      assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 0);
      await assert.rejects(scoped(() => executeStop({ ...request, action: 'complete' }, workerActor)), /fotografie/);
      const photoId = randomUUID();
      await scoped(() => executeStop({ ...request, action: 'photo' }, workerActor, undefined, [{ id: photoId, driveFileId: null, fileName: 'fixture.jpg', mimeType: 'image/jpeg', size: 3, storageProvider: 'DATABASE', storageKey: photoId, contentChecksum: 'fixture', content: new Uint8Array([1, 2, 3]), type: 'AFTER_INSTALLATION' }]));
      await scoped(() => executeStop({ ...request, action: 'complete' }, workerActor));
      const point = await scoped(() => prisma.navigationPoint.findUniqueOrThrow({ where: { id: a.points[0].id } }));
      assert.equal(point.status, 'INSTALLED'); assert.equal(point.installedPhotoId, photoId); assert.ok(point.carrierId); assert.ok(point.surfaceId);
      assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 1); assert.equal(await scoped(() => prisma.navigationPoint.count({ where: { status: 'INSTALLED' } })), 1);
      assert.equal((await scoped(() => myRoute(worker.id))).routes[0].stops.filter(s => s.status === 'DONE').length, 1);
    });
    await t.test('F: replan retains completed history and schedules only 7 remaining points', async () => {
      const plan = await scoped(() => generatePlan({ date, parentPlanId: planId, crews: [{ ...crews[0], startLocation: { latitude: 48, longitude: 17 } }], requestKey: randomUUID() }, actor));
      assert.equal(plan.result.crews[0].stops.length, 7); assert.ok(plan.result.crews[0].stops.every(s => s.navigationPointId !== a.points[0].id));
      assert.equal((await scoped(() => getPlan(planId))).status, 'ACTIVE');
    });
    await t.test('point issue is idempotent and does not block unrelated points or create a carrier', async () => {
      const request = { planId, workOrderId: '', jobId: ids[1], action: 'problem', problemType: 'Technický problém', note: 'Fixture issue', requestKey: randomUUID() };
      await Promise.all([1, 2].map(() => scoped(() => executeStop(request, workerActor))));
      assert.equal(await scoped(() => prisma.navigationPoint.count({ where: { issueReported: true } })), 1);
      assert.equal(await scoped(() => prisma.crmAuditLog.count({ where: { action: 'FIELD_EXECUTION_BLOCKED' } })), 1);
      assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 1);
    });
    await t.test('linked Navigation reuses one WorkOrder, one assignment and one canonical WorkTask for two stops', async () => {
      const nav = await createOrder('Linked client', 2);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const order = await scoped(() => prisma.workOrder.create({ data: { title: 'Linked installation', description: 'Fixture instructions', clientName: 'Linked client', navigationOrderId: nav.id,
        workType: 'INSTALLATION', status: 'PLANNED', scheduledAt: new Date(`${tomorrow}T06:00:00Z`) } }));
      const proposal = await scoped(() => generatePlan({ date: tomorrow, jobIds: nav.points.map(p => navigationJobId(p.id)), crews, requestKey: randomUUID() }, actor));
      assert.equal(proposal.result.crews[0].stops.length, 2); assert.ok(proposal.result.crews[0].stops.every(s => s.workOrderId === order.id));
      await scoped(() => approvePlan(proposal.id, actor, true));
      assert.equal(await scoped(() => prisma.workOrder.count()), 1);
      assert.equal(await scoped(() => prisma.workAssignment.count({ where: { workOrderId: order.id } })), 1);
      assert.equal(await scoped(() => prisma.workTask.count({ where: { workOrderId: order.id } })), 1);
      assert.equal(await scoped(() => prisma.advertisingCarrier.count()), 1);
    });
  } finally { await prisma.$disconnect(); }
});
