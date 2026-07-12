import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  // 1. Authorization: Only MANAGER or ADMIN can confirm work entries
  const isAuthorized = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Nemáte oprávnění potvrdit záznam práce.' }, { status: 403 });
  }

  const { id } = await params;
  const entry = await prisma.workEntry.findUnique({
    where: { id },
    include: {
      employee: true,
      workTask: true,
    },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
  }

  // 2. Validate current status
  if (entry.status === 'CONFIRMED') {
    return NextResponse.json({ error: 'Tento záznam práce je již potvrzen.' }, { status: 400 });
  }

  // 3. Validation before confirmation
  if (!entry.appliedUnitRate) {
    return NextResponse.json({ error: 'Záznam práce nelze potvrdit, protože chybí jednotková sazba.' }, { status: 400 });
  }

  if (entry.quantity.lte(0)) {
    return NextResponse.json({ error: 'Záznam práce nelze potvrdit s nulovým nebo záporným množstvím.' }, { status: 400 });
  }

  if (!entry.employeeId || !entry.workTaskId) {
    return NextResponse.json({ error: 'Záznam práce obsahuje neplatná data.' }, { status: 400 });
  }

  // Verify and recalculate amount to prevent any front-end tampering
  const expectedAmount = entry.quantity.mul(entry.appliedUnitRate);
  if (!entry.calculatedAmount.equals(expectedAmount)) {
    // Correct it on the server if it differs
    await prisma.workEntry.update({
      where: { id },
      data: { calculatedAmount: expectedAmount },
    });
  }

  // 4. Update status to CONFIRMED
  const confirmed = await prisma.workEntry.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
    },
  });

  return NextResponse.json({
    id: confirmed.id,
    status: confirmed.status,
    quantity: confirmed.quantity.toString(),
    appliedUnitRate: confirmed.appliedUnitRate?.toString() ?? null,
    calculatedAmount: confirmed.calculatedAmount.toString(),
  });
}
