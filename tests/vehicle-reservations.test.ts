import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canAssignReservationToOthers,
  canChangeReservation,
  canTransitionReservation,
  derivedVehicleStatus,
  parseReservationDate,
} from '../lib/vehicle-reservations';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('reservation dates accept strict calendar days only', () => {
  assert.equal(parseReservationDate('2026-08-28')?.toISOString(), '2026-08-28T00:00:00.000Z');
  assert.equal(parseReservationDate('2026-02-30'), null);
  assert.equal(parseReservationDate('28.08.2026'), null);
  assert.equal(parseReservationDate('2026-08-28T10:00:00Z'), null);
});

test('only managers assign other employees while workers manage their own reservation', () => {
  assert.equal(canAssignReservationToOthers('ADMIN'), true);
  assert.equal(canAssignReservationToOthers('MANAGER'), true);
  assert.equal(canAssignReservationToOthers('WORKER'), false);
  assert.equal(canChangeReservation('WORKER', 'employee-a', 'employee-a'), true);
  assert.equal(canChangeReservation('WORKER', 'employee-a', 'employee-b'), false);
  assert.equal(canChangeReservation('MANAGER', null, 'employee-b'), true);
});

test('reservation status transitions are one-way and validated', () => {
  assert.equal(canTransitionReservation('RESERVED', 'ACTIVE'), true);
  assert.equal(canTransitionReservation('RESERVED', 'CANCELLED'), true);
  assert.equal(canTransitionReservation('ACTIVE', 'FINISHED'), true);
  assert.equal(canTransitionReservation('FINISHED', 'ACTIVE'), false);
  assert.equal(canTransitionReservation('CANCELLED', 'RESERVED'), false);
});

test('vehicle status reflects current operations instead of future bookings', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  const future = [{ status: 'RESERVED' as const, dateFrom: new Date('2026-09-10T00:00:00Z'), dateTo: new Date('2026-09-11T00:00:00Z') }];
  const current = [{ status: 'RESERVED' as const, dateFrom: new Date('2026-08-28T00:00:00Z'), dateTo: new Date('2026-08-29T00:00:00Z') }];
  assert.equal(derivedVehicleStatus('AVAILABLE', future, now), 'AVAILABLE');
  assert.equal(derivedVehicleStatus('AVAILABLE', current, now), 'RESERVED');
  assert.equal(derivedVehicleStatus('AVAILABLE', [{ ...future[0], status: 'ACTIVE' }], now), 'IN_USE');
  assert.equal(derivedVehicleStatus('SERVICE', current, now), 'SERVICE');
  assert.equal(derivedVehicleStatus('IN_USE', future, now), 'IN_USE');
  assert.equal(derivedVehicleStatus('IN_USE', [], now, true), 'AVAILABLE');
});

test('reservation API enforces module access, serializable conflict checks and scoped actors', () => {
  const api = read('app/api/vehicle-reservations/route.ts');
  assert.match(api, /requireApiAccess\('vehicles'\)/);
  assert.match(api, /TransactionIsolationLevel\.Serializable/);
  assert.match(api, /RESERVATION_CONFLICT/);
  assert.match(api, /code === 'P2034'/);
  assert.match(api, /canAssignReservationToOthers/);
  assert.match(api, /canChangeReservation/);
  assert.doesNotMatch(api, /prisma\.employee\.findFirst\(\)/);
});

test('reservation UI limits employee choices and reports failed status updates', () => {
  const page = read('app/vehicle-reservations/page.tsx');
  const actions = read('components/ReservationStatusActions.tsx');
  assert.match(page, /canAssignReservationToOthers\(user\.role\)/);
  assert.match(actions, /if \(!response\.ok\) throw new Error/);
  assert.match(actions, /role="alert"/);
  assert.match(actions, /updateStatus\('ACTIVE'\)/);
});

test('vehicle overview warns about all operational document deadlines', () => {
  const list = read('app/vehicles/page.tsx');
  const detail = read('app/vehicles/[id]/page.tsx');
  assert.match(list, /vehicle\.technicalInspectionUntil/);
  assert.match(list, /vehicle\.insuranceUntil/);
  assert.match(list, /vehicle\.highwayPassUntil/);
  assert.match(list, /Provozní doklady a platnosti k řešení/);
  assert.match(detail, /isPastDeadline\(vehicle\.insuranceUntil, today\)/);
});
