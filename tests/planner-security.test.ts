import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageConnection, projectEvent, activeCalendarOwner } from '../lib/planner/permissions';
import { runWithTenantContext } from '../lib/tenant-context';
import { scopeTenantQuery } from '../lib/tenant-prisma';
import { validateCalendarOAuthSession } from '../lib/planner/oauth-state';
import { isModuleEnabled } from '../lib/organization-modules';

const actor = { id: 'a', organizationId: 'org-a', role: 'MANAGER' };
const calendar = { organizationId: 'org-a', ownerId: 'b', visibility: 'FREE_BUSY', kind: 'PERSONAL' };
const event = { id: 'event', organizationId: 'org-a', title: 'Soukromý lékař', location: 'Soukromá adresa', startAt: new Date('2026-09-16T09:00Z'), endAt: new Date('2026-09-16T10:00Z'), busy: true, isPrivate: true, allDay: false };
test('every new Planner model is scoped and rejects a foreign tenant override', () => {
  for (const model of ['CalendarConnection', 'ExternalCalendar', 'ExternalCalendarEvent', 'PlannerPreferences', 'PlannerBlock']) {
    runWithTenantContext({ organizationId: 'org-a', source: 'test' }, () => {
      const query = scopeTenantQuery(model, 'findMany', { where: {} }) as { where: { organizationId: string } };
      assert.equal(query.where.organizationId, 'org-a');
      assert.throws(() => scopeTenantQuery(model, 'findMany', { where: { organizationId: 'org-b' } }));
      assert.throws(() => scopeTenantQuery(model, 'create', { data: { organizationId: 'org-b' } }));
    });
  }
});
test('manager cannot manage another user connection or same user in other tenant', () => {
  assert.equal(canManageConnection(actor, { organizationId: 'org-a', userId: 'b' }), false);
  assert.equal(canManageConnection(actor, { organizationId: 'org-b', userId: 'a' }), false);
  assert.equal(canManageConnection(actor, { organizationId: 'org-a', userId: 'a' }), true);
});
test('FREE_BUSY projection used by UI and AI contains no title, location or provider metadata', () => {
  const result = projectEvent(actor, event, calendar, true)!;
  assert.equal(result.title, 'Obsazeno');
  assert.equal(result.location, undefined);
  assert.doesNotMatch(JSON.stringify(result), /lékař|adresa|ownerId|organizationId/);
});
test('WORK_DETAILS never reveals private/default events; FULL requires explicit selection', () => {
  assert.equal(projectEvent(actor, event, { ...calendar, visibility: 'WORK_DETAILS' }, true)!.title, 'Obsazeno');
  assert.equal(projectEvent(actor, { ...event, isPrivate: false }, { ...calendar, visibility: 'WORK_DETAILS' }, true)!.title, event.title);
  assert.equal(projectEvent(actor, event, { ...calendar, visibility: 'FULL' }, true)!.title, event.title);
});
test('cross-tenant and offboarded events are absent even for manager/AI', () => {
  assert.equal(projectEvent(actor, { ...event, organizationId: 'org-b' }, calendar, true), null);
  assert.equal(projectEvent(actor, event, calendar, false), null);
  assert.equal(activeCalendarOwner(null), false);
  assert.equal(activeCalendarOwner({ isActive: false, user: { status: 'ACTIVE' } }), false);
  assert.equal(activeCalendarOwner({ isActive: true, user: { status: 'SUSPENDED' } }), false);
});
test('OAuth state must match cookie nonce, user, tenant and expiration', () => {
  const state = { organizationId: actor.organizationId, userId: actor.id, nonce: 'nonce', verifier: 'pkce', expiresAt: 2000 };
  assert.doesNotThrow(() => validateCalendarOAuthSession(state, actor, 'nonce', 1000));
  for (const candidate of [{ ...state, userId: 'b' }, { ...state, organizationId: 'org-b' }, { ...state, expiresAt: 500 }, { ...state, expiresAt: NaN }, { ...state, verifier: '' }]) assert.throws(() => validateCalendarOAuthSession(candidate, actor, 'nonce', 1000));
  assert.throws(() => validateCalendarOAuthSession(state, actor, null, 1000));
});
test('Planner is opt-in per tenant, including enterprise', () => {
  assert.equal(isModuleEnabled({ plan: 'ENTERPRISE' }, 'planner'), false);
  assert.equal(isModuleEnabled({ plan: 'START', enabledModules: { planner: true } }, 'planner'), true);
});
