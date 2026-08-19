import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });

    const { id } = await params;
    const input = await request.json().catch(() => null);
    if (!input || !input.status) {
      return NextResponse.json({ error: 'Neplatný stav úkolu.' }, { status: 400 });
    }

    const existing = await prisma.quickInternalTask.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Úkol nebyl nalezen.' }, { status: 404 });

    const status = input.status as 'COMPLETED' | 'UNRESOLVED' | 'PENDING';

    if (status === 'UNRESOLVED' && (!input.unresolvedReason || !input.unresolvedReason.trim())) {
      return NextResponse.json(
        { error: 'Při označení úkolu jako Nevyřízeno je povinné zadat důvod pro vedoucího.' },
        { status: 400 }
      );
    }

    const updated = await prisma.quickInternalTask.update({
      where: { id },
      data: {
        status,
        ...(status === 'COMPLETED'
          ? {
              completedAt: new Date(),
              completionNote: input.completionNote || null,
              unresolvedReason: null,
            }
          : status === 'UNRESOLVED'
          ? {
              completedAt: null,
              unresolvedReason: input.unresolvedReason.trim(),
            }
          : {
              completedAt: null,
              unresolvedReason: null,
              completionNote: null,
            }),
      },
      include: {
        assignedToEmployee: { select: { id: true, firstName: true, lastName: true, position: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ ok: true, task: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při aktualizaci úkolu.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCurrentUser();
    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Nemáte oprávnění k mazání úkolu.' }, { status: 403 });
    }

    const { id } = await params;
    await prisma.quickInternalTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při mazání úkolu.' }, { status: 500 });
  }
}
