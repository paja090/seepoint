import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { parseRateInput } from '@/lib/worker-rates';
import { intervalsOverlap } from '@/lib/rate-intervals';
import { Prisma, RateType, WorkType } from '@prisma/client';

async function assertNoWorkOrderRateConflict(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  candidate: { type: RateType; name: string; workType: WorkType | null; validFrom: Date; validTo: Date | null },
  excludeId?: string
) {
  const conflicts = await tx.workOrderRate.findMany({
    where: {
      workOrderId,
      type: candidate.type,
      workType: candidate.workType,
      ...(candidate.type === 'HOURLY' ? {} : { name: { equals: candidate.name, mode: 'insensitive' } }),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { validFrom: true, validTo: true },
  });

  if (conflicts.some((rate) => intervalsOverlap(rate, candidate))) {
    throw new Error('RATE_CONFLICT');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (!isManagerOrAdmin) {
    return NextResponse.json({ error: 'Sazby může upravovat pouze manažer nebo administrátor.' }, { status: 403 });
  }

  const { id: workOrderId, rateId } = await params;
  const existing = await prisma.workOrderRate.findUnique({
    where: { id: rateId },
  });

  if (!existing || existing.workOrderId !== workOrderId) {
    return NextResponse.json({ error: 'Sazba nebyla nalezena.' }, { status: 404 });
  }

  const raw = await request.json().catch(() => null);
  try {
    if (!raw) throw new Error('Neplatná data.');

    // Support partial updates or full validation
    const merged = {
      type: raw.type || existing.type,
      name: raw.name !== undefined ? raw.name : existing.name,
      workType: raw.workType !== undefined ? raw.workType : existing.workType,
      amount: raw.amount !== undefined ? raw.amount : existing.amount.toString(),
      unit: raw.unit !== undefined ? raw.unit : existing.unit,
      validFrom: raw.validFrom ? new Date(raw.validFrom).toISOString().slice(0, 10) : existing.validFrom.toISOString().slice(0, 10),
      validTo: raw.validTo !== undefined ? (raw.validTo ? new Date(raw.validTo).toISOString().slice(0, 10) : null) : (existing.validTo ? existing.validTo.toISOString().slice(0, 10) : null),
    };

    const data = parseRateInput(merged);

    await prisma.$transaction(async (tx) => {
      await assertNoWorkOrderRateConflict(tx, workOrderId, data, rateId);
      await tx.workOrderRate.update({
        where: { id: rateId },
        data: {
          ...data,
          updatedByUserId: user.id,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === 'RATE_CONFLICT'
            ? 'Sazba se překrývá s jinou aktivní sazbou této zakázky.'
            : error instanceof Error
            ? error.message
            : 'Sazbu se nepodařilo uložit.',
      },
      {
        status: error instanceof Error && error.message === 'RATE_CONFLICT' ? 409 : 400,
      }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (!isManagerOrAdmin) {
    return NextResponse.json({ error: 'Sazby může mazat pouze manažer nebo administrátor.' }, { status: 403 });
  }

  const { id: workOrderId, rateId } = await params;
  const existing = await prisma.workOrderRate.findUnique({
    where: { id: rateId },
  });

  if (!existing || existing.workOrderId !== workOrderId) {
    return NextResponse.json({ error: 'Sazba nebyla nalezena.' }, { status: 404 });
  }

  await prisma.workOrderRate.delete({
    where: { id: rateId },
  });

  return NextResponse.json({ success: true });
}
