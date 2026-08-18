import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureWarehouseSchema } from '@/lib/db';

export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, code, category, unit, quantityInStock, minQuantity, unitPrice, location, supplierName, supplierContact, note } = body;

    const updated = await prisma.warehouseItem.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        code: code !== undefined ? (code ? String(code).trim() : null) : undefined,
        category: category || undefined,
        unit: unit || undefined,
        quantityInStock: quantityInStock !== undefined && quantityInStock !== null ? Number(quantityInStock) : undefined,
        minQuantity: minQuantity !== undefined ? (minQuantity !== null && minQuantity !== '' ? Number(minQuantity) : null) : undefined,
        unitPrice: unitPrice !== undefined ? (unitPrice !== null && unitPrice !== '' ? Number(unitPrice) : null) : undefined,
        location: location !== undefined ? (location ? String(location).trim() : null) : undefined,
        supplierName: supplierName !== undefined ? (supplierName ? String(supplierName).trim() : null) : undefined,
        supplierContact: supplierContact !== undefined ? (supplierContact ? String(supplierContact).trim() : null) : undefined,
        note: note !== undefined ? (note ? String(note).trim() : null) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update warehouse item error:', error);
    return NextResponse.json({ error: 'Úprava položky selhala.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });

  await ensureWarehouseSchema();
  const { id } = await params;

  try {
    await prisma.warehouseItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete warehouse item error:', error);
    return NextResponse.json({ error: 'Smazání položky selhalo.' }, { status: 500 });
  }
}
