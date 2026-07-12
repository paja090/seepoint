import { NextResponse } from 'next/server';
import { issueUserToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordResponse } from '@/lib/auth-responses';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const limited = await enforceRateLimit(request, hashRateLimitIdentity(email ?? 'missing-email'), rateLimitPolicies.forgotPassword);
  if (limited) return limited;
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user?.status === 'ACTIVE') { try { const token = await issueUserToken(user.id, 'PASSWORD_RESET', 1); await sendPasswordResetEmail(user.email, `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password/${token}`); } catch { console.error('Password reset email delivery failed.'); } }
  return NextResponse.json(forgotPasswordResponse());
}
