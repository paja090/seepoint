import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractFromPhotoList, extractNavigationFromPhotoText } from '../lib/navigation-photo-ocr';

test('1. extractNavigationFromPhotoText extracts brand, distance, and direction', () => {
  const result1 = extractNavigationFromPhotoText('Albert 350m vpravo');
  assert.equal(result1?.destinationName, 'Albert');
  assert.equal(result1?.distanceMeters, 350);
  assert.equal(result1?.directionDescription, 'vpravo');
  assert.equal(result1?.directionArrow, '➔');

  const result2 = extractNavigationFromPhotoText('Kaufland 1.2 km rovně');
  assert.equal(result2?.destinationName, 'Kaufland');
  assert.equal(result2?.distanceMeters, 1200);
  assert.equal(result2?.directionDescription, 'rovně');
  assert.equal(result2?.directionArrow, '⬆');

  const result3 = extractNavigationFromPhotoText('Billa 500 m vlevo');
  assert.equal(result3?.destinationName, 'Billa');
  assert.equal(result3?.distanceMeters, 500);
  assert.equal(result3?.directionDescription, 'vlevo');
  assert.equal(result3?.directionArrow, '⬅');
});

test('2. extractFromPhotoList prioritizes notes and filenames with high confidence', () => {
  const photos = [
    { url: '/photos/photo1.jpg', note: 'Základní foto sloupu' },
    { url: '/photos/photo2.jpg', note: 'Navigace Shell 2 km vpravo' },
  ];

  const result = extractFromPhotoList(photos);
  assert.equal(result?.destinationName, 'Shell');
  assert.equal(result?.distanceMeters, 2000);
  assert.equal(result?.directionDescription, 'vpravo');
  assert.equal(result?.directionArrow, '➔');
});
