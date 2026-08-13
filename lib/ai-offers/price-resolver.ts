import type { ClientPricingSegment, MediaType, OfferPriceCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AiPriceSnapshot } from './types';

export async function resolveCatalogPrice(input: {
  pricingSegment: ClientPricingSegment;
  mediaType: MediaType;
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
      ],
    },
    orderBy: [{ city: 'desc' }, { mediaType: 'desc' }, { validFrom: 'desc' }, { sortOrder: 'asc' }],
  });
  const rule = rules[0];
  return rule ? {
    ruleId: rule.id, code: rule.code, category: rule.category, unit: rule.unit,
    unitPrice: rule.unitPrice.toNumber(), validFrom: rule.validFrom?.toISOString() ?? null, validTo: rule.validTo?.toISOString() ?? null,
  } : null;
}
