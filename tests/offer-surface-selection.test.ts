import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOfferSurfaces, isOfferSurfaceInBounds, paginateOfferSurfaces } from '../lib/offers/surface-selection.ts';
import type { OfferSurfaceOption } from '../lib/offers/view-model.ts';

function surface(id: string, overrides: Partial<OfferSurfaceOption> = {}): OfferSurfaceOption {
  return {
    id,
    name: `Plocha ${id}`,
    mediaType: 'CITY_POSTER',
    status: 'ACTIVE',
    price: '1000.00',
    photos: [],
    carrier: {
      id: `carrier-${id}`,
      code: `CP${id}`,
      name: `Nosič ${id}`,
      city: 'Ostrava',
      type: overrides.mediaType || 'CITY_POSTER',
      locality: 'Centrum',
      street: 'Nádražní',
      address: 'Nádražní 1',
      description: 'U hlavního nádraží',
      latitude: 49.835,
      longitude: 18.292,
    },
    ...overrides,
  };
}

const defaults = { query: '', mediaType: '', status: '', availability: 'all' as const, gpsOnly: false };

test('filtruje plochy podle kódu, adresy, města, lokality a popisu bez ohledu na velikost písmen', () => {
  const rows = [surface('01'), surface('02', { carrier: { ...surface('02').carrier, city: 'Opava', locality: 'Kateřinky', description: 'Vedle stadionu' } })];
  assert.deepEqual(filterOfferSurfaces(rows, { ...defaults, query: 'stadionu' }, new Map()).map((row) => row.id), ['02']);
  assert.deepEqual(filterOfferSurfaces(rows, { ...defaults, query: 'CP01' }, new Map()).map((row) => row.id), ['01']);
  assert.deepEqual(filterOfferSurfaces(rows, { ...defaults, query: 'KATEŘINKY' }, new Map()).map((row) => row.id), ['02']);
});

test('kombinuje typ, evidenční stav, GPS a serverový výsledek dostupnosti', () => {
  const rows = [
    surface('01'),
    surface('02', { mediaType: 'BILLBOARD', status: 'INACTIVE', carrier: { ...surface('02').carrier, latitude: null, longitude: null } }),
    surface('03', { mediaType: 'BILLBOARD' }),
  ];
  const conflicts = new Map([['01', 'warning' as const], ['03', 'block' as const]]);
  assert.deepEqual(filterOfferSurfaces(rows, { ...defaults, availability: 'available' }, conflicts).map((row) => row.id), ['02']);
  assert.deepEqual(filterOfferSurfaces(rows, { ...defaults, mediaType: 'BILLBOARD', status: 'ACTIVE', availability: 'blocked', gpsOnly: true }, conflicts).map((row) => row.id), ['03']);
});

test('stránkuje velký seznam a bezpečně omezí číslo stránky', () => {
  const rows = Array.from({ length: 55 }, (_, index) => surface(String(index + 1)));
  const result = paginateOfferSurfaces(rows, 3, 24);
  assert.equal(result.pageCount, 3);
  assert.equal(result.currentPage, 3);
  assert.equal(result.rows.length, 7);
  assert.equal(paginateOfferSurfaces(rows, 99, 24).currentPage, 3);
});

test('omezuje GPS plochy podle aktuálního výřezu mapy', () => {
  const bounds = { north: 50, south: 49, east: 19, west: 18 };
  assert.equal(isOfferSurfaceInBounds(surface('01'), bounds), true);
  assert.equal(isOfferSurfaceInBounds(surface('02', { carrier: { ...surface('02').carrier, latitude: 48, longitude: 17 } }), bounds), false);
  assert.equal(isOfferSurfaceInBounds(surface('03', { carrier: { ...surface('03').carrier, latitude: null } }), bounds), false);
});
