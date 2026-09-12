import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('CarrierDetail calculates isDamaged considering carrier photos, notes, and surface OUT_OF_SERVICE status', () => {
  const carrierDetail = read('components/CarrierDetail.tsx');

  // Must check damagedSurfaces with OUT_OF_SERVICE and surface damage photos
  assert.match(
    carrierDetail,
    /damagedSurfaces\s*=\s*carrier\.surfaces\.filter/,
    'CarrierDetail must compute damagedSurfaces'
  );
  assert.match(
    carrierDetail,
    /s\.status\s*===\s*'OUT_OF_SERVICE'/,
    'damagedSurfaces must check OUT_OF_SERVICE'
  );
  assert.match(
    carrierDetail,
    /isDamaged\s*=\s*\(damagePhotos\.length\s*>\s*0\s*\|\|\s*hasDamageNote\s*\|\|\s*hasDamagedSurfaces\)\s*&&\s*!damageResolved/,
    'isDamaged must include hasDamagedSurfaces'
  );
});

test('CarrierDetail calls /api/carriers/:id/resolve-damage with surfaceId and has resolution button on surfaces', () => {
  const carrierDetail = read('components/CarrierDetail.tsx');

  // handleResolveDamage must call /api/carriers/:id/resolve-damage
  assert.match(
    carrierDetail,
    /\/api\/carriers\/\$\{carrier\.id\}\/resolve-damage/,
    'handleResolveDamage must call POST /api/carriers/:id/resolve-damage'
  );

  // Surface list must render resolution button when isSurfaceDamaged
  assert.match(
    carrierDetail,
    /isSurfaceDamaged\s*&&[\s\S]*?handleResolveDamage\(surface\.id\)/,
    'Surface item must provide quick resolve damage button'
  );
});

test('resolve-damage route enforces auth, updates damage photos to ARCHIVE, restores OUT_OF_SERVICE, and logs history', () => {
  const route = read('app/api/carriers/[id]/resolve-damage/route.ts');

  // Authentication guard
  assert.match(route, /requireApiAccess\('carriers'\)/, 'Route must check requireApiAccess');

  // Photo archiving
  assert.match(route, /type:\s*'ARCHIVE'/, 'Route must change photo type to ARCHIVE');
  assert.match(route, /OPRAVENO/, 'Route must append OPRAVENO resolution tag to note');

  // Status restoration
  assert.match(route, /status:\s*nextStatus/, 'Route must restore surface status from OUT_OF_SERVICE');

  // History audit logging
  assert.match(route, /logCarrierHistoryEvent\(\{[\s\S]*?eventType:\s*'REPAIR'/, 'Route must record REPAIR in history log');

  // Chat message resolution
  assert.match(route, /isResolved:\s*true/, 'Route must resolve urgent chat messages');
});

test('NavigationSurfaceManager and CarrierDetailTimelineView integrate with resolve-damage', () => {
  const navManager = read('components/NavigationSurfaceManager.tsx');
  const timelineView = read('components/navigation/CarrierDetailTimelineView.tsx');

  assert.match(
    navManager,
    /\/api\/carriers\/\$\{carrierId\}\/resolve-damage/,
    'NavigationSurfaceManager must call resolve-damage when restoring surface'
  );

  assert.match(
    timelineView,
    /\/api\/carriers\/\$\{carrier\.id\}\/resolve-damage/,
    'CarrierDetailTimelineView must call resolve-damage for OUT_OF_SERVICE surfaces'
  );
});
