import { NextResponse } from 'next/server';
import { createSession, hashPassword, hashToken, validatePassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isTokenUsable } from '@/lib/token-policy';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { activatedLoginPath, passwordsMatch } from '@/lib/auth-onboarding';

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

  const record = await prisma.userToken.findUnique({
    where: { tokenHash: hashToken(body.token) },
    include: { user: { include: { employee: true } } },
  });

  if (!record || !isTokenUsable(record)) {
    return NextResponse.json({ error: 'Odkaz je neplatný nebo vypršel.' }, { status: 400 });
  }
  const expectedType = body.purpose === 'activation' ? 'ACTIVATION' : 'PASSWORD_RESET';
  if (record.type !== expectedType) {
    return NextResponse.json({ error: 'Odkaz je neplatný nebo vypršel.' }, { status: 400 });
  }

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

    if (record.user.employee) {
      await transaction.employee.update({
        where: { id: record.user.employee.id },
        data: { isActive: true },
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
    redirectTo: sessionCreated ? '/dashboard' : activatedLoginPath(record.user.email),
  });
}
