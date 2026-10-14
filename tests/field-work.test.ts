import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskSpec, taskSteps, operations } from '../lib/election-removal/task-spec';
import { planFieldWork } from '../lib/field-planning/planning-engine';
import { buildGoogleMapsRouteSegments } from '../lib/election-removal/point-metadata';
import { detectOperationTypeFromText, setPointOperationTypeInDescription } from '../lib/election-removal/kml-parser';
const location = { latitude: 50, longitude: 14 };
const task = { label: 'Lavička', mediaType: 'BENCH', quantity: 2, ...location, gpsConfirmed: true,
  operationType: 'REPLACE_AD', materialDisposition: 'LEAVE', description: 'Sundat starý polep, nalepit Podzim 2026. Konstrukci ponechat.' };
import { input, job, travel } from './helpers/field-work';

test('all structured operations roundtrip; standalone installation needs no carrier; OTHER requires exact instruction', () => {
  for (const operationType of Object.keys(operations)) {
    const transport = operationType === 'RELOCATION' ? { materialDisposition: 'TRANSFER', destinationLatitude: 49, destinationLongitude: 15, destinationGpsConfirmed: true, destinationName: 'B', loadSlots: 2 } : {};
    const parsed = parseTaskSpec({ ...task, operationType, ...transport });
    assert.equal(parseTaskSpec({ ...JSON.parse(JSON.stringify(parsed)), gpsConfirmed: true, destinationGpsConfirmed: true }).operationType, operationType);
    assert.equal(parsed.carrierId, null);
  }
  assert.throws(() => parseTaskSpec({ ...task, operationType: 'OTHER', description: '' }), /popis/);
  assert.equal(detectOperationTypeFromText(setPointOperationTypeInDescription('převoz', 'OTHER')), 'OTHER');
});
test('ad replacement keeps the structure; transport requires confirmed destination and explicit capacity', () => {
  const steps = taskSteps(parseTaskSpec(task)); assert.equal(steps.length, 1); assert.equal(steps[0].loadDelta, 0); assert.equal(steps[0].photoType, 'AFTER_INSTALLATION');
  assert.throws(() => parseTaskSpec({ ...task, operationType: 'RELOCATION', materialDisposition: 'TRANSFER' }), /GPS/);
});
test('an indivisible 60-slot job cannot enter a 30-slot vehicle', async () => {
  const result = await planFieldWork(input([job({ loadSlots: 60 })]), travel);
  assert.equal(result.crews.length, 0); assert.match(result.unassigned[0].message, /60.*30/);
});
test('transfer is an atomic pickup-delivery pair with road travel, service and running capacity', async () => {
  const result = await planFieldWork(input([job({ loadSlots: 20, operationType: 'RELOCATION', fieldWorkStepId: 'pickup',
    delivery: { id: 'delivery', title: 'Doručení', location: { latitude: 49, longitude: 15 }, serviceMinutes: 15 } })]), travel);
  const stops = result.crews[0].stops; assert.equal(stops.length, 2);
  assert.equal(stops[0].fieldWorkStepId, 'pickup'); assert.equal(stops[1].fieldWorkStepId, 'delivery');
  assert.equal(stops[0].cumulativeLoadSlots, 20); assert.equal(stops[1].cumulativeLoadSlots, 0);
  assert.equal(Date.parse(stops[1].startAt) - Date.parse(stops[0].endAt), 600000);
  assert.equal(result.serviceMinutes, 25);
});
test('same GPS keeps distinct jobs; mixed/separate media obey the selected mode', async () => {
  const i = input([job({ id: 'a', mediaType: 'ACKO' }), job({ id: 'b', mediaType: 'TOWER' })]);
  i.profile.routeMode = 'MIXED'; assert.equal((await planFieldWork(i, travel)).crews[0].stops.length, 2);
  i.profile.routeMode = 'SEPARATE_MEDIA'; assert.equal((await planFieldWork(i, travel)).unassigned.length, 1);
});
test('feasibility includes last unload at depot, break and return', async () => {
  const i = input([job({ loadSlots: 1 })]); i.profile.workdayEnd = '08:00';
  // 10 travel + 10 work + 10 depot + 15 unload + 30 break + 10 return > 60.
  assert.equal((await planFieldWork(i, travel)).crews.length, 0);
  i.profile.workdayEnd = '09:00'; const c = (await planFieldWork(i, travel)).crews[0];
  assert.equal(c.stops.at(-1)?.isWarehousePitstop, true);
  assert.equal(Date.parse(c.endAt) - Date.parse(c.stops.at(-1)!.endAt), 40 * 60000);
});
test('navigation splits twelve points without dropping any and accepts equator coordinates', () => {
  const points = Array.from({ length: 12 }, (_, n) => ({ latitude: n, longitude: n + 1 }));
  const segments = buildGoogleMapsRouteSegments(points); assert.equal(segments.length, 3);
  const represented = new Set(segments.flatMap(s => { const p = new URL(s.url).searchParams; return [p.get('origin'), ...(p.get('waypoints')?.split('|') ?? []), p.get('destination')]; }));
  for (const p of points) assert.ok(represented.has(`${p.latitude},${p.longitude}`));
});




test('field planning input rejects invalid dates, depot coordinates and unload time before saving settings', async () => {
  const { validateFieldPlanInput } = await import('../lib/election-removal/plan-input');
  const base = {date:'2026-10-20',crews:[{id:'crew',employeeIds:['employee'],vehicleId:null}]};
  assert.doesNotThrow(()=>validateFieldPlanInput(base));
  assert.throws(()=>validateFieldPlanInput({...base,date:'2026-02-30'}));
  assert.throws(()=>validateFieldPlanInput({...base,depot:{latitude:200,longitude:14}}));
  assert.throws(()=>validateFieldPlanInput({...base,warehouseUnloadMinutes:-5}));
});

test('transport adapter snapshot survives database JSON serialization', async () => {
  const { convertElectionPointToJob } = await import('../lib/election-removal/planning');
  const { hash } = await import('../lib/field-planning/service');
  const spec = parseTaskSpec({ ...task, operationType: 'RELOCATION', materialDisposition: 'TRANSFER', destinationLatitude: 49, destinationLongitude: 15, destinationGpsConfirmed: true, destinationName: 'B', loadSlots: 2 });
  const now = new Date('2026-10-20T05:00:00Z');
  const point = { ...spec, id: 'point', organizationId: 'org', status: 'PENDING', reviewRequired: false, updatedAt: now,
    steps: taskSteps(spec).map((s, i) => ({ ...s, id: 'step-' + i, status: 'PENDING', updatedAt: now, createdAt: now })) } as unknown as Parameters<typeof convertElectionPointToJob>[0];
  const adapted = convertElectionPointToJob(point, { id: 'campaign', name: 'Transfer', targetDate: now, createdAt: now });
  assert.deepEqual(adapted.delivery?.location, { latitude: 49, longitude: 15 });
  assert.equal(hash(adapted), hash(JSON.parse(JSON.stringify(adapted))));
});
