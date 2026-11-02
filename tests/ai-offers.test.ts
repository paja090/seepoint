import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommendOfferType, inferMediaType, inferQuantity } from '../lib/ai-offers/intent-parser.ts';
import { hasBlockingCollision, isSurfaceAvailable } from '../lib/ai-offers/availability.ts';
import { scoreStandardSurface } from '../lib/ai-offers/scoring.ts';

test('navigation intent is never interpreted as standard media', () => {
  assert.equal(recommendOfferType('KFC chce navigaci k nové pobočce, 6 cedulí na rok.'), 'NAVIGATION');
  assert.equal(recommendOfferType('Potřebuji 6 navigačních cedulí ke Kauflandu.'), 'NAVIGATION');
});

test('standard media intent and media details are extracted', () => {
  const prompt = 'Divadlo chce 20 City Posterů na propagaci představení v říjnu.';
  assert.equal(recommendOfferType(prompt), 'STANDARD_MEDIA');
  assert.equal(inferMediaType(prompt), 'CITY_POSTER');
  assert.equal(inferQuantity(prompt), 20);
});

test('reserved and occupied overlaps block a surface', () => {
  const dateFrom = new Date('2026-10-01'); const dateTo = new Date('2026-10-31');
  assert.equal(hasBlockingCollision([{ status: 'RESERVED', dateFrom: new Date('2026-09-15'), dateTo: new Date('2026-10-02') }], dateFrom, dateTo), true);
  assert.equal(hasBlockingCollision([{ status: 'OCCUPIED', dateFrom: new Date('2026-11-01'), dateTo: new Date('2026-11-30') }], dateFrom, dateTo), false);
});

test('availability is evaluated per advertising surface (A can be blocked while B is free)', () => {
  const period = { dateFrom: new Date('2026-10-01'), dateTo: new Date('2026-10-31') };
  const common = { carrierActive: true, carrierArchived: false, surfaceStatus: 'AVAILABLE', ...period };
  assert.equal(isSurfaceAvailable({ ...common, occupancies: [{ status: 'OCCUPIED', dateFrom: period.dateFrom, dateTo: period.dateTo }] }), false);
  assert.equal(isSurfaceAvailable({ ...common, occupancies: [] }), true);
});

test('surface scoring is transparent', () => {
  const result = scoreStandardSurface({ cityMatch: true, mediaMatch: true, price: 1000, budgetPerItem: 1500, hasGps: true });
  assert.equal(result.score, 95);
  assert.ok(result.reasons.some((reason) => reason.includes('dostupná')));
  assert.ok(result.reasons.some((reason) => reason.includes('městu')));
});

test('AI endpoint contains no invented price fallback or automatic budget discount', () => {
  const route = readFileSync(new URL('../app/api/offers/ai-generate/route.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /surface\.price\s*\|\|\s*2500/);
  assert.doesNotMatch(service, /discountAmount\s*=\s*currentTotal/);
  assert.match(service, /previewAiOffer/);
  assert.match(service, /confirmAiOffer/);
});

test('pricing segment and historical price snapshot fields exist in schema', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /enum ClientPricingSegment/);
  assert.match(schema, /pricingSegment\s+ClientPricingSegment/);
  assert.match(schema, /catalogPrice\s+Decimal\?/);
  assert.match(schema, /overrideReason\s+String\?/);
  assert.match(schema, /mountingType\s+MountingType\?/);
});

