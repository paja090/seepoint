import type { AiInboxClassification, AiInboxStatus } from './types';
import type { AiInboxListItem } from '@/components/ai-inbox/AiInboxMessageCard';

export type AiInboxPriorityTier = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'SPAM';

export type AiInboxSortOption =
  | 'IMPORTANCE_AND_TIME'
  | 'NEWEST'
  | 'OLDEST'
  | 'IMPORTANCE_ONLY';

export type PriorityTierMeta = {
  tier: AiInboxPriorityTier;
  label: string;
  icon: string;
  badgeColor: string;
  borderColor: string;
  description: string;
  order: number;
};

export const PRIORITY_TIER_META: Record<AiInboxPriorityTier, PriorityTierMeta> = {
  URGENT: {
    tier: 'URGENT',
    label: 'Urgentní',
    icon: '🔥',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    borderColor: 'border-rose-400',
    description: 'Vyžaduje okamžitou reakci (reklamace, potvrzená nabídka či naléhavý požadavek)',
    order: 4,
  },
  HIGH: {
    tier: 'HIGH',
    label: 'Prioritní',
    icon: '⚡',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    borderColor: 'border-amber-400',
    description: 'Vysoká obchodní hodnota (nová poptávka, změna požadavku, schválení grafiky)',
    order: 3,
  },
  NORMAL: {
    tier: 'NORMAL',
    label: 'Běžná',
    icon: '✉️',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    borderColor: 'border-slate-300',
    description: 'Běžná provozní komunikace k projektům, podklady a doklady',
    order: 2,
  },
  LOW: {
    tier: 'LOW',
    label: 'Nízká',
    icon: '✓',
    badgeColor: 'bg-slate-50 text-slate-500 border-slate-200',
    borderColor: 'border-slate-200',
    description: 'Již zpracované nebo ryze informativní zprávy',
    order: 1,
  },
  SPAM: {
    tier: 'SPAM',
    label: 'Spam',
    icon: '🚫',
    badgeColor: 'bg-slate-100 text-slate-400 border-slate-200',
    borderColor: 'border-slate-200',
    description: 'Irelevantní pošta, boti a newslettery',
    order: 0,
  },
};

const CLASSIFICATION_BASE_SCORES: Record<AiInboxClassification, number> = {
  COMPLAINT: 100,
  OFFER_ACCEPTED: 90,
  OFFER_REJECTED: 40,
  NEW_INQUIRY: 80,
  CHANGE_REQUEST: 75,
  GRAPHIC_APPROVAL: 70,
  INSTALLATION_REQUEST: 65,
  PHOTO_DOCUMENTATION: 55,
  INVOICE_BILLING: 55,
  GRAPHIC_ASSETS: 50,
  DOCUMENTS: 45,
  EXISTING_PROJECT_REPLY: 40,
  GENERAL_COMMUNICATION: 30,
  UNKNOWN: 20,
  SPAM_IRRELEVANT: -200,
};

export type ImportanceEvaluation = {
  score: number;
  tier: AiInboxPriorityTier;
  reasons: string[];
};

/**
 * Vypočítá skóre důležitosti a prioritní pásmo pro zprávu AI Inboxu.
 */
