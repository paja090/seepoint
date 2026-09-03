import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { canManageWarehouseCatalog } from '@/lib/rbac';
import { runTransactionWithRetry } from '@/lib/transaction-retry';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  if (!canManageWarehouseCatalog(user.role)) {
    return NextResponse.json({ error: 'Požadavek na doplnění zásob může vytvořit pouze administrátor nebo manažer.' }, { status: 403 });
  }

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

    const result = await runTransactionWithRetry(async (tx) => {
      // Serializable isolation turns the read-then-create sequence into one
      // retried decision when two workers request the same item at once.
      const existingRequest = await tx.companyShoppingItem.findFirst({
        where: { title: { equals: item.name, mode: 'insensitive' }, isPurchased: false },
        orderBy: { createdAt: 'desc' },
      });
      if (existingRequest) return { item: existingRequest, alreadyExists: true };

      const shoppingItem = await tx.companyShoppingItem.create({
        data: {
          category: 'WORKSHOP',
          title: item.name,
          quantity: `${neededQty}`,
          unit: item.unit,
          store: item.supplierName || 'Dodavatel dílny',
          priority: 'THIS_WEEK',
          note: `Automaticky vygenerováno ze Skladu. Aktuální stav: ${currentStock} ${item.unit} (Minimální doporučený: ${minStock} ${item.unit}). ${item.supplierContact ? `Kontakt: ${item.supplierContact}` : ''}`,
          addedByUserId: user.id,
          addedByUserName: userName,
        },
      });
      return { item: shoppingItem, alreadyExists: false };
    });

    return NextResponse.json(result.alreadyExists ? { ...result.item, alreadyExists: true } : result.item);
  } catch (error) {
    console.error('Restock shopping item error:', error);
    return NextResponse.json({ error: 'Přidání do Nákupů selhalo.' }, { status: 500 });
  }
}
