import assert from 'node:assert/strict';
import test from 'node:test';
import { offerMissingAssets, offerReadinessChecks } from '../lib/offers/workflow.ts';
import type { OfferView } from '../lib/offers/view-model.ts';

function standardOffer(clientVisible: boolean): OfferView {
  return {
    id: 'offer-1', clientId: 'client-1', title: 'Interní název', campaignName: 'Letní kampaň',
    contactPerson: 'Jan Novák', contactEmail: 'jan@example.cz', status: 'DRAFT', validUntil: '2026-08-01',
    currency: 'CZK', taxRate: '21.00', subtotalBeforeDiscount: '10000.00', subtotal: '10000.00', discountAmount: '0.00', taxAmount: '2100.00', totalWithTax: '12100.00',
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', createdBy: { name: 'Obchodník' }, client: { name: 'Klient s.r.o.' }, charges: [],
    items: [{
      id: 'item-1', surfaceId: 'surface-1', dateFrom: '2026-08-10', dateTo: '2026-08-31', quantity: '1.00', unit: 'plocha', unitPrice: '10000.00', discountPercent: '0.00', discountAmount: '0.00', subtotal: '10000.00', groupLabel: 'Billboard',
      surface: { name: 'Plocha A', mediaType: 'BILLBOARD', carrier: { code: 'BB-1', name: 'Billboard 1', city: 'Praha', latitude: 50.08, longitude: 14.43 }, photos: [{ id: 'photo-1', url: '/photo.jpg', isPrimary: true, isClientVisible: clientVisible }] },
    }],
  };
}

test('audit blokuje fotografii, která není označená jako viditelná klientovi', () => {
  const offer = standardOffer(false);
  assert.equal(offerMissingAssets(offer).some((asset) => asset.kind === 'photo'), true);
  assert.equal(offerReadinessChecks(offer, [], '2026-07-16').find((check) => check.id === 'photos')?.status, 'error');
});

test('kompletní standardní nabídka projde auditem', () => {
  const failed = offerReadinessChecks(standardOffer(true), [], '2026-07-16').filter((check) => check.status === 'error');
  assert.deepEqual(failed, []);
});

test('audit blokuje prošlou platnost a chybějící kontakt', () => {
  const offer = standardOffer(true);
  offer.validUntil = '2026-07-15';
  offer.contactEmail = '';
  const failed = offerReadinessChecks(offer, [], '2026-07-16').filter((check) => check.status === 'error').map((check) => check.id);
  assert.deepEqual(failed.slice(0, 2), ['client', 'validity']);
});
