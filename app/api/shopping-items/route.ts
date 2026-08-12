import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const isPurchased = searchParams.get('isPurchased');

  const where: any = {};
  if (category && category !== 'ALL') {
    where.category = category;
  }
  if (isPurchased === 'true') {
    where.isPurchased = true;
  } else if (isPurchased === 'false') {
    where.isPurchased = false;
  }

  try {
    const items = await prisma.companyShoppingItem.findMany({
      where,
      orderBy: [{ isPurchased: 'asc' }, { createdAt: 'desc' }],
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

    const userName = auth.employee
      ? `${auth.employee.firstName} ${auth.employee.lastName}`.trim()
      : auth.name || auth.email || 'Člen týmu';

    const newItem = await prisma.companyShoppingItem.create({
      data: {
        title: body.title.trim(),
        category,
        quantity: body.quantity?.trim() || null,
        note: body.note?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        addedByUserId: auth.id,
        addedByUserName: userName,
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
