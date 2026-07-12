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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id: workOrderId } = await params;
  const rates = await prisma.workOrderRate.findMany({
    where: { workOrderId },
    orderBy: { validFrom: 'desc' },
  });

  const formatted = rates.map((rate) => ({
    ...rate,
    amount: rate.amount.toString(),
  }));

  return NextResponse.json(formatted);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (!isManagerOrAdmin) {
    return NextResponse.json({ error: 'Sazby zakázky může spravovat pouze manažer nebo administrátor.' }, { status: 403 });
  }

  const { id: workOrderId } = await params;
  const raw = await request.json().catch(() => null);
  try {
    if (!raw) throw new Error('Neplatná data.');
    const data = parseRateInput(raw);

    const rate = await prisma.$transaction(async (tx) => {
      await assertNoWorkOrderRateConflict(tx, workOrderId, data);
      return tx.workOrderRate.create({
        data: {
          ...data,
          workOrderId,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ id: rate.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === 'RATE_CONFLICT'
            ? 'Sazba se překrývá s jinou aktivní sazbou této zakázky stejného typu a práce.'
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
