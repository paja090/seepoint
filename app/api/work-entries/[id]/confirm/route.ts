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

  try {
    const confirmed = await prisma.$transaction(async (tx) => {
      const entry = await tx.workEntry.findUnique({
        where: { id },
        include: {
          employee: true,
          workTask: true,
        },
      });

      if (!entry) {
        throw new Error('NOT_FOUND');
      }

      // 2. Validate current status
      if (entry.status === 'CONFIRMED') {
        throw new Error('ALREADY_CONFIRMED');
      }

      // 3. Validation before confirmation
      if (!entry.appliedUnitRate) {
        throw new Error('MISSING_RATE');
      }

      if (entry.quantity.lte(0)) {
        throw new Error('INVALID_QUANTITY');
      }

      if (!entry.employeeId || !entry.workTaskId) {
        throw new Error('INVALID_DATA');
      }

      // Verify and recalculate amount to prevent any front-end tampering
      const expectedAmount = entry.quantity.mul(entry.appliedUnitRate);

      // 4. Update status to CONFIRMED using conditional query (status: 'DRAFT')
      // This protects against concurrent changes
      return tx.workEntry.update({
        where: { id, status: 'DRAFT' },
        data: {
          status: 'CONFIRMED',
          calculatedAmount: expectedAmount,
        },
      });
    });

    return NextResponse.json({
      id: confirmed.id,
      status: confirmed.status,
      quantity: confirmed.quantity.toString(),
      appliedUnitRate: confirmed.appliedUnitRate?.toString() ?? null,
      calculatedAmount: confirmed.calculatedAmount.toString(),
    });

  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
    }
    if (err.message === 'ALREADY_CONFIRMED') {
      return NextResponse.json({ error: 'Tento záznam práce je již potvrzen.' }, { status: 400 });
    }
    if (err.message === 'MISSING_RATE') {
      return NextResponse.json({ error: 'Záznam práce nelze potvrdit, protože chybí jednotková sazba.' }, { status: 400 });
    }
    if (err.message === 'INVALID_QUANTITY') {
      return NextResponse.json({ error: 'Záznam práce nelze potvrdit s nulovým nebo záporným množstvím.' }, { status: 400 });
    }
    if (err.message === 'INVALID_DATA') {
      return NextResponse.json({ error: 'Záznam práce obsahuje neplatná data.' }, { status: 400 });
    }
    // Prisma record not found error (P2025) means the conditional update (status: 'DRAFT') failed
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Záznam práce se nepodařilo potvrdit. Pravděpodobně byl již potvrzen nebo upraven v jiném požadavku.' }, { status: 409 });
    }
    return NextResponse.json({ error: err.message || 'Nastala chyba při potvrzování záznamu.' }, { status: 500 });
  }
}
