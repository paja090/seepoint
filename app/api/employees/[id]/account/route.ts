import { OrganizationRole, Prisma, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { canAssignRole, canManageTarget, wouldRemoveLastActiveAdmin } from '@/lib/account-policy';
import { audit } from '@/lib/audit';
import { getCurrentUser, hashPassword, issueUserToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ensureEmailConfigured, sendActivationEmail } from '@/lib/email';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { normalizeAuthEmail, temporaryPasswordError } from '@/lib/auth-onboarding';
import { getAppUrl } from '@/lib/app-url';

type AccountInput = { action?: 'enableAccess' | 'invite' | 'setTemporaryPassword' | 'suspend' | 'restore' | 'role'; role?: Role; roles?: Role[]; temporaryPassword?: string; temporaryPasswordConfirmation?: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.role)) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  const body = await request.json().catch(() => null) as AccountInput | null;
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee || !body?.action) return NextResponse.json({ error: 'Zaměstnanec nebo akce nebyli nalezeni.' }, { status: 404 });

  if (body.action === 'enableAccess' && !employee.user) {
    if (!employee.email) return NextResponse.json({ error: 'Pro přístup do aplikace musí mít zaměstnanec e-mail.' }, { status: 400 });
    if (!canAssignRole(actor.role, employee.role)) return NextResponse.json({ error: 'Manažer nemůže vytvořit administrátorský účet.' }, { status: 403 });
    const normalizedEmail = normalizeAuthEmail(employee.email);
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { employees: { where: { organizationId: actor.organizationId! }, take: 1 } },
    });
    if (existing) {
      if (existing.employees[0]) return NextResponse.json({ error: 'Tento e-mail je už propojený s jiným zaměstnancem.' }, { status: 409 });
      if (actor.role !== 'ADMIN' && existing.role === 'ADMIN') return NextResponse.json({ error: 'Administrátorský účet může propojit pouze administrátor.' }, { status: 403 });
      await prisma.$transaction([
        prisma.employee.update({ where: { id: employee.id }, data: { userId: existing.id, email: normalizedEmail, role: employee.role, roles: employee.roles } }),
        prisma.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: actor.organizationId!, userId: existing.id } },
          create: { organizationId: actor.organizationId!, userId: existing.id, role: employee.role as OrganizationRole, roles: employee.roles as OrganizationRole[], isActive: true },
          update: { role: employee.role as OrganizationRole, roles: employee.roles as OrganizationRole[], isActive: true },
        }),
      ]);
      return NextResponse.json({ ok: true, linkedExistingAccount: true });
    }
    const rolesToAssign = body.roles && body.roles.length ? body.roles : (employee.roles.length ? employee.roles : [employee.role]);
    const primaryRole = body.role || employee.role;
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          name: `${employee.firstName} ${employee.lastName}`,
          email: normalizedEmail,
          role: primaryRole,
          roles: rolesToAssign,
          employees: { connect: { id: employee.id } },
          organizationMemberships: {
            create: { organizationId: actor.organizationId!, role: primaryRole as OrganizationRole, roles: rolesToAssign as OrganizationRole[], isActive: true },
          },
        },
      });
      await transaction.employee.update({ where: { id: employee.id }, data: { email: normalizedEmail } });
      return created;
    });
    try {
      const token = await issueUserToken(user.id, 'ACTIVATION', 48); const url = getAppUrl(request, `/activate/${token}`);
      await sendActivationEmail(user.email, url); await audit('ACCOUNT_CREATED', user.id, actor.id);
      return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== 'production' ? { activationUrl: url } : {}) });
    } catch (error) {
      console.error('Employee access was enabled, but invitation failed', error instanceof Error ? error.message : 'unknown error');
      return NextResponse.json({ ok: true, warning: 'Přístup byl povolen, ale pozvánku se nepodařilo odeslat. Použijte akci Odeslat novou pozvánku.' });
    }
  }

  const target = employee.user;
  if (!target) return NextResponse.json({ error: 'Zaměstnanec nemá uživatelský účet.' }, { status: 404 });
  if (actor.id !== target.id && !canManageTarget(actor.role, target.role)) return NextResponse.json({ error: 'Nemáte oprávnění spravovat tento účet.' }, { status: 403 });

  if (body.action === 'invite') {
    const limited = await enforceRateLimit(request, hashRateLimitIdentity(target.id), rateLimitPolicies.resendInvitation);
    if (limited) return limited;
    if (target.status !== 'INVITED') return NextResponse.json({ error: 'Novou pozvánku lze poslat pouze účtu ve stavu INVITED.' }, { status: 400 });
    ensureEmailConfigured();
    const token = await issueUserToken(target.id, 'ACTIVATION', 48); const url = getAppUrl(request, `/activate/${token}`);
    await sendActivationEmail(target.email, url); await audit('INVITATION_RESENT', target.id, actor.id);
    return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== 'production' ? { activationUrl: url } : {}) });
  }

  if (body.action === 'setTemporaryPassword') {
    const validationError = temporaryPasswordError(body.temporaryPassword ?? '', body.temporaryPasswordConfirmation ?? '');
    if (validationError) {
      console.info('[employees/account] Temporary password rejected', {
        targetUserId: target.id,
        reason: validationError,
      });
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const passwordHash = await hashPassword(body.temporaryPassword!);
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: target.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
          sessions: { deleteMany: {} },
        },
      });
      await transaction.employee.update({ where: { id }, data: { isActive: true } });
      await transaction.userToken.updateMany({ where: { userId: target.id, usedAt: null }, data: { usedAt: new Date() } });
      await transaction.userAuditLog.create({
        data: {
          action: 'PASSWORD_CHANGED',
          targetUserId: target.id,
          actorUserId: actor.id,
          metadata: { source: 'ADMIN_TEMPORARY_PASSWORD', mustChangePassword: true },
        },
      });
    });
    console.info('[employees/account] Temporary password issued', { targetUserId: target.id, actorUserId: actor.id });
    return NextResponse.json({ ok: true, message: 'Dočasné heslo bylo nastaveno. Zaměstnanec si ho po prvním přihlášení musí změnit.' });
  }

  if (body.action === 'suspend' || body.action === 'role') {
    const primaryRole = body.role || target.role;
    const rolesArray = body.roles && body.roles.length ? body.roles : Array.from(new Set([primaryRole, ...(target.roles || [])]));
    try {
      await prisma.$transaction(async (transaction) => {
        const activeAdminCount = await transaction.organizationMember.count({
          where: { organizationId: actor.organizationId!, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
        });
        if (wouldRemoveLastActiveAdmin({ targetRole: target.role, nextRole: primaryRole, suspending: body.action === 'suspend', activeAdminCount })) throw new Error('LAST_ADMIN');
        if (body.action === 'suspend') {
          await transaction.organizationMember.update({
            where: { organizationId_userId: { organizationId: actor.organizationId!, userId: target.id } },
            data: { isActive: false },
          });
          await transaction.userSession.deleteMany({ where: { userId: target.id, activeOrganizationId: actor.organizationId! } });
          await transaction.userToken.updateMany({ where: { userId: target.id, usedAt: null }, data: { usedAt: new Date() } });
        } else {
          await Promise.all([
            transaction.organizationMember.update({
              where: { organizationId_userId: { organizationId: actor.organizationId!, userId: target.id } },
              data: { role: primaryRole as OrganizationRole, roles: rolesArray as OrganizationRole[] },
            }),
            transaction.employee.update({ where: { id }, data: { role: primaryRole, roles: rolesArray } }),
          ]);
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Error && error.message === 'LAST_ADMIN') return NextResponse.json({ error: 'Posledního aktivního administrátora nelze deaktivovat ani zbavit role.' }, { status: 409 });
      throw error;
    }
    await audit(body.action === 'suspend' ? 'ACCOUNT_SUSPENDED' : 'ROLE_CHANGED', target.id, actor.id, body.action === 'role' ? { from: target.role, to: primaryRole, roles: rolesArray } : undefined);
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'restore') {
    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId: actor.organizationId!, userId: target.id } },
      data: { isActive: true },
    });
    await audit('ACCOUNT_RESTORED', target.id, actor.id); return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Neplatná akce.' }, { status: 400 });
}
