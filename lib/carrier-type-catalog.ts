import type { Prisma } from '@prisma/client';
import { prisma } from './db';

export type CarrierTypeCatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  active: boolean;
  sortOrder: number;
  legacyEnumValue: string | null;
  capabilities: Record<string, boolean> | null;
};

/** Fetch all active carrier types for the current tenant (sorted by sortOrder). */
export async function getActiveCarrierTypes(): Promise<CarrierTypeCatalogItem[]> {
  const rows = await prisma.organizationCarrierType.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapRow);
}

/** Fetch all carrier types (including inactive) for admin/settings UI. */
export async function getAllCarrierTypes(): Promise<CarrierTypeCatalogItem[]> {
  const rows = await prisma.organizationCarrierType.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapRow);
}

/** Fetch a single carrier type by ID. */
export async function getCarrierTypeById(id: string): Promise<CarrierTypeCatalogItem | null> {
  const row = await prisma.organizationCarrierType.findUnique({ where: { id } });
  return row ? mapRow(row) : null;
}

/** Fetch a single carrier type by code (unique per organization). */
export async function getCarrierTypeByCode(code: string): Promise<CarrierTypeCatalogItem | null> {
  const rows = await prisma.organizationCarrierType.findMany({
    where: { code },
    take: 1,
  });
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Resolve carrier type label — prefers carrierTypeRef, falls back to legacy enum. */
export function resolveCarrierTypeLabel(
  carrierTypeRef: { name: string } | null | undefined,
  legacyCarrierType: string | null | undefined,
): string {
  if (carrierTypeRef?.name) return carrierTypeRef.name;
  if (legacyCarrierType) return legacyCarrierType.replace(/_/g, ' ');
  return 'Neznámý typ';
}

/** Build filter options for UI dropdowns from active carrier types. */
export async function getCarrierTypeFilterOptions(): Promise<{ value: string; label: string }[]> {
  const types = await getActiveCarrierTypes();
  return types.map((t) => ({ value: t.id, label: t.name }));
}

function mapRow(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  active: boolean;
  sortOrder: number;
  legacyEnumValue: string | null;
  capabilities: unknown;
}): CarrierTypeCatalogItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    active: row.active,
    sortOrder: row.sortOrder,
    legacyEnumValue: row.legacyEnumValue,
    capabilities: row.capabilities as Record<string, boolean> | null,
  };
}

/** Standard generic OOH carrier types for newly created tenant organizations.
 *  Crucial: NO SeePoint proprietary types (Promo lavička, Tower, etc.)!
 */
export const GENERIC_DEFAULT_CARRIER_TYPES = [
  { code: 'BILLBOARD',   name: 'Billboard',                 icon: '🟦', color: '#2563EB', sortOrder: 1, legacyEnumValue: 'BILLBOARD' },
  { code: 'BIGBOARD',    name: 'Bigboard',                  icon: '🟪', color: '#7C3AED', sortOrder: 2, legacyEnumValue: 'BIGBOARD' },
  { code: 'CITYLIGHT',   name: 'Citylight / CLV',           icon: '💡', color: '#F59E0B', sortOrder: 3, legacyEnumValue: 'CITYLIGHT' },
  { code: 'BANNER',      name: 'Reklamní plachta / Banner', icon: '🏳️', color: '#10B981', sortOrder: 4, legacyEnumValue: 'BANNER' },
  { code: 'FACADE',      name: 'Fasáda',                    icon: '🏢', color: '#6366F1', sortOrder: 5, legacyEnumValue: 'FACADE' },
  { code: 'LED_SCREEN',  name: 'LED / digitální plocha',     icon: '📺', color: '#EF4444', sortOrder: 6, legacyEnumValue: 'LED_SCREEN' },
  { code: 'OTHER',       name: 'Ostatní',                   icon: '📦', color: '#9CA3AF', sortOrder: 99, legacyEnumValue: 'OTHER' },
] as const;

/** Seeds standard generic carrier types for a new tenant organization. */
export async function seedOrganizationCarrierTypes(organizationId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;
  for (const ct of GENERIC_DEFAULT_CARRIER_TYPES) {
    const existing = await client.organizationCarrierType.findFirst({
      where: { organizationId, code: ct.code },
    });
    if (!existing) {
      await client.organizationCarrierType.create({
        data: {
          organizationId,
          code: ct.code,
          name: ct.name,
          icon: ct.icon,
          color: ct.color,
          sortOrder: ct.sortOrder,
          legacyEnumValue: ct.legacyEnumValue,
          active: true,
        },
      });
    }
  }
}

