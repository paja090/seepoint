import { Prisma } from '@prisma/client';
import type { AppRole, CurrentUser } from '@/lib/rbac';

export const OFFER_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type OfferStatusValue = typeof OFFER_STATUSES[number];

export type OfferItemInput = {
  surfaceId: string;
  dateFrom: string;
  dateTo: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
  discountAmount: string;
  note?: string;
  groupLabel?: string;
  customTitle?: string;
  clientDescription?: string;
};

export type OfferInput = {
  clientId: string;
  title: string;
  campaignName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  campaignGoal?: string;
  budget?: string;
  validUntil?: string;
  internalNote?: string;
  clientMessage?: string;
  taxRate: string;
  confirmNegotiation: boolean;
  packageId?: string;
  items: OfferItemInput[];
  chargeSelections: Array<{ priceRuleId: string; quantity: string }>;
};

export type OfferChargeInput = {
  priceRuleId: string;
  category: 'RENTAL' | 'PRODUCTION' | 'SERVICE';
  code: string;
  label: string;
  description?: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  sortOrder: number;
};

export type CalculatedCharge = OfferChargeInput & { subtotal: string };

export type CalculatedItem = OfferItemInput & {
  baseAmount: string;
  calculatedDiscount: string;
  subtotal: string;
};

export type OfferTotals = {
  subtotalBeforeDiscount: string;
  discountAmount: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  totalWithTax: string;
};

export class OfferValidationError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(message: string, code = 'VALIDATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'OfferValidationError';
    this.code = code;
    this.details = details;
  }
}

export class OfferAvailabilityError extends OfferValidationError {
  readonly conflicts: unknown[];
  constructor(message: string, conflicts: unknown[], code = 'OFFER_CONFLICT') {
    super(message, code, conflicts);
    this.name = 'OfferAvailabilityError';
    this.conflicts = conflicts;
  }
}

const TWO_PLACES = 2;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const decimal = (value: unknown, label: string, fallback?: string) => {
  const normalized = value === undefined || value === null || value === '' ? fallback : String(value).replace(',', '.');
  if (normalized === undefined) throw new OfferValidationError(`${label} je povinné.`);
  try {
    return new Prisma.Decimal(normalized);
  } catch {
    throw new OfferValidationError(`${label} musí být platné číslo.`);
  }
};
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(TWO_PLACES, Prisma.Decimal.ROUND_HALF_UP);
const moneyString = (value: Prisma.Decimal) => money(value).toFixed(TWO_PLACES);

