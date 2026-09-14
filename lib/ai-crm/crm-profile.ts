/**
 * AI CRM Intelligence — Organization Profile Service
 *
 * Configurable thresholds for follow-up timing, stalled deals, renewals,
 * and high-value opportunities. Fully multi-tenant and customizable per organization.
 */

import { prisma } from '@/lib/db';
import type { OrganizationCrmIntelligenceProfileData } from './contracts/types';

export const DEFAULT_CRM_INTELLIGENCE_PROFILE: Omit<OrganizationCrmIntelligenceProfileData, 'organizationId'> = {
  followUpAfterDays: 5,
  stalledOpportunityDays: 14,
  inactiveClientDays: 60,
  renewalWarningDays: 30,
  highValueOfferThreshold: 100000,
  enableRenewalInsights: true,
  enableUpsellInsights: true,
  enableRadarClientInsights: true,
  enableRealizationRiskInsights: true,
};

/**
 * Loads the active CRM intelligence profile for the given organization.
 * Fallbacks to clean, industry-standard defaults without hardcoded company assumptions.
 */
export async function getOrganizationCrmProfile(
  organizationId: string
): Promise<OrganizationCrmIntelligenceProfileData> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { enabledModules: true },
  }).catch(() => null);

  const rawConfig = (org?.enabledModules as Record<string, unknown> | null)?.crmIntelligenceProfile as
    | Partial<OrganizationCrmIntelligenceProfileData>
    | undefined;

  return {
    organizationId,
    followUpAfterDays: Number(rawConfig?.followUpAfterDays) || DEFAULT_CRM_INTELLIGENCE_PROFILE.followUpAfterDays,
    stalledOpportunityDays: Number(rawConfig?.stalledOpportunityDays) || DEFAULT_CRM_INTELLIGENCE_PROFILE.stalledOpportunityDays,
    inactiveClientDays: Number(rawConfig?.inactiveClientDays) || DEFAULT_CRM_INTELLIGENCE_PROFILE.inactiveClientDays,
    renewalWarningDays: Number(rawConfig?.renewalWarningDays) || DEFAULT_CRM_INTELLIGENCE_PROFILE.renewalWarningDays,
    highValueOfferThreshold: Number(rawConfig?.highValueOfferThreshold) || DEFAULT_CRM_INTELLIGENCE_PROFILE.highValueOfferThreshold,
    enableRenewalInsights: rawConfig?.enableRenewalInsights ?? DEFAULT_CRM_INTELLIGENCE_PROFILE.enableRenewalInsights,
    enableUpsellInsights: rawConfig?.enableUpsellInsights ?? DEFAULT_CRM_INTELLIGENCE_PROFILE.enableUpsellInsights,
    enableRadarClientInsights: rawConfig?.enableRadarClientInsights ?? DEFAULT_CRM_INTELLIGENCE_PROFILE.enableRadarClientInsights,
    enableRealizationRiskInsights: rawConfig?.enableRealizationRiskInsights ?? DEFAULT_CRM_INTELLIGENCE_PROFILE.enableRealizationRiskInsights,
  };
}
