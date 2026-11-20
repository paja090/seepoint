/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import {
  isWorkOrderEligibleForPhotoApp,
  isWorkOrderEligibleForPhotoDoc,
  isWorkOrderWorkshopOnly,
  extractGoogleDriveFolderId,
  readWorkOrderDriveExports,
  mergeWorkOrderDriveExports,
} from '../lib/work/photo-folder';
import { finalizeMobilePhotoCampaigns } from '../lib/mobile-photo-campaigns';
import {
  resolveTargetDriveFolder,
  createRealizationDriveFolder,
  uploadPhotoBufferToDriveFolder,
} from '../lib/google-drive';
import { runWithTenantContext } from '../lib/tenant-context';

test('1A eligibility: realization with or without ftdUrl appears in Mobile Photo App while workshop-only is excluded', () => {
  // Realization with Drive folder link (exact user example: "Výměna plachet na věži")
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-1',
      title: 'Výměna plachet na věži',
      status: 'NEW',
      workType: 'REINSTALLATION',
      ftdUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
    }),
    true
  );

  // Open realization WITHOUT ftdUrl still appears automatically (Variant 1A)
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-2',
      title: 'Výměna plachet na věži',
      status: 'PLANNED',
      workType: 'INSTALLATION',
      ftdUrl: null,
    }),
    true
  );

  // Pure workshop task without ftdUrl is excluded
  assert.equal(
    isWorkOrderWorkshopOnly({
      id: 'wo-3',
      title: 'Tisk bannerů a DTP příprava',
      status: 'NEW',
      workType: 'OTHER',
    }),
    true
  );
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-3',
      title: 'Tisk bannerů a DTP příprava',
      status: 'NEW',
      workType: 'OTHER',
    }),
    false
  );

  // Explicit scope=WORKSHOP without ftdUrl is excluded
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-4',
      title: 'Příprava materiálu',
      status: 'PLANNED',
      workType: 'INSTALLATION',
      planningConstraints: { scope: 'WORKSHOP' },
    }),
    false
  );

  // Even a workshop-like title WITH an explicit ftdUrl folder is included so workers can upload photos there
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-5',
      title: 'Tisk a kontrola plachty',
      status: 'NEW',
      workType: 'OTHER',
      ftdUrl: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
    }),
    true
  );

  // Explicitly skipped FTD, DONE, CANCELLED, CRM/Nav linked, or dispatchCampaign orders are excluded from mobile app
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-6',
      title: 'Montáž bez fotek',
      status: 'NEW',
      workType: 'INSTALLATION',
      planningConstraints: { ftdSkipped: true },
    }),
    false
  );
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-7',
      title: 'Hotová realizace',
      status: 'DONE',
      workType: 'INSTALLATION',
    }),
    false
  );
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-8',
      title: 'Zrušená realizace',
      status: 'CANCELLED',
      workType: 'INSTALLATION',
    }),
    false
  );
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-9',
      title: 'CRM zakázka',
      status: 'PLANNED',
      workType: 'INSTALLATION',
      crmOrderId: 'crm-1',
    }),
    false
  );
  assert.equal(
    isWorkOrderEligibleForPhotoApp({
      id: 'wo-10',
      title: 'Navigační zakázka',
      status: 'PLANNED',
      workType: 'INSTALLATION',
      navigationOrderId: 'nav-1',
    }),
    false
  );
});

test('Fotodokumentace eligibility keeps DONE WorkOrders with photos and respects hiddenFromPhotoDoc', () => {
  assert.equal(
    isWorkOrderEligibleForPhotoDoc(
      {
        id: 'wo-done-with-photos',
        title: 'Výměna plachet na věži',
        status: 'DONE',
        workType: 'REINSTALLATION',
      },
      4
    ),
    true
  );

  assert.equal(
    isWorkOrderEligibleForPhotoDoc(
      {
        id: 'wo-done-empty',
        title: 'Starý úkol bez fotek',
        status: 'DONE',
        workType: 'INSTALLATION',
      },
      0
    ),
    false
  );

  assert.equal(
    isWorkOrderEligibleForPhotoDoc(
      {
        id: 'wo-hidden',
        title: 'Skryté album',
        status: 'DONE',
        workType: 'INSTALLATION',
        planningConstraints: { hiddenFromPhotoDoc: true },
      },
      3
    ),
    false
  );

  assert.equal(
    isWorkOrderEligibleForPhotoDoc(
      {
        id: 'wo-cancelled',
        title: 'Zrušené',
        status: 'CANCELLED',
        workType: 'INSTALLATION',
      },
      2
    ),
    false
  );
});

test('extractGoogleDriveFolderId parses Drive URLs, multi-user paths, open?id, raw IDs, and returns null for plain names', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz12345';
  assert.equal(
    extractGoogleDriveFolderId(`https://drive.google.com/drive/folders/${id}?usp=sharing`),
    id
  );
  assert.equal(
    extractGoogleDriveFolderId(`https://drive.google.com/drive/u/0/folders/${id}`),
    id
  );
  assert.equal(
    extractGoogleDriveFolderId(`https://drive.google.com/open?id=${id}`),
    id
  );
  assert.equal(extractGoogleDriveFolderId(id), id);
  assert.equal(extractGoogleDriveFolderId('Výměna plachet na věži 2026'), null);
  assert.equal(extractGoogleDriveFolderId('   '), null);
  assert.equal(extractGoogleDriveFolderId(null), null);
});

