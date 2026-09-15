import test from 'node:test';
import assert from 'node:assert/strict';
import type { NavigationPoint } from '@prisma/client';
import type { PlanningInput, PlanningJob, PlanningProfile } from '../lib/field-planning/contracts';
import { navigationPointJobs } from '../lib/field-planning/navigation-jobs';
import { estimatedLeg, planFieldWork } from '../lib/field-planning/planning-engine';
import { parseProfile } from '../lib/field-planning/profile';

const profile: PlanningProfile = { timezone: 'UTC', country: 'SK', depot: { latitude: 48, longitude: 17 }, endLocation: { latitude: 48, longitude: 17 }, workdayStart: '06:00', workdayEnd: '18:00', breakMinutes: 0, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { NAVIGATION_INSTALLATION: 20, INSTALLATION: 10 }, fallbackSpeedKph: 40, fallbackDistanceFactor: 1.3, maximumJobsPerRoute: 30, vehicleRequired: false, requireHumanApproval: true, enabled: true };
function source(id = 'order', count = 5) {
  const base: PlanningJob = { id, organizationId: 'a', title: id, workType: 'INSTALLATION', priority: 'NORMAL', status: 'PLANNED', scheduledAt: '2030-01-01T06:00:00Z', location: null, serviceMinutes: null, constraints: {}, updatedAt: '2030-01-01T00:00:00Z' };
  const points = Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}`, organizationId: 'a', navigationOrderId: `nav-${id}`, label: `Point ${i}`, address: 'Fixture address', latitude: 48 + i / 1000, longitude: 17, sortOrder: i, isSelectedByClient: true, status: 'PLANNED', installerUserId: null, issueReported: false, updatedAt: new Date('2030-01-01T00:00:00Z') } as NavigationPoint));
  return { base, nav: { id: `nav-${id}`, status: 'PRIPRAVENO_K_INSTALACI', points } };
}
function input(jobs: PlanningJob[]): PlanningInput {
  return { organizationId: 'a', date: '2030-01-01', now: '2030-01-01T00:00:00Z', profile, jobs,
    employees: [{ id: 'worker', organizationId: 'a', name: 'Worker', userId: 'user', isActive: true, roles: ['WORKER'], positions: [], available: true }], vehicles: [], crews: [{ id: 'crew', employeeIds: ['worker'], vehicleId: null }] };
}
const plan = (jobs: PlanningJob[]) => planFieldWork(input(jobs), async (a, b) => estimatedLeg(a, b, profile));
test('A: one NavigationOrder with five locations yields five independently identified stops', async () => {
  const { base, nav } = source(); const r = await plan(navigationPointJobs(base, nav, []));
  assert.equal(r.crews[0].stops.length, 5); assert.equal(r.unassigned.length, 0);
  assert.equal(new Set(r.crews[0].stops.map(s => s.jobId)).size, 5);
  assert.ok(r.crews[0].stops.every(s => s.workOrderId === base.id && s.navigationOrderId === nav.id && s.sourceType === 'NAVIGATION_POINT'));
});
test('B: five plus three points from different orders share the same engine and route', async () => {
  const a = source('a', 5), b = source('b', 3);
  const r = await plan([...navigationPointJobs(a.base, a.nav, []), ...navigationPointJobs(b.base, b.nav, [])]);
  assert.equal(r.crews[0].stops.length, 8); assert.equal(r.serviceMinutes, 160);
});
test('C: invalid GPS is unplannable without inventing coordinates', async () => {
  const { base, nav } = source('', 1); nav.points[0].latitude = NaN;
  const r = await plan(navigationPointJobs(base, nav, [])); assert.equal(r.crews.length, 0); assert.match(r.unassigned[0].message, /Chybí GPS/);
});
test('D: cross-tenant NavigationPoint is rejected before optimization', () => {
  const { base, nav } = source(); nav.points[0].organizationId = 'b';
  assert.throws(() => navigationPointJobs(base, nav, []), /Cross-tenant/);
});
test('F: installed and cancelled points are excluded without removing their source records', async () => {
  const { base, nav } = source(); nav.points[0].status = 'INSTALLED'; nav.points[1].status = 'CANCELLED';
  const r = await plan(navigationPointJobs(base, nav, [])); assert.equal(r.crews[0].stops.length, 3); assert.equal(nav.points.length, 5);
});
test('J: existing deterministic estimated travel applies to point routes', async () => {
  const { base, nav } = source(); const a = await plan(navigationPointJobs(base, nav, [])), b = await plan(navigationPointJobs(base, nav, []));
  assert.deepEqual(a, b); assert.equal(a.estimated, true); assert.ok(a.crews[0].stops.every(s => s.travel.estimated));
});
test('point-specific durations override the tenant default and survive profile validation', async () => {
  const { base, nav } = source('', 1); const durations = { [nav.points[0].id]: 37 };
  assert.deepEqual(parseProfile({ ...profile, navigationPointMinutes: durations }).navigationPointMinutes, durations);
  const r = await plan(navigationPointJobs(base, nav, [], durations)); assert.equal(r.serviceMinutes, 37); assert.equal(r.crews[0].stops[0].workOrderId, '');
});
test('Navigation and ordinary WorkOrder stops can share one plan', async () => {
  const { base, nav } = source('', 2); const r = await plan([...navigationPointJobs(base, nav, []), { ...base, id: 'ordinary', location: profile.depot }]);
  assert.equal(r.crews[0].stops.length, 3);
});
test('point issue and approval-required state block installation independently', async () => {
  const { base, nav } = source(); nav.points[0].issueReported = true; nav.points[1].status = 'APPROVAL_REQUIRED';
  const r = await plan(navigationPointJobs(base, nav, [])); assert.equal(r.unassigned.length, 2); assert.equal(r.crews[0].stops.length, 3);
});
test('order installer is required when the point has no more specific installer', () => {
  const { base, nav } = source('', 1);
  const jobs = navigationPointJobs(base, { ...nav, installerUserId: 'user' }, [{ id: 'worker', userId: 'user' }]);
  assert.deepEqual(jobs[0].constraints.requiredEmployeeIds, ['worker']);
  nav.points[0].installerUserId = 'other-user';
  const specific = navigationPointJobs(base, { ...nav, installerUserId: 'user' }, [{ id: 'worker', userId: 'user' }, { id: 'other', userId: 'other-user' }]);
  assert.deepEqual(specific[0].constraints.requiredEmployeeIds, ['other']);
});
