import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { canEditShoppingList } from '@/lib/rbac';
import {
  shoppingCategory,
  shoppingImage,
  shoppingOptionalText,
  shoppingPrice,
  shoppingPriority,
  shoppingRequestBody,
  shoppingRequiredText,
  shoppingValidationResponse,
} from '@/lib/shopping-validation';

export async function PATCH(
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

    const data: Prisma.CompanyShoppingItemUncheckedUpdateInput = {};
    if (typeof body.title !== 'undefined') {
      data.title = shoppingRequiredText(body.title, 'Název položky', 200);
    }
    if (typeof body.category !== 'undefined') {
      data.category = shoppingCategory(body.category);
    }
    if (typeof body.quantity !== 'undefined') {
      data.quantity = shoppingOptionalText(body.quantity, 'Množství', 50);
    }
    if (typeof body.unit !== 'undefined') {
      data.unit = shoppingOptionalText(body.unit, 'Jednotka', 20);
    }
    if (typeof body.store !== 'undefined') {
      data.store = shoppingOptionalText(body.store, 'Obchod', 120);
    }
    if (typeof body.priority !== 'undefined') {
      data.priority = shoppingPriority(body.priority);
    }
    if (typeof body.note !== 'undefined') {
      data.note = shoppingOptionalText(body.note, 'Poznámka', 2_000);
    }
    if (typeof body.imageUrl !== 'undefined') {
      data.imageUrl = shoppingImage(body.imageUrl, 'Fotografie položky');
    }
    if (typeof body.receiptUrl !== 'undefined') {
      data.receiptUrl = shoppingImage(body.receiptUrl, 'Fotografie účtenky');
    }

    if (typeof body.assignedEmployeeId !== 'undefined') {
      const assignedEmpId = shoppingOptionalText(body.assignedEmployeeId, 'ID zaměstnance', 64);
      if (assignedEmpId) {
        const emp = await prisma.employee.findUnique({
          where: { id: assignedEmpId },
          select: { firstName: true, lastName: true },
        });
        if (emp) {
          data.assignedEmployeeId = assignedEmpId;
          data.assignedEmployeeName = `${emp.firstName} ${emp.lastName}`.trim();
        } else {
          return NextResponse.json({ error: 'Vybraný zaměstnanec nebyl nalezen.' }, { status: 400 });
        }
      } else {
        data.assignedEmployeeId = null;
        data.assignedEmployeeName = null;
      }
    }

    if (typeof body.crmOrderId !== 'undefined') {
      const orderId = shoppingOptionalText(body.crmOrderId, 'ID zakázky', 64);
      if (orderId) {
        const orderExists = await prisma.crmOrder.findUnique({
          where: { id: orderId },
          select: { id: true },
        });
        if (!orderExists) return NextResponse.json({ error: 'Vybraná zakázka nebyla nalezena.' }, { status: 400 });
        data.crmOrderId = orderId;
      } else {
        data.crmOrderId = null;
      }
    }

    if (typeof body.pricePaid !== 'undefined') {
      data.pricePaid = shoppingPrice(body.pricePaid);
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
  } catch (error: unknown) {
    const validationError = shoppingValidationResponse(error);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    console.error('Failed to update shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo upravit.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    await prisma.companyShoppingItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Položka nebyla nalezena.' }, { status: 404 });
    }
    console.error('Failed to delete shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo smazat.' },
      { status: 500 }
    );
  }
}
