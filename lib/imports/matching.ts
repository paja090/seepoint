import { calculateHaversineDistanceKm } from '@/lib/opportunities/distance';
import { cleanText, normalizeCode, normalizeText, parseCoordinate } from '@/lib/carriers-2026/normalize';

export type ExistingCarrierRecord = {
  id: string;
  code: string;
  name: string;
  type: string;
  city: string;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceKey: string | null;
  photoCount: number;
};

export type ExistingSurfaceRecord = {
  id: string;
  carrierId: string;
  name: string;
  mediaType: string;
  sidePosition: string | null;
  sourceKey: string | null;
};

export type ExistingClientRecord = {
  id: string;
  name: string;
  normalizedName: string;
  companyId: string | null;
};

export type CarrierMatchResult =
  | { status: 'MATCHED'; carrier: ExistingCarrierRecord; matchRule: string }
  | { status: 'NEW' }
  | { status: 'AMBIGUOUS'; candidates: ExistingCarrierRecord[] }
  | { status: 'CONFLICT'; carrier: ExistingCarrierRecord; reason: string };

export function matchCarrier(
  imported: {
    carrierCode?: string;
    sourceKey?: string;
    name?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    type?: string;
  },
  existingCarriers: ExistingCarrierRecord[]
): CarrierMatchResult {
  const normCode = imported.carrierCode ? normalizeCode(imported.carrierCode) : '';
  const sourceKey = imported.sourceKey ? cleanText(imported.sourceKey) : '';

  // Rule 1: Exact sourceKey match
  if (sourceKey) {
    const matched = existingCarriers.find((c) => c.sourceKey === sourceKey);
    if (matched) {
      return { status: 'MATCHED', carrier: matched, matchRule: 'EXACT_SOURCE_KEY' };
    }
  }

  // Rule 2: Exact code match
  if (normCode) {
    const matched = existingCarriers.filter((c) => normalizeCode(c.code) === normCode);
    if (matched.length === 1) {
      // Check for gross city conflict
      if (
        imported.city &&
        matched[0].city &&
        normalizeText(imported.city) !== normalizeText(matched[0].city)
      ) {
        return {
          status: 'CONFLICT',
          carrier: matched[0],
          reason: `Kód „${imported.carrierCode}“ již v databázi existuje v městě „${matched[0].city}“, zatímco import uvádí „${imported.city}“.`,
        };
      }
      return { status: 'MATCHED', carrier: matched[0], matchRule: 'EXACT_CODE' };
    } else if (matched.length > 1) {
      return { status: 'AMBIGUOUS', candidates: matched };
    }
  }

  // Rule 3: GPS Proximity match (< 15 meters = 0.015 km)
  if (
    imported.latitude !== undefined &&
    imported.longitude !== undefined &&
    Number.isFinite(imported.latitude) &&
    Number.isFinite(imported.longitude)
  ) {
    const nearby = existingCarriers.filter((c) => {
      if (c.latitude === null || c.longitude === null) return false;
      const distKm = calculateHaversineDistanceKm(
        imported.latitude!,
        imported.longitude!,
        c.latitude,
        c.longitude
      );
      return distKm <= 0.015; // 15 meters
    });

    if (nearby.length === 1) {
      // If code is completely different and not empty, treat with caution
      if (normCode && normalizeCode(nearby[0].code) !== normCode) {
        return {
          status: 'AMBIGUOUS',
          candidates: nearby,
        };
      }
      return { status: 'MATCHED', carrier: nearby[0], matchRule: 'GPS_PROXIMITY' };
    } else if (nearby.length > 1) {
      return { status: 'AMBIGUOUS', candidates: nearby };
    }
  }

  return { status: 'NEW' };
}

export type ClientMatchResult =
  | { status: 'MATCHED'; client: ExistingClientRecord; matchRule: string }
  | { status: 'NEW' }
  | { status: 'NEEDS_REVIEW'; candidates: ExistingClientRecord[] };

