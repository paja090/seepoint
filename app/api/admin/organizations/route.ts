import { NextResponse } from 'next/server';
import { hashToken, newToken } from '@/lib/auth';
import { normalizeAuthEmail } from '@/lib/auth-onboarding';
import { platformPrisma } from '@/lib/db';
import { sendActivationEmail } from '@/lib/email';
import { requireSuperAdmin } from '@/lib/organization';
import { getAppUrl } from '@/lib/app-url';

export async function GET() {
  try {
    await requireSuperAdmin();
    const organizations = await platformPrisma.organization.findMany({ include: { _count: { select: { members: true } } }, orderBy: { createdAt: 'desc' } });
    const surfaceCounts = await platformPrisma.advertisingSurface.groupBy({ by: ['organizationId'], _count: { _all: true } });
    const counts = new Map(surfaceCounts.map((row) => [row.organizationId, row._count._all]));
    return NextResponse.json(organizations.map((organization) => ({ ...organization, memberCount: organization._count.members, surfaceCount: counts.get(organization.id) ?? 0 })));
  } catch { return NextResponse.json({ error: 'Nenalezeno.' }, { status: 404 }); }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const ownerEmail = typeof body?.ownerEmail === 'string' ? normalizeAuthEmail(body.ownerEmail) : '';
    if (name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return NextResponse.json({ error: 'Vyplňte název, bezpečný slug a e-mail vlastníka.' }, { status: 400 });
    const existingUser = await platformPrisma.user.findUnique({ where: { email: ownerEmail } });
    if (existingUser?.status === 'SUSPENDED') return NextResponse.json({ error: 'Účet vlastníka je pozastavený. Nejdříve jej obnovte.' }, { status: 409 });
    const needsActivation = !existingUser || existingUser.status !== 'ACTIVE';
    const token = newToken(); const tokenHash = hashToken(token); const expiresAt = new Date(Date.now() + 48 * 3600000);
    const result = await platformPrisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name, slug, companyId: typeof body?.companyId === 'string' ? body.companyId.trim() || null : null, vatId: typeof body?.vatId === 'string' ? body.vatId.trim() || null : null, email: typeof body?.email === 'string' ? body.email.trim() || null : null, logoUrl: typeof body?.logoUrl === 'string' ? body.logoUrl.trim() || null : null, primaryColor: typeof body?.primaryColor === 'string' ? body.primaryColor.trim() || null : null, plan: 'START', subscriptionStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 14 * 86400000) } });
      const owner = existingUser ?? await tx.user.create({ data: { name: ownerEmail.split('@')[0], email: ownerEmail, role: 'ADMIN', roles: ['ADMIN'], status: 'INVITED' } });
      await tx.organizationMember.create({ data: { organizationId: organization.id, userId: owner.id, role: 'OWNER', roles: ['OWNER'], isActive: !needsActivation } });
      await tx.organizationInvitation.create({ data: { organizationId: organization.id, email: ownerEmail, role: 'OWNER', tokenHash, expiresAt, acceptedAt: needsActivation ? null : new Date() } });
      await tx.organizationOnboarding.create({ data: { organizationId: organization.id, currentStep: needsActivation ? 'OWNER' : 'SETTINGS', companyCompletedAt: new Date(), ownerCompletedAt: needsActivation ? null : new Date() } });
      if (needsActivation) await tx.userToken.create({ data: { userId: owner.id, type: 'ACTIVATION', tokenHash, expiresAt } });
      return { organization, owner };
    });
    let warning: string | undefined;
    const activationUrl = getAppUrl(request, `/activate/${token}`);
    if (needsActivation) try {
      const delivery = await sendActivationEmail(ownerEmail, activationUrl);
      if (delivery.status === 'skipped') warning = 'Preview: organizace vznikla, ale aktivační e-mail nebyl odeslán. Použijte zobrazený aktivační odkaz.';
    } catch { warning = 'Organizace vznikla, ale aktivační e-mail se nepodařilo odeslat.'; }
    const exposeActivationUrl = process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV !== 'production';
    return NextResponse.json({ ok: true, organization: result.organization, warning, ...(exposeActivationUrl && needsActivation ? { activationUrl } : {}) }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'Slug nebo jiný unikátní údaj už existuje.' }, { status: 409 });
    return NextResponse.json({ error: 'Organizaci se nepodařilo vytvořit.' }, { status: 500 });
  }
}
