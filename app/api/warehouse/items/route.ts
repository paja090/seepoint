import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { WarehouseItemCategory, type Prisma } from '@prisma/client';
import { canAccess, canManageWarehouseCatalog } from '@/lib/rbac';
import { WarehouseInputError, warehouseCategory, warehouseNumber, warehouseText } from '@/lib/warehouse-validation';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canAccess(user.role, 'warehouse')) return NextResponse.json({ error: 'Nemáte oprávnění ke skladu.' }, { status: 403 });

  await ensureWarehouseSchema();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category') as WarehouseItemCategory | null;
  const lowStock = searchParams.get('lowStock') === 'true';
  if (q && q.length > 200) return NextResponse.json({ error: 'Hledaný text je příliš dlouhý.' }, { status: 400 });
  if (category && !Object.values(WarehouseItemCategory).includes(category)) {
    return NextResponse.json({ error: 'Neplatná kategorie skladové položky.' }, { status: 400 });
  }

  const where: Prisma.WarehouseItemWhereInput = {};
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
  if (!canManageWarehouseCatalog(user.role)) {
    return NextResponse.json({ error: 'Skladové položky může spravovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  await ensureWarehouseSchema();

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
    const { name, code, category, unit, quantityInStock, minQuantity, unitPrice, location, supplierName, supplierContact, note } = body;
    const initialQuantity = quantityInStock === undefined || quantityInStock === null || quantityInStock === ''
      ? 0
      : warehouseNumber(quantityInStock, 'Počáteční stav', { allowZero: true });
    const performedByName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.warehouseItem.create({
        data: {
          name: warehouseText(name, 'Název položky', 200, true)!,
          code: warehouseText(code, 'Kód položky', 100),
          category: warehouseCategory(category),
          unit: warehouseText(unit ?? 'ks', 'Jednotka', 30, true)!,
          quantityInStock: initialQuantity,
          minQuantity: warehouseNumber(minQuantity, 'Minimální zásoba', { optional: true, allowZero: true }),
          unitPrice: warehouseNumber(unitPrice, 'Jednotková cena', { optional: true, allowZero: true }),
          location: warehouseText(location, 'Umístění', 200),
          supplierName: warehouseText(supplierName, 'Dodavatel', 200),
          supplierContact: warehouseText(supplierContact, 'Kontakt dodavatele', 300),
          note: warehouseText(note, 'Poznámka', 2000),
        },
      });
      if (initialQuantity > 0) {
        await tx.warehouseMovement.create({
          data: {
            itemId: created.id,
            type: 'RECEIPT',
            quantity: initialQuantity,
            performedByName,
            note: 'Počáteční stav při založení skladové položky',
          },
        });
      }
      return created;
    });

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Create warehouse item error:', error);
    return NextResponse.json({ error: 'Vytvoření položky selhalo.' }, { status: 500 });
  }
}
