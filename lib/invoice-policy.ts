import { Prisma } from '@prisma/client';

export function normalizeInvoicePrefix(value: string) {
  const prefix = value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(prefix)) {
    throw new Error('Prefix faktury musí mít 1 až 12 znaků A–Z, číslic nebo pomlček.');
  }
  return prefix;
}

export function formatInvoiceNumber(prefix: string, sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Pořadové číslo faktury není platné.');
  return `${normalizeInvoicePrefix(prefix)}-${String(sequence).padStart(6, '0')}`;
}

export function invoiceDueDate(issueDate: Date, dueDays: number) {
  if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 365) throw new Error('Splatnost faktury musí být 1 až 365 dní.');
  return new Date(issueDate.getTime() + dueDays * 86_400_000);
}

export function invoiceVatAmounts(subtotal: Prisma.Decimal, vatRateInput: Prisma.Decimal.Value) {
  const vatRate = new Prisma.Decimal(vatRateInput);
  if (vatRate.isNegative() || vatRate.greaterThan(100)) throw new Error('Sazba DPH musí být 0 až 100 %.');
  const taxAmount = subtotal.mul(vatRate).div(100).toDecimalPlaces(2);
  return { vatRate, taxAmount, totalAmount: subtotal.plus(taxAmount) };
}

export function createInvoicePartySnapshot(value: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function readInvoicePartySnapshot<T extends object>(snapshot: Prisma.JsonValue | Prisma.InputJsonValue | null, fallback: T): T {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot as T : fallback;
}
