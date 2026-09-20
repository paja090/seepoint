import test from 'node:test';
import assert from 'node:assert/strict';
import { syncNavigationPointToCarrierAndSurface } from '../lib/navigation/navigation-carrier-sync.ts';

test('syncNavigationPointToCarrierAndSurface creates carrier and surface idempotently', async () => {
  const fakeCarriers: any[] = [];
  const fakeSurfaces: any[] = [];

  const mockTx: any = {
    advertisingCarrier: {
      findFirst: async ({ where }: any) => {
        if (where.id) return fakeCarriers.find((c) => c.id === where.id) || null;
        if (where.code) return fakeCarriers.find((c) => c.code === where.code) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const carrier = { id: `carrier-${fakeCarriers.length + 1}`, ...data };
        fakeCarriers.push(carrier);
        return carrier;
      },
      update: async ({ where, data }: any) => {
        const idx = fakeCarriers.findIndex((c) => c.id === where.id);
        if (idx !== -1) fakeCarriers[idx] = { ...fakeCarriers[idx], ...data };
        return fakeCarriers[idx];
      },
    },
    advertisingSurface: {
      findFirst: async ({ where }: any) => {
        if (where.id) return fakeSurfaces.find((s) => s.id === where.id) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const surface = { id: `surface-${fakeSurfaces.length + 1}`, ...data };
        fakeSurfaces.push(surface);
        return surface;
      },
      update: async ({ where, data }: any) => {
        const idx = fakeSurfaces.findIndex((s) => s.id === where.id);
        if (idx !== -1) fakeSurfaces[idx] = { ...fakeSurfaces[idx], ...data };
        return fakeSurfaces[idx];
      },
    },
  };

  const pointInput = {
    id: 'point-1',
    stableKey: 'stable-1',
    label: 'Naváděcí šipka Form Factory',
    latitude: 49.835,
    longitude: 18.292,
    address: 'Krmelínská 12, Ostrava',
    pillarNumber: '5482',
    arrowDirection: 'Doprava',
    calculatedDistanceMeters: 450,
  };

  const meta = {
    organizationId: 'org-test',
    clientId: 'client-1',
    targetName: 'Form Factory',
    city: 'Ostrava',
  };

  // 1. Initial creation
  const result1 = await syncNavigationPointToCarrierAndSurface(mockTx, pointInput, meta);
  assert.ok(result1.carrierId);
  assert.ok(result1.surfaceId);

  assert.equal(fakeCarriers.length, 1);
  assert.equal(fakeSurfaces.length, 1);
  assert.equal(fakeCarriers[0].type, 'NAVIGATION');
  assert.equal(fakeCarriers[0].mountingType, 'LIGHT_POLE');
  assert.equal(fakeCarriers[0].code, 'VO-OSTRAVA-5482');
  assert.equal(fakeSurfaces[0].mediaType, 'NAVIGATION_SIGN');
  assert.equal(fakeSurfaces[0].destinationName, 'Form Factory');

  // 2. Idempotent second run
  const result2 = await syncNavigationPointToCarrierAndSurface(
    mockTx,
    { ...pointInput, carrierId: result1.carrierId, surfaceId: result1.surfaceId },
    meta
  );

  assert.equal(result2.carrierId, result1.carrierId);
  assert.equal(result2.surfaceId, result1.surfaceId);
  assert.equal(fakeCarriers.length, 1, 'Carrier should not be duplicated');
  assert.equal(fakeSurfaces.length, 1, 'Surface should not be duplicated');
});
