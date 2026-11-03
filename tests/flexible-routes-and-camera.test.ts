/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { input, job, travel } from './helpers/field-work';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import { loadFieldJobs } from '../lib/field-planning/field-jobs';
import { loadScheduledRouteDays } from '../lib/field-planning/scheduled-days';
import { finalizeMobilePhotoCampaigns } from '../lib/mobile-photo-campaigns';
import { runWithTenantContext } from '../lib/tenant-context';

async function bundleService(mocks: Record<string, unknown>, entry = 'lib/field-planning/service.ts') {
  const { build } = await import('esbuild');
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [
      {
        name: 'fixtures',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) =>
            a.importer.replaceAll('\\', '/').endsWith('/' + entry.slice(4)) && a.path in mocks
              ? { path: 'fixture:' + a.path, external: true }
              : undefined
          );
        },
      },
    ],
  });
  const realRequire = createRequire(resolve('package.json'));
  const evaluated = { exports: {} as any };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
    (id: string) => (id.startsWith('fixture:') ? mocks[id.slice(8)] : realRequire(id)),
    evaluated,
    evaluated.exports
  );
  return evaluated.exports;
}

test('finalizeMobilePhotoCampaigns auto-hides completed and empty campaigns while keeping unfinished ones', () => {
  const raw = [
    {
      id: 'offer-done',
      sourceType: 'OFFER' as const,
      title: 'Hotová kampaň',
      clientName: 'Klient A',
      status: 'ACCEPTED',
      surfaces: [
        {
          targetKind: 'STANDARD_SURFACE' as const,
          itemId: 's1',
          surfaceId: 's1',
          surfaceName: 'Strana A',
          side: 'Strana A',
          carrierId: 'c1',
          carrierCode: 'BB-01',
          carrierName: 'Billboard 1',
          address: 'Hlavní 1',
          city: 'Praha',
          latitude: 50.08,
          longitude: 14.42,
          dateFrom: null,
          dateTo: null,
          isInstalled: true,
          installedPhotoUrl: '/photo1.jpg',
        },
      ],
    },
    {
      id: 'offer-partial',
      sourceType: 'OFFER' as const,
      title: 'Rozpracovaná kampaň',
      clientName: 'Klient B',
      status: 'ACCEPTED',
      surfaces: [
        {
          targetKind: 'STANDARD_SURFACE' as const,
          itemId: 's2',
          surfaceId: 's2',
          surfaceName: 'Strana A',
          side: 'Strana A',
          carrierId: 'c2',
          carrierCode: 'BB-02',
          carrierName: 'Billboard 2',
          address: 'Nádražní 5',
          city: 'Brno',
          latitude: 49.19,
          longitude: 16.6,
          dateFrom: null,
          dateTo: null,
          isInstalled: true,
          installedPhotoUrl: '/photo2.jpg',
        },
        {
          targetKind: 'STANDARD_SURFACE' as const,
          itemId: 's3',
          surfaceId: 's3',
          surfaceName: 'Strana B',
          side: 'Strana B',
          carrierId: 'c2',
          carrierCode: 'BB-02',
          carrierName: 'Billboard 2',
          address: 'Nádražní 5',
          city: 'Brno',
          latitude: 49.19,
          longitude: 16.6,
          dateFrom: null,
          dateTo: null,
          isInstalled: false,
          installedPhotoUrl: null,
        },
      ],
    },
    {
      id: 'empty-order',
      sourceType: 'CRM_ORDER' as const,
      title: 'Prázdná zakázka',
      clientName: 'Klient C',
      status: 'CONFIRMED',
      surfaces: [],
    },
  ];

  const visible = finalizeMobilePhotoCampaigns(raw);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'offer-partial');
  assert.equal(visible[0].installedCount, 1);
  assert.equal(visible[0].totalSurfaces, 2);
  assert.equal(visible[0].progressPercent, 50);
});

