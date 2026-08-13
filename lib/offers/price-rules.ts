import { ClientPricingSegment, MediaType, OfferPriceCalculation, OfferPriceCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import { OfferValidationError } from './domain';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export type OfferPriceRuleView = {
  id: string; code: string; category: OfferPriceCategory; label: string; description: string | null;
  mediaType: MediaType | null; pricingSegment: ClientPricingSegment; city: string | null;
  validFrom: Date | null; validTo: Date | null; minDurationMonths: number | null; maxDurationMonths: number | null;
  calculation: OfferPriceCalculation; unit: string; unitPrice: string; defaultSelected: boolean; active: boolean; sortOrder: number;
};

export function serializePriceRule(rule: OfferPriceRuleView | (Omit<OfferPriceRuleView, 'unitPrice'> & { unitPrice: Prisma.Decimal })) {
  return { ...rule, unitPrice: typeof rule.unitPrice === 'string' ? rule.unitPrice : rule.unitPrice.toFixed(2), validFrom: rule.validFrom?.toISOString().slice(0, 10) ?? null, validTo: rule.validTo?.toISOString().slice(0, 10) ?? null };
}

export function parsePriceRule(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Data sazby nejsou platná.');
  const input = raw as Record<string, unknown>;
  const code = text(input.code).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
  const label = text(input.label); const unit = text(input.unit);
  if (!code || !label || !unit) throw new OfferValidationError('Kód, název a jednotka jsou povinné.');
  if (!Object.values(OfferPriceCategory).includes(input.category as OfferPriceCategory)) throw new OfferValidationError('Kategorie sazby není platná.');
  if (!Object.values(OfferPriceCalculation).includes(input.calculation as OfferPriceCalculation)) throw new OfferValidationError('Způsob výpočtu není platný.');
  const mediaType = text(input.mediaType);
  if (mediaType && !Object.values(MediaType).includes(mediaType as MediaType)) throw new OfferValidationError('Typ média není platný.');
  const pricingSegment = text(input.pricingSegment) || 'COMMERCIAL';
  if (!Object.values(ClientPricingSegment).includes(pricingSegment as ClientPricingSegment)) throw new OfferValidationError('Cenový segment není platný.');
  const parseDate = (value: unknown, labelText: string) => {
    const rawDate = text(value); if (!rawDate) return null;
    const parsed = new Date(`${rawDate}T00:00:00.000Z`); if (Number.isNaN(parsed.getTime())) throw new OfferValidationError(`${labelText} není platné datum.`); return parsed;
  };
  const validFrom = parseDate(input.validFrom, 'Platnost od'); const validTo = parseDate(input.validTo, 'Platnost do');
  if (validFrom && validTo && validFrom > validTo) throw new OfferValidationError('Platnost od musí být před platností do.');
  const minDurationMonths = input.minDurationMonths === '' || input.minDurationMonths == null ? null : Number(input.minDurationMonths);
  const maxDurationMonths = input.maxDurationMonths === '' || input.maxDurationMonths == null ? null : Number(input.maxDurationMonths);
  if ((minDurationMonths !== null && (!Number.isInteger(minDurationMonths) || minDurationMonths < 1)) || (maxDurationMonths !== null && (!Number.isInteger(maxDurationMonths) || maxDurationMonths < 1))) throw new OfferValidationError('Délka kampaně musí být kladný počet měsíců.');
  let unitPrice: Prisma.Decimal;
  try { unitPrice = new Prisma.Decimal(text(input.unitPrice).replace(',', '.')); } catch { throw new OfferValidationError('Cena musí být platné číslo.'); }
  if (unitPrice.lt(0)) throw new OfferValidationError('Cena nesmí být záporná.');
  return {
    code, category: input.category as OfferPriceCategory, label, description: text(input.description) || null,
    mediaType: mediaType ? mediaType as MediaType : null, pricingSegment: pricingSegment as ClientPricingSegment,
    city: text(input.city) || null, validFrom, validTo, minDurationMonths, maxDurationMonths,
    calculation: input.calculation as OfferPriceCalculation, unit, unitPrice: unitPrice.toDecimalPlaces(2),
    defaultSelected: input.defaultSelected === true, active: input.active !== false,
    sortOrder: Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
  };
}

export async function listOfferPriceRules(activeOnly = false) {
  const rules = await prisma.offerPriceRule.findMany({ where: activeOnly ? { active: true } : undefined, orderBy: [{ pricingSegment: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }] });
  return rules.map(serializePriceRule);
}

export async function createOfferPriceRule(user: CurrentUser, raw: unknown) {
  if (user.role !== 'ADMIN') throw new OfferValidationError('Ceník může spravovat pouze administrátor.', 'FORBIDDEN');
  const data = parsePriceRule(raw);
  return serializePriceRule(await prisma.offerPriceRule.create({ data: { ...data, createdByUserId: user.id, updatedByUserId: user.id } }));
}

export async function updateOfferPriceRule(user: CurrentUser, id: string, raw: unknown) {
  if (user.role !== 'ADMIN') throw new OfferValidationError('Ceník může spravovat pouze administrátor.', 'FORBIDDEN');
  const data = parsePriceRule(raw);
  return serializePriceRule(await prisma.offerPriceRule.update({ where: { id }, data: { ...data, updatedByUserId: user.id } }));
}
