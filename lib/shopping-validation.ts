import { validateChatImage } from './chat-policy';

export const SHOPPING_CATEGORIES = ['OFFICE', 'WORKSHOP'] as const;
export const SHOPPING_PRIORITIES = ['NORMAL', 'THIS_WEEK', 'URGENT'] as const;

export class ShoppingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShoppingValidationError';
  }
}

export function shoppingRequestBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ShoppingValidationError('Neplatná data nákupní položky.');
  }
  return value as Record<string, unknown>;
}

export function shoppingRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ShoppingValidationError(`${label} je povinný údaj.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ShoppingValidationError(`${label} může mít nejvýše ${maxLength} znaků.`);
  }
  return normalized;
}

export function shoppingOptionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ShoppingValidationError(`${label} má neplatný formát.`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new ShoppingValidationError(`${label} může mít nejvýše ${maxLength} znaků.`);
  }
  return normalized;
}

export function shoppingCategory(value: unknown, fallback?: typeof SHOPPING_CATEGORIES[number]) {
  if ((SHOPPING_CATEGORIES as readonly unknown[]).includes(value)) {
    return value as typeof SHOPPING_CATEGORIES[number];
  }
  if ((value === undefined || value === null || value === '') && fallback) return fallback;
  throw new ShoppingValidationError('Kategorie nákupní položky není platná.');
}

export function shoppingPriority(value: unknown, fallback?: typeof SHOPPING_PRIORITIES[number]) {
  if ((SHOPPING_PRIORITIES as readonly unknown[]).includes(value)) {
    return value as typeof SHOPPING_PRIORITIES[number];
  }
  if ((value === undefined || value === null || value === '') && fallback) return fallback;
  throw new ShoppingValidationError('Priorita nákupní položky není platná.');
}

export function shoppingPrice(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new ShoppingValidationError('Zaplacená cena má neplatný formát.');
  }
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const price = typeof normalized === 'number' ? normalized : Number(normalized);
  if (!Number.isFinite(price) || price < 0 || price > 100_000_000) {
    throw new ShoppingValidationError('Zaplacená cena musí být číslo od 0 do 100 000 000 Kč.');
  }
  return Math.round(price * 100) / 100;
}

export function shoppingImage(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ShoppingValidationError(`${label} má neplatný formát.`);
  const normalized = value.trim();
  if (normalized.startsWith('data:')) {
    const result = validateChatImage(normalized, 2_000_000);
    if ('error' in result) throw new ShoppingValidationError(`${label}: ${result.error}`);
    return result.value;
  }
  if (normalized.length > 2048) throw new ShoppingValidationError(`${label} má příliš dlouhou adresu.`);
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe');
    return url.toString();
  } catch {
    throw new ShoppingValidationError(`${label} musí být bezpečná HTTPS adresa nebo vložený obrázek.`);
  }
}

export function shoppingBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new ShoppingValidationError(`${label} musí být ano/ne.`);
  return value;
}

export function shoppingValidationResponse(error: unknown) {
  return error instanceof ShoppingValidationError ? error.message : null;
}
