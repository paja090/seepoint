import { NextResponse } from 'next/server';
import { issueUserToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user?.status === 'ACTIVE') { try { const token = await issueUserToken(user.id, 'PASSWORD_RESET', 1); await sendPasswordResetEmail(user.email, `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password/${token}`); } catch { console.error('Password reset email delivery failed.'); } }
  return NextResponse.json({ message: 'Pokud účet existuje, poslali jsme pokyny k obnově hesla.' });
}
