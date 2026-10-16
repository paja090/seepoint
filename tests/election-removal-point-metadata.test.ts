import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePointMetadata,
  cleanLayerName,
  buildGoogleMapsRouteUrl,
} from '../lib/election-removal/point-metadata';

test('buildGoogleMapsRouteUrl: constructs valid Google Maps directions URLs', () => {
  assert.equal(buildGoogleMapsRouteUrl([]), 'https://www.google.com/maps');

  const single = [{ latitude: 49.834, longitude: 18.282 }];
  assert.ok(buildGoogleMapsRouteUrl(single).includes('destination=49.834%2C18.282'));

  const multiple = [
    { latitude: 49.834, longitude: 18.282 },
    { latitude: 49.840, longitude: 18.290 },
    { latitude: 49.850, longitude: 18.300 },
  ];
  const url = buildGoogleMapsRouteUrl(multiple);
  assert.ok(url.includes('origin=49.834%2C18.282'));
  assert.ok(url.includes('destination=49.85%2C18.3'));
  assert.ok(url.includes('waypoints=49.84%2C18.29'));
});

test('parsePointMetadata: parses real-world Google My Maps point description', () => {
  const rawDescription =
    'Lokalita: domov seniorů Město: Ostrava Část: Marianské hory a Hulváky Ulice: Rybářská lat: 49.834382 lon: 18.2475 URL fotodokumentace: https://drive.google.com/file/d/11XsUY0OsWUXf0hxepGw82eETZOPvpsgi/view';

  const meta = parsePointMetadata(rawDescription);

  assert.equal(meta.locality, 'domov seniorů');
  assert.equal(meta.city, 'Ostrava');
  assert.equal(meta.district, 'Marianské hory a Hulváky');
  assert.equal(meta.street, 'Rybářská');
  assert.equal(
    meta.fullAddress,
    'Rybářská, Marianské hory a Hulváky, Ostrava'
  );
  assert.equal(
    meta.photoUrl,
    'https://drive.google.com/file/d/11XsUY0OsWUXf0hxepGw82eETZOPvpsgi/view'
  );
});

test('parsePointMetadata: handles multi-line descriptions', () => {
  const multiLine = `
Lokalita: ZŠ Provaznická
Ulice: Provaznická
Část: Hrabůvka
Město: Ostrava
URL fotodokumentace: https://drive.google.com/open?id=abc123xyz
Poznámka: Pozor na vjezd, nutno zazvonit
  `.trim();

  const meta = parsePointMetadata(multiLine);

  assert.equal(meta.locality, 'ZŠ Provaznická');
  assert.equal(meta.street, 'Provaznická');
  assert.equal(meta.district, 'Hrabůvka');
  assert.equal(meta.city, 'Ostrava');
  assert.equal(meta.fullAddress, 'Provaznická, Hrabůvka, Ostrava');
  assert.equal(
    meta.photoUrl,
    'https://drive.google.com/open?id=abc123xyz'
  );
  assert.equal(meta.otherNotes, 'Pozor na vjezd, nutno zazvonit');
});

test('parsePointMetadata: falls back gracefully on regular notes without key-values', () => {
  const plainText = 'Áčko umístěné přímo u vchodu do Alberta';
  const meta = parsePointMetadata(plainText);

  assert.equal(meta.locality, null);
  assert.equal(meta.fullAddress, null);
  assert.equal(meta.photoUrl, null);
  assert.equal(meta.otherNotes, 'Áčko umístěné přímo u vchodu do Alberta');
});

test('cleanLayerName: cleans file extensions and noisy prefixes', () => {
  assert.equal(
    cleanLayerName('Databaze obsazenost 2026 - VSE - Lavičky volby 26.csv'),
    'Lavičky volby 26'
  );
  assert.equal(cleanLayerName('Áčka centrum.kml'), 'Áčka centrum');
  assert.equal(cleanLayerName('Towery'), 'Towery');
  assert.equal(cleanLayerName(null), null);
});

