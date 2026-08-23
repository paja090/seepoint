import type { OfferView } from './view-model';

function navigationProposalMode(offer: OfferView) {
  return (offer.navigation as unknown as { proposalMode?: string } | null)?.proposalMode ?? 'LOCATION_SELECTION';
}

export function canDownloadOfferPdf(offer: OfferView) {
  return offer.offerType !== 'NAVIGATION' || navigationProposalMode(offer) === 'PRICED_QUOTE';
}

export function canDownloadInstallationSheet(offer: OfferView) {
  return offer.offerType === 'NAVIGATION'
    && navigationProposalMode(offer) === 'PRICED_QUOTE'
    && offer.status === 'ACCEPTED';
}
