import 'server-only';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { prisma } from './db';
import { hashToken, newToken } from './auth-crypto';
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
  await prisma.userSession.create({ data: { tokenHash: hashToken(token), userId, sessionVersion, expiresAt } });
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
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { employee: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.sessionVersion !== session.user.sessionVersion || session.user.status !== 'ACTIVE' || session.user.employee?.isActive === false) return null;

  const user = session.user;
  const activeRoleCookie = jar.get(ACTIVE_ROLE_COOKIE)?.value;

  // Combine primary role, user roles array, and employee roles array
  const rawRoles = [
    user.role,
    ...(user.roles || []),
    ...(user.employee?.role ? [user.employee.role] : []),
    ...(user.employee?.roles || []),
  ];
  const allowedRoles = Array.from(new Set(rawRoles)) as Role[];

  let activeRole: Role = user.role;
  if (activeRoleCookie && allowedRoles.includes(activeRoleCookie as Role)) {
    activeRole = activeRoleCookie as Role;
  }

  return {
    ...user,
    role: activeRole,
    primaryRole: user.role,
    allowedRoles,
  };
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
