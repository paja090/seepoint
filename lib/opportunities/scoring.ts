import type { OpportunityEventType } from '@prisma/client';
import type {
  OpportunityScoreBreakdown,
  OpportunityScoreComponents,
  OpportunityScoreReason,
} from './types';

export type ScoreInput = {
  eventType?: OpportunityEventType | null;
  city?: string | null;
  region?: string | null;
  eventDate?: Date | string | null;
  sourcePublishedAt?: Date | string | null;
  detectedAt?: Date | string | null;
  hasAvailableCarriers?: boolean;
  carrierCountInCity?: number;
  nearbyCarriersCount?: number;
  suggestedMediaTypes?: string[];
  preferredMediaTypes?: string[];
  targetRegions?: string[];
  targetCities?: string[];
  targetIndustries?: string[];
  companyIndustry?: string | null;
  isInCrm?: boolean;
  hasVerifiedEvidence?: boolean;
  companyId?: string | null;
  website?: string | null;
  sourceUrl?: string | null;
};

export type OpportunityScoreResult = {
  score: number;
  components: OpportunityScoreComponents;
  breakdown: OpportunityScoreBreakdown;
  reasons: OpportunityScoreReason[];
};

export function calculateOpportunityScore(input: ScoreInput): OpportunityScoreResult {
  const reasons: OpportunityScoreReason[] = [];

  // ==========================================
  // Component 1: RELEVANCE (Typ události - max 25 b.)
  // ==========================================
  let relevance = 10;
  switch (input.eventType) {
    case 'NEW_BRANCH':
    case 'NEW_ESTABLISHMENT':
    case 'STORE_OPENING':
    case 'RETAIL_PARK':
    case 'RETAIL_PARK_TENANT':
      relevance = 25;
      reasons.push({ factor: 'EVENT_TYPE', points: 25, reason: 'Otevření nové provozovny / pobočky má prioritní potenciál pro venkovní propagaci.' });
      break;
    case 'RESTAURANT_OPENING':
    case 'CAR_DEALERSHIP':
    case 'EXPANSION':
    case 'RELOCATION':
    case 'REOPENING':
      relevance = 20;
      reasons.push({ factor: 'EVENT_TYPE', points: 20, reason: 'Expanze, stěhování nebo nová provozovna generuje potřebu oslovit místní zákazníky.' });
      break;
    case 'MARKETING_EVENT':
    case 'SEASONAL_CAMPAIGN':
    case 'EVENT_EXHIBITION':
    case 'MASS_RECRUITMENT':
      relevance = 15;
      reasons.push({ factor: 'EVENT_TYPE', points: 15, reason: 'Časově ohraničená akce či kampaň vhodná pro intenzivní OOH komunikaci.' });
      break;
    default:
      relevance = 10;
      reasons.push({ factor: 'EVENT_TYPE', points: 10, reason: 'Obchodní signál relevantní pro regionální reklamu.' });
      break;
  }

  // ==========================================
  // Component 2: FRESHNESS & TIMING (Čerstvost a stáří signálu - max 20 b.)
  // ==========================================
  let freshness = 0;
  const now = new Date();
  const nowMs = now.getTime();

  // 2a. Event date proximity
  let diffDays: number | null = null;
  if (input.eventDate) {
    const eventTime = new Date(input.eventDate).getTime();
    if (!isNaN(eventTime)) {
      diffDays = Math.round((eventTime - nowMs) / (1000 * 60 * 60 * 24));
    }
  }

  // 2b. Publication / detection age
  let publishedDaysAgo = 0;
  const pubDate = input.sourcePublishedAt || input.detectedAt;
  if (pubDate) {
    const pubTime = new Date(pubDate).getTime();
    if (!isNaN(pubTime)) {
      publishedDaysAgo = Math.max(0, Math.round((nowMs - pubTime) / (1000 * 60 * 60 * 24)));
    }
  }

  // 2c. Check for stale signal (e.g. article > 1 year ago or event passed > 90 days ago)
  const isStaleEvent = diffDays !== null && diffDays < -90;
  const isStaleArticle = publishedDaysAgo > 365;

  let stalenessPenalty = 0;

  if (isStaleEvent || isStaleArticle) {
    freshness = 0;
    stalenessPenalty = 15;
    reasons.push({
      factor: 'STALE_SIGNAL',
      points: -15,
      reason: isStaleArticle
        ? `Zastaralý signál: článek byl publikován před více než rokem (${publishedDaysAgo} dní). Příležitost je neaktuální.`
        : `Zastaralá událost: akce proběhla před více než 90 dny (${Math.abs(diffDays!)} dní v minulosti).`,
    });
  } else if (diffDays !== null) {
    if (diffDays >= -7 && diffDays <= 45) {
      freshness += 15;
      reasons.push({
        factor: 'OPTIMAL_TIMING',
        points: 15,
        reason: diffDays >= 0
          ? `Ideální realizační okno kampaně (událost za ${diffDays} dní).`
          : 'Událost právě probíhá nebo proběhla v posledním týdnu.',
      });
    } else if (diffDays > 45 && diffDays <= 90) {
      freshness += 10;
      reasons.push({
        factor: 'OPTIMAL_TIMING',
        points: 10,
        reason: `Dostatečný časový předstih na přípravu kampaně (${diffDays} dní).`,
      });
    } else if (diffDays > 90) {
      freshness += 5;
      reasons.push({
        factor: 'FUTURE_TIMING',
        points: 5,
        reason: `Dlouhodobý výhled (${diffDays} dní do realizace).`,
      });
    } else if (diffDays < -7 && diffDays >= -90) {
      freshness += 3;
      reasons.push({
        factor: 'PAST_EVENT_RECENT',
        points: 3,
        reason: `Nedávno proběhlá událost (${Math.abs(diffDays)} dní v minulosti) – možnost navazující kampaně.`,
      });
    }

    // Publication freshness adjustment
    if (publishedDaysAgo <= 14) {
      freshness = Math.min(20, freshness + 5);
      reasons.push({ factor: 'FRESH_SOURCE', points: 5, reason: 'Čerstvě publikovaný podklad (posledních 14 dní).' });
    } else if (publishedDaysAgo > 60) {
      freshness = Math.max(0, freshness - 3);
      reasons.push({ factor: 'AGING_SOURCE', points: -3, reason: `Starší zdroj zprávy (${publishedDaysAgo} dní starý).` });
    }
  } else {
    // No specific eventDate
    if (publishedDaysAgo <= 14) {
      freshness = 12;
      reasons.push({ factor: 'FRESH_SIGNAL', points: 12, reason: 'Čerstvý signál z médií bez fixního termínu (posledních 14 dní).' });
    } else if (publishedDaysAgo <= 60) {
      freshness = 8;
      reasons.push({ factor: 'RECENT_SIGNAL', points: 8, reason: `Signál z nedávné doby (${publishedDaysAgo} dní).` });
    } else if (publishedDaysAgo <= 180) {
      freshness = 4;
      reasons.push({ factor: 'OLDER_SIGNAL', points: 4, reason: `Starší zpráva (${publishedDaysAgo} dní).` });
    } else {
      freshness = 0;
      reasons.push({ factor: 'STALE_SIGNAL', points: 0, reason: 'Zastaralý signál bez termínu (starší než 6 měsíců).' });
    }
  }

  // Cap freshness between 0 and 20
  freshness = Math.max(0, Math.min(20, freshness));

  // ==========================================
  // Component 3: LOCATION FIT (Shoda lokality a nosičové sítě - max 25 b.)
  // ==========================================
  let locationFit = 0;
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
      locationFit += 10;
      reasons.push({ factor: 'STRATEGIC_REGION', points: 10, reason: `Lokalita ${rawCity} spadá do prioritního regionu organizace.` });
    } else {
      locationFit += 4;
      reasons.push({ factor: 'LOCATION', points: 4, reason: `Lokalita ${rawCity}.` });
    }

    const carrierCount = (input.nearbyCarriersCount && input.nearbyCarriersCount > 0)
      ? input.nearbyCarriersCount
      : (input.carrierCountInCity || (input.hasAvailableCarriers ? 1 : 0));

    if (carrierCount >= 10) {
      locationFit += 15;
      reasons.push({ factor: 'NETWORK_DENSITY', points: 15, reason: `Vysoké pokrytí sítě v lokalitě (${carrierCount}+ nosičů v dosahu).` });
    } else if (carrierCount >= 3) {
      locationFit += 10;
      reasons.push({ factor: 'NETWORK_DENSITY', points: 10, reason: `Dostupná nosičová síť v lokalitě (${carrierCount} nosičů).` });
    } else if (carrierCount >= 1) {
      locationFit += 5;
      reasons.push({ factor: 'NETWORK_DENSITY', points: 5, reason: 'V lokalitě evidován aktivní nosič organizace.' });
    }
  }
  locationFit = Math.min(25, locationFit);

  // ==========================================
  // Component 4: COMPANY FIT (Shoda firmy a klienta - max 20 b.)
  // ==========================================
  let companyFit = 0;
  if (input.isInCrm) {
    companyFit += 10;
    reasons.push({ factor: 'EXISTING_CLIENT', points: 10, reason: 'Firma je evidována v CRM; vysoká pravděpodobnost úspěšného upsellu či expanze.' });
  }
  if (input.companyId || input.website) {
    companyFit += 5;
    reasons.push({ factor: 'VERIFIED_COMPANY', points: 5, reason: 'Ověřená identita společnosti (IČO nebo oficiální web).' });
  }
  if (input.targetIndustries && input.targetIndustries.length > 0 && input.companyIndustry) {
    const ind = input.companyIndustry.toLowerCase();
    const isTargetInd = input.targetIndustries.some((ti) => ind.includes(ti.toLowerCase()));
    if (isTargetInd) {
      companyFit += 5;
      reasons.push({ factor: 'TARGET_INDUSTRY', points: 5, reason: `Odvětví ${input.companyIndustry} odpovídá cílovému zaměření organizace.` });
    }
  } else if (input.website && !input.isInCrm) {
    // General commercial legitimacy point
    companyFit = Math.min(20, companyFit + 3);
  }
  companyFit = Math.min(20, companyFit);

  // ==========================================
  // Component 5: CONFIDENCE & EVIDENCE (Důvěryhodnost zdroje - max 10 b.)
  // ==========================================
  let confidence = 0;
  if (input.hasVerifiedEvidence !== false) {
    confidence += 5;
    reasons.push({ factor: 'EVIDENCE', points: 5, reason: 'Signál doložen z externího zdroje.' });
  }
  const source = (input.sourceUrl || '').trim().toLowerCase();
  if (source.startsWith('http://') || source.startsWith('https://')) {
    if (!source.includes('radar.internal')) {
      confidence += 5;
      reasons.push({ factor: 'VERIFIABLE_URL', points: 5, reason: 'Ověřitelný veřejný odkaz na zdroj informací.' });
    }
  }
  confidence = Math.min(10, confidence);

  // Media fit calculation for backward compatibility
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

  const components: OpportunityScoreComponents = {
    relevance,
    freshness,
    locationFit,
    companyFit,
    confidence,
  };

  const breakdown: OpportunityScoreBreakdown = {
    trigger: relevance,
    customerFit: companyFit,
    timing: freshness,
    geo: locationFit,
    mediaFit,
    evidence: confidence,
  };

  const totalRaw = relevance + freshness + locationFit + companyFit + confidence - stalenessPenalty;
  const score = Math.max(0, Math.min(100, totalRaw));

  return {
    score,
    components,
    breakdown,
    reasons,
  };
}

