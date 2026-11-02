import { prisma } from '@/lib/db';
import { mergeDuplicateClients } from './merge-service';

export type DuplicateGroupItem = {
  id: string;
  name: string;
  normalizedName: string;
  companyId: string | null;
  dic: string | null;
  email: string | null;
  phone: string | null;
  billingCity: string | null;
  createdAt: string;
  ordersCount: number;
  offersCount: number;
  occupanciesCount: number;
  surfacesCount: number;
  invoicesCount: number;
  contractsCount: number;
  contactsCount: number;
  score: number;
};

export type DuplicateGroup = {
  key: string;
  matchType: 'ICO' | 'FUZZY_NAME' | 'NORMALIZED_NAME';
  matchReason: string;
  canonicalClient: DuplicateGroupItem;
  duplicates: DuplicateGroupItem[];
  totalRecordsInGroup: number;
  canAutoMerge: boolean;
};

export function simplifyClientName(name: string): string {
  const norm = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return norm
    .replace(/\b(spol s r o|spol sro|spol|s r o|sro|a s|as|v o s|vos|k s|ks|z s|zs|o p s|ops)\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

export function computeClientCompletenessScore(client: {
  companyId: string | null;
  email: string | null;
  phone: string | null;
  billingCity: string | null;
  _count: {
    crmOrders: number;
    offers: number;
    occupancies: number;
    currentSurfaces: number;
    invoices: number;
    navigationContracts: number;
    contacts: number;
  };
}): number {
  let score = 0;
  if (client.companyId && client.companyId.trim()) score += 50; // IČO is very high signal
  if (client.email && client.email.trim()) score += 10;
  if (client.phone && client.phone.trim()) score += 10;
  if (client.billingCity && client.billingCity.trim()) score += 5;

  // Active business data weighs heavily
  score += client._count.crmOrders * 20;
  score += client._count.invoices * 20;
  score += client._count.offers * 10;
  score += client._count.occupancies * 15;
  score += client._count.currentSurfaces * 5;
  score += client._count.navigationContracts * 15;
  score += client._count.contacts * 5;

  return score;
}

export async function findDuplicateClientGroups(organizationId?: string): Promise<DuplicateGroup[]> {
  const where = {
    active: true,
    ...(organizationId ? { organizationId } : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    select: {
      id: true,
      name: true,
      normalizedName: true,
      companyId: true,
      dic: true,
      email: true,
      phone: true,
      billingCity: true,
      createdAt: true,
      _count: {
        select: {
          crmOrders: true,
          offers: true,
          occupancies: true,
          currentSurfaces: true,
          invoices: true,
          navigationContracts: true,
          contacts: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const formattedClients: DuplicateGroupItem[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    normalizedName: c.normalizedName,
    companyId: c.companyId,
    dic: c.dic,
    email: c.email,
    phone: c.phone,
    billingCity: c.billingCity,
    createdAt: c.createdAt.toISOString(),
    ordersCount: c._count.crmOrders,
    offersCount: c._count.offers,
    occupanciesCount: c._count.occupancies,
    surfacesCount: c._count.currentSurfaces,
    invoicesCount: c._count.invoices,
    contractsCount: c._count.navigationContracts,
    contactsCount: c._count.contacts,
    score: computeClientCompletenessScore(c),
  }));

  const byIco = new Map<string, DuplicateGroupItem[]>();
  const byNormalized = new Map<string, DuplicateGroupItem[]>();
  const bySimplified = new Map<string, DuplicateGroupItem[]>();

  for (const c of formattedClients) {
    if (c.companyId && c.companyId.trim()) {
      const ico = c.companyId.trim();
      if (!byIco.has(ico)) byIco.set(ico, []);
      byIco.get(ico)!.push(c);
    }

    if (c.normalizedName && c.normalizedName.trim()) {
      const norm = c.normalizedName.trim();
      if (!byNormalized.has(norm)) byNormalized.set(norm, []);
      byNormalized.get(norm)!.push(c);
    }

    const sim = simplifyClientName(c.name);
    if (sim && sim.length >= 3) {
      if (!bySimplified.has(sim)) bySimplified.set(sim, []);
      bySimplified.get(sim)!.push(c);
    }
  }

  const groups: DuplicateGroup[] = [];
  const processedClientIds = new Set<string>();

  // 1. Groups by IČO (highest priority)
  for (const [ico, list] of byIco.entries()) {
    if (list.length > 1) {
      const sorted = [...list].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      groups.push({
        key: `ico-${ico}`,
        matchType: 'ICO',
        matchReason: `Shodné IČO ${ico}`,
        canonicalClient: canonical,
        duplicates,
        totalRecordsInGroup: list.length,
        canAutoMerge: true,
      });

      list.forEach((x) => processedClientIds.add(x.id));
    }
  }

  // 2. Groups by exact normalizedName
  for (const [norm, list] of byNormalized.entries()) {
    const unhandled = list.filter((x) => !processedClientIds.has(x.id));
    if (unhandled.length > 1) {
      const sorted = [...unhandled].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      groups.push({
        key: `norm-${norm}`,
        matchType: 'NORMALIZED_NAME',
        matchReason: `Shodný normalizovaný název "${norm}"`,
        canonicalClient: canonical,
        duplicates,
        totalRecordsInGroup: unhandled.length,
        canAutoMerge: true,
      });

      unhandled.forEach((x) => processedClientIds.add(x.id));
    }
  }

  // 3. Groups by simplified/fuzzy name (e.g. without s.r.o. / diacritics)
  for (const [sim, list] of bySimplified.entries()) {
    const unhandled = list.filter((x) => !processedClientIds.has(x.id));
    if (unhandled.length > 1) {
      // Check if they have contradictory non-empty IČOs
      const icos = new Set(unhandled.map((x) => x.companyId).filter(Boolean));
      if (icos.size > 1) {
        // Different IČOs (e.g. McDonald's franchises with distinct company IDs) -> cannot auto-merge safely without user verification
        const sorted = [...unhandled].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
        groups.push({
          key: `sim-${sim}`,
          matchType: 'FUZZY_NAME',
          matchReason: `Podobný název bez právní formy (pozor: rozdílná IČO ${[...icos].join(', ')})`,
          canonicalClient: sorted[0],
          duplicates: sorted.slice(1),
          totalRecordsInGroup: unhandled.length,
          canAutoMerge: false,
        });
      } else {
        // One has IČO and other doesn't, or neither has IČO -> safe to merge!
        const sorted = [...unhandled].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
        groups.push({
          key: `sim-${sim}`,
          matchType: 'FUZZY_NAME',
          matchReason: `Podobný název bez diakritiky a právní formy (s.r.o.)`,
          canonicalClient: sorted[0],
          duplicates: sorted.slice(1),
          totalRecordsInGroup: unhandled.length,
          canAutoMerge: true,
        });
      }

      unhandled.forEach((x) => processedClientIds.add(x.id));
    }
  }

  return groups;
}

export async function searchClientMergeCandidates(
  query: string,
  excludeClientId: string,
  organizationId?: string,
  take = 10
) {
  const cleanQ = query.trim();
  if (!cleanQ || cleanQ.length < 2) return [];

  const where = {
    active: true,
    id: { not: excludeClientId },
    ...(organizationId ? { organizationId } : {}),
    OR: [
      { name: { contains: cleanQ, mode: 'insensitive' as const } },
      { companyId: { contains: cleanQ, mode: 'insensitive' as const } },
      { email: { contains: cleanQ, mode: 'insensitive' as const } },
      { contactPerson: { contains: cleanQ, mode: 'insensitive' as const } },
    ],
  };

  const results = await prisma.client.findMany({
    where,
    select: {
      id: true,
      name: true,
      companyId: true,
      email: true,
      phone: true,
      billingCity: true,
      createdAt: true,
      _count: {
        select: {
          crmOrders: true,
          offers: true,
          occupancies: true,
          invoices: true,
          currentSurfaces: true,
        },
      },
    },
    take,
    orderBy: { name: 'asc' },
  });

  return results.map((c) => ({
    id: c.id,
    name: c.name,
    companyId: c.companyId,
    email: c.email,
    phone: c.phone,
    billingCity: c.billingCity,
    ordersCount: c._count.crmOrders,
    offersCount: c._count.offers,
    occupanciesCount: c._count.occupancies,
    surfacesCount: c._count.currentSurfaces,
    invoicesCount: c._count.invoices,
  }));
}

export async function autoMergeAllHighConfidenceDuplicates(
  actorUserId: string,
  actorEmail: string,
  organizationId?: string
) {
  const groups = await findDuplicateClientGroups(organizationId);
  const eligibleGroups = groups.filter((g) => g.canAutoMerge && g.duplicates.length > 0);

  const mergedResults = [];
  const errors = [];

  for (const group of eligibleGroups) {
    const targetId = group.canonicalClient.id;
    for (const dup of group.duplicates) {
      try {
        const res = await mergeDuplicateClients(targetId, dup.id, actorUserId, actorEmail);
        mergedResults.push({
          targetId,
          targetName: group.canonicalClient.name,
          sourceId: dup.id,
          sourceName: dup.name,
          reason: group.matchReason,
        });
      } catch (err: unknown) {
        errors.push({
          targetId,
          sourceId: dup.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  return {
    totalMerged: mergedResults.length,
    merged: mergedResults,
    errors,
  };
}
