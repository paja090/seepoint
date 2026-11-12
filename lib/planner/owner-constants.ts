export type ApprovalCategory = 'DISCOUNT' | 'EXPENSE' | 'SCHEDULE' | 'COMMERCIAL' | 'OTHER';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'INFO_REQUESTED' | 'REJECTED';

export const APPROVAL_CATEGORY_LABELS: Record<ApprovalCategory, string> = {
  DISCOUNT: 'Sleva / Výjimka z ceny',
  EXPENSE: 'Mimořádný náklad / Nákup',
  SCHEDULE: 'Termín / Realizace',
  COMMERCIAL: 'Obchodní podmínky / Smlouva',
  OTHER: 'Jiné rozhodnutí',
};
