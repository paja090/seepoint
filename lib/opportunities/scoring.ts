import type { OpportunityEventType } from '@prisma/client';
import type { OpportunityScoreReason } from './types';

type ScoreInput = {
  eventType: OpportunityEventType;
  city: string;
  region?: string | null;
  eventDate?: Date | string | null;
  hasAvailableCarriers?: boolean;
  carrierCountInCity?: number;
  suggestedMediaTypes?: string[];
  isInCrm?: boolean;
};

export function calculateOpportunityScore(input: ScoreInput): {
  score: number;
  reasons: OpportunityScoreReason[];
} {
  const reasons: OpportunityScoreReason[] = [];
  let score = 0;

  // 1. Event Type Base Weighting
  switch (input.eventType) {
    case 'NEW_BRANCH':
    case 'NEW_ESTABLISHMENT':
    case 'STORE_OPENING':
    case 'RETAIL_PARK':
    case 'RETAIL_PARK_TENANT':
      score += 25;
      reasons.push({ factor: 'EVENT_TYPE', points: 25, reason: 'Otevření nové provozovny / pobočky má velmi vysoký potenciál pro lokální propagaci.' });
      break;
    case 'RESTAURANT_OPENING':
    case 'CAR_DEALERSHIP':
    case 'EXPANSION':
    case 'RELOCATION':
    case 'REOPENING':
      score += 20;
      reasons.push({ factor: 'EVENT_TYPE', points: 20, reason: 'Expanze nebo stěhování pobočky generuje potřebu oslovit místní zákazníky.' });
      break;
    case 'MARKETING_EVENT':
    case 'SEASONAL_CAMPAIGN':
    case 'EVENT_EXHIBITION':
    case 'MASS_RECRUITMENT':
      score += 15;
      reasons.push({ factor: 'EVENT_TYPE', points: 15, reason: 'Časově ohraničená akce či kampaň vhodná pro intenzivní OOH komunikaci.' });
      break;
    default:
      score += 10;
      reasons.push({ factor: 'EVENT_TYPE', points: 10, reason: 'Obchodní signál relevantní pro regionální reklamu.' });
      break;
  }

  // 2. Confirmed Event Date & Timing
  if (input.eventDate) {
    const eventDate = new Date(input.eventDate);
    const now = new Date();
    const diffDays = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    score += 15;
    reasons.push({ factor: 'CONFIRMED_DATE', points: 15, reason: 'Potvrzený termín události umožňuje přesné plánování kampaně.' });

    if (diffDays >= -7 && diffDays <= 90) {
      score += 10;
      reasons.push({ factor: 'OPTIMAL_TIMING', points: 10, reason: `Událost nastane v ideálním okně pro kampaň (${diffDays > 0 ? `za ${diffDays} dní` : 'právě probíhá'}).` });
    }
  }

  // 3. Location Priority (Ostrava & Moravskoslezský kraj priority)
  const normalizedCity = input.city.trim().toLowerCase();
  const normalizedRegion = (input.region || '').trim().toLowerCase();
  const isMsRegion =
    normalizedCity.includes('ostrava') ||
    normalizedCity.includes('opava') ||
    normalizedCity.includes('karviná') ||
    normalizedCity.includes('karvina') ||
    normalizedCity.includes('havířov') ||
    normalizedCity.includes('havirov') ||
    normalizedCity.includes('frýdek') ||
    normalizedCity.includes('frydek') ||
    normalizedCity.includes('třinec') ||
    normalizedCity.includes('trinec') ||
    normalizedCity.includes('nový jičín') ||
    normalizedCity.includes('novy jicin') ||
    normalizedCity.includes('krnov') ||
    normalizedCity.includes('bohumín') ||
    normalizedCity.includes('bohumin') ||
    normalizedRegion.includes('moravskoslezsk');

  if (isMsRegion) {
    score += 15;
    reasons.push({ factor: 'STRATEGIC_REGION', points: 15, reason: 'Lokalita v Moravskoslezském kraji s vysokým pokrytím sítě SeePOINT.' });
  } else {
    score += 5;
    reasons.push({ factor: 'LOCATION', points: 5, reason: `Lokalita ${input.city}.` });
  }

  // 4. SeePOINT Network Availability in City
  if (input.hasAvailableCarriers || (input.carrierCountInCity && input.carrierCountInCity > 0)) {
    const count = input.carrierCountInCity || 1;
    const bonus = count >= 10 ? 15 : count >= 3 ? 10 : 5;
    score += bonus;
    reasons.push({ factor: 'NETWORK_DENSITY', points: bonus, reason: `SeePOINT eviduje ve městě ${input.city} ${count}+ aktivních reklamních nosičů; konkrétní dostupnost je nutné ověřit pro termín kampaně.` });
  }

  // 5. Multi-Media Fit Bonus
  if (input.suggestedMediaTypes && input.suggestedMediaTypes.length >= 2) {
    score += 10;
    reasons.push({ factor: 'MULTI_MEDIA_FIT', points: 10, reason: 'Příležitost je vhodná pro kombinaci více typů nosičů (City Postery, lavičky, navigace).' });
  }

  // Final Score Clamping (0 - 100)
  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    reasons,
  };
}