test('loadScheduledRouteDays aggregates planned days and filters by employeeId and module flags', async () => {
  const rows = [
    {
      id: 'p1',
      date: '2035-06-12',
      status: 'APPROVED',
      electionCampaignId: null,
      planningSummary: {
        crews: [
          {
            id: 'c1',
            name: 'Posádka Sever',
            employeeIds: ['emp-1'],
            names: ['Jan Novák'],
            stops: [
              { jobId: 'j1', clientName: 'Primark', isWarehousePitstop: false },
              { jobId: 'j2', clientName: 'Kaufland', isWarehousePitstop: false },
              { jobId: 'pit', clientName: null, isWarehousePitstop: true },
            ],
          },
        ],
      },
    },
    {
      id: 'p2',
      date: '2035-06-10',
      status: 'DRAFT',
      electionCampaignId: 'camp-1',
      planningSummary: {
        crews: [
          {
            id: 'c2',
            employeeIds: ['emp-2'],
            names: ['Petr Svoboda'],
            stops: [{ jobId: 'j3', electionRemovalPointId: 'pt-1', fieldWorkStepId: 'st-1', clientName: 'Město' }],
          },
        ],
      },
    },
  ];

  const db: any = {
    fieldPlan: {
      findMany: async ({ where }: any) => {
        assert.equal(where.organizationId, 'org-1');
        return rows.filter(
          (r) =>
            where.status.in.includes(r.status) &&
            (where.electionCampaignId === undefined || r.electionCampaignId === where.electionCampaignId)
        );
      },
    },
  };

  const allDays = await runWithTenantContext({ organizationId: 'org-1', source: 'test' }, () =>
    loadScheduledRouteDays({ aroundDate: '2035-06-10', fieldEnabled: true, navigationEnabled: true }, db)
  );
  assert.deepEqual(
    allDays.map((d) => d.date),
    ['2035-06-10', '2035-06-12']
  );
  assert.equal(allDays[1].stopCount, 2); // warehouse pitstop excluded
  assert.deepEqual(allDays[1].crewNames, ['Posádka Sever']);
  assert.deepEqual(allDays[1].clientNames, ['Primark', 'Kaufland']);

  const emp1Only = await runWithTenantContext({ organizationId: 'org-1', source: 'test' }, () =>
    loadScheduledRouteDays(
      { aroundDate: '2035-06-10', employeeId: 'emp-1', includeDrafts: false },
      db
    )
  );
  assert.equal(emp1Only.length, 1);
  assert.equal(emp1Only[0].date, '2035-06-12');
});

test('loadFieldJobs unblocks parent plan steps via excludePlanIds and expands campaignIds', async () => {
  const point: any = {
    id: 'point-1',
    organizationId: 'org',
    campaignId: 'camp-x',
    label: ' Stojan 1 ',
    mediaType: 'BENCH',
    quantity: 1,
    operationType: 'INSTALL_OBJECT',
    status: 'ASSIGNED',
    reviewRequired: false,
    assignedFieldPlanId: 'parent-plan',
    latitude: 50.1,
    longitude: 14.4,
    updatedAt: new Date(),
    steps: [
      {
        id: 'step-1',
        pointId: 'point-1',
        organizationId: 'org',
        status: 'ASSIGNED',
        sequence: 1,
        kind: 'WORK',
        quantity: 1,
        completedQuantity: 0,
        serviceMinutes: 15,
        loadDelta: 0,
        latitude: 50.1,
        longitude: 14.4,
        updatedAt: new Date(),
        assignedFieldPlanId: 'parent-plan',
      },
    ],
    campaign: {
      id: 'camp-x',
      organizationId: 'org',
      name: 'Terénní zakázka',
      clientName: 'Klient X',
      createdAt: new Date(),
      targetDate: null,
    },
  };

  const db: any = {
    organization: { findUnique: async () => ({ plan: 'ENTERPRISE', enabledModules: { electionRemoval: true } }) },
    electionRemovalPoint: { findMany: async () => [point] },
  };

  // Without excludePlanIds -> blocked
  const blocked = await runWithTenantContext({ organizationId: 'org', source: 'test' }, () =>
    loadFieldJobs(db, undefined, { campaignIds: ['camp-x'] })
  );
  assert.equal(blocked.length, 1);
  assert.ok(blocked[0].blockedReason);

  // With excludePlanIds: ['parent-plan'] -> unblocked for replanning!
  const unblocked = await runWithTenantContext({ organizationId: 'org', source: 'test' }, () =>
    loadFieldJobs(db, undefined, { excludePlanIds: ['parent-plan'], campaignIds: ['camp-x'] })
  );
  assert.equal(unblocked.length, 1);
  assert.equal(Boolean(unblocked[0].blockedReason), false);
});

