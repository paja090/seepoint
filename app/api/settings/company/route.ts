import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';

const editableFields = [
  'name', 'companyId', 'vatId', 'street', 'city', 'postalCode', 'country',
  'email', 'phone', 'website', 'logoUrl', 'primaryColor', 'secondaryColor',
  'emailSignature', 'defaultCurrency', 'bankAccount', 'iban', 'swift',
] as const;

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
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN');
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Neplatná data.' }, { status: 400 });
    const data: Record<string, string | null> = {};
    for (const field of editableFields) {
      if (body[field] === undefined) continue;
      if (typeof body[field] !== 'string') return NextResponse.json({ error: `Pole ${field} musí být text.` }, { status: 400 });
      const value = body[field].trim();
      data[field] = value || null;
    }
    if (typeof data.name === 'string' && data.name.length < 2) return NextResponse.json({ error: 'Název firmy je příliš krátký.' }, { status: 400 });
    if (data.country === null) data.country = 'CZ';
    if (data.defaultCurrency === null) data.defaultCurrency = 'CZK';
    const now = new Date();
    const [organization] = await platformPrisma.$transaction([
      platformPrisma.organization.update({ where: { id: organizationId }, data }),
      platformPrisma.organizationOnboarding.upsert({
        where: { organizationId },
        create: { organizationId, companyCompletedAt: now, settingsCompletedAt: now, currentStep: 'INVENTORY' },
        update: { settingsCompletedAt: now, currentStep: 'INVENTORY' },
      }),
    ]);
    return NextResponse.json({ ok: true, organization });
  } catch {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }
}
