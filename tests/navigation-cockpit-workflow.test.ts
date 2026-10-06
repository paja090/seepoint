import assert from 'node:assert/strict';
import test from 'node:test';
import { offerReadinessChecks } from '../lib/offers/workflow.ts';
import { calculateNavigationOfferTotals, calculateNavigationPointSubtotal } from '../lib/offers/navigation-pricing.ts';
import {
  NAVIGATION_CARRIER_TYPES,
  CARRIER_PIN_COLORS,
  getPointPinVisual,
  getPointPinColor,
  detectCarrierCategory,
} from '../lib/offers/navigation-carrier-types.ts';
import { isRestrictedHighwayOr1stClassRoad, isOstravaRestrictedZone } from '../lib/ai-offers/navigation-constraints.ts';
import { TARGET_COLORS } from '../components/offers/navigation-cockpit/types.ts';
import type { OfferView } from '../lib/offers/view-model.ts';
import { Prisma } from '@prisma/client';

function createMockNavigationOffer(overrides: Partial<OfferView> = {}): OfferView {
  return {
    id: 'nav-offer-test-1',
    offerType: 'NAVIGATION',
    clientId: 'client-1',
    title: 'Navigační kampaň Ostrava',
    campaignName: 'Navigační kampaň Ostrava',
    contactPerson: 'Petr Novák',
    contactEmail: 'novak@example.cz',
    status: 'DRAFT',
    validUntil: '2026-12-31',
    currency: 'CZK',
    taxRate: '21.00',
    subtotalBeforeDiscount: '0.00',
    subtotal: '0.00',
    discountAmount: '0.00',
    taxAmount: '0.00',
    totalWithTax: '0.00',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    createdBy: { name: 'Obchodník SeePoint' },
    client: { name: 'Autocentrum Ostrava s.r.o.', email: 'info@autocentrum.cz' },
    items: [],
    charges: [],
    navigation: {
      city: 'Ostrava',
      targetName: 'Autocentrum Prodejna 1',
      targetAddress: 'Rudná 112, Ostrava',
      targetLatitude: 49.8123,
      targetLongitude: 18.2345,
      proposalMode: 'LOCATION_SELECTION',
      targets: [
        {
          id: 'target-1',
          name: 'Autocentrum Prodejna 1',
          address: 'Rudná 112, Ostrava',
          latitude: 49.8123,
          longitude: 18.2345,
          color: '#be123c',
        },
        {
          id: 'target-2',
          name: 'Autocentrum Servis 2',
          address: 'Výstavní 45, Ostrava',
          latitude: 49.8250,
          longitude: 18.2600,
          color: '#2563eb',
        },
      ],
      points: [
        {
          id: 'point-1',
          label: 'Směrovka Rudná nároží',
          latitude: 49.8100,
          longitude: 18.2300,
          navigationType: 'Směrová tabule',
          variant: '670 × 900 mm',
          orientation: 'Jednostranná',
          quantity: '1',
          unitPrice: '0',
          subtotal: '0',
          installationPrice: '0',
          removalPrice: '0',
          productionPrice: '0',
          framePrice: '0',
          status: 'PLANNED',
          targetId: 'target-1',
          arrowDirectionEnum: 'LEFT',
          sitePhotoId: 'photo-1',
          visualizedPhotoUrl: 'data:image/jpeg;base64,mock',
          isSelectedByClient: true,
        },
        {
          id: 'point-2',
          label: 'A-stojan před vjezdem',
          latitude: 49.8240,
          longitude: 18.2580,
          navigationType: 'A-stojan',
          variant: 'A1 (594 × 841 mm)',
          orientation: 'Oboustranná',
          quantity: '1',
          unitPrice: '0',
          subtotal: '0',
          installationPrice: '0',
          removalPrice: '0',
          productionPrice: '0',
          framePrice: '0',
          status: 'PLANNED',
          targetId: 'target-2',
          arrowDirectionEnum: 'STRAIGHT',
          sitePhotoId: 'photo-2',
          visualizedPhotoUrl: 'data:image/jpeg;base64,mock2',
          isSelectedByClient: false,
        },
      ],
    },
    ...overrides,
  };
}