test('reschedulePlan moves an APPROVED route to any chosen date and keeps completed stops on original day', async () => {
  const data = input([
    job({ id: 'work-done', workType: 'INSTALLATION', sourceType: 'WORK_ORDER' }),
    job({ id: 'work-open', workType: 'INSTALLATION', sourceType: 'WORK_ORDER' }),
    job({
      id: 'field-step:f1',
      sourceType: 'ELECTION_REMOVAL_POINT',
      electionCampaignId: 'camp-1',
      electionRemovalPointId: 'pt-1',
      fieldWorkStepId: 'f1',
    }),
  ]);
  data.date = '2035-06-10';
  data.now = '2035-06-10T05:00:00Z';
  const result = await planFieldWork(data, travel);

  const plans = new Map<string, any>();
  plans.set('orig-plan', {
    id: 'orig-plan',
    organizationId: 'org',
    date: '2035-06-10',
    version: 1,
    status: 'APPROVED',
    electionCampaignId: null,
    planningInputSnapshot: data,
    planningSummary: result,
    approvalSnapshot: { reservationIds: ['res-old'] },
    parentPlanId: null,
  });

  const updatedOrders: any[] = [];
  const updatedSteps: any[] = [];
  const cancelledReservations: any[] = [];
  const createdReservations: any[] = [];

  const tx: any = {
    fieldPlan: {
      findUnique: async ({ where }: any) => plans.get(where.id) ?? null,
      findFirst: async () => null,
      create: async ({ data: rowData }: any) => {
        const created = { id: 'moved-plan', ...rowData };
        plans.set(created.id, created);
        return created;
      },
      update: async ({ where, data: patch }: any) => {
        const target = plans.get(where.id);
        Object.assign(target, patch);
        return target;
      },
    },
    fieldWorkStep: {
      findMany: async () => [{ id: 'f1', status: 'ASSIGNED', quantity: 1, completedQuantity: 0 }],
      updateMany: async ({ where, data: patch }: any) => {
        updatedSteps.push({ where, patch });
        return { count: 1 };
      },
    },
    electionRemovalPoint: {
      update: async () => ({}),
    },
    workOrder: {
      findMany: async () => [
        { id: 'work-done', status: 'DONE' },
        { id: 'work-open', status: 'PLANNED' },
      ],
      update: async ({ where, data: patch }: any) => {
        updatedOrders.push({ where, patch });
        return {};
      },
    },
    employeeAbsence: { findMany: async () => [] },
    vehicle: { findMany: async () => [{ id: data.vehicles[0].id, name: 'Dodávka 1', status: 'AVAILABLE' }] },
    vehicleReservation: {
      findMany: async () => [],
      findFirst: async () => null,
      updateMany: async ({ where }: any) => {
        cancelledReservations.push(where.id.in);
        return { count: 1 };
      },
    },
    crmAuditLog: { create: async () => ({}) },
  };

  const service = await bundleService({
    '../db': { prisma: {} },
    '../tenant-context': { requireTenantContext: () => ({ organizationId: 'org' }) },
    './field-jobs': { requireFieldJobsEnabled: async () => {} },
    './capabilities': { navigationAvailable: async () => true },
    './data': { loadPlanningData: async () => structuredClone(data) },
    '../work-task-sync': { syncWorkOrderTasks: async () => {} },
    '../vehicle-reservation-service': {
      createVehicleReservation: async (_tx: any, payload: any) => {
        createdReservations.push(payload);
        return { id: payload.id };
      },
    },
  });

  const db = { $transaction: async (fn: any) => fn(tx) };
  const movedView = await service.reschedulePlan(
    'orig-plan',
    '2035-06-18',
    { id: 'manager', email: 'm@test', role: 'MANAGER' },
    { startTime: '08:30' },
    db
  );

  assert.equal(movedView.id, 'moved-plan');
  assert.equal(movedView.date, '2035-06-18');
  assert.equal(movedView.status, 'APPROVED');
  // Only unfinished stops moved ('work-open' and 'field-step:f1')
  const movedJobIds = movedView.result.crews[0].stops.map((s: any) => s.jobId).sort();
  assert.deepEqual(movedJobIds, ['field-step:f1', 'work-open']);
  assert.ok(movedView.result.crews[0].stops.every((s: any) => s.startAt.startsWith('2035-06-18')));

  // Completed stop stayed on original plan, marked COMPLETED
  const orig = plans.get('orig-plan');
  assert.equal(orig.status, 'COMPLETED');
  assert.deepEqual(
    orig.planningSummary.crews[0].stops.map((s: any) => s.jobId),
    ['work-done']
  );
  assert.equal(updatedSteps.length, 1);
  assert.equal(updatedSteps[0].patch.assignedFieldPlanId, 'moved-plan');
  assert.equal(updatedOrders.length, 1);
  assert.equal(updatedOrders[0].where.id, 'work-open');
  assert.equal(createdReservations.length, 1);
});