export function calculateAiInboxImportance(
  item: Pick<
    AiInboxListItem,
    | 'classification'
    | 'processingStatus'
    | 'requiresReview'
    | 'confidence'
    | 'client'
    | 'crmOrder'
    | 'offer'
    | 'navigationOrder'
    | '_count'
  >
): ImportanceEvaluation {
  const isSpam =
    item.classification === 'SPAM_IRRELEVANT' ||
    item.processingStatus === 'IGNORED';

  if (isSpam) {
    return {
      score: 0,
      tier: 'SPAM',
      reasons: ['Označeno jako spam nebo irelevantní'],
    };
  }

  const reasons: string[] = [];
  let score = CLASSIFICATION_BASE_SCORES[item.classification] ?? 20;

  // 1. Vyžaduje pozornost obchodníka / týmu
  const needsReview = item.requiresReview && item.processingStatus !== 'PROCESSED';
  if (needsReview) {
    score += 40;
    reasons.push('Vyžaduje kontrolu a potvrzení');
  }

  // 2. Nová příchozí zpráva čekající na zpracování
  if (item.processingStatus === 'INGESTED' || item.processingStatus === 'READY') {
    score += 20;
    reasons.push('Nová nezpracovaná zpráva');
  }

  // 3. Propojení se stávající zakázkou
  if (item.crmOrder) {
    score += 20;
    reasons.push(`Aktivní zakázka ${item.crmOrder.orderNumber}`);
  }

  // 4. Propojení s nabídkou
  if (item.offer) {
    score += 15;
    reasons.push('Vazba na obchodní nabídku');
  }

  // 5. Propojení s navigační zakázkou
  if (item.navigationOrder) {
    score += 15;
    reasons.push('Vazba na navigační systém');
  }

  // 6. Registrovaný klient
  if (item.client) {
    score += 10;
    reasons.push(`Firemní klient ${item.client.name}`);
  }

  // 7. Přílohy
  if ((item._count?.attachments || 0) > 0) {
    score += 5;
    reasons.push('Obsahuje přílohy');
  }

  // 8. Již vyřízeno
  if (item.processingStatus === 'PROCESSED') {
    score -= 60;
    reasons.push('Zpráva je již vyřízena');
  }

  // Určení prioritního pásma
  let tier: AiInboxPriorityTier;
  if (item.processingStatus === 'PROCESSED') {
    tier = 'LOW';
  } else if (
    item.classification === 'COMPLAINT' ||
    (item.classification === 'OFFER_ACCEPTED' && needsReview) ||
    score >= 150
  ) {
    tier = 'URGENT';
  } else if (
    score >= 70 ||
    item.classification === 'NEW_INQUIRY' ||
    item.classification === 'OFFER_ACCEPTED' ||
    item.classification === 'CHANGE_REQUEST' ||
    item.classification === 'GRAPHIC_APPROVAL' ||
    needsReview
  ) {
    tier = 'HIGH';
  } else {
    tier = 'NORMAL';
  }

  return { score, tier, reasons };
}

/**
 * Seřadí položky AI Inboxu podle zvoleného kritéria.
 * - 'IMPORTANCE_AND_TIME': prioritní pásmo sestupně, v rámci pásma od nejnovějšího času příchodu (výchozí).
 * - 'NEWEST': čistě dle času příchodu od nejnovějších.
 * - 'OLDEST': čistě dle času příchodu od nejstarších.
 * - 'IMPORTANCE_ONLY': čistě dle číselného skóre důležitosti sestupně.
 */
export function sortAiInboxItems(
  items: AiInboxListItem[],
  sortOption: AiInboxSortOption = 'IMPORTANCE_AND_TIME'
): AiInboxListItem[] {
  const evaluated = items.map((item) => {
    const evalResult = calculateAiInboxImportance(item);
    return {
      item,
      evalResult,
      timestamp: new Date(item.receivedAt).getTime(),
    };
  });

  evaluated.sort((a, b) => {
    if (sortOption === 'NEWEST') {
      return b.timestamp - a.timestamp;
    }

    if (sortOption === 'OLDEST') {
      return a.timestamp - b.timestamp;
    }

    if (sortOption === 'IMPORTANCE_ONLY') {
      if (b.evalResult.score !== a.evalResult.score) {
        return b.evalResult.score - a.evalResult.score;
      }
      return b.timestamp - a.timestamp;
    }

    // Výchozí: IMPORTANCE_AND_TIME
    // 1. Porovnat prioritní pásmo (URGENT > HIGH > NORMAL > LOW > SPAM)
    const orderDiff =
      PRIORITY_TIER_META[b.evalResult.tier].order -
      PRIORITY_TIER_META[a.evalResult.tier].order;
    if (orderDiff !== 0) {
      return orderDiff;
    }

    // 2. V rámci stejného pásma řadit podle času příchodu od nejnovějšího
    if (b.timestamp !== a.timestamp) {
      return b.timestamp - a.timestamp;
    }

    // 3. Při stejném čase rozhoduje bodové skóre
    return b.evalResult.score - a.evalResult.score;
  });

  return evaluated.map((e) => ({
    ...e.item,
    priorityTier: e.evalResult.tier,
    importanceScore: e.evalResult.score,
  }));
}
