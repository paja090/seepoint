import { NextResponse } from 'next/server';
import { createSession, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email || !body?.password) return NextResponse.json({ error: 'Vyplňte e-mail a heslo.' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email }, include: { employee: true } });
  const valid = user?.passwordHash ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !valid || user.status !== 'ACTIVE' || user.employee?.isActive === false) return NextResponse.json({ error: 'Neplatné přihlašovací údaje nebo neaktivní účet.' }, { status: 401 });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, user.sessionVersion);
  return NextResponse.json({ ok: true, redirectTo: '/dashboard' });
}
