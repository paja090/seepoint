import { OrganizationRole, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { hashToken, newToken } from '@/lib/auth';
import { isValidAuthEmail, normalizeAuthEmail } from '@/lib/auth-onboarding';
import { platformPrisma } from '@/lib/db';
import { sendActivationEmail } from '@/lib/email';
import { requireOrganizationRole } from '@/lib/organization';
import { getAppUrl } from '@/lib/app-url';
import { canAssignOrganizationRole } from '@/lib/organization-invitation-policy';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { effectiveOrganizationRole } from '@/lib/account-policy';

function appRole(role: OrganizationRole): Role {
  return role === 'OWNER' ? Role.ADMIN : role as Role;
}

export async function GET() {
  try {
    const context = await requireOrganizationRole('ADMIN');
    const invitations = await platformPrisma.organizationInvitation.findMany({
      where: { organizationId: context.organizationId, acceptedAt: null, revokedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(invitations);
  } catch {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireOrganizationRole('ADMIN');
    const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
    if (!body || typeof body.email !== 'string' || typeof body.role !== 'string') return NextResponse.json({ error: 'E-mail a role jsou povinné.' }, { status: 400 });
    const email = normalizeAuthEmail(body.email);
    if (!isValidAuthEmail(email)) return NextResponse.json({ error: 'E-mail není platný.' }, { status: 400 });
    if (!Object.values(OrganizationRole).includes(body.role as OrganizationRole)) return NextResponse.json({ error: 'Role není platná.' }, { status: 400 });
    const role = body.role as OrganizationRole;
    const actorRole = effectiveOrganizationRole(context.membership.role, context.membership.roles);
    if (!canAssignOrganizationRole(actorRole, role)) return NextResponse.json({ error: 'Vlastníka může pozvat pouze vlastník.' }, { status: 403 });
    const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${context.organizationId}:${email}`), rateLimitPolicies.resendInvitation);
    if (limited) return limited;

    let user = await platformPrisma.user.findUnique({ where: { email } });
    const existingMember = user
      ? await platformPrisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: context.organizationId, userId: user.id } },
        })
      : null;
    const pendingInvitations = user && existingMember && user.status === 'INVITED'
      ? await platformPrisma.organizationInvitation.findMany({
          where: { organizationId: context.organizationId, email, acceptedAt: null, revokedAt: null },
          select: { tokenHash: true },
        })
      : [];
    if (existingMember && user?.status !== 'INVITED') {
      return NextResponse.json({ error: 'Uživatel už je členem organizace.' }, { status: 409 });
    }

    const token = newToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const needsActivation = !user || user.status === 'INVITED';
    const wasExisting = Boolean(user);
    const result = await platformPrisma.$transaction(async (tx) => {
      if (!user) {
        user = await tx.user.create({ data: { name: email.split('@')[0], email, role: appRole(role), roles: [appRole(role)], status: 'INVITED' } });
      }
      const member = existingMember
        ? await tx.organizationMember.update({ where: { id: existingMember.id }, data: { role, roles: [role], isActive: !needsActivation } })
        : await tx.organizationMember.create({ data: { organizationId: context.organizationId, userId: user.id, role, roles: [role], isActive: !needsActivation } });
      if (existingMember && needsActivation) {
        await tx.organizationInvitation.updateMany({
          where: { organizationId: context.organizationId, email, acceptedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      const invitation = await tx.organizationInvitation.create({
        data: { organizationId: context.organizationId, email, role, tokenHash, expiresAt, invitedById: context.user.id, acceptedAt: needsActivation ? null : new Date() },
      });
      if (needsActivation) {
        await tx.userToken.updateMany({
          where: { tokenHash: { in: pendingInvitations.map((invitation) => invitation.tokenHash) }, usedAt: null },
          data: { usedAt: new Date() },
        });
        await tx.userToken.create({ data: { userId: user.id, type: 'ACTIVATION', tokenHash, expiresAt } });
      }
      return { member, invitation, user };
    });

    let warning: string | undefined;
    const activationUrl = getAppUrl(request, `/activate/${token}`);
    if (needsActivation) {
      try {
        const delivery = await sendActivationEmail(email, activationUrl);
        if (delivery.status === 'skipped') warning = 'Preview: členství vzniklo, ale aktivační e-mail nebyl odeslán. Použijte zobrazený aktivační odkaz.';
      }
      catch (error) {
        console.error('[organization/invitations] Activation email delivery failed', {
          organizationId: context.organizationId,
          userId: result.user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        warning = 'Členství vzniklo, ale aktivační e-mail se nepodařilo odeslat.';
      }
    }
    const exposePreviewActivationUrl = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production';
    return NextResponse.json({
      ok: true,
      memberId: result.member.id,
      existingAccount: wasExisting && !needsActivation,
      resent: Boolean(existingMember),
      warning,
      ...(exposePreviewActivationUrl && needsActivation ? { activationUrl } : {}),
    }, { status: existingMember ? 200 : 201 });
  } catch (error) {
    console.error('[organization/invitations] Request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
}
