import { MediaType, OfferPriceCalculation, OfferPriceCategory, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import { OfferValidationError } from './domain';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export type OfferPriceRuleView = {
  id: string;
  code: string;
  category: OfferPriceCategory;
  label: string;
  description: string | null;
  mediaType: MediaType | null;
  calculation: OfferPriceCalculation;
  unit: string;
  unitPrice: string;
  defaultSelected: boolean;
  active: boolean;
  sortOrder: number;
};

export function serializePriceRule(rule: OfferPriceRuleView | (Omit<OfferPriceRuleView, 'unitPrice'> & { unitPrice: Prisma.Decimal })) {
  return { ...rule, unitPrice: typeof rule.unitPrice === 'string' ? rule.unitPrice : rule.unitPrice.toFixed(2) };
}

export function parsePriceRule(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Data sazby nejsou platná.');
  const input = raw as Record<string, unknown>;
  const code = text(input.code).toUpperCase().replace(/[^A-Z0-9_-]+/g, '_');
  const label = text(input.label);
  const unit = text(input.unit);
  if (!code || !label || !unit) throw new OfferValidationError('Kód, název a jednotka jsou povinné.');
  if (!Object.values(OfferPriceCategory).includes(input.category as OfferPriceCategory)) throw new OfferValidationError('Kategorie sazby není platná.');
  if (!Object.values(OfferPriceCalculation).includes(input.calculation as OfferPriceCalculation)) throw new OfferValidationError('Způsob výpočtu není platný.');
  const mediaType = text(input.mediaType);
  if (mediaType && !Object.values(MediaType).includes(mediaType as MediaType)) throw new OfferValidationError('Typ média není platný.');
  let unitPrice: Prisma.Decimal;
  try { unitPrice = new Prisma.Decimal(text(input.unitPrice).replace(',', '.')); } catch { throw new OfferValidationError('Cena musí být platné číslo.'); }
  if (unitPrice.lt(0)) throw new OfferValidationError('Cena nesmí být záporná.');
  return {
    code,
    category: input.category as OfferPriceCategory,
    label,
    description: text(input.description) || null,
    mediaType: mediaType ? mediaType as MediaType : null,
    calculation: input.calculation as OfferPriceCalculation,
    unit,
    unitPrice: unitPrice.toDecimalPlaces(2),
    defaultSelected: input.defaultSelected === true,
    active: input.active !== false,
    sortOrder: Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
  };
}

export async function listOfferPriceRules(activeOnly = false) {
  const rules = await prisma.offerPriceRule.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
  });
  return rules.map(serializePriceRule);
}

export async function createOfferPriceRule(user: CurrentUser, raw: unknown) {
  if (user.role !== 'ADMIN') throw new OfferValidationError('Ceník může spravovat pouze administrátor.', 'FORBIDDEN');
  const data = parsePriceRule(raw);
  const rule = await prisma.offerPriceRule.create({ data: { ...data, createdByUserId: user.id, updatedByUserId: user.id } });
  return serializePriceRule(rule);
}

export async function updateOfferPriceRule(user: CurrentUser, id: string, raw: unknown) {
  if (user.role !== 'ADMIN') throw new OfferValidationError('Ceník může spravovat pouze administrátor.', 'FORBIDDEN');
  const data = parsePriceRule(raw);
  const rule = await prisma.offerPriceRule.update({ where: { id }, data: { ...data, updatedByUserId: user.id } });
  return serializePriceRule(rule);
}