test('isGenericLayerName: distinguishes generic placeholders from client/motive layers', async () => {
  const { isGenericLayerName } = await import('../lib/election-removal/point-metadata');
  assert.equal(isGenericLayerName('Obecná vrstva'), true);
  assert.equal(isGenericLayerName('Vrstva bez názvu'), true);
  assert.equal(isGenericLayerName('Ručně přidané body'), true);
  assert.equal(isGenericLayerName('Bez názvu'), true);
  assert.equal(isGenericLayerName('Untitled Layer'), true);
  assert.equal(isGenericLayerName(null), true);
  assert.equal(isGenericLayerName(''), true);

  // Real client/motive layers
  assert.equal(isGenericLayerName('BB CALIN'), false);
  assert.equal(isGenericLayerName('Komorní scéna aréna'), false);
  assert.equal(isGenericLayerName('NEW ÁČKA HUJDUS'), false);
  assert.equal(isGenericLayerName('Áčka SeePOINT'), false);
});

test('resolvePointClientName: resolves client from description, layer or campaign', async () => {
  const { resolvePointClientName } = await import('../lib/election-removal/point-metadata');

  // Case 1: Point has meaningful KML layer
  const clientFromLayer = resolvePointClientName({
    layerName: 'BB CALIN',
    campaignName: 'Tomáš lavičky BB + KSA',
  });
  assert.equal(clientFromLayer, 'BB CALIN');

  const clientFromLayer2 = resolvePointClientName({
    layerName: 'Komorní scéna aréna',
    campaignName: 'Tomáš lavičky BB + KSA',
  });
  assert.equal(clientFromLayer2, 'Komorní scéna aréna');

  // Case 2: Explicit Klient in description takes top priority
  const clientFromDesc = resolvePointClientName({
    layerName: 'BB CALIN',
    description: 'Klient: Bageterie Boulevard\nMěsto: Ostrava',
    campaignName: 'Tomáš lavičky BB + KSA',
  });
  assert.equal(clientFromDesc, 'Bageterie Boulevard');

  // Case 3: Generic layer falls back to campaign client or campaign name
  const clientGenericLayer = resolvePointClientName({
    layerName: 'Obecná vrstva',
    campaignClientName: 'Klient XYZ',
    campaignName: 'Kampaň Ostrava',
  });
  assert.equal(clientGenericLayer, 'Klient XYZ');

  // Case 4: Generic layer without campaignClientName falls back to campaignName
  const clientFallback = resolvePointClientName({
    layerName: 'Vrstva bez názvu',
    campaignName: 'Kampaň Ostrava',
  });
  assert.equal(clientFallback, 'Kampaň Ostrava');
});

test('parsePointMetadata: extracts Klient and Kampaň from description', () => {
  const textWithClient = 'Klient: Calin Motiv: Jarní menu Město: Ostrava Ulice: Hlavní';
  const meta = parsePointMetadata(textWithClient);
  assert.equal(meta.client, 'Calin');
  assert.equal(meta.campaign, 'Jarní menu');
  assert.equal(meta.city, 'Ostrava');
  assert.equal(meta.street, 'Hlavní');
});

test('taskInstructions: includes Czech media label and Klient / Motiv', async () => {
  const { taskInstructions } = await import('../lib/election-removal/task-spec');
  const instructions = taskInstructions({
    operationType: 'INSTALL_AD',
    label: 'Výstavní MHD 1A',
    mediaType: 'BENCH',
    quantity: 1,
    clientName: 'BB CALIN',
    description: 'KÓD: OP37',
  });
  assert.ok(instructions.includes('Instalace reklamního materiálu'));
  assert.ok(instructions.includes('Lavička — 1 ks'));
  assert.ok(instructions.includes('Klient / Motiv: BB CALIN'));
  assert.ok(instructions.includes('KÓD: OP37'));
});
