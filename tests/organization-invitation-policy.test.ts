import assert from 'node:assert/strict';
import test from 'node:test';
import { canAssignOrganizationRole, invitationLifecycleStatus, partitionPendingInvitationOrganizations } from '../lib/organization-invitation-policy.ts';

const future = new Date('2030-01-02T00:00:00Z');
const past = new Date('2029-12-31T00:00:00Z');
const now = new Date('2030-01-01T00:00:00Z');

test('invitation lifecycle distinguishes pending, expired, accepted and revoked', () => {
  assert.equal(invitationLifecycleStatus({ acceptedAt: null, revokedAt: null, expiresAt: future }, now), 'PENDING');
  assert.equal(invitationLifecycleStatus({ acceptedAt: null, revokedAt: null, expiresAt: past }, now), 'EXPIRED');
  assert.equal(invitationLifecycleStatus({ acceptedAt: now, revokedAt: null, expiresAt: future }, now), 'ACCEPTED');
  assert.equal(invitationLifecycleStatus({ acceptedAt: now, revokedAt: now, expiresAt: future }, now), 'REVOKED');
});

test('only an organization owner can assign the owner role', () => {
  assert.equal(canAssignOrganizationRole('OWNER', 'OWNER'), true);
  assert.equal(canAssignOrganizationRole('ADMIN', 'OWNER'), false);
  assert.equal(canAssignOrganizationRole('ADMIN', 'SALES'), true);
});

test('activation enables only organizations with a non-expired invitation', () => {
  const partition = partitionPendingInvitationOrganizations([
    { id: 'valid-a', organizationId: 'org-a', expiresAt: future },
    { id: 'expired-a', organizationId: 'org-a', expiresAt: past },
    { id: 'expired-b', organizationId: 'org-b', expiresAt: past },
  ], now);
  assert.deepEqual(partition.validInvitationIds, ['valid-a']);
  assert.deepEqual(partition.validOrganizationIds, ['org-a']);
  assert.deepEqual(partition.expiredInvitationIds, ['expired-a', 'expired-b']);
  assert.deepEqual(partition.expiredOnlyOrganizationIds, ['org-b']);
});