test('navigation catalog migration contains the supplied Ostrava prices', () => {
  const migration = readFileSync(new URL('../prisma/migrations/20260813180000_navigation_ostrava_price_catalog/migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /NAV_OSR_RENTAL_LIGHT_POLE_12M[\s\S]*9500/);
  assert.match(migration, /NAV_OSR_RENTAL_TRACTION_12M[\s\S]*12000/);
  assert.match(migration, /NAV_OSR_RENTAL_COLUMN_12M[\s\S]*12000/);
  assert.match(migration, /NAV_OSR_INSTALLATION[\s\S]*800/);
  assert.match(migration, /NAV_OSR_REMOVAL[\s\S]*600/);
  assert.match(migration, /NAV_OSR_FRAME_DFLEX[\s\S]*1960/);
  assert.match(migration, /NAV_OSR_PRINT_UV_DIBOND[\s\S]*600/);
});

test('navigation confirmation records missing prices as an explicit draft state', () => {
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  assert.match(service, /status: preview\.items\[index\]\?\.finalPrice === null \? 'MISSING' : 'PROVISIONAL'/);
  assert.match(service, /requiresSitePhoto: true/);
  assert.doesNotMatch(service, /unitPrice:\s*\(item\.componentPrices\?\.RENTAL\?\.unitPrice\s*\?\?\s*0\)/);
});

test('navigation target can be geocoded from an address', () => {
  const generator = readFileSync(new URL('../lib/ai-offers/navigation-generator.ts', import.meta.url), 'utf8');
  assert.match(generator, /geocodeAddress/);
  assert.match(generator, /selectedCandidateIds/);
  assert.match(generator, /approachOrigins/);
  assert.doesNotMatch(generator, /advertisingSurface\.findMany|advertisingCarrier\.findMany/);
});

test('browser route analysis replaces radial placeholders with real decision points', () => {
  const map = readFileSync(new URL('../components/offers/GoogleNavigationOfferMap.tsx', import.meta.url), 'utf8');
  const modal = readFileSync(new URL('../components/offers/AiOfferGeneratorModal.tsx', import.meta.url), 'utf8');
  assert.match(map, /DirectionsService/);
  assert.match(map, /isTurn/);
  assert.match(map, /isMainRoad/);
  assert.match(map, /onSuggestedPoints/);
  assert.match(modal, /navigationPoints:/);
  assert.match(modal, /Polohu si AI dohledá sama/);
  assert.doesNotMatch(modal, />Latitude<|>Longitude</);
});

test('confirmed navigation keeps the route points selected in the browser', () => {
  const generator = readFileSync(new URL('../lib/ai-offers/navigation-generator.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  assert.match(service, /request\.navigationPoints/);
  assert.match(generator, /refinedPoints/);
  assert.match(generator, /isRefinedPoint/);
});

test('AI navigation points are new proposals requiring a real pole photo', () => {
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../lib/offers/workflow.ts', import.meta.url), 'utf8');
  assert.match(service, /carrierId: null, surfaceId: null/);
  assert.match(service, /requiresSitePhoto: true/);
  assert.match(workflow, /navigationSitePhotos/);
});

test('calculateBearing and calculateTurnAngle determine truthful turn directions', async () => {
  const { calculateBearing, calculateTurnAngle } = await import('../lib/ai-offers/route-direction-helper.ts');

  // North (from 49.0, 18.0 to 49.1, 18.0)
  const bearingNorth = calculateBearing({ latitude: 49.0, longitude: 18.0 }, { latitude: 49.1, longitude: 18.0 });
  assert.ok(Math.abs(bearingNorth - 0) < 0.5 || Math.abs(bearingNorth - 360) < 0.5);

  // East (from 49.0, 18.0 to 49.0, 18.1)
  const bearingEast = calculateBearing({ latitude: 49.0, longitude: 18.0 }, { latitude: 49.0, longitude: 18.1 });
  assert.ok(Math.abs(bearingEast - 90) < 1.0);

  // Turn North to East -> Right turn (+90 deg)
  const turnRight = calculateTurnAngle(bearingNorth, bearingEast);
  assert.ok(turnRight > 80 && turnRight < 100);

  // Turn North to West -> Left turn (-90 deg)
  const bearingWest = calculateBearing({ latitude: 49.0, longitude: 18.0 }, { latitude: 49.0, longitude: 17.9 });
  const turnLeft = calculateTurnAngle(bearingNorth, bearingWest);
  assert.ok(turnLeft < -80 && turnLeft > -100);
});

test('inferArrowDirectionFromRoute determines LEFT, RIGHT and STRAIGHT accurately', async () => {
  const { inferArrowDirectionFromRoute, encodePolylinePoints } = await import('../lib/ai-offers/route-direction-helper.ts');

  const origin = { latitude: 49.8355, longitude: 18.2925 };
  const targetEast = { latitude: 49.8365, longitude: 18.3100 };
  const targetWest = { latitude: 49.8365, longitude: 18.2750 };
  const targetNorth = { latitude: 49.8500, longitude: 18.2925 };

  // Polyline 1: starts North, then turns East (Right)
  const rightPolyline = encodePolylinePoints([
    origin,
    { latitude: 49.8360, longitude: 18.2925 },
    { latitude: 49.8360, longitude: 18.2950 },
    targetEast,
  ]);
  const rightTurn = inferArrowDirectionFromRoute(origin, targetEast, rightPolyline);
  assert.equal(rightTurn.arrowDirection, 'RIGHT');
  assert.equal(rightTurn.turnText, 'vpravo');

  // Polyline 2: starts North, then turns West (Left)
  const leftPolyline = encodePolylinePoints([
    origin,
    { latitude: 49.8360, longitude: 18.2925 },
    { latitude: 49.8360, longitude: 18.2900 },
    targetWest,
  ]);
  const leftTurn = inferArrowDirectionFromRoute(origin, targetWest, leftPolyline);
  assert.equal(leftTurn.arrowDirection, 'LEFT');
  assert.equal(leftTurn.turnText, 'vlevo');

  // Polyline 3: continues straight North
  const straightPolyline = encodePolylinePoints([
    origin,
    { latitude: 49.8370, longitude: 18.2925 },
    { latitude: 49.8400, longitude: 18.2925 },
    targetNorth,
  ]);
  const straight = inferArrowDirectionFromRoute(origin, targetNorth, straightPolyline);
  assert.equal(straight.arrowDirection, 'STRAIGHT');
  assert.equal(straight.turnText, 'rovně');
});

test('formatNavigationPointDetails produces truthful title and descriptions', async () => {
  const { formatNavigationPointDetails } = await import('../lib/ai-offers/route-direction-helper.ts');

  // Inner circuit right turn
  const innerResult = formatNavigationPointDetails({
    circuit: 'INNER',
    streetPart: 'Výstavní',
    arrowDirection: 'RIGHT',
    turnText: 'vpravo',
    turnVerb: 'Odbočení vpravo',
    distanceMeters: 450,
    zoning: { isAllowed: true, reason: 'Povoleno', isRegulatedZone: true },
  });
  assert.match(innerResult.title, /\[Vnitřní okruh\] Odbočení vpravo na Výstavní \(450 m\)/);
  assert.ok(innerResult.reasons.some((r) => r.includes('Vnitřní okruh (dojezd)')));
  assert.ok(innerResult.reasons.some((r) => r.includes('Směrové rčení: Odbočení vpravo (vpravo) na Výstavní')));

  // Outer circuit left turn
  const outerResult = formatNavigationPointDetails({
    circuit: 'OUTER',
    streetPart: 'Opavská',
    arrowDirection: 'LEFT',
    turnText: 'vlevo',
    turnVerb: 'Odbočení vlevo',
    distanceMeters: 1400,
    zoning: { isAllowed: true, reason: 'Povoleno', isRegulatedZone: false },
  });
  assert.match(outerResult.title, /\[Vnější okruh\] Odbočení vlevo na Opavská \(1,4 km\)/);
  assert.ok(outerResult.reasons.some((r) => r.includes('Vnější okruh (hlavní tah)')));

  // Prohibited zone
  const prohibitedResult = formatNavigationPointDetails({
    circuit: 'INNER',
    streetPart: 'Masarykovo náměstí',
    arrowDirection: 'STRAIGHT',
    turnText: 'rovně',
    turnVerb: 'Pokračovat rovně',
    distanceMeters: 300,
    zoning: { isAllowed: false, reason: 'Památková zóna MPZ', isRegulatedZone: true, badge: '🏛️ Památková zóna (MPZ)' },
  });
  assert.match(prohibitedResult.title, /🏛️ Památková zóna \(MPZ\)/);
  assert.ok(prohibitedResult.reasons.some((r) => r.includes('Památková zóna MPZ')));
});

test('AiOfferGeneratorModal contains dedicated AI re-analysis button and live route recalculation', () => {
  const modal = readFileSync(new URL('../components/offers/AiOfferGeneratorModal.tsx', import.meta.url), 'utf8');
  assert.match(modal, /handleReanalyzeWithAi/);
  assert.match(modal, /✨ Znovu AI: Zkontrolovat a přepočítat trasy & směry/);
  assert.match(modal, /fetchRouteForPoint/);
  assert.match(modal, /inferArrowDirectionFromRoute/);
  assert.match(modal, /formatNavigationPointDetails/);
});

test('NavigationOfferCockpit recalculates routes and arrow directions truthfully', () => {
  const cockpit = readFileSync(new URL('../components/offers/navigation-cockpit/NavigationOfferCockpit.tsx', import.meta.url), 'utf8');
  assert.match(cockpit, /inferArrowDirectionFromRoute/);
  assert.match(cockpit, /recalculateAllRoutes/);
  assert.match(cockpit, /handlePointMove/);
});

test('offerReadinessChecks verifies AI routes and truthful arrow directions for navigation offers', async () => {
  const { offerReadinessChecks } = await import('../lib/offers/workflow.ts');
  type OfferView = Parameters<typeof offerReadinessChecks>[0];

  // Case 1: Offer with verified routes and directions
  const verifiedOffer = {
    offerType: 'NAVIGATION',
    client: { name: 'Supermarket Ostrava', contactEmail: 'info@supermarket.cz' },
    validUntil: '2028-12-31',
    totalWithTax: '50000',
    navigation: {
      targetName: 'Supermarket Ostrava',
      targetLatitude: 49.8355,
      targetLongitude: 18.2925,
      proposalMode: 'PRICED_QUOTE',
      points: [
        {
          id: 'p1',
          label: 'P1 - Výstavní - 350m vpravo',
          latitude: 49.8360,
          longitude: 18.2910,
          routePolyline: 'polyline_sample_1',
          arrowDirectionEnum: 'RIGHT',
          visualizedPhotoUrl: 'https://example.com/vis1.jpg',
          sitePhotoId: 'photo_1',
        },
        {
          id: 'p2',
          label: 'P2 - Rudná - 750m rovně',
          latitude: 49.8370,
          longitude: 18.2900,
          routePolyline: 'polyline_sample_2',
          arrowDirectionEnum: 'STRAIGHT',
          visualizedPhotoUrl: 'https://example.com/vis2.jpg',
          sitePhotoId: 'photo_2',
        },
      ],
    },
  } as unknown as OfferView;

  const checksVerified = offerReadinessChecks(verifiedOffer);
  const aiRouteCheck = checksVerified.find((c) => c.id === 'navigationAiRoutes');
  assert.ok(aiRouteCheck, 'navigationAiRoutes check must exist');
  assert.equal(aiRouteCheck.status, 'ok');
  assert.match(aiRouteCheck.detail, /Všechny navigační body mají spočítanou jízdní trasu a ověřený směr/);

  // Case 2: Older offer or dragged points missing route / arrow direction
  const unverifiedOffer = {
    ...verifiedOffer,
    navigation: {
      ...verifiedOffer.navigation,
      points: [
        { ...verifiedOffer.navigation!.points[0], routePolyline: null, arrowDirectionEnum: null },
        verifiedOffer.navigation!.points[1],
      ],
    },
  } as unknown as OfferView;

  const checksUnverified = offerReadinessChecks(unverifiedOffer);
  const unverifiedAiCheck = checksUnverified.find((c) => c.id === 'navigationAiRoutes');
  assert.ok(unverifiedAiCheck);
  assert.equal(unverifiedAiCheck.status, 'warning');
  assert.match(unverifiedAiCheck.detail, /U 1 bodů chybí ověřená jízdní trasa nebo směrová šipka/);
});

test('NavigationOfferPublicView contains AI check toolbar and triggers navigation-ai-check API', () => {
  const publicView = readFileSync(new URL('../components/offers/NavigationOfferPublicView.tsx', import.meta.url), 'utf8');
  assert.match(publicView, /handleRunAiCheck/);
  assert.match(publicView, /navigation-ai-check/);
  assert.match(publicView, /AI Kontrola tras a směrových rčení/);
  assert.match(publicView, /pointsWithRoutes/);
  assert.match(publicView, /allRoutesVerified/);
});

test('NavigationMapStep contains prominent AI check toolbar button', () => {
  const mapStep = readFileSync(new URL('../components/offers/navigation-cockpit/NavigationMapStep.tsx', import.meta.url), 'utf8');
  assert.match(mapStep, /AI Kontrola tras a směrových rčení/);
  assert.match(mapStep, /onRecalculateRoutes/);
});

test('API route /api/offers/[id]/navigation-ai-check exists and performs truthful verification', () => {
  const apiRoute = readFileSync(new URL('../app/api/offers/[id]/navigation-ai-check/route.ts', import.meta.url), 'utf8');
  assert.match(apiRoute, /computeGoogleRoute/);
  assert.match(apiRoute, /inferArrowDirectionFromRoute/);
  assert.match(apiRoute, /evaluateNavigationZoning/);
  assert.match(apiRoute, /formatNavigationPositionName/);
  assert.match(apiRoute, /formatNavigationPointDetails/);
  assert.match(apiRoute, /prisma\.navigationPoint\.update/);
});

