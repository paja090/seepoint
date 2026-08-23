import 'server-only';
import { getCurrentUser } from './auth';
import type { OrganizationRole } from '@prisma/client';

export async function getCurrentOrganization() {
  const user = await getCurrentUser();
  return user?.organization ?? null;
}

export async function requireOrganization() {
  const user = await getCurrentUser();
  if (!user?.organization || !user.organizationId || !user.membership) {
    throw new Error('Active organization is required.');
  }
  return {
    organization: user.organization,
    organizationId: user.organizationId,
    membership: user.membership,
    user,
  };
}

export async function requireOrganizationMember() {
  return requireOrganization();
}

export async function requireOrganizationRole(...roles: OrganizationRole[]) {
  const context = await requireOrganization();
  const effectiveRoles = new Set([context.membership.role, ...context.membership.roles]);
  if (context.membership.role !== 'OWNER' && !roles.some((role) => effectiveRoles.has(role))) {
    throw new Error('Organization role is not sufficient.');
  }
  return context;
}

export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== 'SUPER_ADMIN') throw new Error('Super admin access is required.');
  return user;
}
