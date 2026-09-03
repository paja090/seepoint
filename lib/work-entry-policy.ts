import { Prisma, RateType, WorkEntryStatus, WorkType } from '@prisma/client';
import type { AppRole } from './rbac';

export class WorkEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkEntryValidationError';
  }
}

export const WORK_ENTRY_PAGE_LIMIT = 500;
const MAX_ID_LENGTH = 100;
const MAX_UNIT_LENGTH = 30;
const MAX_NOTE_LENGTH = 2_000;
const MAX_REASON_LENGTH = 500;
const MAX_QUANTITY = new Prisma.Decimal('999999.9999');
const MAX_MONEY = new Prisma.Decimal('9999999999.99');
const DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;

export function parseDateOnly(value: unknown, label = 'Datum') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new WorkEntryValidationError(`${label} musí být platné datum.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new WorkEntryValidationError(`${label} musí být platné datum.`);
  }
  return parsed;
}

export function parseWorkType(value: unknown) {
  if (typeof value !== 'string' || !Object.values(WorkType).includes(value as WorkType)) {
    throw new WorkEntryValidationError('Vyberte platný druh práce.');
  }
  return value as WorkType;
}

export function parseRateType(value: unknown) {
  if (typeof value !== 'string' || !Object.values(RateType).includes(value as RateType)) {
    throw new WorkEntryValidationError('Vyberte platný způsob odměny.');
  }
  return value as RateType;
}

export function parseWorkEntryStatus(value: unknown) {
  if (typeof value !== 'string' || !Object.values(WorkEntryStatus).includes(value as WorkEntryStatus)) {
    throw new WorkEntryValidationError('Vyberte platný stav výkazu.');
  }
  return value as WorkEntryStatus;
}

export function parseId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_ID_LENGTH) {
    throw new WorkEntryValidationError(`${label} není platné.`);
  }
  return value.trim();
}

export function parseOptionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new WorkEntryValidationError(`${label} musí být text.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new WorkEntryValidationError(`${label} je příliš dlouhý (max. ${maxLength} znaků).`);
  return trimmed || undefined;
}

export function parseUnit(value: unknown) {
  return parseOptionalText(value, 'Jednotka', MAX_UNIT_LENGTH);
}

export function parseNote(value: unknown) {
  return parseOptionalText(value, 'Poznámka', MAX_NOTE_LENGTH);
}

export function parseReason(value: unknown, label = 'Důvod') {
  return parseOptionalText(value, label, MAX_REASON_LENGTH);
}

export function parseQuantity(value: unknown) {
  const raw = String(value ?? '').trim();
  let quantity: Prisma.Decimal;
  if (/^\d+:\d{1,2}$/.test(raw)) {
    const [hoursRaw, minutesRaw] = raw.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isSafeInteger(hours) || minutes < 0 || minutes > 59) {
      throw new WorkEntryValidationError('Neplatný formát času.');
    }
    quantity = new Prisma.Decimal(hours).add(new Prisma.Decimal(minutes).div(60));
  } else {
    if (!DECIMAL_PATTERN.test(raw)) throw new WorkEntryValidationError('Neplatný formát množství.');
    quantity = new Prisma.Decimal(raw.replace(',', '.'));
  }
  if (quantity.lte(0) || quantity.gt(MAX_QUANTITY) || quantity.decimalPlaces() > 4) {
    throw new WorkEntryValidationError('Množství musí být kladné číslo s nejvýše 4 desetinnými místy.');
  }
  return quantity;
}

export function parseMoney(value: unknown, label: string) {
  const raw = String(value ?? '').trim();
  if (!DECIMAL_PATTERN.test(raw)) throw new WorkEntryValidationError(`${label} musí být platné nezáporné číslo.`);
  const amount = new Prisma.Decimal(raw.replace(',', '.'));
  if (amount.lt(0) || amount.gt(MAX_MONEY) || amount.decimalPlaces() > 2) {
    throw new WorkEntryValidationError(`${label} musí být nezáporné číslo s nejvýše 2 desetinnými místy.`);
  }
  return amount;
}

export function assertCalculatedAmountFits(quantity: Prisma.Decimal, rate: Prisma.Decimal | null) {
  if (rate && quantity.mul(rate).gt(MAX_MONEY)) {
    throw new WorkEntryValidationError('Výsledná částka překračuje povolený rozsah.');
  }
}

export function canManageWorkEntries(role: AppRole | string) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'ACCOUNTANT';
}

export function canResolveEmployeeRate(
  role: AppRole | string,
  user: { id: string; email: string },
  employee: { userId: string | null; email: string | null },
) {
  return canManageWorkEntries(role) || employee.userId === user.id || Boolean(employee.email && employee.email.toLowerCase() === user.email.toLowerCase());
}
