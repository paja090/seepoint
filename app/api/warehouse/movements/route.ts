import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';
import { WarehouseMovementType } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();

  try {
    const body = await request.json();
    const { itemId, type, quantity, workOrderId, assignedEmployeeId, note } = body;

    if (!itemId || !type || !quantity || Number(quantity) <= 0) {
      return NextResponse.json({ error: 'Vyberte položku, typ pohybu a kladné množství.' }, { status: 400 });
    }

    const item = await prisma.warehouseItem.findUnique({ where: { id: itemId } });
    if (!item) {
      return NextResponse.json({ error: 'Položka nebyla nalezena.' }, { status: 404 });
    }

    const qty = Number(quantity);
    let newStock = Number(item.quantityInStock);

    if (type === 'RECEIPT' || type === 'RETURN') {
      newStock += qty;
    } else if (type === 'ISSUE') {
      if (newStock < qty) {
        return NextResponse.json(
          { error: `Nedostatek materiálu na skladě. Aktuálně je k dispozici pouze ${newStock} ${item.unit}.` },
          { status: 400 }
        );
      }
      newStock -= qty;
    } else if (type === 'ADJUSTMENT') {
      newStock = qty; // Direct stock override during inventory count
    }

    // Determine assigned employee name if ID provided
    let assignedEmployeeName: string | null = null;
    if (assignedEmployeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: assignedEmployeeId } });
      if (emp) assignedEmployeeName = `${emp.firstName} ${emp.lastName}`.trim();
    }

    const performedByName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.name || user.email;

    // Create movement log and update item quantity in a transaction
    const [movement, updatedItem] = await prisma.$transaction([
      prisma.warehouseMovement.create({
        data: {
          itemId,
          type: type as WarehouseMovementType,
          quantity: qty,
          workOrderId: workOrderId || null,
          assignedEmployeeId: assignedEmployeeId || null,
          assignedEmployeeName: assignedEmployeeName || null,
          performedByName,
          note: note ? String(note).trim() : null,
        },
        include: {
          item: true,
          workOrder: true,
        },
      }),
      prisma.warehouseItem.update({
        where: { id: itemId },
        data: { quantityInStock: newStock },
      }),
    ]);

    return NextResponse.json({ movement, item: updatedItem });
  } catch (error) {
    console.error('Create warehouse movement error:', error);
    return NextResponse.json({ error: 'Registrace pohybu selhala.' }, { status: 500 });
  }
}
