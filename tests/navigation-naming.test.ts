import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNavigationPositionName,
  getNavigationPhotoDownloadName,
} from '../lib/navigation/navigation-naming.ts';

test('formatNavigationPositionName creates canonical P{N} - {Street} - {distAndDir}', () => {
  const result = formatNavigationPositionName({
    positionNumber: 1,
    street: 'Ostravská 500/12',
    rawDistanceAndDirection: '500 m vpravo',
  });
  assert.equal(result, 'P1 - Ostravská - 500m vpravo');
});

test('formatNavigationPositionName normalizes doprava to vpravo and handles km', () => {
  const result = formatNavigationPositionName({
    positionNumber: 7,
    street: 'Místecká',
    rawDistanceAndDirection: '1300 m doprava',
  });
  assert.equal(result, 'P7 - Místecká - 1300m vpravo');
});

test('formatNavigationPositionName cleans street repetitions', () => {
  const result = formatNavigationPositionName({
    positionNumber: 4,
    street: '17. Listopadu',
    rawDistanceAndDirection: '17. Listopadu 2 km šipka vpravo',
  });
  assert.equal(result, 'P4 - 17. listopadu - 2km šipka vpravo');
});

test('formatNavigationPositionName uses distanceMeters and direction when raw is absent', () => {
  const result = formatNavigationPositionName({
    positionNumber: 2,
    street: 'Beskydská',
    distanceMeters: 600,
    direction: 'vpravo',
  });
  assert.equal(result, 'P2 - Beskydská - 600m vpravo');
});

test('getNavigationPhotoDownloadName formats safe file download name', () => {
  const filename = getNavigationPhotoDownloadName('P1 - Ostravská - 500m vpravo', 'jpg');
  assert.equal(filename, 'P1 - Ostravská - 500m vpravo.jpg');
});

test('getNavigationPhotoDownloadName strips invalid path characters', () => {
  const filename = getNavigationPhotoDownloadName('P1 - Hradecká / Křižovatka II - 200m rovně', 'jpg');
  assert.equal(filename, 'P1 - Hradecká - Křižovatka II - 200m rovně.jpg');
});
