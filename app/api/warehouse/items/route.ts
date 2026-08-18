import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { WarehouseItemCategory } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category') as WarehouseItemCategory | null;
  const lowStock = searchParams.get('lowStock') === 'true';

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { supplierName: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (category) {
    where.category = category;
  }

  try {
    let items = await prisma.warehouseItem.findMany({
      where,
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    if (lowStock) {
      items = items.filter((item) => item.minQuantity !== null && Number(item.quantityInStock) < Number(item.minQuantity));
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('Fetch warehouse items error:', error);
    return NextResponse.json({ error: 'Načtení skladu selhalo.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();

  try {
    const body = await request.json();
    const { name, code, category, unit, quantityInStock, minQuantity, unitPrice, location, supplierName, supplierContact, note } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Zadejte název položky.' }, { status: 400 });
    }

    const item = await prisma.warehouseItem.create({
      data: {
        name: name.trim(),
        code: code ? String(code).trim() : null,
        category: category || 'CONSUMABLE',
        unit: unit || 'ks',
        quantityInStock: quantityInStock !== undefined && quantityInStock !== null ? Number(quantityInStock) : 0,
        minQuantity: minQuantity !== undefined && minQuantity !== null && minQuantity !== '' ? Number(minQuantity) : null,
        unitPrice: unitPrice !== undefined && unitPrice !== null && unitPrice !== '' ? Number(unitPrice) : null,
        location: location ? String(location).trim() : null,
        supplierName: supplierName ? String(supplierName).trim() : null,
        supplierContact: supplierContact ? String(supplierContact).trim() : null,
        note: note ? String(note).trim() : null,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('Create warehouse item error:', error);
    return NextResponse.json({ error: 'Vytvoření položky selhalo.' }, { status: 500 });
  }
}
