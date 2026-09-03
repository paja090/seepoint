import { WarehouseItemCategory, WarehouseMovementType } from '@prisma/client';

export const MAX_WAREHOUSE_QUANTITY = 1_000_000;
export const MAX_WAREHOUSE_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_WAREHOUSE_BATCH_SIZE = 50;
export const WAREHOUSE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class WarehouseInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarehouseInputError';
  }
}

export function warehouseText(value: unknown, label: string, maxLength: number, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new WarehouseInputError(`${label} je povinný údaj.`);
    return null;
  }
  if (typeof value !== 'string') throw new WarehouseInputError(`${label} musí být text.`);
  const clean = value.trim();
  if (!clean) {
    if (required) throw new WarehouseInputError(`${label} je povinný údaj.`);
    return null;
  }
  if (clean.length > maxLength) throw new WarehouseInputError(`${label} může mít nejvýše ${maxLength} znaků.`);
  return clean;
}

export function warehouseNumber(value: unknown, label: string, options: { optional: true; allowZero?: boolean }): number | null;
export function warehouseNumber(value: unknown, label: string, options?: { optional?: false; allowZero?: boolean }): number;
export function warehouseNumber(value: unknown, label: string, options: { optional?: boolean; allowZero?: boolean } = {}): number | null {
  if (value === undefined || value === null || value === '') {
    if (options.optional) return null;
    throw new WarehouseInputError(`${label} je povinný údaj.`);
  }
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new WarehouseInputError(`${label} musí být platné číslo.`);
  if (options.allowZero ? number < 0 : number <= 0) {
    throw new WarehouseInputError(`${label} musí být ${options.allowZero ? 'nula nebo kladné číslo' : 'kladné číslo'}.`);
  }
  if (number > MAX_WAREHOUSE_QUANTITY) throw new WarehouseInputError(`${label} překračuje povolený limit.`);
  return Math.round(number * 100) / 100;
}

export function warehouseCategory(value: unknown) {
  if (value === undefined || value === null || value === '') return WarehouseItemCategory.CONSUMABLE;
  if (value !== WarehouseItemCategory.CONSUMABLE && value !== WarehouseItemCategory.RETURNABLE) {
    throw new WarehouseInputError('Neplatná kategorie skladové položky.');
  }
  return value;
}

export function warehouseMovementType(value: unknown) {
  if (!Object.values(WarehouseMovementType).includes(value as WarehouseMovementType)) {
    throw new WarehouseInputError('Neplatný typ skladového pohybu.');
  }
  return value as WarehouseMovementType;
}

export function validateWarehouseImage(file: File) {
  if (!WAREHOUSE_IMAGE_TYPES.has(file.type)) throw new WarehouseInputError('Fotka musí být ve formátu JPEG, PNG nebo WebP.');
  if (file.size <= 0 || file.size > MAX_WAREHOUSE_IMAGE_BYTES) throw new WarehouseInputError('Fotka může mít nejvýše 3 MB.');
}

export function validateWarehouseDataImage(value: unknown) {
  if (typeof value !== 'string') throw new WarehouseInputError('Fotka musí být platný obrázek.');
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new WarehouseInputError('Fotka musí být ve formátu JPEG, PNG nebo WebP.');
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
  const bytes = Math.floor((match[2].length * 3) / 4) - padding;
  if (bytes <= 0 || bytes > MAX_WAREHOUSE_IMAGE_BYTES) throw new WarehouseInputError('Fotka může mít nejvýše 3 MB.');
  return value;
}
