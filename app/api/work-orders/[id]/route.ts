import { WorkOrderStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type UpdateInput = { status?: unknown; ftdSent?: unknown; invoiced?: unknown };

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await request.json().catch(() => null) as UpdateInput | null;
  if (!input) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  if (typeof input.status !== 'string' || !Object.values(WorkOrderStatus).includes(input.status as WorkOrderStatus)) {
    return NextResponse.json({ error: 'Vybraný stav není platný.' }, { status: 400 });
  }
  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Pracovní úkol nebyl nalezen.' }, { status: 404 });
  const saved = await prisma.workOrder.update({
    where: { id },
    data: {
      status: input.status as WorkOrderStatus,
      ftdSent: typeof input.ftdSent === 'boolean' ? input.ftdSent : undefined,
      invoiced: typeof input.invoiced === 'boolean' ? input.invoiced : undefined,
    },
    select: { id: true, status: true, ftdSent: true, invoiced: true },
  });
  return NextResponse.json(saved);
}
