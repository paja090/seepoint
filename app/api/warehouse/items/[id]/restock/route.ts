import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();
  const { id } = await params;

  try {
    const item = await prisma.warehouseItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Skladová položka nebyla nalezena.' }, { status: 404 });
    }

    const currentStock = Number(item.quantityInStock);
    const minStock = item.minQuantity ? Number(item.minQuantity) : 5;
    const neededQty = Math.max(1, minStock * 2 - currentStock);

    const userName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;

    // Create item in CompanyShoppingItem (Module Nákupy)
    const shoppingItem = await prisma.companyShoppingItem.create({
      data: {
        category: 'WORKSHOP', // Dílna & Výroba
        title: item.name,
        quantity: `${neededQty}`,
        unit: item.unit,
        store: item.supplierName || 'Dodavatel dílny',
        priority: 'HIGH' as const,
        note: `Automaticky vygenerováno ze Skladu. Aktuální stav: ${currentStock} ${item.unit} (Minimální doporučený: ${minStock} ${item.unit}). ${item.supplierContact ? `Kontakt: ${item.supplierContact}` : ''}`,
        addedByUserId: user.id,
        addedByUserName: userName,
      },
    });

    return NextResponse.json(shoppingItem);
  } catch (error) {
    console.error('Restock shopping item error:', error);
    return NextResponse.json({ error: 'Přidání do Nákupů selhalo.' }, { status: 500 });
  }
}
