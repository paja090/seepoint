import type { OpportunityEventType } from '@prisma/client';
import type { OpportunityScoreBreakdown, OpportunityScoreReason } from './types';

export type ScoreInput = {
  eventType?: OpportunityEventType | null;
  city?: string | null;
  region?: string | null;
  eventDate?: Date | string | null;
  hasAvailableCarriers?: boolean;
  carrierCountInCity?: number;
  nearbyCarriersCount?: number;
  suggestedMediaTypes?: string[];
  preferredMediaTypes?: string[];
  targetRegions?: string[];
  targetCities?: string[];
  isInCrm?: boolean;
  hasVerifiedEvidence?: boolean;
  companyId?: string | null;
  website?: string | null;
};

export type OpportunityScoreResult = {
  score: number;
  breakdown: OpportunityScoreBreakdown;
  reasons: OpportunityScoreReason[];
};

export function calculateOpportunityScore(input: ScoreInput): OpportunityScoreResult {
  const reasons: OpportunityScoreReason[] = [];

  // Dimension 1: TRIGGER (Typ události / signál)
  let trigger = 10;
  switch (input.eventType) {
    case 'NEW_BRANCH':
    case 'NEW_ESTABLISHMENT':
    case 'STORE_OPENING':
    case 'RETAIL_PARK':
    case 'RETAIL_PARK_TENANT':
      trigger = 25;
      reasons.push({ factor: 'EVENT_TYPE', points: 25, reason: 'Otevření nové provozovny / pobočky má velmi vysoký potenciál pro venkovní propagaci.' });
      break;
    case 'RESTAURANT_OPENING':
    case 'CAR_DEALERSHIP':
    case 'EXPANSION':
    case 'RELOCATION':
    case 'REOPENING':
      trigger = 20;
      reasons.push({ factor: 'EVENT_TYPE', points: 20, reason: 'Expanze nebo stěhování pobočky generuje potřebu oslovit místní zákazníky.' });
      break;
    case 'MARKETING_EVENT':
    case 'SEASONAL_CAMPAIGN':
    case 'EVENT_EXHIBITION':
    case 'MASS_RECRUITMENT':
      trigger = 15;
      reasons.push({ factor: 'EVENT_TYPE', points: 15, reason: 'Časově ohraničená akce či kampaň vhodná pro intenzivní OOH komunikaci.' });
      break;
    default:
      trigger = 10;
      reasons.push({ factor: 'EVENT_TYPE', points: 10, reason: 'Obchodní signál relevantní pro regionální reklamu.' });
      break;
  }

  // Dimension 2: CUSTOMER FIT
  let customerFit = 0;
  if (input.isInCrm) {
    customerFit += 10;
    reasons.push({ factor: 'EXISTING_CLIENT', points: 10, reason: 'Firma je již evidována v CRM; příležitost pro upsell či navazující kampaň.' });
  }
  if (input.companyId || input.website) {
    customerFit += 5;
    reasons.push({ factor: 'VERIFIED_COMPANY', points: 5, reason: 'Ověřená identita společnosti (IČO nebo oficiální web).' });
  }

  // Dimension 3: TIMING
  let timing = 0;
  if (input.eventDate) {
    const eventDate = new Date(input.eventDate);
    const now = new Date();
    const diffDays = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    timing += 10;
    reasons.push({ factor: 'CONFIRMED_DATE', points: 10, reason: 'Potvrzený termín události umožňuje přesné plánování kampaně.' });

    if (diffDays >= -7 && diffDays <= 45) {
      timing += 15;
      reasons.push({ factor: 'OPTIMAL_TIMING', points: 15, reason: `Ideální realizační okno (${diffDays > 0 ? `za ${diffDays} dní` : 'právě probíhá'}).` });
    } else if (diffDays > 45 && diffDays <= 90) {
      timing += 8;
      reasons.push({ factor: 'OPTIMAL_TIMING', points: 8, reason: `Dostatečný časový předstih na přípravu (${diffDays} dní).` });
    }
  }

  // Dimension 4: GEO & NETWORK DENSITY
  let geo = 0;
  const rawCity = input.city?.trim() || '';
  const rawRegion = input.region?.trim() || '';
  const normalizedCity = rawCity.toLowerCase();
  const normalizedRegion = rawRegion.toLowerCase();

  if (rawCity) {
    const targetCities = (input.targetCities || []).map((c) => c.toLowerCase());
    const targetRegions = (input.targetRegions || []).map((r) => r.toLowerCase());

    const isTargetCity = targetCities.some((tc) => normalizedCity.includes(tc) || tc.includes(normalizedCity));
    const isTargetRegion = targetRegions.some((tr) => normalizedRegion.includes(tr) || tr.includes(normalizedRegion));

    if (isTargetCity || isTargetRegion) {
      geo += 10;
      reasons.push({ factor: 'STRATEGIC_REGION', points: 10, reason: `Lokalita ${rawCity} spadá do prioritního regionu organizace.` });
    } else {
      geo += 4;
      reasons.push({ factor: 'LOCATION', points: 4, reason: `Lokalita ${rawCity}.` });
    }

    const carrierCount = (input.nearbyCarriersCount && input.nearbyCarriersCount > 0)
      ? input.nearbyCarriersCount
      : (input.carrierCountInCity || (input.hasAvailableCarriers ? 1 : 0));

    if (carrierCount >= 10) {
      geo += 15;
      reasons.push({ factor: 'NETWORK_DENSITY', points: 15, reason: `Vysoké pokrytí sítě v lokalitě (${carrierCount}+ nosičů v dosahu).` });
    } else if (carrierCount >= 3) {
      geo += 10;
      reasons.push({ factor: 'NETWORK_DENSITY', points: 10, reason: `Dostupná nosičová síť v lokalitě (${carrierCount} nosičů).` });
    } else if (carrierCount >= 1) {
      geo += 5;
      reasons.push({ factor: 'NETWORK_DENSITY', points: 5, reason: 'V lokalitě evidován aktivní nosič organizace.' });
    }
  }

  // Dimension 5: MEDIA FIT
  let mediaFit = 0;
  const preferred = (input.preferredMediaTypes || []).map((m) => m.toUpperCase());
  const suggested = (input.suggestedMediaTypes || []).map((m) => m.toUpperCase());

  if (preferred.length > 0 && suggested.length > 0) {
    const matches = suggested.filter((s) => preferred.includes(s));
    if (matches.length >= 2) {
      mediaFit = 12;
      reasons.push({ factor: 'MULTI_MEDIA_FIT', points: 12, reason: `Příležitost odpovídá více formátům v portfoliu firmy (${matches.join(', ')}).` });
    } else if (matches.length === 1) {
      mediaFit = 8;
      reasons.push({ factor: 'MEDIA_FIT', points: 8, reason: `Příležitost odpovídá formátu ${matches[0]}.` });
    } else {
      mediaFit = 4;
    }
  } else if (suggested.length >= 2) {
    mediaFit = 8;
    reasons.push({ factor: 'MULTI_MEDIA_FIT', points: 8, reason: 'Vhodné pro multi-formátovou OOH kampaň.' });
  } else if (suggested.length === 1) {
    mediaFit = 5;
  }

  // Dimension 6: EVIDENCE
  let evidence = 5;
  if (input.hasVerifiedEvidence !== false) {
    reasons.push({ factor: 'EVIDENCE', points: 5, reason: 'Signál doložen z externího zdroje.' });
  }

  const breakdown: OpportunityScoreBreakdown = {
    trigger,
    customerFit,
    timing,
    geo,
    mediaFit,
    evidence,
  };

  const totalRaw = trigger + customerFit + timing + geo + mediaFit + evidence;
  const score = Math.max(0, Math.min(100, totalRaw));

  return {
    score,
    breakdown,
    reasons,
  };
}
