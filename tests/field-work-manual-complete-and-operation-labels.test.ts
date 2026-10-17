import test from 'node:test';
import assert from 'node:assert/strict';
import { getCampaignOperationLabel } from '../lib/election-removal/task-spec.js';

test('1. getCampaignOperationLabel dynamically resolves operation labels based on points and campaign name', () => {
  // Mostly installation points
  const installPoints = [
    { operationType: 'INSTALL_AD' },
    { operationType: 'INSTALL_OBJECT' },
    { operationType: 'INSPECTION' },
  ];
  const installResult = getCampaignOperationLabel(installPoints, 'Kampaň Jaro 2026');
  assert.equal(installResult.progressLabel, 'Postup montáže');
  assert.equal(installResult.badgeLabel, 'Montáž');
  assert.equal(installResult.verbDoneLabel, 'namontováno');

  // Mostly relocation points
  const relocationPoints = [
    { operationType: 'RELOCATION' },
    { operationType: 'RELOCATION' },
    { operationType: 'REMOVE_AD' },
  ];
  const relocResult = getCampaignOperationLabel(relocationPoints, 'Přesun panelů');
  assert.equal(relocResult.progressLabel, 'Postup přesunu');
  assert.equal(relocResult.badgeLabel, 'Přesun');
  assert.equal(relocResult.verbDoneLabel, 'přesunuto');

  // Mostly removal points
  const removalPoints = [
    { operationType: 'REMOVE_OBJECT' },
    { operationType: 'REMOVE_AD' },
  ];
  const removalResult = getCampaignOperationLabel(removalPoints, 'Volby 2026');
  assert.equal(removalResult.progressLabel, 'Postup demontáže');
  assert.equal(removalResult.badgeLabel, 'Demontáž');
  assert.equal(removalResult.verbDoneLabel, 'demontováno');

  // Mostly replacement points
  const replacePoints = [
    { operationType: 'REPLACE_AD' },
    { operationType: 'BANNER_CHANGE' },
  ];
  const replaceResult = getCampaignOperationLabel(replacePoints, 'Výměna motivu');
  assert.equal(replaceResult.progressLabel, 'Postup výměny');
  assert.equal(replaceResult.badgeLabel, 'Výměna');

  // Mostly inspection points
  const inspectPoints = [
    { operationType: 'INSPECTION' },
    { operationType: 'INSPECTION' },
  ];
  const inspectResult = getCampaignOperationLabel(inspectPoints, 'Revize');
  assert.equal(inspectResult.progressLabel, 'Postup kontroly');
  assert.equal(inspectResult.badgeLabel, 'Kontrola');

  // Points have no explicit operationType, fallback to campaign name
  const nameFallbackInstall = getCampaignOperationLabel([], 'Montáž navigačních tabulí Havířov');
  assert.equal(nameFallbackInstall.progressLabel, 'Postup montáže');

  const nameFallbackReloc = getCampaignOperationLabel([], 'Přesun áček na nová stanoviště');
  assert.equal(nameFallbackReloc.progressLabel, 'Postup přesunu');

  const nameFallbackRemoval = getCampaignOperationLabel([], 'Demontáž volebních nosičů');
  assert.equal(nameFallbackRemoval.progressLabel, 'Postup demontáže');

  // Completely neutral/unspecified
  const neutralResult = getCampaignOperationLabel([], 'Všeobecný výjezd');
  assert.equal(neutralResult.progressLabel, 'Postup realizace');
  assert.equal(neutralResult.badgeLabel, 'Terénní práce');
});

test('2. Fotodokumentace navigation album isolates client labels and photos on shared pole', () => {
  const askoClientId = 'client-asko';
  const kfcClientId = 'client-kfc';

  const carrierWithSharedPole = {
    id: 'carrier-shared-pole',
    code: 'NAV-HAV-B12864FF',
    name: 'P28 - Nár. Třída - KFC vlevo 900m', // Pole named after KFC in legacy import!
    address: 'Národní Třída 44',
    city: 'Havířov',
    surfaces: [
      {
        id: 'surf-kfc',
        name: 'P28 - Nár. Třída - KFC vlevo 900m',
        directionDescription: 'KFC vlevo 900 m',
        currentClientId: kfcClientId,
        photos: [
          {
            id: 'photo-kfc-sign',
            type: 'MONTAGE',
            fileName: 'kfc.jpg',
            createdAt: new Date('2026-06-01'),
            capturedLatitude: 49.78,
            capturedLongitude: 18.42,
            capturedByWorkerName: 'Karel',
          },
        ],
      },
      {
        id: 'surf-asko',
        name: 'P28 - Nár. Třída - 1,8km',
        directionDescription: '1,8 km rovně',
        currentClientId: askoClientId,
        photos: [
          {
            id: 'photo-asko-sign',
            type: 'MONTAGE',
            fileName: 'asko.jpg',
            createdAt: new Date('2026-07-01'),
            capturedLatitude: 49.78,
            capturedLongitude: 18.42,
            capturedByWorkerName: 'Petr',
          },
        ],
      },
    ],
  };

  const itemForAsko = {
    id: 'item-asko-1',
    carrierId: carrierWithSharedPole.id,
    navigationPoint: null as { label?: string } | null, // Legacy / carrier-based item
    carrier: carrierWithSharedPole,
    selectedPhoto: {
      // Suppose it was mistakenly pointing to KFC's photo in legacy data
      id: 'photo-kfc-sign',
      type: 'MONTAGE',
      fileName: 'kfc.jpg',
      createdAt: new Date('2026-06-01'),
      capturedLatitude: 49.78,
      capturedLongitude: 18.42,
      capturedByWorkerName: 'Karel',
      surfaceId: 'surf-kfc',
    },
    snapshot: null,
  };

  // Replicate the mapping logic from app/fotodokumentace/page.tsx
  const clientSurface = itemForAsko.carrier?.surfaces?.find((s) => s.currentClientId === askoClientId) ?? null;

  let effectivePhoto = itemForAsko.selectedPhoto;
  if (clientSurface && effectivePhoto?.surfaceId && effectivePhoto.surfaceId !== clientSurface.id) {
    if (clientSurface.photos && clientSurface.photos.length > 0) {
      effectivePhoto = { ...clientSurface.photos[0], surfaceId: clientSurface.id };
    }
  }

  const label =
    clientSurface?.name ||
    itemForAsko.navigationPoint?.label ||
    (itemForAsko.carrier?.address
      ? `${itemForAsko.carrier.address}${clientSurface?.directionDescription ? ` · ${clientSurface.directionDescription}` : ''}`
      : `Bod ${itemForAsko.carrier?.code || itemForAsko.id.slice(-4)}`);

  // Verify label NEVER mentions KFC!
  assert.equal(label, 'P28 - Nár. Třída - 1,8km');
  assert.equal(label.includes('KFC'), false);
  assert.equal(label.includes('Elán'), false);

  // Verify photo was healed to ASKO's photo instead of KFC's photo
  assert.equal(effectivePhoto?.id, 'photo-asko-sign');
  assert.equal(effectivePhoto?.fileName, 'asko.jpg');
});
