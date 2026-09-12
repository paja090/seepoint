import type { AiInboxClassification } from './types';

export type ConfidenceTier = 'VERY_HIGH' | 'LIKELY' | 'REVIEW' | 'UNCERTAIN';

export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.95) return 'VERY_HIGH';
  if (confidence >= 0.80) return 'LIKELY';
  if (confidence >= 0.60) return 'REVIEW';
  return 'UNCERTAIN';
}

export function getConfidenceBadge(confidence: number): {
  label: string;
  tier: ConfidenceTier;
  colorClass: string;
  percentage: number;
} {
  const percentage = Math.round(confidence * 100);
  const tier = getConfidenceTier(confidence);
  switch (tier) {
    case 'VERY_HIGH':
      return {
        label: 'Velmi vysoká jistota',
        tier,
        colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        percentage,
      };
    case 'LIKELY':
      return {
        label: 'Pravděpodobné',
        tier,
        colorClass: 'bg-blue-100 text-blue-800 border-blue-300',
        percentage,
      };
    case 'REVIEW':
      return {
        label: 'Zkontrolovat',
        tier,
        colorClass: 'bg-amber-100 text-amber-800 border-amber-300',
        percentage,
      };
    case 'UNCERTAIN':
      return {
        label: 'Nejisté',
        tier,
        colorClass: 'bg-rose-100 text-rose-800 border-rose-300',
        percentage,
      };
  }
}

export const CLASSIFICATION_LABELS: Record<
  AiInboxClassification,
  { label: string; icon: string; description: string; badgeColor: string }
> = {
  NEW_INQUIRY: {
    label: 'Nová poptávka',
    icon: '✨',
    description: 'Nová poptávka po reklamních plochách, navigaci či tisku',
    badgeColor: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  },
  EXISTING_PROJECT_REPLY: {
    label: 'Odpověď k projektu',
    icon: '💬',
    description: 'Reakce na probíhající nabídku, zakázku nebo navigaci',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  OFFER_ACCEPTED: {
    label: 'Nabídka schválena',
    icon: '✅',
    description: 'Klient vyjádřil schválení nabídky',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  OFFER_REJECTED: {
    label: 'Nabídka odmítnuta',
    icon: '❌',
    description: 'Klient nabídku odmítl',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  CHANGE_REQUEST: {
    label: 'Změna požadavku',
    icon: '🔄',
    description: 'Klient požaduje úpravu počtu ploch, lokality či parametrů',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  GRAPHIC_ASSETS: {
    label: 'Grafické podklady',
    icon: '🎨',
    description: 'Zaslaná loga nebo podklady pro tisk a vizualizaci',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  GRAPHIC_APPROVAL: {
    label: 'Grafika schválena',
    icon: '🖨️',
    description: 'Klient schválil vizualizaci nebo tisková data',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  DOCUMENTS: {
    label: 'Dokumenty / Smlouvy',
    icon: '📄',
    description: 'Objednávky, smlouvy, předávací protokoly',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  INSTALLATION_REQUEST: {
    label: 'Požadavek na montáž',
    icon: '🔧',
    description: 'Instalace, výlep nebo servisní zásah',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  PHOTO_DOCUMENTATION: {
    label: 'Fotodokumentace',
    icon: '📷',
    description: 'Fotografie z terénu nebo po instalaci',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  INVOICE_BILLING: {
    label: 'Fakturace a platby',
    icon: '💰',
    description: 'Faktury, dotazy na splatnost a vyúčtování',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  COMPLAINT: {
    label: 'Reklamace / Závada',
    icon: '⚠️',
    description: 'Hlášení poškození plochy, výpadku osvětlení či vady tisku',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  GENERAL_COMMUNICATION: {
    label: 'Běžná zpráva',
    icon: '✉️',
    description: 'Obecná obchodní komunikace a organizační dotazy',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  SPAM_IRRELEVANT: {
    label: 'Spam / Irelevantní',
    icon: '🚫',
    description: 'Nevyžádaná pošta, newslettery a automatické zprávy',
    badgeColor: 'bg-slate-100 text-slate-400 border-slate-200',
  },
  UNKNOWN: {
    label: 'Neznámý typ',
    icon: '❓',
    description: 'Obsah vyžaduje manuální kontrolu obchodníkem',
    badgeColor: 'bg-slate-100 text-slate-600 border-slate-300',
  },
};
