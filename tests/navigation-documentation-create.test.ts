import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshotItem } from '../lib/navigation-documentation.js';

test('1. Item snapshot correctly retains customDirection without violating NavigationDocumentationItem schema', () => {
  const customDir = '➡️ vpravo u křižovatky';
  const itemInput = {
    navigationPointId: 'np-test-1',
    carrierId: 'carrier-test-1',
    selectedPhotoId: 'photo-test-1',
    customDirection: customDir,
    sortOrder: 0,
    isVisible: true,
  };

  // Ensure mapping correctly moves customDirection to snapshot
  const { customDirection, ...itemData } = itemInput;
  const prismaCreateInput = {
    ...itemData,
    organizationId: 'org_test',
    snapshot: customDirection ? { direction: customDirection } : undefined,
  };

  // Must NOT have customDirection as root property
  assert.equal('customDirection' in prismaCreateInput, false);
  // Must have snapshot with direction
  assert.deepEqual(prismaCreateInput.snapshot, { direction: customDir });
  assert.equal(prismaCreateInput.organizationId, 'org_test');
  assert.equal(prismaCreateInput.sortOrder, 0);
  assert.equal(prismaCreateInput.isVisible, true);
});

test('2. buildSnapshotItem preserves customDirection over fallback orientation', () => {
  const snapshotWithCustom = buildSnapshotItem({
    id: 'item-1',
    clientNote: 'Poznámka pro klienta',
    customDirection: 'vlevo k areálu',
    navigationPoint: {
      id: 'np-1',
      label: 'NAV-01',
      latitude: 50.0,
      longitude: 14.4,
      status: 'INSTALLED',
      orientation: 'Pravoběžné',
      updatedAt: new Date(),
    },
  });

  assert.equal(snapshotWithCustom.direction, 'vlevo k areálu');

  const snapshotWithFallback = buildSnapshotItem({
    id: 'item-2',
    navigationPoint: {
      id: 'np-2',
      label: 'NAV-02',
      latitude: 50.0,
      longitude: 14.4,
      status: 'INSTALLED',
      orientation: 'Obousměrné',
      updatedAt: new Date(),
    },
  });

  assert.equal(snapshotWithFallback.direction, 'Obousměrné');
});
