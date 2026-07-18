import { MediaType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import { OfferValidationError } from './domain';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullableDecimal = (value: unknown, label: string) => { const raw = text(value).replace(',', '.'); if (!raw) return null; try { const parsed = new Prisma.Decimal(raw); if (parsed.lt(0)) throw new Error(); return parsed.toDecimalPlaces(2); } catch { throw new OfferValidationError(`${label} musí být nezáporné číslo.`); } };
const assertAdmin = (user: CurrentUser) => { if (user.role !== 'ADMIN') throw new OfferValidationError('Balíčky může spravovat pouze administrátor.', 'FORBIDDEN'); };

export async function listMediaPackages() {
  return prisma.mediaPackage.findMany({ include: { rules: { orderBy: { sortOrder: 'asc' } } }, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
}

export async function createMediaPackage(user: CurrentUser, raw: unknown) {
  assertAdmin(user);
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Data balíčku nejsou platná.');
  const input = raw as Record<string, unknown>; const name = text(input.name); const rows = Array.isArray(input.rules) ? input.rules : [];
  if (!name || rows.length === 0) throw new OfferValidationError('Název a alespoň jedno pravidlo balíčku jsou povinné.');
  const rules = rows.map((rawRule, index) => { if (!rawRule || typeof rawRule !== 'object') throw new OfferValidationError(`Pravidlo ${index + 1} není platné.`); const rule = rawRule as Record<string, unknown>; const mediaType = text(rule.mediaType); const quantity = Number(rule.quantity); if (!Object.values(MediaType).includes(mediaType as MediaType) || !Number.isInteger(quantity) || quantity < 1) throw new OfferValidationError(`Pravidlo ${index + 1} nemá platný typ média nebo počet.`); return { mediaType: mediaType as MediaType, city: text(rule.city) || null, locality: text(rule.locality) || null, quantity, sortOrder: index }; });
  return prisma.mediaPackage.create({ data: { name, description: text(input.description) || null, standardPrice: nullableDecimal(input.standardPrice, 'Standardní cena'), packagePrice: nullableDecimal(input.packagePrice, 'Balíčková cena'), defaultDuration: text(input.defaultDuration) ? Number(input.defaultDuration) : null, rules: { create: rules } }, include: { rules: true } });
}

export async function archiveMediaPackage(user: CurrentUser, id: string) { assertAdmin(user); return prisma.mediaPackage.update({ where: { id }, data: { active: false }, include: { rules: true } }); }
