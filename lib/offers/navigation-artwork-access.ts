import type { OfferView } from './view-model';

export type NavigationArtworkAccessState = {
  offerType?: string | null;
  status: string;
  proposalMode?: string | null;
};

export function canUploadNavigationArtworkForState(state: NavigationArtworkAccessState): boolean {
  return state.offerType === 'NAVIGATION'
    && state.proposalMode === 'PRICED_QUOTE'
    && state.status === 'ACCEPTED';
}

export function canUploadNavigationArtwork(offer: OfferView): boolean {
  const navigation = offer.navigation as ({ proposalMode?: string | null } & NonNullable<OfferView['navigation']>) | null | undefined;
  return canUploadNavigationArtworkForState({
    offerType: offer.offerType,
    status: offer.status,
    proposalMode: navigation?.proposalMode,
  });
}
