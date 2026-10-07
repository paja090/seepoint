import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePointMetadata,
  cleanLayerName,
} from '../lib/election-removal/point-metadata';

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
