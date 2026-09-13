import { prisma } from '@/lib/db';
import {
  type OrganizationRealizationProfile,
  DEFAULT_REALIZATION_PROFILE,
} from './contracts/realization-profile';

/**
 * Resolves the configuration profile for AI Realization Intelligence.
 * Uses safe, deterministic defaults and respects organization-level overrides if configured.
 * Does not require schema migration or abuse feature flags.
 */
export async function getOrganizationRealizationProfile(
  organizationId: string
): Promise<OrganizationRealizationProfile> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, enabledModules: true },
    });

    if (!org) {
      return {
        organizationId,
        ...DEFAULT_REALIZATION_PROFILE,
      };
    }

    // If organization has custom realization profile stored in configuration
    const modulesConfig = org.enabledModules as Record<string, unknown> | null;
    const customConfig = modulesConfig?.realizationProfile as Partial<OrganizationRealizationProfile> | undefined;

    if (customConfig && typeof customConfig === 'object') {
      return {
        organizationId,
        requiredGraphicsApproval: customConfig.requiredGraphicsApproval ?? DEFAULT_REALIZATION_PROFILE.requiredGraphicsApproval,
        requiredPhotoDocumentation: customConfig.requiredPhotoDocumentation ?? DEFAULT_REALIZATION_PROFILE.requiredPhotoDocumentation,
        requiredFinalReview: customConfig.requiredFinalReview ?? DEFAULT_REALIZATION_PROFILE.requiredFinalReview,
        billingRequiresPhotos: customConfig.billingRequiresPhotos ?? DEFAULT_REALIZATION_PROFILE.billingRequiresPhotos,
        deadlineWarningDays: typeof customConfig.deadlineWarningDays === 'number' && customConfig.deadlineWarningDays > 0
          ? customConfig.deadlineWarningDays
          : DEFAULT_REALIZATION_PROFILE.deadlineWarningDays,
        productionLeadDays: typeof customConfig.productionLeadDays === 'number' && customConfig.productionLeadDays > 0
          ? customConfig.productionLeadDays
          : DEFAULT_REALIZATION_PROFILE.productionLeadDays,
        installationLeadDays: typeof customConfig.installationLeadDays === 'number' && customConfig.installationLeadDays > 0
          ? customConfig.installationLeadDays
          : DEFAULT_REALIZATION_PROFILE.installationLeadDays,
        automaticTaskGeneration: customConfig.automaticTaskGeneration ?? DEFAULT_REALIZATION_PROFILE.automaticTaskGeneration,
      };
    }

    return {
      organizationId,
      ...DEFAULT_REALIZATION_PROFILE,
    };
  } catch {
    return {
      organizationId,
      ...DEFAULT_REALIZATION_PROFILE,
    };
  }
}
