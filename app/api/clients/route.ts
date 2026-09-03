import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { createClient, findDuplicateClients } from '@/lib/crm/client-service';
import { CrmClientValidationError, parseClientInput } from '@/lib/crm/client-policy';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    take: 500,
    select: { id: true, name: true, pricingSegment: true, companyId: true, contactPerson: true, email: true, phone: true, note: true },
  });

  return NextResponse.json(clients);
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  try {
    if (!auth.organizationId) return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
    const body = parseClientInput(await request.json().catch(() => null));
    const duplicates = await findDuplicateClients(body.companyId ?? undefined, body.name, body.email ?? undefined);
    if (duplicates.length) return NextResponse.json({ error: 'Klient se stejným názvem, IČO nebo e-mailem už existuje.', duplicates }, { status: 409 });
    const client = await createClient(body, auth.id, auth.email, auth.organizationId);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof CrmClientValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Klient se stejným názvem už existuje.' }, { status: 409 });
    console.error('Legacy CRM client creation failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo založit.' }, { status: 500 });
  }
}
