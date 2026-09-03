import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { ShoppingPriority, type Prisma } from '@prisma/client';
import { canEditShoppingList } from '@/lib/rbac';
import {
  SHOPPING_CATEGORIES,
  SHOPPING_PRIORITIES,
  shoppingCategory,
  shoppingImage,
  shoppingOptionalText,
  shoppingPriority,
  shoppingRequestBody,
  shoppingRequiredText,
  shoppingValidationResponse,
} from '@/lib/shopping-validation';

export async function GET(request: Request) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const isPurchased = searchParams.get('isPurchased');
  const priority = searchParams.get('priority');
  const assignedEmployeeId = searchParams.get('assignedEmployeeId');
  const store = searchParams.get('store');
  const q = searchParams.get('q')?.trim();

  const where: Prisma.CompanyShoppingItemWhereInput = {};
  if (category && category !== 'ALL' && !(SHOPPING_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: 'Kategorie filtru není platná.' }, { status: 400 });
  }
  if (category && category !== 'ALL') {
    where.category = category;
  }
  if (isPurchased === 'true') {
    where.isPurchased = true;
  } else if (isPurchased === 'false') {
    where.isPurchased = false;
  }
  if (priority && priority !== 'ALL' && !(SHOPPING_PRIORITIES as readonly string[]).includes(priority)) {
    return NextResponse.json({ error: 'Priorita filtru není platná.' }, { status: 400 });
  }
  if (priority && priority !== 'ALL') {
    where.priority = priority as ShoppingPriority;
  }
  if (assignedEmployeeId) {
    if (assignedEmployeeId === 'UNASSIGNED') {
      where.assignedEmployeeId = null;
    } else {
      where.assignedEmployeeId = assignedEmployeeId;
    }
  }
  if (store && store !== 'ALL') {
    where.store = { equals: store, mode: 'insensitive' };
  }

  if (q && q.length > 100) {
    return NextResponse.json({ error: 'Hledaný text může mít nejvýše 100 znaků.' }, { status: 400 });
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { store: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      { assignedEmployeeName: { contains: q, mode: 'insensitive' } },
      { crmOrder: { title: { contains: q, mode: 'insensitive' } } },
      { crmOrder: { orderNumber: { contains: q, mode: 'insensitive' } } },
    ];
  }

  try {
    const items = await prisma.companyShoppingItem.findMany({
      where,
      include: {
        crmOrder: {
          select: {
            id: true,
            title: true,
            orderNumber: true,
          },
        },
      },
      orderBy: [{ isPurchased: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch shopping items:', error);
    return NextResponse.json(
      { error: 'Položky nákupního seznamu se nepodařilo načíst.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;
  if (!canEditShoppingList(auth.role)) {
    return NextResponse.json({ error: 'Tato role může nákupní seznam pouze zobrazit.' }, { status: 403 });
  }

  try {
    const body = shoppingRequestBody(await request.json().catch(() => null));
    const title = shoppingRequiredText(body.title, 'Název položky', 200);
    const category = shoppingCategory(body.category, 'WORKSHOP');
    const priority = shoppingPriority(body.priority, 'NORMAL');
    const quantity = shoppingOptionalText(body.quantity, 'Množství', 50);
    const unit = shoppingOptionalText(body.unit, 'Jednotka', 20);
    const store = shoppingOptionalText(body.store, 'Obchod', 120);
    const note = shoppingOptionalText(body.note, 'Poznámka', 2_000);
    const imageUrl = shoppingImage(body.imageUrl, 'Fotografie položky');
    const receiptUrl = shoppingImage(body.receiptUrl, 'Fotografie účtenky');

    const userName = (
      auth.employee
        ? `${auth.employee.firstName || ''} ${auth.employee.lastName || ''}`.trim()
        : auth.name || auth.email || 'Člen týmu'
    ).trim() || 'Člen týmu';

    let assignedEmployeeName: string | null = null;
    const assignedEmployeeId = shoppingOptionalText(body.assignedEmployeeId, 'ID zaměstnance', 64);
    if (assignedEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: assignedEmployeeId },
        select: { firstName: true, lastName: true },
      });
      if (emp) {
        assignedEmployeeName = `${emp.firstName} ${emp.lastName}`.trim();
      } else {
        return NextResponse.json({ error: 'Vybraný zaměstnanec nebyl nalezen.' }, { status: 400 });
      }
    }

    const crmOrderId = shoppingOptionalText(body.crmOrderId, 'ID zakázky', 64);
    if (crmOrderId) {
      const orderExists = await prisma.crmOrder.findUnique({
        where: { id: crmOrderId },
        select: { id: true },
      });
      if (!orderExists) {
        return NextResponse.json({ error: 'Vybraná zakázka nebyla nalezena.' }, { status: 400 });
      }
    }

    const newItem = await prisma.companyShoppingItem.create({
      data: {
        title,
        category,
        quantity,
        unit,
        store,
        priority,
        note,
        imageUrl,
        receiptUrl,
        assignedEmployeeId,
        assignedEmployeeName,
        crmOrderId,
        addedByUserId: auth.id || null,
        addedByUserName: userName,
      },
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

    return NextResponse.json(newItem);
  } catch (error: unknown) {
    const validationError = shoppingValidationResponse(error);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    console.error('Failed to create shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo přidat do nákupního seznamu.' },
      { status: 500 }
    );
  }
}
