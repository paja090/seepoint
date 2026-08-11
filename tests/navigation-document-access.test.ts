import assert from 'node:assert/strict';
import test from 'node:test';
import { canDownloadInstallationSheet, canDownloadOfferPdf } from '../lib/offers/navigation-document-access.ts';
import type { OfferView } from '../lib/offers/view-model.ts';

function offer(proposalMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE', status = 'DRAFT'): OfferView {
  return {
    offerType: 'NAVIGATION',
    status,
    navigation: { proposalMode } as unknown as OfferView['navigation'],
  } as OfferView;
}

test('fáze 1 blokuje cenové PDF i montážní list', () => {
  const phaseOne = offer('LOCATION_SELECTION');
  assert.equal(canDownloadOfferPdf(phaseOne), false);
  assert.equal(canDownloadInstallationSheet(phaseOne), false);
});

test('fáze 2 zpřístupní cenové PDF, ale montážní list až po přijetí', () => {
  assert.equal(canDownloadOfferPdf(offer('PRICED_QUOTE', 'SENT')), true);
  assert.equal(canDownloadInstallationSheet(offer('PRICED_QUOTE', 'SENT')), false);
  assert.equal(canDownloadInstallationSheet(offer('PRICED_QUOTE', 'ACCEPTED')), true);
});

test('cenová PDF ostatních typů nabídek zůstávají dostupná', () => {
  const standard = { offerType: 'STANDARD_MEDIA', status: 'DRAFT' } as OfferView;
  assert.equal(canDownloadOfferPdf(standard), true);
  assert.equal(canDownloadInstallationSheet(standard), false);
});
