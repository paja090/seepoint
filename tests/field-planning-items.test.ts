import test from 'node:test';
import assert from 'node:assert/strict';
import { itemStatus, workItemJobs, type FieldItem } from '../lib/field-planning/item-jobs';
import { planFieldWork, estimatedLeg } from '../lib/field-planning/planning-engine';
import { profileForNavigation } from '../lib/field-planning/profile';
import type { PlanningInput, PlanningJob, PlanningProfile } from '../lib/field-planning/contracts';
const date = new Date('2030-06-01T00:00:00Z');
const profile: PlanningProfile = { timezone: 'UTC', country: 'SK', depot: { latitude: 48, longitude: 17 }, endLocation: { latitude: 48, longitude: 17 }, workdayStart: '06:00', workdayEnd: '18:00', breakMinutes: 0, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { INSTALLATION: 10, 'INSTALLATION:BILLBOARD': 12 }, fallbackSpeedKph: 40, fallbackDistanceFactor: 1.3, maximumJobsPerRoute: 50, vehicleRequired: false, requireHumanApproval: true, enabled: true };
const base: PlanningJob = { id: 'order', organizationId: 'a', title: 'Campaign', workType: 'INSTALLATION', priority: 'NORMAL', status: 'PLANNED', scheduledAt: date.toISOString(), updatedAt: date.toISOString(), serviceMinutes: 600, location: null, constraints: {} };
function items(count = 20): FieldItem[] { return Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, organizationId: 'a', workOrderId: base.id, carrierId: `carrier-${i}`, surfaceId: null, crmRealizationId: null, crmRealization: null, surface: null, description: null, quantity: 1, executionStatus: null, estimatedMinutes: null, issueNote: null, updatedAt: date,
  carrier: { id: `carrier-${i}`, organizationId: 'a', name: `Billboard ${i}`, type: 'BILLBOARD', latitude: 48, longitude: 17, updatedAt: date } } as FieldItem)); }
function input(jobs: PlanningJob[]): PlanningInput { return { organizationId: 'a', date: '2030-06-01', now: date.toISOString(), profile, jobs, employees: [0, 1].map(i => ({ id: `e${i}`, organizationId: 'a', name: `Worker ${i}`, userId: `u${i}`, isActive: true, available: true, positions: [], roles: ['WORKER'] })), vehicles: [], crews: [0, 1].map(i => ({ id: `c${i}`, employeeIds: [`e${i}`], vehicleId: null })) }; }
const plan = (jobs: PlanningJob[]) => planFieldWork(input(jobs), async (a, b) => estimatedLeg(a, b, profile));
test('20 ordinary billboard items produce 20 stops across crews with one parent WorkOrder', async () => { const r = await plan(workItemJobs(base, items(), profile)); assert.equal(r.unassigned.length, 0); assert.equal(r.crews.length, 2); const stops = r.crews.flatMap(c => c.stops); assert.equal(stops.length, 20); assert.equal(new Set(stops.map(s => s.jobId)).size, 20); assert.ok(stops.every(s => s.workOrderId === 'order' && s.workOrderItemId)); });
test('same GPS keeps item identity and does not multiply aggregate WorkOrder hours', () => { const jobs = workItemJobs(base, items(), profile); assert.equal(jobs.length, 20); assert.equal(jobs.reduce((n, j) => n + j.serviceMinutes!, 0), 240); });
test('tenant-specific carrier duration and item override precede WorkType default', () => { const a = items(1); a[0].estimatedMinutes = 7; assert.equal(workItemJobs(base, a, profile)[0].serviceMinutes, 7); a[0].estimatedMinutes = null; assert.equal(workItemJobs(base, a, { ...profile, serviceMinutes: { INSTALLATION: 25 } })[0].serviceMinutes, 25); });
test('missing GPS stays unassigned while other items remain feasible', async () => { const a = items(2); a[0].carrier!.latitude = null; const r = await plan(workItemJobs(base, a, profile)); assert.equal(r.unassigned.length, 1); assert.equal(r.crews.flatMap(c => c.stops).length, 1); });
for (const reference of ['item', 'carrier', 'surface', 'realization']) test(`cross-tenant ${reference} rejected`, () => { const a = items(1); if (reference === 'item') a[0].organizationId = 'b'; if (reference === 'carrier') a[0].carrier!.organizationId = 'b'; if (reference === 'surface') a[0].surface = { organizationId: 'b' } as FieldItem['surface']; if (reference === 'realization') a[0].crmRealization = { organizationId: 'b' } as FieldItem['crmRealization']; assert.throws(() => workItemJobs(base, a, profile), /Cross-tenant/); });
test('one DONE and one blocked item do not affect sibling execution or history', async () => { const a = items(3); a[0].executionStatus = 'DONE'; a[1].issueNote = 'Broken'; const r = await plan(workItemJobs(base, a, profile)); assert.equal(r.crews.flatMap(c => c.stops).length, 1); assert.equal(r.unassigned.length, 1); assert.equal(a[0].executionStatus, 'DONE'); });
test('linked CRM state is authoritative even when an item has an old state', () => { assert.equal(itemStatus({ executionStatus: 'DONE', crmRealization: { status: 'SCHEDULED', claimNote: null } }), 'PLANNED'); assert.equal(itemStatus({ executionStatus: null, crmRealization: { status: 'PHOTOGRAPHED', claimNote: null } }), 'DONE'); });
test('item road fallback remains deterministic and explicitly estimated', async () => { const jobs = workItemJobs(base, items(2), profile); assert.deepEqual(await plan(jobs), await plan(jobs)); assert.equal((await plan(jobs)).estimated, true); });
test('disabled Navigation profile view hides its settings while preserving historical route geometry', () => {
  const original = { ...profile, navigationPointMinutes: { point: 25 }, serviceMinutes: { ...profile.serviceMinutes, NAVIGATION_INSTALLATION: 20, 'NAVIGATION_INSTALLATION:SIGN': 15 } };
  const visible = profileForNavigation(original, false);
  assert.ok(!('navigationPointMinutes' in visible)); assert.ok(!Object.keys(visible.serviceMinutes).some(k => k.startsWith('NAVIGATION')));
  assert.deepEqual(visible.depot, original.depot); assert.equal(visible.workdayStart, original.workdayStart); assert.equal(original.navigationPointMinutes.point, 25);
});
test('existing CRM installer is a hard crew requirement, not an optimizer suggestion', () => {
  const a = items(1); a[0].crmRealizationId = 'realization';
  a[0].crmRealization = { id: 'realization', organizationId: 'a', workOrderId: base.id, carrierId: a[0].carrierId, surfaceId: null, assignedUserId: 'installer', status: 'SCHEDULED', updatedAt: date } as FieldItem['crmRealization'];
  assert.deepEqual(workItemJobs(base, a, profile, [{ id: 'employee', userId: 'installer' }])[0].constraints.requiredEmployeeIds, ['employee']);
  assert.match(workItemJobs(base, a, profile)[0].blockedReason!, /Employee/);
});