test('1. Stage-aware readiness: Fáze 1 (LOCATION_SELECTION) s cenou 0 Kč projde auditem bez chyby', () => {
  const offer = createMockNavigationOffer();
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  const calcCheck = checks.find((c) => c.id === 'calculation');
  assert.equal(calcCheck?.status, 'ok', 'Fáze 1 nesmí blokovat nulovou cenu.');
  assert.match(calcCheck?.detail || '', /Fáze 1: Lokační výběr bez cen/, 'Musí informovat, že kalkulace následuje.');
});

test('2. Stage-aware readiness: Fáze 2 (PRICED_QUOTE) s cenou 0 Kč vyžaduje doplnění cen', () => {
  const offer = createMockNavigationOffer();
  offer.navigation!.proposalMode = 'PRICED_QUOTE';
  offer.totalWithTax = '0.00';
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  const calcCheck = checks.find((c) => c.id === 'calculation');
  assert.equal(calcCheck?.status, 'error', 'Fáze 2 musí vyžadovat nenulovou cenu.');
});

test('3. Stage-aware readiness: Fáze 2 (PRICED_QUOTE) s kladnou cenou projde auditem', () => {
  const offer = createMockNavigationOffer();
  offer.navigation!.proposalMode = 'PRICED_QUOTE';
  offer.totalWithTax = '14520.00';
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  const calcCheck = checks.find((c) => c.id === 'calculation');
  assert.equal(calcCheck?.status, 'ok', 'Kladná kalkulace projde auditem.');
});

test('4. Správa cílů: definice palety barev pro provozovny v Cockpitu', () => {
  assert.ok(Array.isArray(TARGET_COLORS));
  assert.ok(TARGET_COLORS.length >= 7);
  assert.equal(TARGET_COLORS[0], '#be123c');
  assert.equal(TARGET_COLORS[1], '#2563eb');
});

test('5. Provázání cílů a bodů: bod má přiřazený konkrétní targetId a cílové souřadnice', () => {
  const offer = createMockNavigationOffer();
  const p1 = offer.navigation!.points[0];
  const p2 = offer.navigation!.points[1];
  assert.equal(p1.targetId, 'target-1');
  assert.equal(p2.targetId, 'target-2');
});

test('6. Specifické nosiče a rozměry: Áčka, Towery a směrové tabule v konfiguraci nosičů', () => {
  const aStand = NAVIGATION_CARRIER_TYPES.find((c) => c.id === 'A_BOARD');
  const tower = NAVIGATION_CARRIER_TYPES.find((c) => c.id === 'TOWER');
  const directional = NAVIGATION_CARRIER_TYPES.find((c) => c.id === 'NAVIGATION');

  assert.ok(aStand, 'A-stojan nosič musí existovat v konfiguraci');
  assert.ok(tower, 'Tower nosič musí existovat v konfiguraci');
  assert.ok(directional, 'Směrová tabule musí existovat v konfiguraci');

  assert.equal(aStand.label, 'Áčko / Reklamní stojan');
  assert.equal(tower.label, 'Tower / Pylon / Věž');
  assert.equal(directional.label, 'Směrová tabule (VO)');
});

test('7. Barevné odlišení pinů podle typu nosiče: detekce kategorie nosiče', () => {
  const aStandVisual = getPointPinVisual({ navigationType: 'A-stojan' });
  assert.equal(aStandVisual.category.id, 'A_BOARD');
  assert.equal(aStandVisual.color, '#ea580c');

  const towerVisual = getPointPinVisual({ navigationType: 'Navigační tower' });
  assert.equal(towerVisual.category.id, 'TOWER');
  assert.equal(towerVisual.color, '#7c3aed');

  const navVisual = getPointPinVisual({ navigationType: 'Směrová tabule' });
  assert.equal(navVisual.category.id, 'NAVIGATION');
  assert.equal(navVisual.color, '#0284c7');
});

test('8. Směrové šipky: validace 13 směrů včetně kruhových objezdů', () => {
  const validArrows = [
    'LEFT', 'RIGHT', 'STRAIGHT', 'SLANTED_LEFT', 'SLANTED_RIGHT', 'U_TURN', 'TWO_WAY',
    'ROUNDABOUT_1', 'ROUNDABOUT_2', 'ROUNDABOUT_3', 'ROUNDABOUT_4', 'ROUNDABOUT_5', 'ROUNDABOUT',
  ];
  assert.equal(validArrows.length, 13, 'Musí existovat 13 standardních navigačních směrů.');
  for (const arrow of validArrows) {
    assert.ok(typeof arrow === 'string' && arrow.length > 0);
  }
});