export function parseDateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new OfferValidationError(`${label} musí být platné datum.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new OfferValidationError(`${label} musí být platné datum.`);
  }
  return date;
}

export function normalizeOfferInput(raw: unknown): OfferInput {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Tělo požadavku není platné.');
  const input = raw as Record<string, unknown>;
  const rows = Array.isArray(input.items) ? input.items : [];
  const rawCharges = Array.isArray(input.chargeSelections) ? input.chargeSelections : [];
  const items = rows.map((rawItem, index): OfferItemInput => {
    if (!rawItem || typeof rawItem !== 'object') throw new OfferValidationError(`Položka ${index + 1} není platná.`);
    const item = rawItem as Record<string, unknown>;
    const dateFrom = text(item.dateFrom);
    const dateTo = text(item.dateTo);
    parseDateOnly(dateFrom, `Začátek položky ${index + 1}`);
    parseDateOnly(dateTo, `Konec položky ${index + 1}`);
    if (dateFrom > dateTo) throw new OfferValidationError(`U položky ${index + 1} musí být datum od před datem do.`);
    return {
      surfaceId: text(item.surfaceId),
      dateFrom,
      dateTo,
      quantity: text(item.quantity) || '1',
      unit: text(item.unit) || 'plocha',
      unitPrice: text(item.unitPrice ?? item.price) || '0',
      discountPercent: text(item.discountPercent) || '0',
      discountAmount: text(item.discountAmount) || '0',
      note: text(item.note) || undefined,
      groupLabel: text(item.groupLabel) || undefined,
      customTitle: text(item.customTitle) || undefined,
      clientDescription: text(item.clientDescription) || undefined,
    };
  });

  const clientId = text(input.clientId);
  const title = text(input.title);
  if (!clientId) throw new OfferValidationError('Vyberte klienta.');
  if (!title) throw new OfferValidationError('Zadejte interní název nabídky.');
  if (items.length === 0) throw new OfferValidationError('Přidejte alespoň jednu reklamní plochu.', 'EMPTY_OFFER');
  if (items.some((item) => !item.surfaceId)) throw new OfferValidationError('Každá položka musí obsahovat reklamní plochu.');
  const ids = items.map((item) => item.surfaceId);
  if (new Set(ids).size !== ids.length) throw new OfferValidationError('Jedna reklamní plocha nesmí být v nabídce vícekrát.', 'DUPLICATE_SURFACE');

  const validUntil = text(input.validUntil);
  if (validUntil) parseDateOnly(validUntil, 'Platnost nabídky');
  const budgetInput = text(input.budget);
  const normalizedBudget = budgetInput ? decimal(budgetInput, 'Rozpočet') : null;
  if (normalizedBudget?.lt(0)) throw new OfferValidationError('Rozpočet nesmí být záporný.');
  const contactEmail = text(input.contactEmail);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new OfferValidationError('Kontaktní e-mail není platný.');

  return {
    clientId,
    title,
    campaignName: text(input.campaignName) || undefined,
    contactPerson: text(input.contactPerson) || undefined,
    contactEmail: contactEmail || undefined,
    contactPhone: text(input.contactPhone) || undefined,
    campaignGoal: text(input.campaignGoal) || undefined,
    budget: normalizedBudget?.toFixed(2),
    validUntil: validUntil || undefined,
    internalNote: text(input.internalNote ?? input.note) || undefined,
    clientMessage: text(input.clientMessage) || undefined,
    taxRate: text(input.taxRate) || '21',
    confirmNegotiation: input.confirmNegotiation === true,
    packageId: text(input.packageId) || undefined,
    items,
    chargeSelections: rawCharges.map((rawCharge, index) => {
      if (!rawCharge || typeof rawCharge !== 'object') throw new OfferValidationError(`Doplňková položka ${index + 1} není platná.`);
      const charge = rawCharge as Record<string, unknown>;
      const priceRuleId = text(charge.priceRuleId);
      const quantity = decimal(charge.quantity, `Množství doplňkové položky ${index + 1}`, '1');
      if (!priceRuleId || quantity.lte(0)) throw new OfferValidationError(`Doplňková položka ${index + 1} není platná.`);
      return { priceRuleId, quantity: quantity.toFixed(2) };
    }),
  };
}

export function calculateItem(input: OfferItemInput): CalculatedItem {
  const quantity = decimal(input.quantity, 'Množství');
  const unitPrice = decimal(input.unitPrice, 'Jednotková cena');
  const discountPercent = decimal(input.discountPercent, 'Sleva v procentech', '0');
  const fixedDiscount = decimal(input.discountAmount, 'Sleva v částce', '0');
  if (quantity.lte(0)) throw new OfferValidationError('Množství musí být větší než nula.');
  if (unitPrice.lt(0) || fixedDiscount.lt(0)) throw new OfferValidationError('Cena ani sleva nesmí být záporná.');
  if (discountPercent.lt(0) || discountPercent.gt(100)) throw new OfferValidationError('Sleva musí být v rozsahu 0–100 %.');
  const base = money(quantity.mul(unitPrice));
  const percentageDiscount = money(base.mul(discountPercent).div(100));
  const totalDiscount = money(percentageDiscount.add(fixedDiscount));
  if (totalDiscount.gt(base)) throw new OfferValidationError('Sleva nesmí být vyšší než cena položky.');
  return {
    ...input,
    quantity: quantity.toFixed(2),
    unitPrice: moneyString(unitPrice),
    discountPercent: discountPercent.toFixed(2),
    discountAmount: moneyString(fixedDiscount),
    baseAmount: moneyString(base),
    calculatedDiscount: moneyString(totalDiscount),
    subtotal: moneyString(base.sub(totalDiscount)),
  };
}

export function calculateOffer(items: OfferItemInput[], taxRateInput: string, charges: OfferChargeInput[] = []) {
  const taxRate = decimal(taxRateInput, 'Sazba DPH', '21');
  if (taxRate.lt(0) || taxRate.gt(100)) throw new OfferValidationError('Sazba DPH musí být v rozsahu 0–100 %.');
  const calculatedItems = items.map(calculateItem);
  const calculatedCharges = charges.map((charge): CalculatedCharge => {
    const quantity = decimal(charge.quantity, 'Množství doplňkové položky');
    const unitPrice = decimal(charge.unitPrice, 'Cena doplňkové položky');
    if (quantity.lte(0) || unitPrice.lt(0)) throw new OfferValidationError('Doplňková položka má neplatnou cenu nebo množství.');
    return { ...charge, quantity: quantity.toFixed(2), unitPrice: moneyString(unitPrice), subtotal: moneyString(quantity.mul(unitPrice)) };
  });
  const itemBase = calculatedItems.reduce((sum, item) => sum.add(item.baseAmount), new Prisma.Decimal(0));
  const chargeBase = calculatedCharges.reduce((sum, charge) => sum.add(charge.subtotal), new Prisma.Decimal(0));
  const beforeDiscount = itemBase.add(chargeBase);
  const discounts = calculatedItems.reduce((sum, item) => sum.add(item.calculatedDiscount), new Prisma.Decimal(0));
  const subtotal = money(beforeDiscount.sub(discounts));
  const taxAmount = money(subtotal.mul(taxRate).div(100));
  const totals: OfferTotals = {
    subtotalBeforeDiscount: moneyString(beforeDiscount),
    discountAmount: moneyString(discounts),
    subtotal: moneyString(subtotal),
    taxRate: taxRate.toFixed(2),
    taxAmount: moneyString(taxAmount),
    totalWithTax: moneyString(subtotal.add(taxAmount)),
  };
  return { items: calculatedItems, charges: calculatedCharges, totals };
}

export function recoverFixedDiscount(
  quantityInput: string,
  unitPriceInput: string,
  discountPercentInput: string,
  calculatedDiscountInput: string | null | undefined,
) {
  if (!calculatedDiscountInput) return '0.00';
  const quantity = decimal(quantityInput, 'Množství');
  const unitPrice = decimal(unitPriceInput, 'Jednotková cena');
  const discountPercent = decimal(discountPercentInput, 'Sleva v procentech', '0');
  const calculatedDiscount = money(decimal(calculatedDiscountInput, 'Sleva v částce'));
  const base = money(quantity.mul(unitPrice));
  const percentageDiscount = money(base.mul(discountPercent).div(100));
  const fixedDiscount = money(calculatedDiscount.sub(percentageDiscount));
  return moneyString(fixedDiscount.gt(0) ? fixedDiscount : new Prisma.Decimal(0));
}

const TRANSITIONS: Record<OfferStatusValue, OfferStatusValue[]> = {
  DRAFT: ['SENT', 'EXPIRED'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransitionOffer(from: OfferStatusValue, to: OfferStatusValue) {
  return TRANSITIONS[from].includes(to);
}

export function assertOfferTransition(from: OfferStatusValue, to: OfferStatusValue) {
  if (!canTransitionOffer(from, to)) throw new OfferValidationError(`Přechod stavu ${from} → ${to} není povolen.`, 'INVALID_STATUS_TRANSITION');
}

export function canManageOfferRole(role: AppRole) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'SALES';
}

export function canConvertOfferRole(role: AppRole) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function canAccessOffer(user: CurrentUser, createdByUserId: string | null) {
  return user.role === 'ADMIN' || user.role === 'MANAGER' || (user.role === 'SALES' && (!createdByUserId || createdByUserId === user.id));
}

export function serverOfferAuthor(user: CurrentUser) {
  return { createdBy: user.name, createdByUserId: user.id, updatedByUserId: user.id };
}

export function planOfferConversion(offerSurfaceIds: string[], existingSurfaceIds: string[]) {
  const uniqueOfferIds = new Set(offerSurfaceIds);
  const uniqueExistingIds = new Set(existingSurfaceIds);
  if (uniqueExistingIds.size === uniqueOfferIds.size && [...uniqueOfferIds].every((id) => uniqueExistingIds.has(id))) return 'idempotent' as const;
  if (uniqueExistingIds.size > 0) throw new OfferValidationError('Nabídka je převedena pouze částečně; je nutný ruční audit před opakováním.', 'PARTIAL_CONVERSION');
  return 'create' as const;
}

export function cloneOfferInput(source: OfferInput): OfferInput {
  return { ...source, title: `Kopie – ${source.title}`, items: source.items.map((item) => ({ ...item })), chargeSelections: source.chargeSelections.map((charge) => ({ ...charge })) };
}

export function assertAvailability(conflicts: Array<{ severity: 'block' | 'warning' }>, confirmNegotiation: boolean) {
  const blocking = conflicts.filter((conflict) => conflict.severity === 'block');
  if (blocking.length) throw new OfferAvailabilityError('Vybrané plochy jsou v termínu obsazené nebo rezervované.', blocking);
  if (conflicts.length && !confirmNegotiation) throw new OfferAvailabilityError('Vybrané plochy jsou v jednání. Pokračování vyžaduje výslovné potvrzení.', conflicts, 'NEGOTIATION_CONFIRMATION_REQUIRED');
}

export function stripPublicOfferSecrets<T extends Record<string, unknown>>(source: T): T {
  const result: Record<string, unknown> = { ...source };
  for (const key of ['id', 'clientId', 'internalNote', 'budget', 'events', 'converted', 'archivedAt', 'hasPublicLink', 'contactPerson', 'contactEmail', 'contactPhone']) delete result[key];
  if (result.createdBy && typeof result.createdBy === 'object') { const author = { ...(result.createdBy as Record<string, unknown>) }; delete author.id; delete author.email; result.createdBy = author; }
  if (result.client && typeof result.client === 'object') { const client = { ...(result.client as Record<string, unknown>) }; for (const key of ['companyId', 'contactPerson', 'email', 'phone']) delete client[key]; result.client = client; }
  if (Array.isArray(result.items)) result.items = result.items.map((raw) => { const item = { ...(raw as Record<string, unknown>) }; delete item.id; delete item.surfaceId; delete item.note; if (item.surface && typeof item.surface === 'object') { const surface = { ...(item.surface as Record<string, unknown>) }; delete surface.status; item.surface = surface; } return item; });
  if (Array.isArray(result.charges)) result.charges = result.charges.map((raw) => { const charge = { ...(raw as Record<string, unknown>) }; delete charge.id; delete charge.priceRuleId; return charge; });
  if (Array.isArray(result.packageSelections)) result.packageSelections = result.packageSelections.map((raw) => { const selection = { ...(raw as Record<string, unknown>) }; delete selection.id; delete selection.packageId; return selection; });
  if (result.navigation && typeof result.navigation === 'object') { const navigation = { ...(result.navigation as Record<string, unknown>) }; if (Array.isArray(navigation.points)) navigation.points = navigation.points.map((raw) => { const point = { ...(raw as Record<string, unknown>) }; delete point.id; delete point.carrierId; delete point.internalNote; delete point.status; return point; }); result.navigation = navigation; }
  if (result.cityGallery && typeof result.cityGallery === 'object') { const gallery = { ...(result.cityGallery as Record<string, unknown>) }; delete gallery.projectId; result.cityGallery = gallery; }
  return result as T;
}
