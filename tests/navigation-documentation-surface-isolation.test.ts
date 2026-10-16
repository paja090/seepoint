import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDocumentationPhotos,
  resolveDocumentationDirection,
  buildSnapshotItem,
  type DocumentationCarrier,
  type DocumentationPoint,
  type DocumentationSurface,
} from '../lib/navigation-documentation.js';

test('1. Two surfaces on same carrier pole - photos and direction are strictly isolated to client', () => {
  const askoClientId = 'client-asko';
  const elanClientId = 'client-elan';

  const surfaceAsko: DocumentationSurface = {
    id: 'surf-asko',
    name: 'P8 - Dělnická - 400m vpravo',
    currentClientId: askoClientId,
    directionDescription: '400 m doprava',
    photos: [
      {
        id: 'photo-asko-1',
        url: 'https://example.com/asko.jpg',
        surfaceId: 'surf-asko',
        isPrimary: false,
        isClientVisible: true,
        createdAt: new Date('2026-07-01'),
      },
    ],
  };

  const surfaceElan: DocumentationSurface = {
    id: 'surf-elan',
    name: 'P3 - Dělnická - Elán 1,7km rovně',
    currentClientId: elanClientId,
    directionDescription: 'Elán 1,7 km rovně',
    photos: [
      {
        id: 'photo-elan-primary',
        url: 'https://example.com/elan.jpg',
        surfaceId: 'surf-elan',
        isPrimary: true, // marked as primary!
        isClientVisible: true,
        createdAt: new Date('2026-10-01'), // newer!
      },
    ],
  };

  const sharedCarrier: DocumentationCarrier = {
    id: 'carrier-shared-pole-49',
    code: 'NAV-HAV-AFBC5187',
    name: 'P3 - Dělnická - Elán 1,7km rovně', // carrier has name from surface 2
    city: 'Havířov',
    photos: [
      {
        id: 'photo-neutral-pole',
        url: 'https://example.com/pole.jpg',
        surfaceId: null, // neutral pole photo
        isPrimary: false,
        isClientVisible: true,
        createdAt: new Date('2026-01-01'),
      },
    ],
    surfaces: [surfaceElan, surfaceAsko], // Note: surfaceElan is first in the array!
  };

  const pointAsko: DocumentationPoint = {
    id: 'point-asko',
    label: 'P8',
    surfaceId: 'surf-asko',
    carrierId: sharedCarrier.id,
    orientation: null, // relies on surface description
    carrier: sharedCarrier,
  };

  // Resolution for ASKO
  const askoPhotos = resolveDocumentationPhotos({
    point: pointAsko,
    carrier: sharedCarrier,
    allClientIds: [askoClientId],
  });

  const askoDirection = resolveDocumentationDirection({
    point: pointAsko,
    carrier: sharedCarrier,
    allClientIds: [askoClientId],
  });

  // Photo must be ASKO's photo, NOT Elán's photo (even though Elán's is primary and newer)
  assert.equal(askoPhotos.selectedPhoto?.id, 'photo-asko-1');
  assert.equal(askoPhotos.availablePhotos.some((p) => p.id === 'photo-elan-primary'), false);
  // Neutral carrier photo is included as fallback
  assert.equal(askoPhotos.availablePhotos.some((p) => p.id === 'photo-neutral-pole'), true);

  // Direction must be ASKO's direction, NOT Elán's direction
  assert.equal(askoDirection, '400 m doprava');
  assert.notEqual(askoDirection, 'Elán 1,7 km rovně');

  // Resolution for ELAN
  const pointElan: DocumentationPoint = {
    id: 'point-elan',
    label: 'P3',
    surfaceId: 'surf-elan',
    carrierId: sharedCarrier.id,
    orientation: null,
    carrier: sharedCarrier,
  };

  const elanPhotos = resolveDocumentationPhotos({
    point: pointElan,
    carrier: sharedCarrier,
    allClientIds: [elanClientId],
  });

  const elanDirection = resolveDocumentationDirection({
    point: pointElan,
    carrier: sharedCarrier,
    allClientIds: [elanClientId],
  });

  assert.equal(elanPhotos.selectedPhoto?.id, 'photo-elan-primary');
  assert.equal(elanPhotos.availablePhotos.some((p) => p.id === 'photo-asko-1'), false);
  assert.equal(elanDirection, 'Elán 1,7 km rovně');
});

test('2. Installed photo takes precedence over surface photos', () => {
  const point: DocumentationPoint = {
    id: 'pt-1',
    label: 'NAV-01',
    surfaceId: 'surf-1',
    installedPhoto: {
      id: 'photo-installed',
      url: 'https://example.com/installed.jpg',
      isPrimary: false,
      isClientVisible: true,
      createdAt: new Date('2026-05-01'),
    },
    carrier: {
      id: 'c-1',
      surfaces: [
        {
          id: 'surf-1',
          currentClientId: 'client-1',
          photos: [
            {
              id: 'photo-surface-newer',
              url: 'https://example.com/surf.jpg',
              surfaceId: 'surf-1',
              isPrimary: true,
              isClientVisible: true,
              createdAt: new Date('2026-09-01'),
            },
          ],
        },
      ],
    },
  };

  const res = resolveDocumentationPhotos({
    point,
    carrier: point.carrier,
    allClientIds: ['client-1'],
  });

  assert.equal(res.selectedPhoto?.id, 'photo-installed');
  assert.equal(res.availablePhotos[0].id, 'photo-installed');
  assert.equal(res.availablePhotos[1].id, 'photo-surface-newer');
});

test('3. Fallback carrier branch: surface isolation without navigation points', () => {
  const askoClientId = 'client-asko';
  const surfaceAsko: DocumentationSurface = {
    id: 'surf-asko',
    name: 'P8 - Dělnická - 400m vpravo',
    currentClientId: askoClientId,
    directionDescription: '400 m doprava',
    photos: [{ id: 'photo-asko', url: 'https://example.com/asko.jpg', surfaceId: 'surf-asko' }],
  };

  const surfaceElan: DocumentationSurface = {
    id: 'surf-elan',
    name: 'P3 - Dělnická - Elán 1,7km rovně',
    currentClientId: 'client-elan',
    directionDescription: 'Elán 1,7 km rovně',
    photos: [{ id: 'photo-elan', url: 'https://example.com/elan.jpg', surfaceId: 'surf-elan' }],
  };

  const carrier: DocumentationCarrier = {
    id: 'carrier-1',
    code: 'NAV-01',
    name: 'Pole 01',
    surfaces: [surfaceElan, surfaceAsko],
  };

  // Direct surface resolution for ASKO
  const res = resolveDocumentationPhotos({
    surface: surfaceAsko,
    carrier,
    allClientIds: [askoClientId],
  });

  assert.equal(res.selectedPhoto?.id, 'photo-asko');
  assert.equal(res.availablePhotos.length, 1);
  assert.equal(res.availablePhotos[0].id, 'photo-asko');

  const dir = resolveDocumentationDirection({
    surface: surfaceAsko,
    carrier,
    allClientIds: [askoClientId],
  });
  assert.equal(dir, '400 m doprava');
});
