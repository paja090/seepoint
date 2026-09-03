import { NextRequest, NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { createClient, findDuplicateClients } from '@/lib/crm/client-service';
import { normalizeClientName } from '@/lib/crm/domain';
import { CrmClientValidationError, parseClientInput, parseClientListQuery } from '@/lib/crm/client-policy';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;

  const { searchParams } = new URL(req.url);
  let parsed;
  try {
    parsed = parseClientListQuery(searchParams);
  } catch (error) {
    if (error instanceof CrmClientValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  const { q, status, clientType, assignedUserId, page, pageSize } = parsed;
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
    where.status = status;
  }

  if (clientType) {
    where.clientType = clientType;
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

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({ clients, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAccess('clients');
  if (isApiDenied(authResult)) return authResult;
  const user = authResult;

  try {
    if (!user.organizationId) return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
    const rawBody = await req.json().catch(() => null);
    const body = parseClientInput(rawBody);
    const ignoreDuplicates = Boolean(rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) && (rawBody as Record<string, unknown>).ignoreDuplicates === true);

    // Check duplicates before creating
    const duplicates = await findDuplicateClients(body.companyId ?? undefined, body.name, body.email ?? undefined);
    if (duplicates.length > 0 && !ignoreDuplicates) {
      const canForceCreate = !duplicates.some((client) => normalizeClientName(client.name) === normalizeClientName(body.name));
      return NextResponse.json({
        hasDuplicates: true,
        warning: 'Byl nalezen existující klient se stejným IČO nebo názvem.',
        duplicates,
        canForceCreate,
      }, { status: 409 });
    }

    const client = await createClient(body, user.id, user.email, user.organizationId);
    return NextResponse.json({ success: true, client }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof CrmClientValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof Error && err.message === 'INVALID_ASSIGNEE') return NextResponse.json({ error: 'Přiřazený uživatel není aktivním členem organizace.' }, { status: 400 });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Klient se stejným názvem už existuje.' }, { status: 409 });
    }
    if (err instanceof Error && err.message.includes('stejným názvem')) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error('CRM client creation failed', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo založit.' }, { status: 500 });
  }
}
