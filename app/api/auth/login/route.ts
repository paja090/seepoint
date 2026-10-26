import { NextResponse } from 'next/server';
import { createSession, verifyPassword } from '@/lib/auth';
import { platformPrisma, prisma } from '@/lib/db';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { normalizeAuthEmail } from '@/lib/auth-onboarding';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = body?.email ? normalizeAuthEmail(body.email) : undefined;
    const limited = await enforceRateLimit(request, hashRateLimitIdentity(email ?? 'missing-email'), rateLimitPolicies.login);
    if (limited) return limited;
    if (!email || !body?.password) return NextResponse.json({ error: 'Vyplňte e-mail a heslo.' }, { status: 400 });

    const user = await platformPrisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { organizationMemberships: { where: { isActive: true, organization: { isActive: true } }, take: 1 } },
    });
    const valid = user?.passwordHash ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid || user.status !== 'ACTIVE' || (user.platformRole !== 'SUPER_ADMIN' && user.organizationMemberships.length === 0)) {
      console.warn('[auth/login] Login rejected', {
        reason: !user ? 'USER_NOT_FOUND' : !valid ? 'INVALID_PASSWORD' : user.status !== 'ACTIVE' ? 'USER_INACTIVE' : 'NO_ACTIVE_MEMBERSHIP',
      });
      return NextResponse.json({ error: 'Neplatné přihlašovací údaje nebo neaktivní účet.' }, { status: 401 });
    }

    try {
      await createSession(user.id, user.sessionVersion);
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    } catch (error) {
      console.error('[auth/login] Session creation failed', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Přihlášení se nepodařilo dokončit. Zkuste to prosím znovu.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, redirectTo: user.mustChangePassword ? '/profile?firstLogin=1' : '/dashboard' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[auth/login] Unexpected failure', message);
    if (message.includes('exceeded the quota')) {
      return NextResponse.json(
        { error: 'Databáze překročila limit bezplatného plánu na Neon.tech (Quota Exceeded). Pro obnovení provozu je nutné navýšit limit v administraci Neonu.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Přihlášení se nezdařilo z důvodu výpadku databáze. Zkuste to prosím za okamžik.' },
      { status: 500 }
    );
  }
}
