import type { OfferView } from './view-model';

export type OfferBranding = OfferView['branding'];

// This portfolio belongs to the organization created by the foundation migration.
// A display name (including an empty one) must never grant another tenant its content.
export function hasSeePointPortfolio(branding: OfferBranding): boolean {
  return branding?.id === 'org_seepoint_default';
}

export function offerBrandName(branding: OfferBranding): string {
  return branding?.name?.trim() || 'Dodavatel nabídky';
}

export function offerBrandLogo(branding: OfferBranding): string | null {
  return branding?.logoUrl?.trim() || (hasSeePointPortfolio(branding) ? '/seepoint-logo.svg' : null);
}

export function navigationPresentation(branding: OfferBranding, settings?: Record<string, unknown> | null) {
  const ownPortfolio = hasSeePointPortfolio(branding);
  return {
    showReferences: ownPortfolio && settings?.showReferences !== false,
    showRealizations: ownPortfolio && settings?.showRealizations !== false,
    showPartnershipGuarantee: ownPortfolio && settings?.showPartnershipGuarantee !== false,
    showAboutCompany: Boolean(branding?.name?.trim()) && settings?.showAboutCompany !== false,
  };
}
