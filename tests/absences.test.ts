import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canCreateAbsenceFor,
  canDeleteAbsence,
  canManageAbsences,
  canReviewAbsence,
  canViewAbsenceNote,
  parseAbsenceDate,
} from '../lib/absences';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('absence dates accept strict calendar days only', () => {
  assert.equal(parseAbsenceDate('2026-08-28')?.toISOString(), '2026-08-28T00:00:00.000Z');
  assert.equal(parseAbsenceDate('2026-02-30'), null);
  assert.equal(parseAbsenceDate('28.08.2026'), null);
  assert.equal(parseAbsenceDate('2026-08-28T10:00:00Z'), null);
});

test('workers request only their own absence while managers can plan for the team', () => {
  assert.equal(canManageAbsences('ADMIN'), true);
  assert.equal(canManageAbsences('MANAGER'), true);
  assert.equal(canManageAbsences('WORKER'), false);
  assert.equal(canCreateAbsenceFor('WORKER', 'employee-a', 'employee-a'), true);
  assert.equal(canCreateAbsenceFor('WORKER', 'employee-a', 'employee-b'), false);
  assert.equal(canCreateAbsenceFor('MANAGER', null, 'employee-b'), true);
});

test('review, deletion and private notes follow server-side role rules', () => {
  assert.equal(canReviewAbsence('PENDING', 'APPROVED'), true);
  assert.equal(canReviewAbsence('PENDING', 'REJECTED'), true);
  assert.equal(canReviewAbsence('APPROVED', 'REJECTED'), false);
  assert.equal(canDeleteAbsence('WORKER', 'employee-a', { employeeId: 'employee-a', status: 'PENDING' }), true);
  assert.equal(canDeleteAbsence('WORKER', 'employee-a', { employeeId: 'employee-a', status: 'APPROVED' }), false);
  assert.equal(canDeleteAbsence('MANAGER', null, { employeeId: 'employee-a', status: 'APPROVED' }), true);
  assert.equal(canViewAbsenceNote('WORKER', 'employee-a', 'employee-b'), false);
  assert.equal(canViewAbsenceNote('WORKER', 'employee-a', 'employee-a'), true);
});

test('absence API enforces module access, approval workflow and transactional overlap checks', () => {
  const api = read('app/api/absences/route.ts');
  assert.match(api, /requireApiAccess\('team'\)/);
  assert.match(api, /TransactionIsolationLevel\.Serializable/);
  assert.match(api, /ABSENCE_CONFLICT/);
  assert.match(api, /canCreateAbsenceFor/);
  assert.match(api, /canDeleteAbsence/);
  assert.match(api, /canReviewAbsence/);
  assert.match(api, /canViewAbsenceNote/);
  assert.match(api, /canManageAbsences\(user\.role\) \? 'APPROVED' : 'PENDING'/);
});

test('vacation UI counts only approved presence and exposes manager review actions', () => {
  const page = read('app/vacations/page.tsx');
  const client = read('components/vacations/VacationPlannerClient.tsx');
  assert.match(page, /canViewAbsenceNote/);
  assert.match(page, /canManageAbsences/);
  assert.match(client, /if \(a\.status !== 'APPROVED'\) return false/);
  assert.match(client, /handleReviewAbsence\(item\.id, 'APPROVED'\)/);
  assert.match(client, /handleReviewAbsence\(item\.id, 'REJECTED'\)/);
  assert.match(client, /Nevkládejte diagnózu/);
});
