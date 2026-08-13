import type { ClientPricingSegment, MediaType, MountingType, OfferPriceCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AiPriceSnapshot } from './types';

export async function resolveCatalogPrice(input: {
  pricingSegment: ClientPricingSegment;
  mediaType: MediaType;
  mountingType?: MountingType;
  category: OfferPriceCategory;
  city?: string;
  effectiveDate: Date;
  durationMonths: number;
}, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<AiPriceSnapshot | null> {
  const rules = await db.offerPriceRule.findMany({
    where: {
      active: true,
      pricingSegment: input.pricingSegment,
      category: input.category,
      OR: [{ mediaType: input.mediaType }, { mediaType: null }],
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: input.effectiveDate } }] },
        { OR: [{ validTo: null }, { validTo: { gte: input.effectiveDate } }] },
        { OR: [{ minDurationMonths: null }, { minDurationMonths: { lte: input.durationMonths } }] },
        { OR: [{ maxDurationMonths: null }, { maxDurationMonths: { gte: input.durationMonths } }] },
        ...(input.city ? [{ OR: [{ city: null }, { city: { equals: input.city, mode: 'insensitive' as const } }] }] : [{ city: null }]),
        ...(input.mountingType ? [{ OR: [{ mountingType: null }, { mountingType: input.mountingType }] }] : [{ mountingType: null }]),
      ],
    },
    orderBy: [{ validFrom: 'desc' }, { sortOrder: 'asc' }],
  });
  const normalizedCity = input.city?.trim().toLocaleLowerCase('cs') ?? '';
  const rule = rules.sort((left, right) => {
    const score = (candidate: typeof left) =>
      (candidate.city?.toLocaleLowerCase('cs') === normalizedCity ? 4 : 0)
      + (candidate.mediaType === input.mediaType ? 2 : 0)
      + (candidate.mountingType === input.mountingType ? 1 : 0);
    return score(right) - score(left);
  })[0];
  return rule ? {
    ruleId: rule.id, code: rule.code, category: rule.category, unit: rule.unit,
    unitPrice: rule.unitPrice.toNumber(), validFrom: rule.validFrom?.toISOString() ?? null, validTo: rule.validTo?.toISOString() ?? null,
    mountingType: rule.mountingType,
  } : null;
}
