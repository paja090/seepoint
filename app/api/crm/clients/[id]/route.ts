import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

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
        contacts: { orderBy: { createdAt: 'desc' } },
        branches: { orderBy: { createdAt: 'desc' } },
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
    const body = await request.json();
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name: body.name,
        companyId: body.companyId,
        tradingName: body.tradingName,
        dic: body.dic,
        billingStreet: body.billingStreet,
        billingCity: body.billingCity,
        billingZip: body.billingZip,
        billingCountry: body.billingCountry,
        website: body.website,
        contactPerson: body.contactPerson,
        email: body.email,
        phone: body.phone,
        status: body.status,
        clientType: body.clientType,
        pricingSegment: body.pricingSegment,
        source: body.source,
        assignedUserId: body.assignedUserId,
        note: body.note,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
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

  try {
    if (isPermanent) {
      // Hard delete from database
      await prisma.client.delete({ where: { id } });
      await prisma.crmAuditLog.create({
        data: {
          userId: auth.id,
          userEmail: auth.email,
          action: 'PERMANENT_DELETE_CLIENT',
          entityType: 'Client',
          entityId: id,
        },
      });
      return NextResponse.json({ success: true, permanent: true });
    } else {
      // Soft delete / deactivation
      await prisma.$transaction([
        prisma.client.update({ where: { id }, data: { active: false, status: 'INACTIVE' } }),
        prisma.crmAuditLog.create({
          data: {
            userId: auth.id,
            userEmail: auth.email,
            action: 'DEACTIVATE_CLIENT',
            entityType: 'Client',
            entityId: id,
          },
        }),
      ]);
      return NextResponse.json({ success: true, permanent: false });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    }
    console.error('CRM client deactivation/deletion failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Klienta se nepodařilo odstranit.' }, { status: 500 });
  }
}
