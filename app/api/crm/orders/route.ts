import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { createCrmOrder, CrmOrderConversionError } from '@/lib/crm/order-service';
import {
  CrmOrderValidationError,
  parseCreateCrmOrderInput,
  parseCrmOrderListQuery,
} from '@/lib/crm/order-policy';
import { buildCrmOrderSearchWhere } from '@/lib/crm/search-query';

export async function GET(req: NextRequest) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) {
    return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseCrmOrderListQuery(new URL(req.url).searchParams);
  } catch (error) {
    if (error instanceof CrmOrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const andClauses: Prisma.CrmOrderWhereInput[] = [{ organizationId: auth.organizationId }];
  if (parsed.q) {
    andClauses.push(buildCrmOrderSearchWhere(parsed.q));
  }
  if (parsed.clientId) {
    andClauses.push({ clientId: parsed.clientId });
  }
  if (parsed.agencyClientId) {
    andClauses.push({ agencyClientId: parsed.agencyClientId });
  }
  if (parsed.branchId) {
    andClauses.push({
      OR: [
        { branchId: parsed.branchId },
        { realizations: { some: { branchId: parsed.branchId } } },
      ],
    });
  }
  if (parsed.status) {
    andClauses.push({ status: parsed.status });
  }
  if (parsed.missingAgency) {
    andClauses.push({
      agencyClientId: null,
      OR: [{ agencyName: null }, { agencyName: '' }],
    });
  }

  const where: Prisma.CrmOrderWhereInput = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

  const [orders, total] = await Promise.all([
    prisma.crmOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyId: true,
            branches: {
              where: { active: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, code: true, city: true },
            },
          },
        },
        agencyClient: { select: { id: true, name: true, companyId: true } },
        branch: { select: { id: true, name: true, code: true, city: true } },
        assignedUser: { select: { id: true, name: true } },
        _count: { select: { workOrders: true, clientInvoices: true, realizations: true } },
      },
    }),
    prisma.crmOrder.count({ where }),
  ]);

  return NextResponse.json({
    orders,
    pagination: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) {
    return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
  }

  try {
    const rawBody = await req.json().catch(() => null);
    const input = parseCreateCrmOrderInput(rawBody);
    const order = await createCrmOrder(input, auth.id, auth.email, auth.organizationId);
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (error) {
    if (error instanceof CrmOrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CrmOrderConversionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[crm/orders] POST failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Zakázku se nepodařilo vytvořit.' }, { status: 500 });
  }
}
