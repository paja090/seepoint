import type { OfferView } from './view-model';

export function canUploadNavigationArtwork(offer: OfferView): boolean {
  return offer.offerType === 'NAVIGATION' && !['REJECTED', 'ARCHIVED'].includes(offer.status);
}
