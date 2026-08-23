import type { OrganizationOnboardingStep } from '@prisma/client';

export const ONBOARDING_STEPS = ['COMPANY', 'OWNER', 'SETTINGS', 'INVENTORY', 'TEAM'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingRecord = {
  companyCompletedAt: Date | null;
  ownerCompletedAt: Date | null;
  settingsCompletedAt: Date | null;
  inventoryCompletedAt: Date | null;
  teamCompletedAt: Date | null;
};

export type OnboardingEvidence = {
  hasCompany: boolean;
  hasActiveOwner: boolean;
  surfaceCount: number;
  activeMemberCount: number;
};

export function deriveOnboardingProgress(record: OnboardingRecord, evidence: OnboardingEvidence) {
  const completed: Record<OnboardingStep, boolean> = {
    COMPANY: Boolean(record.companyCompletedAt) || evidence.hasCompany,
    OWNER: Boolean(record.ownerCompletedAt) || evidence.hasActiveOwner,
    SETTINGS: Boolean(record.settingsCompletedAt),
    INVENTORY: Boolean(record.inventoryCompletedAt) || evidence.surfaceCount > 0,
    TEAM: Boolean(record.teamCompletedAt) || evidence.activeMemberCount > 1,
  };
  const firstIncomplete = ONBOARDING_STEPS.find((step) => !completed[step]);
  const completedCount = ONBOARDING_STEPS.filter((step) => completed[step]).length;
  return {
    completed,
    completedCount,
    percent: Math.round((completedCount / ONBOARDING_STEPS.length) * 100),
    currentStep: (firstIncomplete ?? 'COMPLETED') as OrganizationOnboardingStep,
    isCompleted: firstIncomplete === undefined,
  };
}
