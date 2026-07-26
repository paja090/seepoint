import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { createSession, getCurrentUser, hashPassword, invalidateUserSessions, validatePassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  const input = await request.json().catch(() => null) as { action?: string; firstName?: string; lastName?: string; phone?: string; currentPassword?: string; newPassword?: string; confirmNewPassword?: string } | null;
  if (!input) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
  if (input.action === 'contact') {
    if (!user.employee) return NextResponse.json({ error: 'Účet nemá zaměstnanecký profil.' }, { status: 400 });
    const firstName = input.firstName?.trim(); const lastName = input.lastName?.trim();
    if (!firstName || !lastName) return NextResponse.json({ error: 'Jméno a příjmení jsou povinné.' }, { status: 400 });
    await prisma.$transaction([prisma.employee.update({ where: { id: user.employee.id }, data: { firstName, lastName, phone: input.phone?.trim() || null } }), prisma.user.update({ where: { id: user.id }, data: { name: `${firstName} ${lastName}` } })]);
    return NextResponse.json({ ok: true });
  }
  if (input.action === 'password') {
    if (!user.passwordHash || !input.currentPassword || !await verifyPassword(input.currentPassword, user.passwordHash)) return NextResponse.json({ error: 'Současné heslo není správné.' }, { status: 400 });
    if (!input.newPassword || !validatePassword(input.newPassword)) return NextResponse.json({ error: 'Nové heslo musí mít alespoň 12 znaků a obsahovat písmeno i číslo.' }, { status: 400 });
    if (input.newPassword !== input.confirmNewPassword) return NextResponse.json({ error: 'Potvrzení nového hesla se neshoduje.' }, { status: 400 });
    if (await verifyPassword(input.newPassword, user.passwordHash)) return NextResponse.json({ error: 'Nové heslo musí být jiné než současné.' }, { status: 400 });
    const passwordHash = await hashPassword(input.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    const sessionVersion = await invalidateUserSessions(user.id);
    await createSession(user.id, sessionVersion);
    await audit('PASSWORD_CHANGED', user.id, user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Neplatná akce.' }, { status: 400 });
}
