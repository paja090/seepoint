import type { OrganizationRole, Role } from '@prisma/client';

const organizationAdminRoles: OrganizationRole[] = ['OWNER', 'ADMIN'];

export function effectiveOrganizationRole(role: OrganizationRole, roles: OrganizationRole[] = []) {
  const allRoles = [role, ...roles];
  if (allRoles.includes('OWNER')) return 'OWNER' as const;
  if (allRoles.includes('ADMIN')) return 'ADMIN' as const;
  return role;
}

export function canManageTarget(actorRole: Role, targetRole: Role) {
  return actorRole === 'ADMIN' || (actorRole === 'MANAGER' && targetRole !== 'ADMIN');
}

export function canAssignRole(actorRole: Role, nextRole: Role) {
  return actorRole === 'ADMIN' || (actorRole === 'MANAGER' && nextRole !== 'ADMIN');
}

export function wouldRemoveLastActiveAdmin(options: {
  targetRole: Role;
  nextRole?: Role;
  suspending?: boolean;
  activeAdminCount: number;
}) {
  const removesAdmin = options.suspending || (options.nextRole !== undefined && options.nextRole !== 'ADMIN');
  return options.targetRole === 'ADMIN' && removesAdmin && options.activeAdminCount <= 1;
}

export function canManageOrganizationMember(actorRole: OrganizationRole, targetRole: OrganizationRole) {
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN') return targetRole !== 'OWNER';
  return actorRole === 'MANAGER' && !organizationAdminRoles.includes(targetRole);
}

export function canAssignOrganizationRole(actorRole: OrganizationRole, nextRole: OrganizationRole) {
  if (actorRole === 'OWNER') return true;
  if (actorRole === 'ADMIN') return nextRole !== 'OWNER';
  return actorRole === 'MANAGER' && !organizationAdminRoles.includes(nextRole);
}

export function wouldRemoveLastActiveOrganizationAdmin(options: {
  targetRole: OrganizationRole;
  nextRole?: OrganizationRole;
  suspending?: boolean;
  activeAdminCount: number;
}) {
  const removesAdmin = options.suspending || (options.nextRole !== undefined && !organizationAdminRoles.includes(options.nextRole));
  return organizationAdminRoles.includes(options.targetRole) && removesAdmin && options.activeAdminCount <= 1;
}
