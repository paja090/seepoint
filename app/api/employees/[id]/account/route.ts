import { Prisma, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { canAssignRole, canManageTarget, wouldRemoveLastActiveAdmin } from '@/lib/account-policy';
import { audit } from '@/lib/audit';
import { getCurrentUser, issueUserToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ensureEmailConfigured, sendActivationEmail } from '@/lib/email';

type AccountInput = { action?: 'enableAccess' | 'invite' | 'suspend' | 'restore' | 'role'; role?: Role };

function activationUrl(token: string) {
  return `${process.env.APP_URL ?? 'http://localhost:3000'}/activate/${token}`;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.role)) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const body = await request.json().catch(() => null) as AccountInput | null;
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee || !body?.action) return NextResponse.json({ error: 'Zaměstnanec nebo akce nebyli nalezeni.' }, { status: 404 });

  if (body.action === 'enableAccess' && !employee.user) {
    ensureEmailConfigured();
    if (!employee.email) return NextResponse.json({ error: 'Pro přístup do aplikace musí mít zaměstnanec e-mail.' }, { status: 400 });
    if (!canAssignRole(actor.role, employee.role)) return NextResponse.json({ error: 'Manažer nemůže vytvořit administrátorský účet.' }, { status: 403 });
    const user = await prisma.user.create({ data: { name: `${employee.firstName} ${employee.lastName}`, email: employee.email, role: employee.role, employee: { connect: { id: employee.id } } } });
    const token = await issueUserToken(user.id, 'ACTIVATION', 48); const url = activationUrl(token);
    await sendActivationEmail(user.email, url); await audit('ACCOUNT_CREATED', user.id, actor.id);
    return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== 'production' ? { activationUrl: url } : {}) });
  }

  const target = employee.user;
  if (!target) return NextResponse.json({ error: 'Zaměstnanec nemá uživatelský účet.' }, { status: 404 });
  if (!canManageTarget(actor.role, target.role)) return NextResponse.json({ error: 'Nemáte oprávnění spravovat tento účet.' }, { status: 403 });
  if (actor.id === target.id && body.action === 'role') return NextResponse.json({ error: 'Nemůžete změnit vlastní roli.' }, { status: 400 });
  if (body.action === 'role' && (!body.role || !canAssignRole(actor.role, body.role))) return NextResponse.json({ error: 'Tuto roli nemůžete přiřadit.' }, { status: 403 });

  if (body.action === 'invite') {
    if (target.status !== 'INVITED') return NextResponse.json({ error: 'Novou pozvánku lze poslat pouze účtu ve stavu INVITED.' }, { status: 400 });
    ensureEmailConfigured();
    const token = await issueUserToken(target.id, 'ACTIVATION', 48); const url = activationUrl(token);
    await sendActivationEmail(target.email, url); await audit('INVITATION_RESENT', target.id, actor.id);
    return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== 'production' ? { activationUrl: url } : {}) });
  }

  if (body.action === 'suspend' || body.action === 'role') {
    try {
      await prisma.$transaction(async (transaction) => {
        const activeAdminCount = await transaction.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', OR: [{ employee: null }, { employee: { is: { isActive: true } } }] } });
        if (wouldRemoveLastActiveAdmin({ targetRole: target.role, nextRole: body.role, suspending: body.action === 'suspend', activeAdminCount })) throw new Error('LAST_ADMIN');
        if (body.action === 'suspend') { await transaction.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED', sessionVersion: { increment: 1 }, sessions: { deleteMany: {} } } }); await transaction.userToken.updateMany({ where: { userId: target.id, usedAt: null }, data: { usedAt: new Date() } }); }
        else await Promise.all([transaction.user.update({ where: { id: target.id }, data: { role: body.role! } }), transaction.employee.update({ where: { id }, data: { role: body.role! } })]);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Error && error.message === 'LAST_ADMIN') return NextResponse.json({ error: 'Posledního aktivního administrátora nelze deaktivovat ani zbavit role.' }, { status: 409 });
      throw error;
    }
    await audit(body.action === 'suspend' ? 'ACCOUNT_SUSPENDED' : 'ROLE_CHANGED', target.id, actor.id, body.action === 'role' ? { from: target.role, to: body.role! } : undefined);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'restore') {
    await prisma.user.update({ where: { id: target.id }, data: { status: target.passwordHash ? 'ACTIVE' : 'INVITED' } });
    await audit('ACCOUNT_RESTORED', target.id, actor.id); return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Neplatná akce.' }, { status: 400 });
}
