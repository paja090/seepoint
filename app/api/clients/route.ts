import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { normalizeClientName } from '@/lib/navigation-import-plan';
import { offerErrorResponse } from '@/lib/offers/http';
import { OfferValidationError } from '@/lib/offers/domain';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, pricingSegment: true, companyId: true, contactPerson: true, email: true, phone: true, note: true },
  });

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  try {
    const body = await request.json() as Record<string, unknown>;
    const get = (key: string) => typeof body[key] === 'string' ? body[key].trim() : '';
    const name = get('name');
    const email = get('email');
    if (!name) throw new OfferValidationError('Zadejte název klienta.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OfferValidationError('E-mail klienta není platný.');
    const normalizedName = normalizeClientName(name);
    if (!normalizedName) throw new OfferValidationError('Název klienta není platný.');
    const client = await prisma.client.create({
      data: {
        name,
        normalizedName,
        companyId: get('companyId') || null,
        contactPerson: get('contactPerson') || null,
        email: email || null,
        phone: get('phone') || null,
        note: get('note') || null,
      },
      select: { id: true, name: true, companyId: true, contactPerson: true, email: true, phone: true, note: true },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
