import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ManagerDashboard } from '../components/dashboard/ManagerDashboard';
import { OfferTemplatesCatalogView } from '../components/offers/OfferTemplatesCatalogView';
import { WeatherClockWidget } from '../components/WeatherClockWidget';

Object.assign(globalThis, { React });

test('empty agency dashboard has no invented city or borrowed company heading', () => {
  const html = renderToStaticMarkup(React.createElement(ManagerDashboard, {
    totalSurfaces: 0, availableSurfaces: 0, occupiedSurfaces: 0,
    knownMonthlyRent: 0, annualizedKnownRent: 0, pricedOccupiedSurfaces: 0,
    unpricedOccupiedSurfaces: 0, occupancyPercent: 0, waitingOffers: 0,
    seasonalityData: Array(12).fill(0), ending7: [], mediaBreakdown: [], topCities: [],
  }));
  assert.match(html, /Zatím nejsou evidované lokality/);
  assert.doesNotMatch(html, /Ostrava|SeePOINT/);
});

test('shared concept catalog does not invent prices or promise municipal permits', () => {
  const html = renderToStaticMarkup(React.createElement(OfferTemplatesCatalogView, { clients: [{ id: 'qx-client', name: 'QX test' }] }));
  assert.match(html, /QX test/);
  assert.match(html, /vlastního firemního ceníku/);
  assert.doesNotMatch(html, /Orientační sazba|7.?900|2.?900|4.?500|18.?000|1.?200|Policie ČR v ceně/);
});

test('weather initially shows no fictitious temperature before a city is selected', () => {
  for (const compact of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(WeatherClockWidget, { compact }));
    assert.match(html, /Vybrat město/);
    assert.doesNotMatch(html, /21°C|20°C|Po 1\.1\./);
  }
});
