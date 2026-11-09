import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('public offer page places approval response actions immediately below header', () => {
  const pageCode = readFileSync(new URL('../app/offer/[token]/page.tsx', import.meta.url), 'utf8');

  // Verify SpecializedOfferResponseActions is rendered before SpecializedOfferSummary
  const headerIdx = pageCode.indexOf('</header>');
  const topActionsIdx = pageCode.indexOf('placement="top"');
  const summaryIdx = pageCode.indexOf('<SpecializedOfferSummary');
  const bottomActionsIdx = pageCode.indexOf('placement="bottom"');

  assert.ok(headerIdx !== -1, 'header must be present');
  assert.ok(topActionsIdx !== -1, 'top action banner must be present');
  assert.ok(summaryIdx !== -1, 'SpecializedOfferSummary must be present');
  assert.ok(bottomActionsIdx !== -1, 'bottom action banner must be present');

  assert.ok(topActionsIdx > headerIdx, 'top action banner must be after header');
  assert.ok(topActionsIdx < summaryIdx, 'top action banner must be before SpecializedOfferSummary');
  assert.ok(bottomActionsIdx > summaryIdx, 'bottom action banner must be after SpecializedOfferSummary');
});

test('SpecializedOfferResponseActions contains prominent approval buttons and point selection description', () => {
  const componentCode = readFileSync(new URL('../components/offers/SpecializedOfferResponseActions.tsx', import.meta.url), 'utf8');

  // Verify approval button text
  assert.match(componentCode, /Schválit nabídku/, 'Must have "Schválit nabídku"');
  assert.match(componentCode, /Potvrdit výběr lokalit/, 'Must have "Potvrdit výběr lokalit"');

  // Verify description regarding point selection
  assert.match(componentCode, /V nabídce si můžete sami označit a vybrat konkrétní body/, 'Must describe point selection capability');
  assert.match(componentCode, /#nav-points-section/, 'Must link directly to nav-points-section');
});

test('NavigationOfferPublicView provides dedicated point selection guide and navigation anchor', () => {
  const viewCode = readFileSync(new URL('../components/offers/NavigationOfferPublicView.tsx', import.meta.url), 'utf8');

  // Verify anchor exists for smooth scrolling
  assert.match(viewCode, /id="nav-points-section"/, 'Must have id="nav-points-section" anchor');

  // Verify point selection guide banner
  assert.match(viewCode, /Vyberte si navigační body do nabídky podle svých představ/, 'Must contain point selection header');
  assert.match(viewCode, /Označit všech/, 'Must have button to select all points');
  assert.match(viewCode, /Zrušit výběr/, 'Must have button to clear selection');

  // Verify point selection buttons on cards
  assert.match(viewCode, /✓ Vybráno v nabídce/, 'Must show selected state');
  assert.match(viewCode, /\+ Vybrat do nabídky/, 'Must show unselected state');
});

test('standard media OfferHero features Schvalit nabidku and explanatory note', () => {
  const heroCode = readFileSync(new URL('../components/offer/OfferHero.tsx', import.meta.url), 'utf8');

  assert.match(heroCode, /Schválit nabídku/, 'OfferHero button must be "Schválit nabídku"');
  assert.match(heroCode, /Nabídku můžete jedním kliknutím schválit nebo požádat o úpravu/, 'OfferHero must have explanatory text');
});

test('both navigation and standard offers support start-from-0, live daily cost, and sticky floating summary', () => {
  const navView = readFileSync(new URL('../components/offers/NavigationOfferPublicView.tsx', import.meta.url), 'utf8');
  const standardProposal = readFileSync(new URL('../components/offer/OfferProposal.tsx', import.meta.url), 'utf8');
  const showcase = readFileSync(new URL('../components/offer/CarrierShowcase.tsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../components/offer/CarrierPreviewCard.tsx', import.meta.url), 'utf8');
  const pricing = readFileSync(new URL('../components/offer/PricingSummary.tsx', import.meta.url), 'utf8');

  // Navigation offer
  assert.match(navView, /Začít od 0 a naklikat si sám/);
  assert.match(navView, /Rychlý přehled trasy/);
  assert.match(navView, /Máte zvolený start od 0 bodů/);
  assert.match(navView, /den/);

  // Standard proposal & components
  assert.match(showcase, /Začít od 0/);
  assert.match(showcase, /Poskládejte si kampaň podle svých představ/);
  assert.match(card, /Zahrnuto v kampani|\+ Přidat do kampaně/);
  assert.match(card, /den/);
  assert.match(pricing, /Máte zvolený start od 0 ploch/);
  assert.match(standardProposal, /Rychlý přehled výběru kampaně/);
  assert.match(standardProposal, /Schválit výběr/);
});

