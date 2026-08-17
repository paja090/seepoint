import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Chybí ID položky.' }, { status: 400 });

  try {
    const existing = await prisma.companyShoppingItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Položka nebyla nalezena.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const userName = auth.employee
      ? `${auth.employee.firstName} ${auth.employee.lastName}`.trim()
      : auth.name || auth.email || 'Člen týmu';

    const nextIsPurchased = body.isPurchased !== undefined ? Boolean(body.isPurchased) : !existing.isPurchased;

    const data: any = {
      isPurchased: nextIsPurchased,
      purchasedByUserId: nextIsPurchased ? auth.id : null,
      purchasedByUserName: nextIsPurchased ? userName : null,
      purchasedAt: nextIsPurchased ? new Date() : null,
    };

    if (nextIsPurchased && body.pricePaid !== undefined) {
      data.pricePaid = body.pricePaid !== null && body.pricePaid !== '' ? parseFloat(body.pricePaid) : null;
    }
    if (nextIsPurchased && body.receiptUrl !== undefined) {
      data.receiptUrl = body.receiptUrl ? String(body.receiptUrl).trim() : null;
    }

    const updated = await prisma.companyShoppingItem.update({
      where: { id },
      data,
      include: {
        crmOrder: {
          select: {
            id: true,
            title: true,
            orderNumber: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to toggle shopping item:', error);
    return NextResponse.json(
      { error: 'Stav položky se nepodařilo změnit.' },
      { status: 500 }
    );
  }
}
