import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Chybí ID položky.' }, { status: 400 });

  try {
    const existing = await prisma.companyShoppingItem.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Položka nebyla nalezena.' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Neplatná data pro úpravu.' }, { status: 400 });
    }

    const data: any = {};
    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim();
    }
    if (body.category && ['OFFICE', 'WORKSHOP'].includes(body.category)) {
      data.category = body.category;
    }
    if (typeof body.quantity !== 'undefined') {
      data.quantity = body.quantity ? String(body.quantity).trim() : null;
    }
    if (typeof body.unit !== 'undefined') {
      data.unit = body.unit ? String(body.unit).trim() : null;
    }
    if (typeof body.store !== 'undefined') {
      data.store = body.store ? String(body.store).trim() : null;
    }
    if (body.priority && ['NORMAL', 'THIS_WEEK', 'URGENT'].includes(body.priority)) {
      data.priority = body.priority;
    }
    if (typeof body.note !== 'undefined') {
      data.note = body.note ? String(body.note).trim() : null;
    }
    if (typeof body.imageUrl !== 'undefined') {
      data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    }
    if (typeof body.receiptUrl !== 'undefined') {
      data.receiptUrl = body.receiptUrl ? String(body.receiptUrl).trim() : null;
    }

    if (typeof body.assignedEmployeeId !== 'undefined') {
      data.assignedEmployeeId = body.assignedEmployeeId || null;
      if (body.assignedEmployeeId) {
        const emp = await prisma.employee.findUnique({
          where: { id: body.assignedEmployeeId },
          select: { firstName: true, lastName: true },
        });
        data.assignedEmployeeName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : null;
      } else {
        data.assignedEmployeeName = null;
      }
    }

    if (typeof body.crmOrderId !== 'undefined') {
      data.crmOrderId = body.crmOrderId || null;
    }

    if (typeof body.pricePaid !== 'undefined') {
      data.pricePaid = body.pricePaid !== null && body.pricePaid !== '' ? parseFloat(body.pricePaid) : null;
    }

    const updated = await prisma.companyShoppingItem.update({
      where: { id },
      data,
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo upravit.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('team');
  if (isApiDenied(auth)) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Chybí ID položky.' }, { status: 400 });

  try {
    await prisma.companyShoppingItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete shopping item:', error);
    return NextResponse.json(
      { error: 'Položku se nepodařilo smazat.' },
      { status: 500 }
    );
  }
}