test('approvePlan replaces an APPROVED parent plan cleanly when adding new work to an existing route', async () => {
  const parentData = input([
    job({
      id: 'field-step:a',
      sourceType: 'ELECTION_REMOVAL_POINT',
      electionCampaignId: 'camp-1',
      electionRemovalPointId: 'pa',
      fieldWorkStepId: 'a',
    }),
  ]);
  parentData.date = '2035-06-20';
  parentData.now = '2035-06-20T05:00:00Z';
  const parentResult = await planFieldWork(parentData, travel);

  const replanData = input([
    job({
      id: 'field-step:a',
      sourceType: 'ELECTION_REMOVAL_POINT',
      electionCampaignId: 'camp-1',
      electionRemovalPointId: 'pa',
      fieldWorkStepId: 'a',
    }),
    job({ id: 'extra-work', workType: 'INSTALLATION', sourceType: 'WORK_ORDER' }),
  ]);
  replanData.date = '2035-06-20';
  replanData.now = '2035-06-20T05:00:00Z';
  const replanResult = await planFieldWork(replanData, travel);

  const plans = new Map<string, any>([
    [
      'parent-approved',
      {
        id: 'parent-approved',
        organizationId: 'org',
        date: '2035-06-20',
        status: 'APPROVED',
        planningInputSnapshot: parentData,
        planningSummary: parentResult,
        approvalSnapshot: { reservationIds: ['res-parent'] },
        parentPlanId: null,
      },
    ],
    [
      'child-draft',
      {
        id: 'child-draft',
        organizationId: 'org',
        date: '2035-06-20',
        status: 'DRAFT',
        planningInputSnapshot: replanData,
        planningSummary: replanResult,
        approvalSnapshot: {},
        parentPlanId: 'parent-approved',
      },
    ],
  ]);

  const stepState = { id: 'a', status: 'ASSIGNED', assignedFieldPlanId: 'parent-approved' };
  const assignments: any[] = [];

  const tx: any = {
    fieldPlan: {
      findUnique: async ({ where }: any) => plans.get(where.id) ?? null,
      updateMany: async ({ where, data: patch }: any) => {
        const p = plans.get(where.id);
        if (!p || p.status !== where.status) return { count: 0 };
        Object.assign(p, patch);
        return { count: 1 };
      },
      update: async ({ where, data: patch }: any) => {
        const p = plans.get(where.id);
        Object.assign(p, patch);
        return p;
      },
    },
    fieldWorkStep: {
      updateMany: async ({ where, data: patch }: any) => {
        if (where.assignedFieldPlanId === 'parent-approved' && stepState.assignedFieldPlanId === 'parent-approved') {
          Object.assign(stepState, patch);
          return { count: 1 };
        }
        if (where.id === 'a' && stepState.status === where.status && stepState.assignedFieldPlanId === where.assignedFieldPlanId) {
          Object.assign(stepState, patch);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    electionRemovalPoint: {
      updateMany: async () => ({ count: 1 }),
      update: async () => ({}),
    },
    electionCampaign: { update: async () => ({}) },
    workOrder: {
      findUnique: async () => ({ id: 'extra-work', status: 'NEW', assignments }),
      update: async () => ({}),
    },
    workAssignment: { create: async ({ data: row }: any) => assignments.push(row) },
    vehicleReservation: {
      findFirst: async () => ({ id: 'res-parent' }),
      updateMany: async () => ({ count: 0 }),
    },
    crmAuditLog: { create: async () => ({}) },
  };

  const service = await bundleService({
    '../db': { prisma: {} },
    '../tenant-context': { requireTenantContext: () => ({ organizationId: 'org' }) },
    './field-jobs': { requireFieldJobsEnabled: async () => {} },
    './capabilities': { navigationAvailable: async () => true },
    './data': { loadPlanningData: async () => structuredClone(replanData) },
    '../work-task-sync': { syncWorkOrderTasks: async () => {} },
    '../vehicle-reservation-service': { createVehicleReservation: async () => ({ id: 'res-new' }) },
  });

  const db = { $transaction: async (fn: any) => fn(tx) };
  const approved = await service.approvePlan(
    'child-draft',
    { id: 'manager', email: 'm@test', role: 'MANAGER' },
    true,
    db
  );

  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.result.crews[0].stops.length, 2);
  assert.equal(stepState.assignedFieldPlanId, 'child-draft');
  assert.equal(stepState.status, 'ASSIGNED');
  assert.equal(assignments.length, 1);
  assert.equal(plans.get('parent-approved').status, 'CANCELLED');
});
