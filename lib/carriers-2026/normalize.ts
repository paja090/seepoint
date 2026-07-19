import { createHash } from 'node:crypto';

export function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeText(value: unknown) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(s\.?\s*r\.?\s*o\.?)\b/gi, 'sro')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeCode(value: unknown) {
  return normalizeText(value).replace(/\s+/g, '').toUpperCase();
}

export function stableHash(value: unknown) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

export function parseCoordinate(value: unknown, min: number, max: number) {
  const parsed = Number(cleanText(value).replace(',', '.').replace(/[NSEW°]/gi, ''));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export function decimalString(value: unknown) {
  const parsed = Number(cleanText(value).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(parsed)) return undefined;
  return parsed.toFixed(2);
}

export function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function addMonths(isoDate: string, months: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
