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
