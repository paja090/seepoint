import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCrews, dispatchMapResult, dispatchPlanHref, dispatchProgress, dispatchTimeline } from '../lib/dispatch/presentation';
import type { DispatchPlan } from '../lib/dispatch/queue';
import type { MyRouteDTO, PlanningResult } from '../lib/field-planning/contracts';
import { input, job, travel } from './helpers/field-work';
import { planFieldWork } from '../lib/field-planning/planning-engine';

test('dispatch presentation reuses saved routes without mixing days, identities or editing permissions', async () => {
  const data = input([job()]);
  const result = await planFieldWork(data, travel);
  const plan: DispatchPlan = { id: 'one', date: data.date, status: 'APPROVED', version: 1, electionCampaignId: null, planningSummary: result };
  const second = { ...plan, id: 'two', date: '2035-06-11', electionCampaignId: 'campaign', status: 'DRAFT' };
  const before = structuredClone(result);
  const rows = dispatchCrews([plan, second]);
  assert.notEqual(rows[0].key, rows[1].key);
  assert.deepEqual(result, before);
  const map = dispatchMapResult([plan, second])!;
  assert.equal(map.crews[0].id, rows[0].key);
  assert.deepEqual(map.crews[0].stops, (plan.planningSummary as PlanningResult).crews[0].stops);
  assert.match(dispatchPlanHref(second), /date=2035-06-11/);
  assert.match(dispatchPlanHref(second), /campaign=campaign/);
  assert.match(dispatchPlanHref(plan), /planner=work/);
  const events = dispatchTimeline([plan, second]);
  assert.ok(events.every(event => event.source === 'FIELD_TRIP' && event.editable === false));
  assert.equal(events[0].startAt, result.crews[0].departureAt);
  assert.equal(events[1].busy, false);
});

test('dispatch progress comes only from live execution, including problems and partial completion', () => {
  const routes = [{ planId: 'plan', crewId: 'crew', stops: [{ status: 'DONE' }, { status: 'ISSUE' }, { status: 'IN_PROGRESS', completedQuantity: 1, quantity: 3 }] }] as MyRouteDTO['routes'];
  assert.deepEqual(dispatchProgress(routes), { 'plan:crew': { total: 3, done: 1, issues: 1 } });
  assert.equal(dispatchProgress(routes)['unknown:crew'], undefined);
  assert.deepEqual(dispatchProgress([]), {});
});

test('dispatch execution scope includes all crews only for managers and preserves mobile defaults', async () => {
  const { build } = await import('esbuild');
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const data = input([job()]);
  const summary = await planFieldWork(data, travel);
  const crew = summary.crews[0];
  const mocks: Record<string, unknown> = {
    '../db': { prisma: {} }, '../tenant-context': { requireTenantContext: () => ({ organizationId: 'org' }) },
    './data': { loadProfile: async () => data.profile }, './capabilities': { navigationAvailable: async () => true },
    './live-location': { loadPlanCrewLocations: async () => ({}) },
  };
  const bundle = await build({ entryPoints: ['lib/field-planning/execution.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'scope-fixtures', setup(b) { b.onResolve({ filter: /.*/ }, args => args.importer.replaceAll('\\', '/').endsWith('/field-planning/execution.ts') && args.path in mocks ? { path: 'fixture:' + args.path, external: true } : undefined); } }] });
  const realRequire = createRequire(resolve('package.json'));
  // Only this read service boundary is mocked; route selection and status projection execute unchanged.
  const evaluated = { exports: {} as { myRoute: typeof import('../lib/field-planning/execution').myRoute } };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)((id: string) => id.startsWith('fixture:') ? mocks[id.slice(8)] : realRequire(id), evaluated, evaluated.exports);
  let role = 'WORKER';
  const db = {
    user: { findUnique: async () => ({ role }) },
    employee: { findFirst: async () => ({ id: crew.employeeIds[0] }), findMany: async () => [{ userId: 'user' }] },
    fieldPlan: { findMany: async ({ where }: { where: { organizationId: string; id?: { in: string[] } } }) => {
      assert.equal(where.organizationId, 'org'); if (where.id) assert.deepEqual(where.id.in, ['plan']);
      return [{ id: 'plan', planningSummary: { ...summary, crews: [crew, { ...crew, id: 'other', employeeIds: ['other-employee'] }] } }];
    } },
    workOrder: { findMany: async () => data.jobs.map(job => ({ id: job.id, title: job.title, status: 'DONE', items: [], crmRealizations: [], workTasks: [] })) },
    navigationPoint: { findMany: async () => [] }, electionRemovalPoint: { findMany: async () => [] }, crmAuditLog: { findMany: async () => [] },
  } as unknown as Parameters<typeof evaluated.exports.myRoute>[2];
  const read = (all = false) => evaluated.exports.myRoute('user', data.date, db, all ? { allCrews: true, planIds: ['plan'] } : undefined);
  assert.equal((await read()).routes.length, 1);
  assert.equal((await read(true)).routes.length, 1);
  role = 'MANAGER'; assert.equal((await read()).routes.length, 1);
  const dispatch = await read(true); assert.equal(dispatch.routes.length, 2);
  assert.deepEqual(dispatch.routes.map(route => route.crewId), [crew.id, 'other']);
});
