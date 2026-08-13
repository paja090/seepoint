import { NextResponse } from 'next/server';
import { createSession, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { normalizeAuthEmail } from '@/lib/auth-onboarding';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email ? normalizeAuthEmail(body.email) : undefined;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(email ?? 'missing-email'), rateLimitPolicies.login);
  if (limited) return limited;
  if (!email || !body?.password) return NextResponse.json({ error: 'Vyplňte e-mail a heslo.' }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, include: { employee: true } });
  const valid = user?.passwordHash ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !valid || user.status !== 'ACTIVE' || user.employee?.isActive === false) {
    console.warn('[auth/login] Login rejected', {
      reason: !user ? 'USER_NOT_FOUND' : !valid ? 'INVALID_PASSWORD' : user.status !== 'ACTIVE' ? 'USER_INACTIVE' : 'EMPLOYEE_INACTIVE',
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
}
