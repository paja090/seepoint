import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scoutAdvertisingLocationsAi,
  analyzePlotAdvertisingPotentialAi,
} from '../lib/cadastre/ai-land-scout';

test('scoutAdvertisingLocationsAi returns strategic locations for regional query', async () => {
  const locations = await scoutAdvertisingLocationsAi('Ostrava');
  assert.ok(Array.isArray(locations));
  assert.ok(locations.length > 0);

  const first = locations[0];
  assert.ok(first.title);
  assert.ok(first.addressOrJunction);
  assert.ok(typeof first.latitude === 'number');
  assert.ok(typeof first.longitude === 'number');
  assert.ok(first.visibilityScore >= 1 && first.visibilityScore <= 10);
  assert.ok(first.recommendedCarrierType);
  assert.ok(first.estimatedMonthlyRentCzk > 0);
  assert.ok(first.commercialRationale);
  assert.ok(first.acquisitionTip);
});

test('analyzePlotAdvertisingPotentialAi calculates score and generates cold outreach pitch', async () => {
  const analysis = await analyzePlotAdvertisingPotentialAi({
    label: 'Plot Rudná autoservis',
    parcelNumber: '1240/2',
    cadastralArea: 'Zábřeh nad Odrou',
    landType: 'Zastavěná plocha a nádvoří',
    latitude: 49.808142,
    longitude: 18.28312,
    landownerName: 'Autoservis Rudná s.r.o.',
    monthlyRent: 5000,
  });

  assert.ok(analysis.overallScore >= 1 && analysis.overallScore <= 10);
  assert.ok(['EXTREME', 'HIGH', 'MEDIUM', 'LOW'].includes(analysis.trafficRating));
  assert.ok(analysis.recommendedCarrier);
  assert.ok(analysis.estimatedFairRentCzk > 0);
  assert.ok(analysis.pros.length > 0);
  assert.ok(analysis.negotiationPoints.length > 0);
  assert.ok(analysis.outreachSubject);
  assert.ok(analysis.outreachLetterTemplate.includes('SeePOINT'));
});
