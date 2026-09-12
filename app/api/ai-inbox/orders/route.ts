import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  if (!canAccess(user.role, 'aiInbox')) {
    return NextResponse.json({ error: 'Nemáte oprávnění pro přístup k AI Inboxu.' }, { status: 403 });
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Chybí kontext organizace.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const clientId = searchParams.get('clientId')?.trim();

  const where: Prisma.CrmOrderWhereInput = {
    organizationId,
  };

  if (clientId) {
    where.clientId = clientId;
  }

  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
      { clientOrderCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orders = await prisma.crmOrder.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      title: true,
      status: true,
      projectType: true,
      client: {
        select: { id: true, name: true },
      },
      navigationOrder: {
        select: { id: true, status: true },
      },
    },
  });

  return NextResponse.json({ orders });
}
