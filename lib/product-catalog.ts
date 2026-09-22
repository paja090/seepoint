import 'server-only';
import { prisma } from './db';

export type ProductCatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  carrierTypeId: string | null;
  carrierType?: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  unit: string | null;
  active: boolean;
  sortOrder: number;
};

/** Fetch active products for current tenant. */
export async function getActiveProducts(): Promise<ProductCatalogItem[]> {
  const rows = await prisma.product.findMany({
    where: { active: true },
    include: {
      carrierTypeRef: {
        select: { id: true, code: true, name: true, icon: true, color: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapProductRow);
}

/** Fetch all products (including inactive) for admin/settings. */
export async function getAllProducts(): Promise<ProductCatalogItem[]> {
  const rows = await prisma.product.findMany({
    include: {
      carrierTypeRef: {
        select: { id: true, code: true, name: true, icon: true, color: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapProductRow);
}

/** Fetch product by ID. */
export async function getProductById(id: string): Promise<ProductCatalogItem | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    include: {
      carrierTypeRef: {
        select: { id: true, code: true, name: true, icon: true, color: true },
      },
    },
  });
  return row ? mapProductRow(row) : null;
}

/** Fetch products linked to a specific OrganizationCarrierType. */
export async function getProductsByCarrierType(carrierTypeId: string): Promise<ProductCatalogItem[]> {
  const rows = await prisma.product.findMany({
    where: { carrierTypeId, active: true },
    include: {
      carrierTypeRef: {
        select: { id: true, code: true, name: true, icon: true, color: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map(mapProductRow);
}

function mapProductRow(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  carrierTypeId: string | null;
  carrierTypeRef?: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  unit: string | null;
  active: boolean;
  sortOrder: number;
}): ProductCatalogItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    carrierTypeId: row.carrierTypeId,
    carrierType: row.carrierTypeRef
      ? {
          id: row.carrierTypeRef.id,
          code: row.carrierTypeRef.code,
          name: row.carrierTypeRef.name,
          icon: row.carrierTypeRef.icon,
          color: row.carrierTypeRef.color,
        }
      : null,
    unit: row.unit,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}
