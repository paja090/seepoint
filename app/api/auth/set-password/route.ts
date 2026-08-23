import { NextResponse } from 'next/server';
import { createSession, hashPassword, hashToken, validatePassword } from '@/lib/auth';
import { platformPrisma, prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { isTokenUsable } from '@/lib/token-policy';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { activatedLoginPath, passwordsMatch } from '@/lib/auth-onboarding';
import { partitionPendingInvitationOrganizations } from '@/lib/organization-invitation-policy';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; password?: string; passwordConfirmation?: string; purpose?: 'activation' | 'reset' } | null;
  const policy = body?.purpose === 'activation' ? rateLimitPolicies.activate : rateLimitPolicies.resetPassword;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(body?.token ?? 'missing-token'), policy);
  if (limited) return limited;

  if (!body?.token || !body.password || !validatePassword(body.password)) {
    return NextResponse.json(
      { error: 'Heslo musí mít alespoň 12 znaků a obsahovat písmeno i číslo.' },
      { status: 400 }
    );
  }
  if (!body.passwordConfirmation || !passwordsMatch(body.password, body.passwordConfirmation)) {
    return NextResponse.json({ error: 'Zadaná hesla se neshodují.' }, { status: 400 });
  }

  const record = await platformPrisma.userToken.findUnique({
    where: { tokenHash: hashToken(body.token) },
    include: {
      user: {
        include: {
          employees: true,
          organizationMemberships: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!record || !isTokenUsable(record)) {
    return NextResponse.json({ error: 'Odkaz je neplatný nebo vypršel.' }, { status: 400 });
  }
  const expectedType = body.purpose === 'activation' ? 'ACTIVATION' : 'PASSWORD_RESET';
  if (record.type !== expectedType) {
    return NextResponse.json({ error: 'Odkaz je neplatný nebo vypršel.' }, { status: 400 });
  }

  const activationInvitation = record.type === 'ACTIVATION'
    ? await platformPrisma.organizationInvitation.findUnique({
        where: { tokenHash: record.tokenHash },
        select: { organizationId: true, role: true, acceptedAt: true, revokedAt: true, expiresAt: true },
      })
    : null;
  if (record.type === 'ACTIVATION' && (!activationInvitation || activationInvitation.acceptedAt || activationInvitation.revokedAt || activationInvitation.expiresAt <= new Date())) {
    return NextResponse.json({ error: 'Odkaz je neplatný nebo vypršel.' }, { status: 400 });
  }
  const membership = activationInvitation
    ? record.user.organizationMemberships.find((item) => item.organizationId === activationInvitation.organizationId)
    : record.user.organizationMemberships.find((item) => item.isActive);
  if (!membership) return NextResponse.json({ error: 'Pozvánka není přiřazena k aktivní organizaci.' }, { status: 400 });
  enterTenantContext({ organizationId: membership.organizationId, userId: record.userId, source: 'session' });

  if (record.user.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'Váš účet je pozastaven. Kontaktujte administrátora.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.password);
  const nextSessionVersion = record.user.sessionVersion + 1;

  const claimed = await prisma.$transaction(async (transaction) => {
    const claim = await transaction.userToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claim.count !== 1) return false;

    await transaction.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        status: 'ACTIVE',
        sessionVersion: nextSessionVersion,
        mustChangePassword: false,
        lastLoginAt: new Date(),
      },
    });

    await transaction.employee.updateMany({
      where: { userId: record.userId },
      data: { isActive: true },
    });

    if (record.type === 'ACTIVATION' && activationInvitation) {
      await transaction.organizationMember.update({
        where: { organizationId_userId: { organizationId: activationInvitation.organizationId, userId: record.userId } },
        data: { isActive: true },
      });
      if (activationInvitation.role === 'OWNER') {
        await transaction.organizationOnboarding.updateMany({
          where: { organizationId: activationInvitation.organizationId },
          data: { ownerCompletedAt: new Date(), currentStep: 'SETTINGS' },
        });
      }
    }

    if (record.type === 'ACTIVATION') {
      await transaction.userToken.updateMany({
        where: { userId: record.userId, type: 'ACTIVATION', usedAt: null },
        data: { usedAt: new Date() },
      });
      await transaction.organizationInvitation.updateMany({
        where: { tokenHash: record.tokenHash, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
    }

    await transaction.userSession.deleteMany({ where: { userId: record.userId } });
    await transaction.userAuditLog.create({
      data: {
        action: record.type === 'ACTIVATION' ? 'ACCOUNT_ACTIVATED' : 'PASSWORD_CHANGED',
        targetUserId: record.userId,
        actorUserId: record.userId,
      },
    });
    return true;
  });

  if (!claimed) {
    return NextResponse.json({ error: 'Odkaz je neplatný nebo již byl použit.' }, { status: 400 });
  }

  if (record.type === 'ACTIVATION') {
    try {
      const lifecycleNow = new Date();
      const pendingInvitations = await platformPrisma.organizationInvitation.findMany({
        where: { email: record.user.email, acceptedAt: null, revokedAt: null },
        select: { id: true, organizationId: true, expiresAt: true },
      });
      const partition = partitionPendingInvitationOrganizations(pendingInvitations, lifecycleNow);
      await platformPrisma.$transaction(async (tx) => {
        if (partition.validInvitationIds.length) {
          await tx.organizationInvitation.updateMany({ where: { id: { in: partition.validInvitationIds } }, data: { acceptedAt: lifecycleNow } });
          await tx.organizationMember.updateMany({ where: { userId: record.userId, organizationId: { in: partition.validOrganizationIds } }, data: { isActive: true } });
        }
        if (partition.expiredInvitationIds.length) {
          await tx.organizationInvitation.updateMany({ where: { id: { in: partition.expiredInvitationIds } }, data: { revokedAt: lifecycleNow } });
          await tx.organizationMember.updateMany({ where: { userId: record.userId, organizationId: { in: partition.expiredOnlyOrganizationIds } }, data: { isActive: false } });
        }
      });
    } catch (error) {
      console.error('[auth/set-password] Invitation acceptance sync failed after account activation', {
        userId: record.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // The password is already safely committed. A cookie/session failure must not
  // leave the user with a consumed token and no usable next step.
  let sessionCreated = true;
  try {
    await createSession(record.userId, nextSessionVersion);
  } catch (error) {
    sessionCreated = false;
    console.error('[auth/set-password] Session creation failed after password save', {
      userId: record.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({
    ok: true,
    sessionCreated,
    redirectTo: sessionCreated
      ? (record.type === 'ACTIVATION' && activationInvitation?.role === 'OWNER' ? '/onboarding' : '/dashboard')
      : activatedLoginPath(record.user.email),
  });
}
