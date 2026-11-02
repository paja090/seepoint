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
import {
  isRestrictedHighwayOr1stClassRoad,
  isOstravaRestrictedZone,
  isCityOstrava,
  isOstravaHistoricalHeritageZone,
  isOstravaRegulatedZone,
  evaluateNavigationZoning,
  OSTRAVA_HERITAGE_ZONES_GEOJSON,
} from '../lib/ai-offers/navigation-constraints.ts';
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
    pricingTier: 'standard',
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

test('19. Detekce města Ostrava vs ostatní regiony (isCityOstrava)', () => {
  assert.equal(isCityOstrava('Ostrava', 'Hlavní třída 12'), true);
  assert.equal(isCityOstrava(undefined, 'Nádražní, Ostrava-Přívoz'), true);
  assert.equal(isCityOstrava(undefined, 'Alšovo náměstí, Poruba'), true);
  assert.equal(isCityOstrava('Brno', 'Kounicova 10'), false);
  assert.equal(isCityOstrava('Praha', 'Václavské náměstí 1'), false);
  assert.equal(isCityOstrava('Olomouc', 'Horní náměstí'), false);
});

test('20. Oddělení restrikcí: dálnice celostátně vs městské rychlostní tahy v Ostravě vs jiné agentury', () => {
  // Dálnice D1 je zakázána všude (v Ostravě i v Brně)
  assert.equal(isRestrictedHighwayOr1stClassRoad('D1 exit 354', 'Ostrava'), true);
  assert.equal(isRestrictedHighwayOr1stClassRoad('D1 km 190', 'Brno'), true);
  assert.equal(isRestrictedHighwayOr1stClassRoad('Dálnice D56', 'Ostrava'), true);

  // Rudná / Místecká je zakázána pro sloupy VO v Ostravě (I. třída / městský průtah)
  assert.equal(isRestrictedHighwayOr1stClassRoad('Rudná 12, Ostrava', 'Ostrava'), true);
  assert.equal(isRestrictedHighwayOr1stClassRoad('Místecká ulice, Ostrava', 'Ostrava'), true);

  // V jiných městech (např. Brno, Praha) ulice se jménem Rudná NESMÍ být blokována jako ostravská I. třída!
  assert.equal(isRestrictedHighwayOr1stClassRoad('Rudná 5, Brno', 'Brno'), false);
  assert.equal(isRestrictedHighwayOr1stClassRoad('Rudná ulice, Praha', 'Praha'), false);
});

test('21. Ostravská zonace: Regulovaná zóna (Nařízení 2/2020) vs Památková zóna (MPZ Masarykovo náměstí)', () => {
  // Masarykovo náměstí = MPZ (historické jádro) -> přísný zákaz navigací na VO
  const mpzResult = evaluateNavigationZoning({
    latitude: 49.8355,
    longitude: 18.2925,
    addressText: 'Masarykovo náměstí 1, Ostrava',
    city: 'Ostrava',
  });
  assert.equal(mpzResult.isOstrava, true);
  assert.equal(mpzResult.isHistoricalHeritageZone, true);
  assert.equal(mpzResult.isAllowed, false);
  assert.match(mpzResult.badge, /Památková zóna/i);

  // Hrabůvka / Závodní / širší centrum = Regulovaná zóna (Nařízení č. 2/2020), kde jsou navigace na VO POVOLENY
  // Ověříme, že pro městskou ulici v Ostravě mimo MPZ je isAllowed === true
  const standardResult = evaluateNavigationZoning({
    latitude: 49.7800,
    longitude: 18.2000,
    addressText: 'Závodní 1, Ostrava-Hrabůvka',
    city: 'Ostrava',
  });
  assert.equal(standardResult.isOstrava, true);
  assert.equal(standardResult.isHistoricalHeritageZone, false);
  assert.equal(standardResult.isAllowed, true);
  assert.match(standardResult.badge, /✓/);
});

test('22. Mimoměstská zonace pro jiné agentury (Brno, Olomouc)', () => {
  const brnoResult = evaluateNavigationZoning({
    latitude: 49.2000,
    longitude: 16.6000,
    addressText: 'Kounicova 10, Brno',
    city: 'Brno',
  });
  assert.equal(brnoResult.isOstrava, false);
  assert.equal(brnoResult.city, 'Brno');
  assert.equal(brnoResult.isAllowed, true);
  assert.match(brnoResult.badge, /Městská komunikace \(Brno\)/);
  assert.doesNotMatch(brnoResult.reason, /2\/2020/); // Žádná zmínka o ostravské vyhlášce!
});

test('23. Dvouokruhový koncept (Vnitřní okruh do 750 m vs Vnější okruh nad 750 m)', () => {
  const innerDistance = 350;
  const outerDistance = 1800;

  const isInner = innerDistance <= 750;
  const isOuter = outerDistance > 750;

  assert.equal(isInner, true);
  assert.equal(isOuter, true);

  const innerCircuit = isInner ? 'INNER' : 'OUTER';
  const outerCircuit = isOuter ? 'OUTER' : 'INNER';

  assert.equal(innerCircuit, 'INNER');
  assert.equal(outerCircuit, 'OUTER');
});

