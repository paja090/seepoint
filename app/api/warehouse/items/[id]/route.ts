import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { canManageWarehouseCatalog } from '@/lib/rbac';
import { WarehouseInputError, warehouseCategory, warehouseNumber, warehouseText } from '@/lib/warehouse-validation';

export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canManageWarehouseCatalog(user.role)) {
    return NextResponse.json({ error: 'Skladové položky může spravovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  await ensureWarehouseSchema();
  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 });
    const { name, code, category, unit, quantityInStock, minQuantity, unitPrice, location, supplierName, supplierContact, note } = body;

    if (quantityInStock !== undefined) {
      return NextResponse.json({ error: 'Stav zásoby měňte pouze evidovaným skladovým pohybem.' }, { status: 400 });
    }

    const updated = await prisma.warehouseItem.update({
      where: { id },
      data: {
        name: name !== undefined ? warehouseText(name, 'Název položky', 200, true)! : undefined,
        code: code !== undefined ? warehouseText(code, 'Kód položky', 100) : undefined,
        category: category !== undefined ? warehouseCategory(category) : undefined,
        unit: unit !== undefined ? warehouseText(unit, 'Jednotka', 30, true)! : undefined,
        minQuantity: minQuantity !== undefined ? warehouseNumber(minQuantity, 'Minimální zásoba', { optional: true, allowZero: true }) : undefined,
        unitPrice: unitPrice !== undefined ? warehouseNumber(unitPrice, 'Jednotková cena', { optional: true, allowZero: true }) : undefined,
        location: location !== undefined ? warehouseText(location, 'Umístění', 200) : undefined,
        supplierName: supplierName !== undefined ? warehouseText(supplierName, 'Dodavatel', 200) : undefined,
        supplierContact: supplierContact !== undefined ? warehouseText(supplierContact, 'Kontakt dodavatele', 300) : undefined,
        note: note !== undefined ? warehouseText(note, 'Poznámka', 2000) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Update warehouse item error:', error);
    return NextResponse.json({ error: 'Úprava položky selhala.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canManageWarehouseCatalog(user.role)) {
    return NextResponse.json({ error: 'Skladové položky může spravovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  await ensureWarehouseSchema();
  const { id } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.warehouseItem.findUnique({
        where: { id },
        select: { id: true, _count: { select: { movements: true } } },
      });
      if (!existing) throw new WarehouseInputError('Skladová položka nebyla nalezena.');
      if (existing._count.movements > 0) {
        throw new WarehouseInputError('Položku s historií pohybů nelze smazat, aby zůstala zachována auditní stopa.');
      }
      await tx.warehouseItem.delete({ where: { id } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WarehouseInputError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Delete warehouse item error:', error);
    return NextResponse.json({ error: 'Smazání položky selhalo.' }, { status: 500 });
  }
}
