import type { OrganizationRole } from '@prisma/client';

export type InvitationLifecycleStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

export function invitationLifecycleStatus(
  invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InvitationLifecycleStatus {
  if (invitation.revokedAt) return 'REVOKED';
  if (invitation.acceptedAt) return 'ACCEPTED';
  return invitation.expiresAt <= now ? 'EXPIRED' : 'PENDING';
}

export function canAssignOrganizationRole(actorRole: OrganizationRole, targetRole: OrganizationRole) {
  return targetRole !== 'OWNER' || actorRole === 'OWNER';
}

export function partitionPendingInvitationOrganizations(
  invitations: Array<{ id: string; organizationId: string; expiresAt: Date }>,
  now = new Date(),
) {
  const valid = invitations.filter((invitation) => invitation.expiresAt > now);
  const validOrganizationIds = [...new Set(valid.map((invitation) => invitation.organizationId))];
  const validOrganizations = new Set(validOrganizationIds);
  const expired = invitations.filter((invitation) => invitation.expiresAt <= now);
  return {
    validInvitationIds: valid.map((invitation) => invitation.id),
    expiredInvitationIds: expired.map((invitation) => invitation.id),
    validOrganizationIds,
    expiredOnlyOrganizationIds: [...new Set(expired.map((invitation) => invitation.organizationId).filter((id) => !validOrganizations.has(id)))],
  };
}
