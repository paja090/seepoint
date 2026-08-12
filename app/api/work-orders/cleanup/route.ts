import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST() {
  const auth = await requireApiAccess('work');
  if (isApiDenied(auth)) return auth;

  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);

    // Find old completed or cancelled work orders
    const oldOrders = await prisma.workOrder.findMany({
      where: {
        status: { in: ['DONE', 'CANCELLED'] },
        scheduledAt: { lt: cutoffDate },
      },
      select: { id: true },
    });

    const oldOrderIds = oldOrders.map((o) => o.id);

    if (oldOrderIds.length === 0) {
      return NextResponse.json({
        message: 'Žádné staré dokončené úkoly k vyčištění nebyly nalezeny.',
        cleanedCount: 0,
      });
    }

    // Delete associated assignments, tasks, items first
    await prisma.$transaction([
      prisma.workAssignment.deleteMany({
        where: { workOrderId: { in: oldOrderIds } },
      }),
      prisma.workTask.deleteMany({
        where: { workOrderId: { in: oldOrderIds } },
      }),
      prisma.workOrderItem.deleteMany({
        where: { workOrderId: { in: oldOrderIds } },
      }),
      prisma.workOrder.deleteMany({
        where: { id: { in: oldOrderIds } },
      }),
    ]);

    return NextResponse.json({
      message: `Úspěšně vyčištěno ${oldOrderIds.length} starých dokončených úkolů z databáze.`,
      cleanedCount: oldOrderIds.length,
    });
  } catch (error) {
    console.error('Failed to cleanup old work orders:', error);
    return NextResponse.json(
      { error: 'Vyčištění databáze se nepodařilo.' },
      { status: 500 }
    );
  }
}
