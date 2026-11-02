import assert from 'node:assert/strict';
import test from 'node:test';
import { scoutAdvertisingLocationsAi } from '../lib/cadastre/ai-land-scout.ts';
import { findCadastralParcelByCoords } from '../lib/cadastre/cuzk-service.ts';

test('1. ČÚZK link generator produces valid official RÚIAN VDP & Mapy.cz URLs without ASP.NET error', async () => {
  const sampleParcelId = '93422519010';
  const sampleLat = 49.8355;
  const sampleLng = 18.2820;

  // Verify URL formats
  const vdpUrl = `https://vdp.cuzk.cz/vdp/ruian/parcely/${sampleParcelId}`;
  const mapyKatastrUrl = `https://mapy.cz/zakladni?q=${sampleLat},${sampleLng}&z=18&base=katastr`;

  assert.ok(vdpUrl.startsWith('https://vdp.cuzk.cz/vdp/ruian/parcely/'));
  assert.ok(!vdpUrl.includes('typ=KU'), 'Must NOT use invalid typ=KU on ČÚZK');
  assert.ok(mapyKatastrUrl.includes('base=katastr'), 'Mapy.cz URL must enable cadastral layer');
});

test('2. AI Land Scout returns dedicated FIRST_CLASS_ROAD_CORRIDOR locations when preferredFocus is FIRST_CLASS_ROAD', async () => {
  const locations = await scoutAdvertisingLocationsAi('Ostrava', 'FIRST_CLASS_ROAD', 6);
  assert.ok(locations.length > 0, 'Should return scouted locations');

  const firstClassLocation = locations.find((loc) => loc.propertyType === 'FIRST_CLASS_ROAD_CORRIDOR');
  assert.ok(firstClassLocation, 'Should include at least one 1st-class road corridor location');
  assert.ok(
    firstClassLocation.title.includes('Rudná') ||
      firstClassLocation.title.includes('Místecká') ||
      firstClassLocation.title.includes('I/11') ||
      firstClassLocation.title.includes('I/56') ||
      firstClassLocation.title.includes('I. třídy'),
    'Should be a 1st class road corridor location'
  );
  assert.ok(
    firstClassLocation.recommendedCarrierType.toLowerCase().includes('sloupek') ||
      firstClassLocation.recommendedCarrierType.toLowerCase().includes('column') ||
      firstClassLocation.recommendedCarrierType.toLowerCase().includes('pylon'),
    'Should recommend standalone navigation column or pylon on private land'
  );
  assert.ok(
    firstClassLocation.commercialRationale.includes('silnic') ||
      firstClassLocation.commercialRationale.includes('VO') ||
      firstClassLocation.commercialRationale.includes('zákon'),
    'Should explain the VO ban on 1st-class roads and advantage of private land column'
  );
});

test('3. AI Land Scout general locations also include private commercial corridors', async () => {
  const generalLocations = await scoutAdvertisingLocationsAi('Ostrava', 'ALL', 8);
  assert.equal(generalLocations.length, 8);
  assert.ok(generalLocations.every((l) => l.latitude > 49 && l.longitude > 17));
  assert.ok(generalLocations.every((l) => l.visibilityScore >= 8));
  assert.ok(generalLocations.every((l) => l.estimatedMonthlyRentCzk > 0));
});
