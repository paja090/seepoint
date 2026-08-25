import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { hashToken } from './auth-crypto';
import type { TenantContext } from './tenant-context';

const SESSION_COOKIE = 'seepoint_session';

const resolveSessionTenant = cache(async (token: string): Promise<TenantContext | null> => {
  // Dynamic import avoids a module-initialization cycle with the Prisma extension.
  const { platformPrisma } = await import('./db');
  const session = await platformPrisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      activeOrganizationId: true,
      expiresAt: true,
      sessionVersion: true,
      userId: true,
      user: {
        select: {
          sessionVersion: true,
          status: true,
          organizationMemberships: {
            where: { isActive: true, organization: { isActive: true } },
            select: { organizationId: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  if (session.sessionVersion !== session.user.sessionVersion || session.user.status !== 'ACTIVE') return null;

  const membership = session.user.organizationMemberships.find(
    (item) => item.organizationId === session.activeOrganizationId,
  ) ?? session.user.organizationMemberships[0];

  const orgId = membership?.organizationId || session.activeOrganizationId;

  return orgId
    ? { organizationId: orgId, userId: session.userId, source: 'session' }
    : null;
});

export async function resolveRequestTenantContext(): Promise<TenantContext | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return token ? resolveSessionTenant(token) : null;
  } catch {
    return null;
  }
}
