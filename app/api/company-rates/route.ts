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

export async function POST(request: Request) {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries', 'settlements', 'mySettlements', 'settings']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Sazby může spravovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (!raw) throw new Error('Neplatná data.');
    const data = parseRateInput({
      ...raw,
      validFrom: raw.validFrom || new Date().toISOString().slice(0, 10),
    });
    const allowUpsert = Boolean(raw.upsert);

    const rate = await prisma.$transaction(
      async (tx) => {
        if (allowUpsert) {
          const existing = await tx.companyRate.findFirst({
            where: {
              type: data.type,
              name: { equals: data.name, mode: 'insensitive' },
              isActive: true,
            },
            orderBy: { validFrom: 'desc' },
          });

          if (existing) {
            return tx.companyRate.update({
              where: { id: existing.id },
              data: {
                amount: data.amount,
                unit: data.unit,
                workType: data.workType,
                carrierTypeLabel: data.carrierTypeLabel || data.name,
                note: data.note,
                updatedByUserId: user.id,
              },
            });
          }
        }

        await assertNoCompanyRateConflict(tx, data);
        return tx.companyRate.create({
          data: {
            ...data,
            carrierTypeLabel: data.carrierTypeLabel || data.name,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      {
        id: rate.id,
        type: rate.type,
        name: rate.name,
        workType: rate.workType,
        carrierTypeLabel: rate.carrierTypeLabel,
        amount: rate.amount.toString(),
        unit: rate.unit || (rate.type === 'HOURLY' ? 'hod' : 'ks'),
        validFrom: rate.validFrom.toISOString(),
        validTo: rate.validTo ? rate.validTo.toISOString() : null,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === 'RATE_CONFLICT'
            ? 'Sazba se překrývá s jinou aktivní firemní sazbou stejného názvu a typu.'
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

export async function GET() {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries', 'settlements', 'mySettlements', 'settings']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const rates = await prisma.companyRate.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }, { validFrom: 'desc' }],
  });

  const formatted = rates.map((rate) => ({
    ...rate,
    amount: rate.amount.toString(),
  }));

  return NextResponse.json(formatted);
}
