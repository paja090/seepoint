import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';
import { normalizeCompanySettingsUpdate } from '@/lib/company-settings-policy';
import type { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN');
    const organization = await platformPrisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 });
    return NextResponse.json(organization);
  } catch {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  let organizationId: string;
  try {
    ({ organizationId } = await requireOrganizationRole('ADMIN'));
  } catch {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });

  let data;
  try {
    data = normalizeCompanySettingsUpdate(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatná data.' }, { status: 400 });
  }

  try {
    const now = new Date();
    const [organization] = await platformPrisma.$transaction([
      platformPrisma.organization.update({ where: { id: organizationId }, data: data as Prisma.OrganizationUpdateInput }),
      platformPrisma.organizationOnboarding.upsert({
        where: { organizationId },
        create: { organizationId, companyCompletedAt: now, settingsCompletedAt: now, currentStep: 'INVENTORY' },
        update: { settingsCompletedAt: now, currentStep: 'INVENTORY' },
      }),
    ]);
    return NextResponse.json({ ok: true, organization });
  } catch (error) {
    console.error('[settings/company] Update failed', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Firemní údaje se nepodařilo uložit.' }, { status: 500 });
  }
}
