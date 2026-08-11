import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Nejste přihlášeni' }, { status: 401 });
    }

    const workOrderId = (await params).id;
    const workerName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.email;

    // Find assignment for this workOrder and user
    const assignment = await prisma.workAssignment.findFirst({
      where: {
        workOrderId,
        OR: [
          { userId: user.id },
          { workerName: { contains: user.name || '', mode: 'insensitive' } },
        ],
      },
    });

    if (assignment) {
      await prisma.workAssignment.update({
        where: { id: assignment.id },
        data: {
          acknowledgedAt: new Date(),
          userId: user.id,
        },
      });
    } else {
      // Create acknowledgment assignment if none existed
      await prisma.workAssignment.create({
        data: {
          workOrderId,
          userId: user.id,
          workerName: workerName || user.name || 'Pracovník',
          acknowledgedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, acknowledgedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Work order acknowledgment error:', error);
    return NextResponse.json({ error: 'Chyba při potvrzování úkolu' }, { status: 500 });
  }
}
