import { OrganizationRole } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/app-url';
import { hashToken, newToken } from '@/lib/auth';
import { platformPrisma } from '@/lib/db';
import { sendActivationEmail } from '@/lib/email';
import { requireOrganizationRole } from '@/lib/organization';
import { canAssignOrganizationRole, invitationLifecycleStatus } from '@/lib/organization-invitation-policy';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireOrganizationRole('ADMIN');
    const { id } = await params;
    const body = await request.json().catch(() => null) as { action?: unknown; role?: unknown } | null;
    if (!body || !['resend', 'revoke', 'update-role'].includes(String(body.action))) {
      return NextResponse.json({ error: 'Neplatná akce.' }, { status: 400 });
    }

    const invitation = await platformPrisma.organizationInvitation.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!invitation) return NextResponse.json({ error: 'Pozvánka nebyla nalezena.' }, { status: 404 });
    const status = invitationLifecycleStatus(invitation);
    if (status === 'ACCEPTED' || status === 'REVOKED') {
      return NextResponse.json({ error: 'Pozvánka už není aktivní.' }, { status: 409 });
    }
    if (invitation.role === 'OWNER' && context.membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Pozvánku vlastníka může spravovat pouze vlastník.' }, { status: 403 });
    }

    const user = await platformPrisma.user.findUnique({ where: { email: invitation.email } });
    if (!user) return NextResponse.json({ error: 'Pozvaný účet nebyl nalezen.' }, { status: 409 });

    if (body.action === 'update-role') {
      if (typeof body.role !== 'string' || !Object.values(OrganizationRole).includes(body.role as OrganizationRole)) {
        return NextResponse.json({ error: 'Role není platná.' }, { status: 400 });
      }
      const role = body.role as OrganizationRole;
      if (!canAssignOrganizationRole(context.membership.role, role)) {
        return NextResponse.json({ error: 'Vlastníka může nastavit pouze vlastník.' }, { status: 403 });
      }
      await platformPrisma.$transaction(async (tx) => {
        await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { role } });
        await tx.organizationMember.update({
          where: { organizationId_userId: { organizationId: context.organizationId, userId: user.id } },
          data: { role, roles: [role], isActive: false },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'revoke') {
      await platformPrisma.$transaction(async (tx) => {
        await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
        await tx.userToken.updateMany({ where: { tokenHash: invitation.tokenHash, usedAt: null }, data: { usedAt: new Date() } });
        await tx.organizationMember.updateMany({
          where: { organizationId: context.organizationId, userId: user.id },
          data: { isActive: false },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (user.status !== 'INVITED') {
      return NextResponse.json({ error: 'Účet už byl aktivován.' }, { status: 409 });
    }
    const token = newToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const nextInvitation = await platformPrisma.$transaction(async (tx) => {
      await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      await tx.userToken.updateMany({ where: { tokenHash: invitation.tokenHash, usedAt: null }, data: { usedAt: new Date() } });
      await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: context.organizationId, userId: user.id } },
        data: { role: invitation.role, roles: [invitation.role], isActive: false },
      });
      const created = await tx.organizationInvitation.create({
        data: {
          organizationId: context.organizationId,
          email: invitation.email,
          role: invitation.role,
          tokenHash,
          expiresAt,
          invitedById: context.user.id,
        },
      });
      await tx.userToken.create({ data: { userId: user.id, type: 'ACTIVATION', tokenHash, expiresAt } });
      return created;
    });

    const activationUrl = getAppUrl(request, `/activate/${token}`);
    let warning: string | undefined;
    try {
      await sendActivationEmail(invitation.email, activationUrl);
    } catch (error) {
      console.error('[organization/invitations/resend] Activation email delivery failed', {
        organizationId: context.organizationId,
        invitationId: nextInvitation.id,
        error: error instanceof Error ? error.message : String(error),
      });
      warning = 'Pozvánka byla obnovena, ale e-mail se nepodařilo odeslat.';
    }
    const exposePreviewActivationUrl = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production';
    return NextResponse.json({
      ok: true,
      warning,
      ...(exposePreviewActivationUrl ? { activationUrl } : {}),
    });
  } catch (error) {
    console.error('[organization/invitations/id] Request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
}
