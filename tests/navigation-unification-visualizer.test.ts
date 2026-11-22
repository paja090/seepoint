import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  arrowCharToDirectionEnum,
  formatCalculatedDistanceForInput,
  formatNavigationDirectionLabel,
  formatNavigationPointDesignation,
  haversineDistanceMeters,
  parseDistanceTextToManual,
  parseNavigationVisualizationConfig,
  resolveNavigationDistance,
} from '../lib/offers/navigation-carrier-types.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PGlite: 20261122020000_navigation_visualization_config migration adds visualizationConfig JSONB cleanly', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "NavigationPoint" ("id" TEXT PRIMARY KEY, "label" TEXT NOT NULL);`);
    const sql = read('prisma/migrations/20261122020000_navigation_visualization_config/migration.sql');
    await db.exec(sql);

    const cfg = { signX: 312.5, signY: 210, signScale: 0.9, signRotation: -4, mountType: 'pole', mountSide: 'left', theme: 'blue' };
    await db.query(
      `INSERT INTO "NavigationPoint" ("id", "label", "visualizationConfig") VALUES ($1, $2, $3::jsonb)`,
      ['np_1', 'P1 – Orlovská', JSON.stringify(cfg)]
    );

    const res = await db.query<{ visualizationConfig: typeof cfg }>(
      `SELECT "visualizationConfig" FROM "NavigationPoint" WHERE "id" = 'np_1'`
    );
    assert.equal(res.rows[0]?.visualizationConfig.signX, 312.5);
    assert.equal(res.rows[0]?.visualizationConfig.signScale, 0.9);
  } finally {
    await db.close();
  }
});

test('formatNavigationPointDesignation unifies street, compound directions, and never freezes stale P1 labels', () => {
  // Even if label has stale baked "P1 – Stará ulice – 900 m rovně", live address/direction/distance must win
  const live = formatNavigationPointDesignation(
    {
      label: 'P1 – Stará ulice – 900 m rovně',
      address: 'ul. Nádražní 14, Ostrava',
      arrowDirectionEnum: 'STRAIGHT_LEFT',
      distanceSource: 'MANUAL',
      manualDistanceValue: 350,
      manualDistanceUnit: 'METERS',
      calculatedDistanceMeters: 500,
    },
    0,
    { audience: 'CLIENT' }
  );

  assert.equal(live.street, 'Nádražní 14');
  assert.equal(live.direction, 'rovně a vlevo');
  assert.equal(live.distance, '350 m');
  assert.equal(live.isDistanceConfirmed, true);
  assert.equal(live.calculatedDistance, '500 m');
  assert.equal(live.fullTitle, 'P1 – Nádražní 14 – 350 m rovně a vlevo');

  // All compound arrows translate to clean Czech labels
  assert.equal(formatNavigationDirectionLabel('STRAIGHT_RIGHT'), 'rovně a vpravo');
  assert.equal(formatNavigationDirectionLabel('LEFT_STRAIGHT'), 'vlevo a rovně');
  assert.equal(formatNavigationDirectionLabel('RIGHT_STRAIGHT'), 'vpravo a rovně');
  assert.equal(formatNavigationDirectionLabel('LEFT_RIGHT'), 'vlevo i vpravo');
});

test('Confirmed vs internal distance: CLIENT audience hides unconfirmed auto map calculation while INTERNAL keeps it', () => {
  const unconfirmedPoint = {
    address: 'Orlovská, Ostrava',
    arrowDirectionEnum: 'RIGHT',
    distanceSource: 'CALCULATED',
    manualDistanceValue: null,
    calculatedDistanceMeters: 480,
  };

  const clientView = formatNavigationPointDesignation(unconfirmedPoint, 0, { audience: 'CLIENT' });
  assert.equal(clientView.isDistanceConfirmed, false);
  assert.equal(clientView.distance, '');
  assert.equal(clientView.calculatedDistance, '500 m');
  assert.equal(clientView.fullTitle, 'P1 – Orlovská – vpravo');

  const internalView = formatNavigationPointDesignation(unconfirmedPoint, 0, { audience: 'INTERNAL' });
  assert.equal(internalView.isDistanceConfirmed, false);
  assert.equal(internalView.distance, '500 m');
  assert.equal(internalView.fullTitle, 'P1 – Orlovská – 500 m vpravo');

  // Once confirmed via manual value, CLIENT sees confirmed distance
  const confirmedPoint = {
    ...unconfirmedPoint,
    distanceSource: 'MANUAL',
    manualDistanceValue: 450,
    manualDistanceUnit: 'METERS',
  };
  const confirmedClient = resolveNavigationDistance(confirmedPoint, { audience: 'CLIENT' });
  assert.equal(confirmedClient.isConfirmed, true);
  assert.equal(confirmedClient.distance, '450 m');
  assert.equal(confirmedClient.calculatedDistance, '500 m');
});

test('parseNavigationVisualizationConfig preserves valid geometry and rejects malformed payloads', () => {
  const valid = parseNavigationVisualizationConfig({
    signX: 410.44,
    signY: 220.16,
    signXRatio: 0.513,
    signYRatio: 0.367,
    signScale: 1.25,
    signRotation: -6,
    mountType: 'pole',
    mountSide: 'left',
    mirrorGraphic: true,
    theme: 'blue',
    signText: '  Kofola  ',
    subText: 'Prodejna Svinov',
    canvasWidth: 800,
    canvasHeight: 600,
  });
  assert.ok(valid);
  assert.equal(valid.signX, 410.4);
  assert.equal(valid.signScale, 1.25);
  assert.equal(valid.mountSide, 'left');
  assert.equal(valid.theme, 'blue');
  assert.equal(valid.signText, 'Kofola');

  assert.equal(parseNavigationVisualizationConfig(null), null);
  assert.equal(parseNavigationVisualizationConfig({ signX: 'bad', signY: 10, signScale: 1 }), null);
  assert.equal(parseNavigationVisualizationConfig({ signX: 10, signY: 10, signScale: -1 }), null);
});

test('Visualizer distance/arrow sync helpers and Street View haversine delta work accurately', () => {
  assert.deepEqual(parseDistanceTextToManual('1,2 km'), { value: '1,2', unit: 'KILOMETERS' });
  assert.deepEqual(parseDistanceTextToManual('350 m'), { value: '350', unit: 'METERS' });
  assert.equal(parseDistanceTextToManual('bez vzdálenosti'), null);

  assert.deepEqual(formatCalculatedDistanceForInput(480), { value: '500', unit: 'METERS' });
  assert.deepEqual(formatCalculatedDistanceForInput(1220), { value: '1,2', unit: 'KILOMETERS' });
  assert.deepEqual(formatCalculatedDistanceForInput(1240), { value: '1,3', unit: 'KILOMETERS' });

  assert.equal(arrowCharToDirectionEnum('⬆⬅'), 'STRAIGHT_LEFT');
  assert.equal(arrowCharToDirectionEnum('⬅➔'), 'LEFT_RIGHT');
  assert.equal(arrowCharToDirectionEnum('➔'), 'RIGHT');

  const delta = haversineDistanceMeters(49.8346, 18.282, 49.8348, 18.282);
  assert.ok(delta >= 20 && delta <= 25, `expected ~22m, got ${delta}`);
});

test('NavigationSignVisualizer preserves position/size and NavigationStreetViewModal wires adopt-location back to map point', () => {
  const visSrc = read('components/navigation-documentation/NavigationSignVisualizer.tsx');
  assert.match(visSrc, /initialConfig\?:\s*NavigationVisualizationConfig \| null/);
  assert.match(visSrc, /hasExplicitPositionRef/);
  assert.match(visSrc, /signXRatio/);
  assert.match(visSrc, /Zachována uložená poloha a velikost/);

  const svSrc = read('components/offers/navigation-cockpit/NavigationStreetViewModal.tsx');
  assert.match(svSrc, /onAdoptLocation\?:/);
  assert.match(svSrc, /position_changed/);
  assert.match(svSrc, /handleAdoptStreetViewLocation/);
  assert.match(svSrc, /Převzít polohu ze Street View do bodu/);

  const mapStepSrc = read('components/offers/navigation-cockpit/NavigationMapStep.tsx');
  assert.match(mapStepSrc, /onAdoptLocation=\{onPointMove\}/);

  const publicViewSrc = read('components/offers/NavigationOfferPublicView.tsx');
  assert.match(publicViewSrc, /variant = 'public'/);
  assert.match(publicViewSrc, /variant === 'internal' && Boolean\(offer\.id\)/);
});
