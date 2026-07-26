import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createClient, findDuplicateClients } from '@/lib/crm/client-service';
import { normalizeClientName } from '@/lib/crm/domain';
import { prisma } from '@/lib/db';
import { ClientSource, ClientStatus, ClientType, Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const status = searchParams.get('status')?.trim();
  const clientType = searchParams.get('clientType')?.trim();
  const assignedUserId = searchParams.get('assignedUserId')?.trim();
  const inactiveDays = searchParams.get('inactiveDays')?.trim();

  const where: Prisma.ClientWhereInput = { active: true };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { companyId: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { contactPerson: { contains: q, mode: 'insensitive' } },
      { billingCity: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status as Prisma.EnumClientStatusFilter;
  }

  if (clientType) {
    where.clientType = clientType as Prisma.EnumClientTypeFilter;
  }

  if (assignedUserId) {
    where.assignedUserId = assignedUserId;
  }

  if (inactiveDays) {
    const days = parseInt(inactiveDays, 10);
    if (!isNaN(days) && days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      where.lastActivityAt = { lte: cutoff };
    }
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          occupancies: true,
          offers: true,
          crmOrders: true,
          invoices: true,
          crmTasks: true,
        },
      },
    },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Název společnosti je povinný.' }, { status: 400 });
    }
    if (body.status && !Object.values(ClientStatus).includes(body.status)) return NextResponse.json({ error: 'Neplatný stav klienta.' }, { status: 400 });
    if (body.clientType && !Object.values(ClientType).includes(body.clientType)) return NextResponse.json({ error: 'Neplatný typ klienta.' }, { status: 400 });
    if (body.source && !Object.values(ClientSource).includes(body.source)) return NextResponse.json({ error: 'Neplatný zdroj klienta.' }, { status: 400 });

    // Check duplicates before creating
    const duplicates = await findDuplicateClients(body.companyId, body.name, body.email);
    if (duplicates.length > 0 && !body.ignoreDuplicates) {
      const canForceCreate = !duplicates.some((client) => normalizeClientName(client.name) === normalizeClientName(body.name));
      return NextResponse.json({
        hasDuplicates: true,
        warning: 'Byl nalezen existující klient se stejným IČO nebo názvem.',
        duplicates,
        canForceCreate,
      }, { status: 409 });
    }

    const client = await createClient(body, user.id, user.email);
    return NextResponse.json({ success: true, client });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Klient se stejným názvem už existuje.' }, { status: 409 });
    }
    if (err instanceof Error && err.message.includes('stejným názvem')) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('CRM client creation failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo založit.' }, { status: 500 });
  }
}
