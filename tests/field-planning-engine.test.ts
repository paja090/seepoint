import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatedLeg, planFieldWork } from '../lib/field-planning/planning-engine';
import { googleTravelProvider } from '../lib/field-planning/travel';
import { parseProfile, zonedTime, dayInZone, parseConstraints } from '../lib/field-planning/profile';
import { scopeTenantQuery } from '../lib/tenant-prisma';
import { runWithTenantContext } from '../lib/tenant-context';
import { hasModuleAccess } from '../lib/module-policy';
import { hash } from '../lib/field-planning/service';
import type { PlanningInput, PlanningProfile } from '../lib/field-planning/contracts';

export const profile: PlanningProfile = { timezone: 'Europe/Prague', country: 'SK', depot: { latitude: 48, longitude: 17 }, endLocation: { latitude: 48, longitude: 17 },
  workdayStart: '06:00', workdayEnd: '14:00', breakMinutes: 30, overtimeMinutes: 0, strategy: 'BALANCED', serviceMinutes: { INSTALLATION: 20 },
  fallbackSpeedKph: 40, fallbackDistanceFactor: 1.4, maximumJobsPerRoute: 50, vehicleRequired: false, requireHumanApproval: true, enabled: true };
export function fixture(count = 5, employees = 1): PlanningInput {
  return { organizationId: 'a', date: '2030-06-10', now: '2030-06-09T10:00:00Z', profile: structuredClone(profile),
    jobs: Array.from({ length: count }, (_, i) => ({ id: `w${i}`, organizationId: 'a', title: `Work ${i}`, workType: 'INSTALLATION', priority: 'NORMAL', status: 'PLANNED', scheduledAt: '2030-06-10T04:00:00Z', updatedAt: '2030-06-01T00:00:00Z', location: { latitude: 48 + i / 1000, longitude: 17 }, serviceMinutes: null, constraints: {} })),
    employees: Array.from({ length: employees }, (_, i) => ({ id: `e${i}`, organizationId: 'a', name: `Employee ${i}`, userId: `u${i}`, isActive: true, available: true, positions: ['installation'], roles: ['WORKER'] })),
    vehicles: [{ id: 'v0', organizationId: 'a', name: 'Vehicle', status: 'AVAILABLE', reserved: false }],
    crews: Array.from({ length: employees }, (_, i) => ({ id: `c${i}`, employeeIds: [`e${i}`], vehicleId: null })) };
}
const compute = (input: PlanningInput) => planFieldWork(input, async (a, b) => estimatedLeg(a, b, input.profile));
test('A: one worker and five GPS jobs make a feasible complete route', async () => {
  const r = await compute(fixture()); assert.equal(r.crews.length, 1); assert.equal(r.crews[0].stops.length, 5); assert.equal(r.unassigned.length, 0); assert.equal(r.conflicts.length, 0);
  assert.ok(Date.parse(r.crews[0].endAt) <= zonedTime('2030-06-10', '14:00', profile.timezone));
});
test('B: two workers and ten jobs distribute work to both crews', async () => {
  const r = await compute(fixture(10, 2)); assert.equal(r.crews.length, 2); assert.equal(r.crews.flatMap(c => c.stops).length, 10); assert.ok(r.crews.every(c => c.stops.length >= 4));
});
test('C: absence prevents assigning worker', async () => { const i = fixture(); i.employees[0].available = false; const r = await compute(i); assert.equal(r.crews.length, 0); assert.equal(r.conflicts[0].code, 'WORKER_UNAVAILABLE'); });
for (const status of ['SERVICE', 'OUT_OF_SERVICE', 'IN_USE']) test(`D: ${status} vehicle is not assigned`, async () => { const i = fixture(); i.crews[0].vehicleId = 'v0'; i.vehicles[0].status = status; assert.equal((await compute(i)).crews.length, 0); });
test('E: overlapping vehicle reservation excludes the vehicle', async () => { const i = fixture(); i.crews[0].vehicleId = 'v0'; i.vehicles[0].reserved = true; assert.equal((await compute(i)).crews.length, 0); });
test('F: urgent job wins over a closer normal job', async () => { const i = fixture(); i.jobs[4].priority = 'URGENT'; assert.equal((await compute(i)).crews[0].stops[0].workOrderId, 'w4'); });
test('G: fixed windows wait until opening and finish before hard deadline', async () => {
  const i = fixture(1); i.jobs[0].constraints = { windowStart: '2030-06-10T08:00:00Z', windowEnd: '2030-06-10T08:30:00Z' };
  const r = await compute(i); assert.equal(r.crews[0].stops[0].startAt, '2030-06-10T08:00:00.000Z'); assert.equal(r.crews[0].stops[0].endAt, '2030-06-10T08:20:00.000Z');
});
test('G: impossible window is unassigned, never silently violated', async () => { const i = fixture(1); i.jobs[0].deadlineAt = '2030-06-10T04:10:00Z'; const r = await compute(i); assert.equal(r.crews.length, 0); assert.equal(r.unassigned[0].code, 'DEADLINE_AT_RISK'); });
test('hard earlier deadline wins over urgency with a later fixed window', async () => { const i = fixture(2); i.jobs[0].priority = 'URGENT'; i.jobs[0].constraints.windowStart = '2030-06-10T08:00:00Z'; i.jobs[1].deadlineAt = '2030-06-10T05:00:00Z'; const r = await compute(i); assert.deepEqual(r.crews[0].stops.map(s => s.workOrderId), ['w1', 'w0']); assert.equal(r.unassigned.length, 0); });
test('H: deterministic fallback marks estimates and repeats identically', async () => { const i = fixture(); assert.deepEqual(await compute(i), await compute(i)); assert.equal((await compute(i)).estimated, true); });
test('H: actual Google failure uses explicit fallback, successful Routes drives ETA', async () => {
  const oldFetch = globalThis.fetch; const old = process.env.GOOGLE_MAPS_SERVER_API_KEY; process.env.GOOGLE_MAPS_SERVER_API_KEY = 'test';
  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    const a = profile.depot, b = { latitude: 48.1, longitude: 17 };
    assert.deepEqual(await googleTravelProvider(profile)(a, b), estimatedLeg(a, b, profile));
    globalThis.fetch = async () => new Response(JSON.stringify({ routes: [{ distanceMeters: 3456, duration: '600s', polyline: { encodedPolyline: 'test' } }] }));
    const r = await planFieldWork(fixture(1), googleTravelProvider(profile));
    assert.equal(r.estimated, false); assert.equal(r.crews[0].stops[0].arrivalAt, '2030-06-10T04:10:00.000Z'); assert.equal(r.travelSeconds, 1200);
  } finally { globalThis.fetch = oldFetch; if (old === undefined) delete process.env.GOOGLE_MAPS_SERVER_API_KEY; else process.env.GOOGLE_MAPS_SERVER_API_KEY = old; }
});
test('I: missing GPS does not become guessed coordinates', async () => { const i = fixture(1); i.jobs[0].location = null; const r = await compute(i); assert.equal(r.crews.length, 0); assert.match(r.unassigned[0].message, /GPS/); });
test('K: mixed tenant workers, jobs and vehicles hard reject', async () => { for (const table of ['employees', 'jobs', 'vehicles'] as const) { const i = fixture(); i[table][0].organizationId = 'b'; await assert.rejects(compute(i), /Cross-tenant/); } });
test('M: replanning excludes DONE and CANCELLED without mutating history', async () => { const i = fixture(); i.jobs[0].status = 'DONE'; i.jobs[1].status = 'CANCELLED'; const original = structuredClone(i); const r = await compute(i); assert.equal(r.crews[0].stops.length, 3); assert.deepEqual(i, original); });
test('required people and qualifications are hard constraints', async () => { const i = fixture(1, 2); i.jobs[0].constraints.requiredEmployeeIds = ['e1']; assert.equal((await compute(i)).crews[0].employeeIds[0], 'e1'); i.jobs[0].constraints.requiredPositions = ['electrical']; assert.equal((await compute(i)).crews.length, 0); });
test('required predecessor finishes before dependent task, despite urgent dependent', async () => { const i = fixture(2); i.jobs[0].constraints.predecessorIds = ['w1']; i.jobs[0].priority = 'URGENT'; const r = await compute(i); assert.deepEqual(r.crews[0].stops.map(s => s.workOrderId), ['w1', 'w0']); });
test('cyclic prerequisites stay unassigned', async () => { const i = fixture(2); i.jobs[0].constraints.predecessorIds = ['w1']; i.jobs[1].constraints.predecessorIds = ['w0']; assert.equal((await compute(i)).unassigned.length, 2); });
test('duplicate crew vehicle and worker use cannot make overlapping assignments', async () => { const i = fixture(5, 2); i.crews.forEach(c => c.vehicleId = 'v0'); const r = await compute(i); assert.equal(r.conflicts.length, 1); assert.equal(r.crews.length, 1); });
test('tenant workday differences change departure times', async () => { const a = fixture(1), b = fixture(1); b.profile.workdayStart = '09:00'; b.profile.workdayEnd = '17:00'; assert.notEqual((await compute(a)).crews[0].departureAt, (await compute(b)).crews[0].departureAt); });
test('tenant durations and WorkOrder estimatedHours override are respected', async () => { const a = fixture(1), b = fixture(1); b.profile.serviceMinutes.INSTALLATION = 45; assert.equal((await compute(a)).serviceMinutes, 20); assert.equal((await compute(b)).serviceMinutes, 45); b.jobs[0].serviceMinutes = 70; assert.equal((await compute(b)).serviceMinutes, 70); });
test('unknown service duration is unplannable, not invented', async () => { const i = fixture(1); i.profile.serviceMinutes = {}; assert.equal((await compute(i)).unassigned.length, 1); });
test('return travel and mandatory break count against shift end', async () => { const i = fixture(1); i.profile.workdayEnd = '06:40'; const r = await compute(i); assert.equal(r.crews.length, 0); });
test('timezone conversion supports differing regions and rejects DST ambiguity', () => {
  assert.notEqual(zonedTime('2030-06-10', '08:00', 'America/New_York'), zonedTime('2030-06-10', '08:00', 'Asia/Tokyo'));
  assert.equal(dayInZone(new Date('2030-06-10T23:00:00Z'), 'Asia/Tokyo'), '2030-06-11');
  assert.throws(() => zonedTime('2026-03-29', '02:30', 'Europe/Prague')); assert.throws(() => zonedTime('2026-10-25', '02:30', 'Europe/Prague'));
});
test('profile validates clocks, unknown country and mandatory human approval', () => { assert.equal(parseProfile({ ...profile, country: null }).country, null); assert.equal(parseProfile({ ...profile, country: 'US' }).country, 'US'); assert.throws(() => parseProfile({ ...profile, requireHumanApproval: false })); assert.throws(() => parseProfile({ ...profile, fallbackSpeedKph: 0 })); assert.throws(() => parseConstraints({ windowStart: '2030-06-10T08:00' })); });
test('tenant plan scope applies to reads, updates, deletes and creation', () => runWithTenantContext({ organizationId: 'a', source: 'test' }, () => {
  for (const operation of ['findMany', 'findUnique', 'updateMany', 'deleteMany']) assert.equal((scopeTenantQuery('FieldPlan', operation, { where: { id: 'plan' } }) as { where: { organizationId: string } }).where.organizationId, 'a');
  assert.throws(() => scopeTenantQuery('FieldPlan', 'create', { data: { organizationId: 'b' } }));
}));
test('disabled module cannot be accessed even by manager', () => {
  const user = { role: 'MANAGER', organizationId: 'a', organization: { id: 'a', isActive: true, plan: 'PRO', enabledModules: { workRoute: false } }, membership: { organizationId: 'a', isActive: true } };
  assert.equal(hasModuleAccess(user, 'workRoute', 'work'), false);
});
test('snapshot fingerprint survives JSONB key reordering', () => { assert.equal(hash({ a: 1, b: { x: 2, y: 3 } }), hash({ b: { y: 3, x: 2 }, a: 1 })); });
