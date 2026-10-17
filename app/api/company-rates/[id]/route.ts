import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { parseRateInput } from '@/lib/worker-rates';
import { intervalsOverlap } from '@/lib/rate-intervals';
import { Prisma, RateType, WorkType } from '@prisma/client';

async function assertNoCompanyRateConflict(
  tx: Prisma.TransactionClient,
  candidate: { type: RateType; name: string; workType: WorkType | null; validFrom: Date; validTo: Date | null },
  excludeId?: string
) {
  const conflicts = await tx.companyRate.findMany({
    where: {
      type: candidate.type,
      workType: candidate.workType,
      name: { equals: candidate.name, mode: 'insensitive' },
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { validFrom: true, validTo: true },
  });

  if (conflicts.some((rate) => intervalsOverlap(rate, candidate))) {
    throw new Error('RATE_CONFLICT');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries', 'settlements', 'mySettlements', 'settings']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Sazby může spravovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  const { id: rateId } = await params;
  const old = await prisma.companyRate.findUnique({
    where: { id: rateId },
  });

  if (!old) {
    return NextResponse.json({ error: 'Sazba nebyla nalezena.' }, { status: 404 });
  }

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (!raw) throw new Error('Neplatná data.');

    if (raw.action === 'end' || (raw.validTo && !raw.name)) {
      const validTo = new Date(String(raw.validTo ?? new Date().toISOString().slice(0, 10)));
      if (Number.isNaN(validTo.getTime()) || validTo < old.validFrom) {
        throw new Error('Zadejte platné datum ukončení.');
      }
      await prisma.companyRate.update({
        where: { id: rateId },
        data: {
          validTo,
          isActive: false,
          updatedByUserId: user.id,
        },
      });
      return NextResponse.json({ ok: true });
    }

    const data = parseRateInput(raw);
    const amountChanged = !old.amount.equals(data.amount) || old.currency !== data.currency;

    if (amountChanged && data.validFrom > old.validFrom) {
      const previousEnd = new Date(data.validFrom);
      previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

      await prisma.$transaction(
        async (tx) => {
          await assertNoCompanyRateConflict(tx, data, rateId);
          await tx.companyRate.update({
            where: { id: rateId },
            data: {
              validTo: previousEnd,
              isActive: false,
              updatedByUserId: user.id,
            },
          });
          await tx.companyRate.create({
            data: {
              ...data,
              createdByUserId: user.id,
              updatedByUserId: user.id,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return NextResponse.json({ versioned: true });
    }

    await prisma.$transaction(
      async (tx) => {
        await assertNoCompanyRateConflict(tx, data, rateId);
        await tx.companyRate.update({
          where: { id: rateId },
          data: {
            name: data.name,
            type: data.type,
            amount: data.amount,
            workType: data.workType,
            unit: data.unit,
            note: data.note,
            validFrom: data.validFrom,
            validTo: data.validTo,
            isActive: true,
            updatedByUserId: user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === 'RATE_CONFLICT'
            ? 'Sazba se překrývá s jinou aktivní firemní sazbou stejného typu a práce.'
            : error instanceof Error
            ? error.message
            : 'Sazbu se nepodařilo změnit.',
      },
      {
        status: error instanceof Error && error.message === 'RATE_CONFLICT' ? 409 : 400,
      }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries', 'settlements', 'mySettlements', 'settings']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Sazby může mazat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  const { id: rateId } = await params;
  const existing = await prisma.companyRate.findUnique({ where: { id: rateId } });
  if (!existing) {
    return NextResponse.json({ error: 'Sazba nebyla nalezena.' }, { status: 404 });
  }

  await prisma.companyRate.delete({ where: { id: rateId } });
  return NextResponse.json({ ok: true });
}
