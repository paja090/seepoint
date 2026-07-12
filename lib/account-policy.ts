import type { Role } from '@prisma/client';

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