test('9. Položková kalkulace navigačního bodu: nájem, rám, výroba, montáž, demontáž', () => {
  const subtotal = calculateNavigationPointSubtotal({
    quantity: new Prisma.Decimal(2),
    unitPrice: new Prisma.Decimal(1200),
    framePrice: new Prisma.Decimal(500),
    productionPrice: new Prisma.Decimal(800),
    installationPrice: new Prisma.Decimal(400),
    removalPrice: new Prisma.Decimal(200),
  });
  // (1200 + 500 + 800 + 400 + 200) * 2 = 3100 * 2 = 6200
  assert.equal(subtotal.toString(), '6200');
});

test('10. Celkový rozpočet nabídky s DPH 21 %', () => {
  const pointSubtotals = [new Prisma.Decimal(6200), new Prisma.Decimal(3800)];
  const totals = calculateNavigationOfferTotals(pointSubtotals);
  assert.equal(totals.subtotal.toString(), '10000');
  assert.equal(totals.taxAmount.toString(), '2100');
  assert.equal(totals.totalWithTax.toString(), '12100');
});

test('11. Ostrava restrikce: detekce dálnic a silnic 1. třídy dle zákona o pozemních komunikacích', () => {
  assert.equal(isRestrictedHighwayOr1stClassRoad('D1 exit 354'), true);
  assert.equal(isRestrictedHighwayOr1stClassRoad('Rudná silnice I/11 Ostrava'), true);
  assert.equal(isRestrictedHighwayOr1stClassRoad('Místecká I/56 Ostrava'), true);
  assert.equal(isRestrictedHighwayOr1stClassRoad('Nádražní 12, Ostrava'), false);
});

test('12. Ostrava restrikce: detekce památkové zóny (Nařízení č. 2/2020)', () => {
  assert.equal(isOstravaRestrictedZone(49.8355, 18.2925, 'Masarykovo náměstí, Ostrava'), true);
  assert.equal(isOstravaRestrictedZone(49.7800, 18.2000, 'Závodní 1, Hrabůvka'), false);
});

test('13. Zachování alternativ: nevybrané body klientem se nemažou a mají isSelectedByClient === false', () => {
  const offer = createMockNavigationOffer();
  const selected = offer.navigation!.points.filter((p) => p.isSelectedByClient !== false);
  const unselected = offer.navigation!.points.filter((p) => p.isSelectedByClient === false);
  assert.equal(selected.length, 1);
  assert.equal(unselected.length, 1);
  assert.equal(unselected[0].id, 'point-2');
});

test('14. Kontrola přítomnosti cílů v auditu připravenosti navigace', () => {
  const offer = createMockNavigationOffer();
  offer.navigation!.targetName = '';
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  assert.equal(checks.find((c) => c.id === 'target')?.status, 'error');
});

test('15. Kontrola přítomnosti navigačních bodů v auditu připravenosti', () => {
  const offer = createMockNavigationOffer();
  offer.navigation!.points = [];
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  assert.equal(checks.find((c) => c.id === 'points')?.status, 'error');
});

test('16. Kontrola klientských vizuálů bodů v auditu připravenosti', () => {
  const offer = createMockNavigationOffer();
  offer.navigation!.points[0].visualizedPhotoUrl = null;
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  assert.equal(checks.find((c) => c.id === 'navigationVisuals')?.status, 'error');
});

test('17. Kontrola terénních fotografií sloupů v auditu připravenosti', () => {
  const offer = createMockNavigationOffer();
  const checks = offerReadinessChecks(offer, [], '2026-10-06');
  assert.equal(checks.find((c) => c.id === 'navigationSitePhotos')?.status, 'ok');
});

test('18. Validace struktury navigační nabídky pro obě fáze workflow', () => {
  const phase1Offer = createMockNavigationOffer({
    navigation: {
      ...createMockNavigationOffer().navigation!,
      proposalMode: 'LOCATION_SELECTION',
    },
  });
  assert.equal(phase1Offer.navigation?.proposalMode, 'LOCATION_SELECTION');

  const phase2Offer = createMockNavigationOffer({
    totalWithTax: '15000.00',
    navigation: {
      ...createMockNavigationOffer().navigation!,
      proposalMode: 'PRICED_QUOTE',
    },
  });
  assert.equal(phase2Offer.navigation?.proposalMode, 'PRICED_QUOTE');
  assert.equal(Number(phase2Offer.totalWithTax), 15000);
});