test('mergeWorkOrderDriveExports preserves existing planningConstraints and accumulates exported photo IDs', () => {
  const initial = { scope: 'FIELD', latitude: 50.08 };
  const afterFirst = mergeWorkOrderDriveExports(initial, {
    folderId: 'folder-1',
    folderName: 'Věž 2026',
    folderUrl: 'https://drive.google.com/drive/folders/folder-1',
    exportedAt: '2026-11-20T10:00:00.000Z',
    newEntries: {
      'photo-1': { driveFileId: 'drive-1', folderId: 'folder-1', exportedAt: '2026-11-20T10:00:00.000Z' },
    },
  });

  const afterSecond = mergeWorkOrderDriveExports(afterFirst, {
    folderId: 'folder-1',
    folderName: 'Věž 2026',
    folderUrl: 'https://drive.google.com/drive/folders/folder-1',
    exportedAt: '2026-11-20T11:00:00.000Z',
    newEntries: {
      'photo-2': { driveFileId: 'drive-2', folderId: 'folder-1', exportedAt: '2026-11-20T11:00:00.000Z' },
    },
  });

  assert.equal(afterSecond.scope, 'FIELD');
  assert.equal(afterSecond.latitude, 50.08);
  const meta = readWorkOrderDriveExports(afterSecond);
  assert.equal(meta.lastFolderId, 'folder-1');
  assert.equal(meta.lastFolderUrl, 'https://drive.google.com/drive/folders/folder-1');
  assert.deepEqual(Object.keys(meta.photos).sort(), ['photo-1', 'photo-2']);
});

test('finalizeMobilePhotoCampaigns keeps allowMultiplePhotos WorkOrder campaigns visible even after first photo', () => {
  const result = finalizeMobilePhotoCampaigns([
    {
      id: 'wo-realization',
      sourceType: 'WORK_ORDER',
      title: 'Výměna plachet na věži',
      clientName: 'Klient Věž',
      status: 'IN_PROGRESS',
      workOrderId: 'wo-realization',
      allowMultiplePhotos: true,
      totalPhotosCount: 2,
      surfaces: [
        {
          targetKind: 'WORK_ORDER_ITEM',
          itemId: 'item-1',
          workOrderId: 'wo-realization',
          workOrderItemId: 'item-1',
          allowMultiplePhotos: true,
          photosCount: 2,
          surfaceId: '',
          surfaceName: 'Výměna plachet na věži',
          side: 'Realizace (2 fotek)',
          carrierId: '',
          carrierCode: 'REALIZACE',
          carrierName: 'Výměna plachet na věži',
          address: 'Věž Sever',
          city: '',
          latitude: null,
          longitude: null,
          dateFrom: null,
          dateTo: null,
          isInstalled: true,
          installedPhotoUrl: '/api/photos/p2/file',
        },
      ],
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'wo-realization');
  assert.equal(result[0].allowMultiplePhotos, true);
  assert.equal(result[0].totalPhotosCount, 2);
});

test('buildWorkOrderAlbumSlug and verifyWorkOrderAlbumSlug round-trip and reject tampered slugs', async (t) => {
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const originalLoad = loader._load;
  loader._load = function (id: string, ...args: any[]) {
    if (id === 'server-only') return {};
    return originalLoad.call(this, id, ...args);
  };
  t.after(() => {
    loader._load = originalLoad;
  });

  const { buildWorkOrderAlbumSlug, verifyWorkOrderAlbumSlug } = await import(
    '../lib/election-removal/album-token'
  );

  const slug = buildWorkOrderAlbumSlug('org-test-123', 'cmo_workorder_abc123');
  assert.ok(slug.startsWith('workorder.org-test-123.cmo_workorder_abc123.'));

  const verified = verifyWorkOrderAlbumSlug(slug);
  assert.deepEqual(verified, {
    organizationId: 'org-test-123',
    workOrderId: 'cmo_workorder_abc123',
  });

  // Tampered workOrderId or signature must be rejected
  assert.equal(verifyWorkOrderAlbumSlug(slug.replace('cmo_workorder_abc123', 'cmo_workorder_other')), null);
  assert.equal(verifyWorkOrderAlbumSlug(`${slug.slice(0, -4)}0000`), null);
  assert.equal(verifyWorkOrderAlbumSlug('surface.org.abc.sig'), null);
});

test('Google Drive export helpers resolve/create folders and upload idempotently in mock mode', async (t) => {
  const env = process.env as Record<string, string | undefined>;
  const origNodeEnv = env.NODE_ENV;
  const origMock = env.GOOGLE_DRIVE_MOCK_ENABLED;
  env.NODE_ENV = 'development';
  env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';
  t.after(() => {
    env.NODE_ENV = origNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = origMock;
  });

  await runWithTenantContext(
    { organizationId: 'org-drive-export-test', userId: 'u-1', source: 'session' },
    async () => {
      const resolved = await resolveTargetDriveFolder(
        'https://drive.google.com/drive/folders/1MockFolderId1234567890abcde'
      );
      assert.equal(resolved.id, '1MockFolderId1234567890abcde');

      const created = await createRealizationDriveFolder('Výměna plachet na věži');
      assert.equal(created.name, 'Výměna plachet na věži');
      assert.ok(created.webViewLink.includes(created.id));

      const firstUpload = await uploadPhotoBufferToDriveFolder({
        accessToken: created.accessToken,
        targetFolderId: created.id,
        buffer: Buffer.from('jpeg-bytes'),
        mimeType: 'image/jpeg',
        fileName: '01_vez.jpg',
        photoId: 'photo-export-1',
      });
      assert.equal(firstUpload.alreadyExisted, false);

      const secondUpload = await uploadPhotoBufferToDriveFolder({
        accessToken: created.accessToken,
        targetFolderId: created.id,
        buffer: Buffer.from('jpeg-bytes'),
        mimeType: 'image/jpeg',
        fileName: '01_vez.jpg',
        photoId: 'photo-export-1',
      });
      assert.equal(secondUpload.alreadyExisted, true);
      assert.equal(secondUpload.id, firstUpload.id);
    }
  );
});
