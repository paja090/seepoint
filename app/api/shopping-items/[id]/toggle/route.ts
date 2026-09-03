import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { canEditShoppingList } from '@/lib/rbac';
import {
  shoppingBoolean,
  shoppingImage,
  shoppingPrice,
  shoppingRequestBody,
  shoppingValidationResponse,
} from '@/lib/shopping-validation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;
  if (!canEditShoppingList(auth.role)) {
    return NextResponse.json({ error: 'Tato role může nákupní seznam pouze zobrazit.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Chybí ID položky.' }, { status: 400 });

  try {
    const existing = await prisma.companyShoppingItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Položka nebyla nalezena.' }, { status: 404 });
    }

    const body = shoppingRequestBody(await request.json().catch(() => null));
    const userName = auth.employee
      ? `${auth.employee.firstName} ${auth.employee.lastName}`.trim()
      : auth.name || auth.email || 'Člen týmu';

    const nextIsPurchased = shoppingBoolean(body.isPurchased, 'Stav zakoupení');

    const data: Prisma.CompanyShoppingItemUncheckedUpdateInput = {
      isPurchased: nextIsPurchased,
      purchasedByUserId: nextIsPurchased ? auth.id : null,
      purchasedByUserName: nextIsPurchased ? userName : null,
      purchasedAt: nextIsPurchased ? new Date() : null,
    };

    if (nextIsPurchased && body.pricePaid !== undefined) {
      data.pricePaid = shoppingPrice(body.pricePaid);
    }
    if (nextIsPurchased && body.receiptUrl !== undefined) {
      data.receiptUrl = shoppingImage(body.receiptUrl, 'Fotografie účtenky');
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
    const validationError = shoppingValidationResponse(error);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    console.error('Failed to toggle shopping item:', error);
    return NextResponse.json(
      { error: 'Stav položky se nepodařilo změnit.' },
      { status: 500 }
    );
  }
}
