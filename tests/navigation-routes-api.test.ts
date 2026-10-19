/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { NextResponse } from 'next/server';

test('navigation-routes API - auth checks and route calculation', async (t) => {
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const originalLoad = loader._load;
  let currentUser: any = null;

  loader._load = function (id: string, ...args: any[]) {
    if (id === 'server-only') return {};
    if (id === '@/lib/api-auth') {
      return {
        requireApiAccess: async () => {
          if (!currentUser) {
            return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
          }
          return currentUser;
        },
        isApiDenied: (val: any) => val instanceof NextResponse,
      };
    }
    if (id === '@/lib/google-maps') {
      return {
        getGoogleMapsKeyDetails: () => ({ key: 'test-key', sourceName: 'GOOGLE_MAPS_SERVER_API_KEY' }),
        computeGoogleRoute: async (origin: any, destination: any) => {
          return {
            distanceMeters: 4500,
            durationSeconds: 320,
            polyline: 'sample_encoded_polyline_abc',
            status: 'OK',
          };
        },
      };
    }
    return originalLoad.call(this, id, ...args);
  };
  t.after(() => { loader._load = originalLoad; });

  const { POST, GET } = await import('../app/api/navigation-routes/route');

  // 1. Unauthenticated test
  currentUser = null;
  const unauthReq = new Request('https://seepoint.test/api/navigation-routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originLat: 49.8355, originLng: 18.2925, destLat: 49.8282, destLng: 18.1722 }),
  });
  const unauthRes = await POST(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. Authenticated with invalid coordinates
  currentUser = { id: 'usr-1', organizationId: 'org-1', role: 'ADMIN' };
  const invalidReq = new Request('https://seepoint.test/api/navigation-routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originLat: 'not-a-number', originLng: 18.2925 }),
  });
  const invalidRes = await POST(invalidReq);
  assert.equal(invalidRes.status, 400);

  // 3. Authenticated with valid flat coordinates
  const validReq = new Request('https://seepoint.test/api/navigation-routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originLat: 49.8355,
      originLng: 18.2925,
      destLat: 49.8282,
      destLng: 18.1722,
    }),
  });
  const validRes = await POST(validReq);
  assert.equal(validRes.status, 200);
  const data = await validRes.json();
  assert.equal(data.status, 'OK');
  assert.equal(data.distanceMeters, 4500);
  assert.equal(data.polyline, 'sample_encoded_polyline_abc');

  // 4. Authenticated with nested coordinates
  const nestedReq = new Request('https://seepoint.test/api/navigation-routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: { latitude: 49.8355, longitude: 18.2925 },
      destination: { latitude: 49.8282, longitude: 18.1722 },
    }),
  });
  const nestedRes = await POST(nestedReq);
  assert.equal(nestedRes.status, 200);
  const nestedData = await nestedRes.json();
  assert.equal(nestedData.status, 'OK');
  assert.equal(nestedData.distanceMeters, 4500);

  // 5. GET diagnostics endpoint
  const getReq = new Request('https://seepoint.test/api/navigation-routes', { method: 'GET' });
  const getRes = await GET(getReq);
  assert.equal(getRes.status, 200);
  const diagData = await getRes.json();
  assert.equal(diagData.hasKey, true);
  assert.equal(diagData.hasPolyline, true);
});