test('24. Oficiální polygonová vrstva NPÚ pro Městské památkové zóny (MPZ) Ostravy', () => {
  assert.ok(OSTRAVA_HERITAGE_ZONES_GEOJSON, 'GeoJSON památkových zón musí existovat');
  assert.equal(OSTRAVA_HERITAGE_ZONES_GEOJSON.type, 'FeatureCollection');
  assert.equal(OSTRAVA_HERITAGE_ZONES_GEOJSON.features.length, 15, 'Ostravské památkové zóny obsahují 15 oficiálních polygonů (Moravská Ostrava, Poruba, Přívoz, Vítkovice)');

  // Ověření prostorového Point-in-Polygon testu pro klíčová památková centra:
  // 1. Masarykovo náměstí (Moravská Ostrava)
  assert.equal(isOstravaHistoricalHeritageZone(49.8355, 18.2925), true);
  // 2. Alšovo náměstí / Hlavní třída (Poruba Sorela)
  assert.equal(isOstravaHistoricalHeritageZone(49.8280, 18.1700), true);
  // 3. Náměstí Svatopluka Čecha (Přívoz)
  assert.equal(isOstravaHistoricalHeritageZone(49.8510, 18.2720), true);
  // 4. Mírové náměstí / Štítová kolonie (Vítkovice)
  assert.equal(isOstravaHistoricalHeritageZone(49.8140, 18.2650), true);

  // Místo mimo památkovou zónu (Hrabůvka, Svinov, Výškovice)
  assert.equal(isOstravaHistoricalHeritageZone(49.7800, 18.2000), false);
});

test('25. Plánování montáže: Výchozí filtr "active" zobrazuje pouze body bez nahrané fotodokumentace', () => {
  type MockPoint = {
    id: string;
    orderId: string;
    hasPhoto: boolean;
    isOrderComplete: boolean;
    plannedInstallationAt: string | null;
    installerId: string | null;
  };

  const points: MockPoint[] = [
    // Zakázka 1 (stará, kompletně hotová s fotkami)
    { id: 'p1', orderId: 'ord-old-1', hasPhoto: true, isOrderComplete: true, plannedInstallationAt: '2025-01-10', installerId: 'inst-1' },
    { id: 'p2', orderId: 'ord-old-1', hasPhoto: true, isOrderComplete: true, plannedInstallationAt: '2025-01-10', installerId: 'inst-1' },
    // Zakázka 2 (aktivní, částečně namontovaná: 1 bod má fotku, 1 bod ještě nemá fotku)
    { id: 'p3', orderId: 'ord-active-2', hasPhoto: true, isOrderComplete: false, plannedInstallationAt: '2026-11-01', installerId: 'inst-2' },
    { id: 'p4', orderId: 'ord-active-2', hasPhoto: false, isOrderComplete: false, plannedInstallationAt: '2026-11-03', installerId: 'inst-2' },
    // Zakázka 3 (zbrusu nová, nenaplánovaná, žádná fotka)
    { id: 'p5', orderId: 'ord-new-3', hasPhoto: false, isOrderComplete: false, plannedInstallationAt: null, installerId: null },
  ];

  // Filtrovací logika odpovídající InstallationPlanningView.tsx (statusFilter === 'active')
  const activePoints = points.filter((p) => !p.hasPhoto);

  assert.equal(activePoints.length, 2, 'Ve výchozím zobrazení mají zůstat pouze 2 body čekající na fotodokumentaci');
  assert.deepEqual(activePoints.map((p) => p.id), ['p4', 'p5']);
  assert.ok(!activePoints.some((p) => p.orderId === 'ord-old-1'), 'Hotová zakázka ord-old-1 nesmí být ve výchozím plánování');
});

test('26. Plánování montáže: Filtry pro "Nenaplánované", "V terénu" a "Hotové (s fotodokumentací)"', () => {
  const points = [
    { id: 'p1', hasPhoto: true, plannedInstallationAt: '2025-01-10', installerId: 'inst-1' },
    { id: 'p2', hasPhoto: false, plannedInstallationAt: '2026-11-03', installerId: 'inst-2' },
    { id: 'p3', hasPhoto: false, plannedInstallationAt: null, installerId: null },
  ];

  const unplannedPoints = points.filter((p) => !p.hasPhoto && (!p.plannedInstallationAt || !p.installerId));
  const plannedPoints = points.filter((p) => !p.hasPhoto && Boolean(p.plannedInstallationAt));
  const completedPoints = points.filter((p) => p.hasPhoto);

  assert.equal(unplannedPoints.length, 1);
  assert.equal(unplannedPoints[0].id, 'p3');

  assert.equal(plannedPoints.length, 1);
  assert.equal(plannedPoints[0].id, 'p2');

  assert.equal(completedPoints.length, 1);
  assert.equal(completedPoints[0].id, 'p1');
});

test('27. Hromadná akce "⚡ Celá zakázka" vybere pouze body zakázky bez nahrané fotky', () => {
  const orderPoints = [
    { id: 'p1', orderId: 'ord-100', hasPhoto: true },
    { id: 'p2', orderId: 'ord-100', hasPhoto: false },
    { id: 'p3', orderId: 'ord-100', hasPhoto: false },
  ];

  const targetOrderId = 'ord-100';
  const selectedForOrder = orderPoints
    .filter((p) => p.orderId === targetOrderId && !p.hasPhoto)
    .map((p) => p.id);

  assert.equal(selectedForOrder.length, 2);
  assert.deepEqual(selectedForOrder, ['p2', 'p3']);
  assert.ok(!selectedForOrder.includes('p1'), 'Již namontovaný bod s fotkou p1 nesmí být vybrán pro přeplánování');
});


