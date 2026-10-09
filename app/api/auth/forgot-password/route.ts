import { NextResponse } from 'next/server';
import { issueUserToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendActivationEmail, sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordResponse } from '@/lib/auth-responses';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { normalizeAuthEmail } from '@/lib/auth-onboarding';
import { getAppUrl } from '@/lib/app-url';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email ? normalizeAuthEmail(body.email) : undefined;
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(email ?? 'missing-email'), rateLimitPolicies.forgotPassword);
  if (limited) return limited;

  const user = email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }) : null;
  if (user && (user.status === 'ACTIVE' || user.status === 'INVITED')) {
    try {
      const isInvited = user.status === 'INVITED';
      const tokenType = isInvited ? 'ACTIVATION' : 'PASSWORD_RESET';
      const token = await issueUserToken(user.id, tokenType, 24);
      const path = isInvited ? `/activate/${token}` : `/reset-password/${token}`;
      const url = getAppUrl(request, path);
      if (isInvited) {
        await sendActivationEmail(user.email, url);
      } else {
        await sendPasswordResetEmail(user.email, url);
      }
    } catch (error) {
      console.error('[auth/forgot-password] Email delivery failed', error instanceof Error ? error.message : String(error));
    }
  }

  return NextResponse.json(forgotPasswordResponse());
}
