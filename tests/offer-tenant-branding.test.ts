import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasSeePointPortfolio, navigationPresentation, offerBrandLogo } from '../lib/offers/branding';
import { OfferBrandMark } from '../components/offer/OfferBrandMark';
import { PublicOfferFooter } from '../components/offer/PublicOfferFooter';
import { NavigationOfferPublicView } from '../components/offers/NavigationOfferPublicView';
import { toProposalOffer } from '../lib/offers/presentation';
import { OfferEmailPreviewDialog } from '../components/offers/OfferEmailPreviewDialog';
import type { OfferView } from '../lib/offers/view-model';

// tsx uses the classic JSX runtime with the application's preserve setting.
Object.assign(globalThis, { React });
const branding = { id: 'qx-promotion', name: 'QX promotion' };
const offer = {
  id: 'test-offer', title: 'Test navigace', campaignName: 'Test', status: 'DRAFT',
  offerType: 'NAVIGATION', branding, client: { name: 'Test klient' }, createdBy: { name: 'Obchodník' },
  items: [], charges: [], subtotal: '0', totalWithTax: '0',
  navigation: { city: 'Ostrava', targetName: 'Prodejna', targetLatitude: 50, targetLongitude: 15, points: [], proposalMode: 'LOCATION_SELECTION' },
  campaignStrategy: { presentationSettings: { showReferences: true, showRealizations: true, showPartnershipGuarantee: true, showAboutCompany: true } },
} as unknown as OfferView;

test('portfolio access requires the canonical organization ID, never a name or stale display flags', () => {
  for (const candidate of [undefined, null, branding, { name: 'SeePoint' }, { id: 'other', name: 'SeePoint partner' }]) {
    assert.equal(hasSeePointPortfolio(candidate), false);
    assert.equal(offerBrandLogo(candidate), null);
    const settings = navigationPresentation(candidate, { showReferences: true, showRealizations: true, showPartnershipGuarantee: true });
    assert.equal(settings.showReferences, false);
    assert.equal(settings.showRealizations, false);
    assert.equal(settings.showPartnershipGuarantee, false);
  }
  assert.equal(hasSeePointPortfolio({ id: 'org_seepoint_default', name: 'Renamed' }), true);
});

test('QX public navigation with old enabled flags contains no borrowed portfolio or contacts', () => {
  const html = renderToStaticMarkup(React.createElement(NavigationOfferPublicView, { offer }));
  assert.match(html, /QX promotion/);
  assert.doesNotMatch(html, /SeePoint|seepoint|KFC|LIDL|Penny|real-mcdonalds|real-penny|400\+|150\+|15\+|statutární město Ostrava|Google Maps Routes API|Kliknutím do mapy/i);
});

test('missing tenant logo renders its name and missing contacts produce no links', () => {
  const html = renderToStaticMarkup(React.createElement(PublicOfferFooter, { branding }));
  assert.match(html, /QX promotion/);
  assert.doesNotMatch(html, /seepoint|mailto:|tel:|<img/i);
  const own = renderToStaticMarkup(React.createElement(OfferBrandMark, { branding: { ...branding, logoUrl: '/qx-logo.svg' } }));
  assert.match(own, /qx-logo\.svg/);
});

test('standard presentation and PDF data omit other tenant references and stock photos', () => {
  const proposal = toProposalOffer(offer);
  assert.deepEqual(proposal.references, []);
  assert.deepEqual(proposal.benefits, []);
  assert.equal(proposal.heroImage, '/placeholder.svg');
  assert.ok(proposal.mediaMix.every((media) => media.image === '/placeholder.svg'));
});


test('client Google map hides editing controls as well as municipal claims from legacy defaults', () => {
  const previous = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  try {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-only-no-network';
    const html = renderToStaticMarkup(React.createElement(NavigationOfferPublicView, { offer }));
    assert.doesNotMatch(html, /Vyhledat cílovou provozovnu|Kliknutím do mapy|Routes Enabled|statutární město Ostrava/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = previous;
  }
});


test('email preview uses the tenant identity and never borrows a missing logo', () => {
  for (const ownBranding of [branding, undefined]) {
    const html = renderToStaticMarkup(React.createElement(OfferEmailPreviewDialog, {
      data: { branding: ownBranding, recipient: 'test@example.invalid', campaignName: 'Test kampaně', contactName: 'Test klient', locationSelection: false, salespersonName: 'Test Admin', salespersonEmail: 'admin@example.invalid' },
      message: 'Testovací zpráva', subject: 'Test', onClose() {}, onMessageChange() {}, onSubjectChange() {},
    }));
    assert.match(html, ownBranding ? /QX promotion/ : /Dodavatel nabídky/);
    assert.doesNotMatch(html, /SeePOINT|seepoint-logo|Obchodní kontakt SeePOINT/i);
  }
});