export function stripLegalCompanyForm(normName: string): string {
  return normName
    .replace(/\b(spol\s*s\s*r\s*o|spol\s*sro|sro|a\s*s|as|v\s*o\s*s|vos|k\s*s|ks|z\s*s|zs)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchClient(
  imported: {
    companyId?: string;
    name: string;
  },
  existingClients: ExistingClientRecord[]
): ClientMatchResult {
  const ico = imported.companyId ? cleanText(imported.companyId).replace(/\s+/g, '') : '';
  const normName = normalizeText(imported.name);

  // Rule 1: Match by IČO (100% conclusive)
  if (ico && /^\d{8}$/.test(ico)) {
    const matched = existingClients.find((c) => c.companyId === ico);
    if (matched) {
      return { status: 'MATCHED', client: matched, matchRule: 'EXACT_ICO' };
    }
  }

  // Rule 2: Match by exact normalized legal name
  if (normName) {
    const matched = existingClients.find((c) => c.normalizedName === normName);
    if (matched) {
      return { status: 'MATCHED', client: matched, matchRule: 'NORMALIZED_NAME' };
    }

    // Rule 2b: Match without legal suffixes ("s.r.o.", "spol. s r.o.", "a.s.")
    const baseNormName = stripLegalCompanyForm(normName);
    if (baseNormName.length >= 3) {
      const baseMatched = existingClients.find(
        (c) => stripLegalCompanyForm(c.normalizedName) === baseNormName
      );
      if (baseMatched) {
        return { status: 'MATCHED', client: baseMatched, matchRule: 'BASE_NAME_WITHOUT_SUFFIX' };
      }
    }

    // Rule 3: Substring / alias candidates
    const candidates = existingClients.filter(
      (c) => {
        const cBase = stripLegalCompanyForm(c.normalizedName);
        return (
          (cBase.length > 3 && baseNormName.includes(cBase)) ||
          (baseNormName.length > 3 && cBase.includes(baseNormName)) ||
          (c.normalizedName.length > 3 && normName.includes(c.normalizedName)) ||
          (normName.length > 3 && c.normalizedName.includes(normName))
        );
      }
    );

    if (candidates.length > 0) {
      return { status: 'NEEDS_REVIEW', candidates };
    }
  }

  return { status: 'NEW' };
}

export type SurfaceMatchResult =
  | { status: 'MATCHED'; surface: ExistingSurfaceRecord; matchRule: string }
  | { status: 'AMBIGUOUS'; candidates: ExistingSurfaceRecord[] }
  | { status: 'NOT_FOUND' };

function extractSideToken(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = normalizeText(raw).toUpperCase();
  const explicit = cleaned.match(/\b(?:STRANA|SIDE|POZICE|POS)\s*([A-D1-4])\b/);
  if (explicit) return explicit[1];
  if (/^[A-D1-4]$/.test(cleaned)) return cleaned;
  return '';
}

/**
 * Resolves the target surface on a carrier during occupancy import.
 * Supports side A/B/1/2 targeting (`sidePosition` / `surfaceName`) so double-sided
 * carriers never blindly overwrite surface[0].
 */
export function matchSurface(
  carrierSurfaces: ExistingSurfaceRecord[],
  criteria: { sidePosition?: string | null; surfaceName?: string | null }
): SurfaceMatchResult {
  if (!carrierSurfaces || carrierSurfaces.length === 0) {
    return { status: 'NOT_FOUND' };
  }

  const rawSide = cleanText(criteria.sidePosition ?? '');
  const rawName = cleanText(criteria.surfaceName ?? '');
  const sideToken = extractSideToken(rawSide) || extractSideToken(rawName);
  const normName = rawName ? normalizeText(rawName) : '';
  const normSide = rawSide ? normalizeText(rawSide) : '';

  if (carrierSurfaces.length === 1 && !sideToken && !normName && !normSide) {
    return { status: 'MATCHED', surface: carrierSurfaces[0], matchRule: 'SINGLE_SURFACE' };
  }

  // 1. Exact sidePosition or surface name match
  if (normName) {
    const exactName = carrierSurfaces.find((s) => normalizeText(s.name) === normName);
    if (exactName) return { status: 'MATCHED', surface: exactName, matchRule: 'EXACT_SURFACE_NAME' };
  }

  if (sideToken) {
    const bySidePos = carrierSurfaces.filter(
      (s) =>
        extractSideToken(s.sidePosition) === sideToken ||
        extractSideToken(s.name) === sideToken
    );
    if (bySidePos.length === 1) {
      return { status: 'MATCHED', surface: bySidePos[0], matchRule: 'SIDE_TOKEN' };
    }
    // Map numeric 1->A, 2->B and vice versa
    const altToken = sideToken === '1' ? 'A' : sideToken === '2' ? 'B' : sideToken === 'A' ? '1' : sideToken === 'B' ? '2' : '';
    if (altToken) {
      const byAlt = carrierSurfaces.filter(
        (s) =>
          extractSideToken(s.sidePosition) === altToken ||
          extractSideToken(s.name) === altToken
      );
      if (byAlt.length === 1) {
        return { status: 'MATCHED', surface: byAlt[0], matchRule: 'SIDE_TOKEN_ALIAS' };
      }
    }
  }

  // 2. Partial surface name match (e.g. "centrum" -> "Strana A - směr centrum")
  if (normName.length >= 2) {
    const partial = carrierSurfaces.filter((s) => {
      const sn = normalizeText(s.name);
      return sn.includes(normName) || normName.includes(sn);
    });
    if (partial.length === 1) {
      return { status: 'MATCHED', surface: partial[0], matchRule: 'PARTIAL_SURFACE_NAME' };
    }
  }

  if (carrierSurfaces.length === 1) {
    return { status: 'MATCHED', surface: carrierSurfaces[0], matchRule: 'SINGLE_SURFACE_FALLBACK' };
  }

  return { status: 'AMBIGUOUS', candidates: carrierSurfaces };
}

const CZECH_MONTHS: Record<string, number> = {
  leden: 1,
  unor: 2,
  brezen: 3,
  duben: 4,
  kveten: 5,
  cerven: 6,
  cervenec: 7,
  srpen: 8,
  zari: 9,
  rijen: 10,
  listopad: 11,
  prosinec: 12,
};

export function parseImportDateOnly(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
  }

  const cz = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(trimmed);
  if (cz) {
    const d = Number(cz[1]);
    const m = Number(cz[2]);
    const y = Number(cz[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
  }

  return null;
}

export function parseOccupancyImportDates(
  mapped: Record<string, unknown>,
  referenceYear = new Date().getUTCFullYear()
): { dateFrom: Date; dateTo: Date } | null {
  const from = parseImportDateOnly(mapped.dateFrom);
  const to = parseImportDateOnly(mapped.dateTo);
  if (from && to) {
    return { dateFrom: from, dateTo: to };
  }

  const slot = typeof mapped.monthSlot === 'string' ? mapped.monthSlot.trim() : '';
  if (slot) {
    const ym = /^(\d{4})[-/](\d{1,2})$/.exec(slot);
    const my = /^(\d{1,2})[./-](\d{4})$/.exec(slot);
    let year = referenceYear;
    let month = 0;

    if (ym) {
      year = Number(ym[1]);
      month = Number(ym[2]);
    } else if (my) {
      month = Number(my[1]);
      year = Number(my[2]);
    } else {
      const norm = normalizeText(slot);
      const yearMatch = norm.match(/\b(20\d{2})\b/);
      if (yearMatch) year = Number(yearMatch[1]);
      for (const [key, num] of Object.entries(CZECH_MONTHS)) {
        if (norm.includes(key)) {
          month = num;
          break;
        }
      }
    }

    if (month >= 1 && month <= 12) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return { dateFrom: start, dateTo: end };
    }
  }

  return null;
}

export function parseOccupancyImportStatus(
  rawStatus: unknown,
  dateFrom: Date,
  dateTo: Date,
  now = new Date()
): 'OCCUPIED' | 'RESERVED' | 'NEGOTIATION' | 'FINISHED' {
  const norm = typeof rawStatus === 'string' ? normalizeText(rawStatus) : '';
  if (norm) {
    if (norm.includes('obsaz') || norm.includes('potvrz') || norm.includes('aktiv') || norm.includes('prodan') || norm === 'occupied') {
      return 'OCCUPIED';
    }
    if (norm.includes('opce') || norm.includes('jednan') || norm.includes('nabidk') || norm === 'negotiation') {
      return 'NEGOTIATION';
    }
    if (norm.includes('ukonc') || norm.includes('skonc') || norm === 'finished') {
      return 'FINISHED';
    }
    if (norm.includes('rezerv') || norm === 'reserved') {
      return 'RESERVED';
    }
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dateTo < today) return 'FINISHED';
  if (dateFrom > today) return 'RESERVED';
  return 'OCCUPIED';
}
