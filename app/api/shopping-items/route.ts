import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

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

  const where: any = {};
  if (category && category !== 'ALL') {
    where.category = category;
  }
  if (isPurchased === 'true') {
    where.isPurchased = true;
  } else if (isPurchased === 'false') {
    where.isPurchased = false;
  }
  if (priority && ['NORMAL', 'THIS_WEEK', 'URGENT'].includes(priority)) {
    where.priority = priority;
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

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: 'Zadejte název položky k nákupu.' },
        { status: 400 }
      );
    }

    const category = ['OFFICE', 'WORKSHOP'].includes(body.category)
      ? body.category
      : 'WORKSHOP';

    const priority = ['NORMAL', 'THIS_WEEK', 'URGENT'].includes(body.priority)
      ? body.priority
      : 'NORMAL';

    const userName = auth.employee
      ? `${auth.employee.firstName} ${auth.employee.lastName}`.trim()
      : auth.name || auth.email || 'Člen týmu';

    let assignedEmployeeName = body.assignedEmployeeName?.trim() || null;
    if (body.assignedEmployeeId && !assignedEmployeeName) {
      const emp = await prisma.employee.findUnique({
        where: { id: body.assignedEmployeeId },
        select: { firstName: true, lastName: true },
      });
      if (emp) {
        assignedEmployeeName = `${emp.firstName} ${emp.lastName}`.trim();
      }
    }

    const newItem = await prisma.companyShoppingItem.create({
      data: {
        title: body.title.trim(),
        category,
        quantity: body.quantity?.trim() || null,
        unit: body.unit?.trim() || null,
        store: body.store?.trim() || null,
        priority,
        note: body.note?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        receiptUrl: body.receiptUrl?.trim() || null,
        assignedEmployeeId: body.assignedEmployeeId || null,
        assignedEmployeeName,
        crmOrderId: body.crmOrderId || null,
        addedByUserId: auth.id,
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
  } catch (error) {
    console.error('Failed to create shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo přidat do nákupního seznamu.' },
      { status: 500 }
    );
  }
}
