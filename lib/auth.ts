import 'server-only';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { platformPrisma, prisma } from './db';
import { hashToken, newToken } from './auth-crypto';
import { enterTenantContext } from './tenant-context';
export { hashPassword, hashToken, newToken, validatePassword, verifyPassword } from './auth-crypto';

export const SESSION_COOKIE = 'seepoint_session';
export const ACTIVE_ROLE_COOKIE = 'seepoint_active_role';
const SESSION_DAYS = 14;

export async function createSession(userId: string, sessionVersion: number) {
  const jar = await cookies();
  const previousToken = jar.get(SESSION_COOKIE)?.value;
  if (previousToken) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(previousToken) } });
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const membership = await platformPrisma.organizationMember.findFirst({
    where: { userId, isActive: true, organization: { isActive: true } },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true },
  });
  await prisma.userSession.create({ data: { tokenHash: hashToken(token), userId, activeOrganizationId: membership?.organizationId, sessionVersion, expiresAt } });
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(ACTIVE_ROLE_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await platformPrisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          employees: true,
          organizationMemberships: {
            where: { isActive: true, organization: { isActive: true } },
            include: { organization: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  }).catch(() => null);
  if (!session || session.expiresAt <= new Date() || session.sessionVersion !== session.user.sessionVersion || session.user.status !== 'ACTIVE') return null;

  const user = session.user;
  const memberships = user.organizationMemberships;
  const membership = memberships.find((item) => item.organizationId === session.activeOrganizationId) ?? memberships[0] ?? null;
  if (!membership && user.platformRole !== 'SUPER_ADMIN') return null;

  if (membership && membership.organizationId !== session.activeOrganizationId) {
    await platformPrisma.userSession.update({
      where: { id: session.id },
      data: { activeOrganizationId: membership.organizationId },
    });
  }

  const employee = membership
    ? user.employees.find((item) => item.organizationId === membership.organizationId) ?? null
    : null;
  if (employee?.isActive === false) return null;

  const activeOrgId = membership?.organizationId || session.activeOrganizationId;
  if (activeOrgId) {
    enterTenantContext({
      organizationId: activeOrgId,
      userId: user.id,
      source: 'session',
    });
  }

  const activeRoleCookie = jar.get(ACTIVE_ROLE_COOKIE)?.value;

  const membershipRole = membership?.role === 'OWNER' ? 'ADMIN' : membership?.role;
  const membershipRoles = (membership?.roles ?? []).map((role) => role === 'OWNER' ? 'ADMIN' : role) as Role[];
  const rawRoles = [
    ...(membershipRole ? [membershipRole as Role] : []),
    ...membershipRoles,
    ...(employee?.role ? [employee.role] : []),
    ...(employee?.roles || []),
  ];
  const allowedRoles = Array.from(new Set(rawRoles.length ? rawRoles : [Role.VIEWER])) as Role[];

  let activeRole: Role = allowedRoles[0];
  if (activeRoleCookie && allowedRoles.includes(activeRoleCookie as Role)) {
    activeRole = activeRoleCookie as Role;
  }

  return {
    ...user,
    employees: undefined,
    organizationMemberships: undefined,
    employee,
    organization: membership?.organization ?? null,
    organizationId: membership?.organizationId ?? null,
    membership,
    memberships: memberships.map(({ organization, ...item }) => ({ ...item, organization })),
    role: activeRole,
    primaryRole: membershipRole ? membershipRole as Role : Role.VIEWER,
    allowedRoles,
  };
}

export async function setActiveOrganization(organizationId: string) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await platformPrisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
  const membership = await platformPrisma.organizationMember.findFirst({
    where: { userId: session.userId, organizationId, isActive: true, organization: { isActive: true } },
    include: { organization: true },
  });
  if (!membership) return null;
  await platformPrisma.userSession.update({
    where: { id: session.id },
    data: { activeOrganizationId: organizationId },
  });
  jar.delete(ACTIVE_ROLE_COOKIE);
  enterTenantContext({ organizationId, userId: session.userId, source: 'session' });
  return membership.organization;
}

export async function invalidateUserSessions(userId: string) {
  const [user] = await prisma.$transaction([prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } }), prisma.userSession.deleteMany({ where: { userId } })]);
  return user.sessionVersion;
}

export async function issueUserToken(userId: string, type: 'ACTIVATION' | 'PASSWORD_RESET', hours: number) {
  const token = newToken();
  await prisma.$transaction([
    prisma.userToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.userToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 3600000) } }),
  ]);
  return token;
}
