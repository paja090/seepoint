import type { OfferView } from './view-model';

export function canUploadNavigationArtwork(offer: OfferView): boolean {
  const proposalMode = (offer.navigation as unknown as { proposalMode?: string } | null)?.proposalMode;
  return offer.offerType === 'NAVIGATION'
    && proposalMode === 'PRICED_QUOTE'
    && offer.status === 'ACCEPTED';
}
