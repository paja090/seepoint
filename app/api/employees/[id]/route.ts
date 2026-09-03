import { OrganizationRole, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { canManageOrganizationMember, effectiveOrganizationRole, wouldRemoveLastActiveOrganizationAdmin } from '@/lib/account-policy';
import { getCurrentUser } from '@/lib/auth';
import { isValidAuthEmail, normalizeAuthEmail } from '@/lib/auth-onboarding';
import { prisma } from '@/lib/db';

function text(input: Record<string, unknown>, key: string) {
  return typeof input[key] === 'string' && (input[key] as string).trim() ? (input[key] as string).trim() : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.role) || !actor.organizationId || !actor.membership) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const { id } = await params;
  const actorMembershipRole = effectiveOrganizationRole(actor.membership.role, actor.membership.roles) as OrganizationRole;
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!employee) return NextResponse.json({ error: 'Zaměstnanec nebyl nalezen.' }, { status: 404 });
  const targetMembership = employee.userId
    ? await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId, userId: employee.userId } } })
    : null;
  const targetMembershipRole = targetMembership ? effectiveOrganizationRole(targetMembership.role, targetMembership.roles) : null;
  if (targetMembershipRole && actor.id !== employee.userId && !canManageOrganizationMember(actorMembershipRole, targetMembershipRole)) {
    return NextResponse.json({ error: 'Nemáte oprávnění upravovat tohoto člena organizace.' }, { status: 403 });
  }

  const firstName = text(input, 'firstName');
  const lastName = text(input, 'lastName');
  const rawEmail = text(input, 'email');
  const email = rawEmail ? normalizeAuthEmail(rawEmail) : null;
  if (!firstName || !lastName) return NextResponse.json({ error: 'Jméno a příjmení jsou povinné.' }, { status: 400 });
  if (rawEmail && !isValidAuthEmail(rawEmail)) return NextResponse.json({ error: 'Zadejte platný e-mail.' }, { status: 400 });
  if (employee.user && !email) return NextResponse.json({ error: 'Účet s přístupem musí mít e-mail.' }, { status: 400 });

  const positions = [...new Set((text(input, 'positions') ?? text(input, 'position') ?? '').split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 12);
  const isActive = input.isActive === true || input.isActive === 'true';
  if (!isActive && targetMembershipRole === 'OWNER' && actor.platformRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Vlastníka organizace nelze deaktivovat z karty zaměstnance.' }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const currentMembership = employee.userId
        ? await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId!, userId: employee.userId } } })
        : null;
      const currentMembershipRole = currentMembership ? effectiveOrganizationRole(currentMembership.role, currentMembership.roles) : null;
      if (!isActive && employee.isActive && currentMembershipRole && ['OWNER', 'ADMIN'].includes(currentMembershipRole)) {
        const activeAdminCount = await tx.organizationMember.count({ where: { organizationId: actor.organizationId!, isActive: true, OR: [{ role: { in: ['OWNER', 'ADMIN'] } }, { roles: { hasSome: ['OWNER', 'ADMIN'] } }] } });
        if (wouldRemoveLastActiveOrganizationAdmin({ targetRole: currentMembershipRole, suspending: true, activeAdminCount })) throw new Error('LAST_ADMIN');
      }

      let membershipCount = 0;
      if (employee.userId) membershipCount = await tx.organizationMember.count({ where: { userId: employee.userId } });
      if (employee.user && membershipCount > 1 && email !== normalizeAuthEmail(employee.user.email)) throw new Error('MULTI_ORG_EMAIL');

      await tx.employee.update({
        where: { id },
        data: { firstName, lastName, email, phone: text(input, 'phone'), position: positions[0] ?? null, positions, isActive, note: text(input, 'note') },
      });
      if (employee.user) {
        if (membershipCount <= 1) {
          await tx.user.update({ where: { id: employee.user.id }, data: { name: `${firstName} ${lastName}`, email: email! } });
        }
        if (!isActive && currentMembership) {
          await tx.organizationMember.update({ where: { organizationId_userId: { organizationId: actor.organizationId!, userId: employee.user.id } }, data: { isActive: false } });
          await tx.userSession.deleteMany({ where: { userId: employee.user.id, activeOrganizationId: actor.organizationId! } });
        } else if (isActive && currentMembership && !currentMembership.isActive) {
          await tx.organizationMember.update({ where: { organizationId_userId: { organizationId: actor.organizationId!, userId: employee.user.id } }, data: { isActive: true } });
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ADMIN') return NextResponse.json({ error: 'Posledního aktivního vlastníka nebo administrátora nelze deaktivovat.' }, { status: 409 });
    if (error instanceof Error && error.message === 'MULTI_ORG_EMAIL') return NextResponse.json({ error: 'Přihlašovací e-mail účtu používaného ve více organizacích může změnit pouze uživatel nebo platformní administrátor.' }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Tento e-mail už používá jiný účet nebo zaměstnanec.' }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.role) || !actor.organizationId || !actor.membership) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
  const { id } = await params;
  const actorMembershipRole = effectiveOrganizationRole(actor.membership.role, actor.membership.roles);

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({ where: { id }, include: { user: true } });
      if (!employee) throw new Error('NOT_FOUND');
      const membership = employee.userId
        ? await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: actor.organizationId!, userId: employee.userId } } })
        : null;
      const membershipRole = membership ? effectiveOrganizationRole(membership.role, membership.roles) : null;
      if (membershipRole && actor.id !== employee.userId && !canManageOrganizationMember(actorMembershipRole, membershipRole)) throw new Error('FORBIDDEN');
      if (membershipRole === 'OWNER' && actor.platformRole !== 'SUPER_ADMIN') throw new Error('OWNER_PROTECTED');
      if (membershipRole && ['OWNER', 'ADMIN'].includes(membershipRole)) {
        const activeAdminCount = await tx.organizationMember.count({ where: { organizationId: actor.organizationId!, isActive: true, OR: [{ role: { in: ['OWNER', 'ADMIN'] } }, { roles: { hasSome: ['OWNER', 'ADMIN'] } }] } });
        if (wouldRemoveLastActiveOrganizationAdmin({ targetRole: membershipRole, suspending: true, activeAdminCount })) throw new Error('LAST_ADMIN');
      }
      if (employee.userId) {
        await tx.organizationMember.deleteMany({ where: { organizationId: actor.organizationId!, userId: employee.userId } });
        await tx.userSession.deleteMany({ where: { userId: employee.userId, activeOrganizationId: actor.organizationId! } });
      }
      await tx.employee.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Zaměstnanec nebyl nalezen.' }, { status: 404 });
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Nemáte oprávnění smazat tohoto člena organizace.' }, { status: 403 });
    if (error instanceof Error && error.message === 'OWNER_PROTECTED') return NextResponse.json({ error: 'Vlastníka organizace nelze smazat z karty zaměstnance.' }, { status: 409 });
    if (error instanceof Error && error.message === 'LAST_ADMIN') return NextResponse.json({ error: 'Posledního aktivního vlastníka nebo administrátora nelze smazat.' }, { status: 409 });
    return NextResponse.json({ error: 'Zaměstnance nelze smazat, protože na něj mohou být navázaná pracovní data. Nejprve ho deaktivujte.' }, { status: 409 });
  }
}
