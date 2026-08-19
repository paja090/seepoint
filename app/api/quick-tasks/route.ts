import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const assignedEmployeeId = searchParams.get('assignedEmployeeId');
    const status = searchParams.get('status');

    const tasks = await prisma.quickInternalTask.findMany({
      where: {
        ...(assignedEmployeeId ? { assignedToEmployeeId: assignedEmployeeId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        assignedToEmployee: { select: { id: true, firstName: true, lastName: true, position: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ ok: true, tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při načítání rychlých úkolů.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });

    const input = await request.json().catch(() => null);
    if (!input || !input.title || !input.assignedToEmployeeId) {
      return NextResponse.json({ error: 'Zadejte název úkolu a přiřazeného zaměstnance.' }, { status: 400 });
    }

    const task = await prisma.quickInternalTask.create({
      data: {
        title: input.title,
        description: input.description || null,
        assignedToEmployeeId: input.assignedToEmployeeId,
        createdByUserId: actor.id,
        priority: input.priority || 'MEDIUM',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: 'PENDING',
      },
      include: {
        assignedToEmployee: { select: { id: true, firstName: true, lastName: true, position: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ ok: true, task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při vytváření úkolu.' }, { status: 500 });
  }
}
