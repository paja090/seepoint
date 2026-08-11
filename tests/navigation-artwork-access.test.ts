import test from 'node:test';
import assert from 'node:assert/strict';
import { canUploadNavigationArtwork } from '../lib/offers/navigation-artwork-access.ts';
import type { OfferView } from '../lib/offers/view-model.ts';

function offer(proposalMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE', status: string): OfferView {
  return { offerType: 'NAVIGATION', status, navigation: { proposalMode } } as unknown as OfferView;
}

test('grafické podklady lze nahrát až po přijetí cenové nabídky', () => {
  assert.equal(canUploadNavigationArtwork(offer('LOCATION_SELECTION', 'SENT')), false);
  assert.equal(canUploadNavigationArtwork(offer('PRICED_QUOTE', 'SENT')), false);
  assert.equal(canUploadNavigationArtwork(offer('PRICED_QUOTE', 'ACCEPTED')), true);
});
