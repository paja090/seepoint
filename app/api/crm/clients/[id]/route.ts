import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { CrmClientValidationError, parseClientUpdateInput } from '@/lib/crm/client-policy';
import { normalizeClientName } from '@/lib/crm/domain';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        contacts: { where: { active: true }, orderBy: { createdAt: 'desc' } },
        branches: { where: { active: true }, orderBy: { createdAt: 'desc' } },
        offers: { orderBy: { createdAt: 'desc' } },
        crmOrders: { orderBy: { createdAt: 'desc' } },
        contracts: { orderBy: { createdAt: 'desc' } },
        invoices: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { createdAt: 'desc' } },
        crmTasks: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('CRM client fetch failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;

  try {
    if (!auth.organizationId) return NextResponse.json({ error: 'Chybí aktivní organizace.' }, { status: 400 });
    const body = parseClientUpdateInput(await request.json().catch(() => null));
    const assignedUserId = typeof body.assignedUserId === 'string' ? body.assignedUserId : null;
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.client.findFirst({ where: { id, active: true } });
      if (!current) throw new Error('CLIENT_NOT_FOUND');
      if (assignedUserId && !await tx.organizationMember.count({
        where: { organizationId: auth.organizationId!, userId: assignedUserId, isActive: true },
      })) throw new Error('INVALID_ASSIGNEE');

      const nextName = String(body.name);
      const result = await tx.client.update({
        where: { id },
        data: {
          ...(body as Prisma.ClientUncheckedUpdateInput),
          normalizedName: normalizeClientName(nextName),
          lastActivityAt: new Date(),
        },
      });
      await tx.crmAuditLog.create({
        data: {
          userId: auth.id,
          userEmail: auth.email,
          action: 'UPDATE_CLIENT',
          entityType: 'Client',
          entityId: id,
          detailsJson: JSON.stringify({ previousName: current.name, nextName: result.name }),
        },
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CrmClientValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === 'INVALID_ASSIGNEE') return NextResponse.json({ error: 'Přiřazený uživatel není aktivním členem organizace.' }, { status: 400 });
    if (error instanceof Error && error.message === 'CLIENT_NOT_FOUND') return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Aktivní klient se stejným názvem už existuje.' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }
    console.error('CRM client update failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo upravit.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients');
  if (isApiDenied(auth)) return auth;
  const { id } = await params;
  const url = new URL(request.url);
  const isPermanent = url.searchParams.get('permanent') === 'true';

  if (!['ADMIN', 'MANAGER'].includes(auth.role)) {
    return NextResponse.json({ error: 'Klienta může archivovat pouze administrátor nebo manažer.' }, { status: 403 });
  }
  if (isPermanent) {
    return NextResponse.json({ error: 'Trvalé mazání klientů není přes API povoleno. Použijte bezpečnou archivaci.' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id, active: true }, data: { active: false, status: 'INACTIVE' } });
      await tx.crmAuditLog.create({
          data: {
            userId: auth.id,
            userEmail: auth.email,
            action: 'DEACTIVATE_CLIENT',
            entityType: 'Client',
            entityId: id,
          },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, permanent: false });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }
    console.error('CRM client deactivation/deletion failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo odstranit.' }, { status: 500 });
  }
}
