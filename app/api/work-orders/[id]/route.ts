import { WorkOrderStatus, WorkPriority } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type UpdateInput = { status?: unknown; priority?: unknown; price?: unknown; ftdSent?: unknown; invoiced?: unknown };

function parsePrice(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return false;
  return normalized;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await request.json().catch(() => null) as UpdateInput | null;
  if (!input) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  if (typeof input.status !== 'string' || !Object.values(WorkOrderStatus).includes(input.status as WorkOrderStatus)) {
    return NextResponse.json({ error: 'Vybraný stav není platný.' }, { status: 400 });
  }
  if (input.priority !== undefined && (typeof input.priority !== 'string' || !Object.values(WorkPriority).includes(input.priority as WorkPriority))) {
    return NextResponse.json({ error: 'Vybraná priorita není platná.' }, { status: 400 });
  }
  const price = parsePrice(input.price);
  if (price === false) return NextResponse.json({ error: 'Cena musí být kladné číslo s nejvýše dvěma desetinnými místy.' }, { status: 400 });

  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Pracovní úkol nebyl nalezen.' }, { status: 404 });
  const saved = await prisma.workOrder.update({
    where: { id },
    data: {
      status: input.status as WorkOrderStatus,
      priority: input.priority as WorkPriority | undefined,
      price,
      ftdSent: typeof input.ftdSent === 'boolean' ? input.ftdSent : undefined,
      invoiced: typeof input.invoiced === 'boolean' ? input.invoiced : undefined,
    },
    select: { id: true, status: true, priority: true, price: true, ftdSent: true, invoiced: true },
  });
  return NextResponse.json({ ...saved, price: saved.price?.toString() ?? null });
}
