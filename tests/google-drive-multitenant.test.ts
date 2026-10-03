/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { uploadPhotoToGoogleDrive } from '../lib/google-drive';
import { runWithTenantContext } from '../lib/tenant-context';

test('Multi-tenant Google Drive API: GET /api/google-drive/images isolates files per organization', async t => {
  const env = process.env as Record<string, string | undefined>;
  const origNodeEnv = env.NODE_ENV;
  const origMock = env.GOOGLE_DRIVE_MOCK_ENABLED;
  const origFolder = env.GOOGLE_DRIVE_FOLDER_ID;

  env.NODE_ENV = 'development';
  env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';
  env.GOOGLE_DRIVE_FOLDER_ID = 'root-company-drive';

  let currentAuth = { id: 'user-a', organizationId: 'org-aaa', role: 'ADMIN' };

  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const originalLoad = loader._load;
  loader._load = function (id: string, ...args: any[]) {
    if (id === 'server-only') return {};
    if (id === '@/lib/api-auth') {
      return {
        requireApiAccess: async () => currentAuth,
        isApiDenied: () => false,
      };
    }
    return originalLoad.call(this, id, ...args);
  };

  t.after(() => {
    loader._load = originalLoad;
    env.NODE_ENV = origNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = origMock;
    env.GOOGLE_DRIVE_FOLDER_ID = origFolder;
  });

  // Pre-seed files in mock drive for Org AAA and Org BBB
  const fileA = new File(['content A'], 'aaa-carrier.jpg', { type: 'image/jpeg' });
  const uploadedA = await runWithTenantContext(
    { organizationId: 'org-aaa', userId: 'user-a', source: 'session' },
    async () => uploadPhotoToGoogleDrive(fileA, 'aaa-carrier.jpg', 'photo-aaa-1'),
  );

  const fileB = new File(['content B'], 'bbb-carrier.jpg', { type: 'image/jpeg' });
  const uploadedB = await runWithTenantContext(
    { organizationId: 'org-bbb', userId: 'user-b', source: 'session' },
    async () => uploadPhotoToGoogleDrive(fileB, 'bbb-carrier.jpg', 'photo-bbb-1'),
  );

  const { GET } = await import('../app/api/google-drive/images/route');

  // Request as Org AAA
  currentAuth = { id: 'user-a', organizationId: 'org-aaa', role: 'ADMIN' };
  const resA = await GET(new Request('http://localhost/api/google-drive/images'));
  assert.equal(resA.status, 200);
  const dataA = await resA.json();
  assert.ok(dataA.files.some((f: any) => f.id === uploadedA.id), 'Org AAA must see its own file');
  assert.equal(dataA.files.some((f: any) => f.id === uploadedB.id), false, 'Org AAA must NEVER see Org BBB file');

  // Request as Org BBB
  currentAuth = { id: 'user-b', organizationId: 'org-bbb', role: 'ADMIN' };
  const resB = await GET(new Request('http://localhost/api/google-drive/images'));
  assert.equal(resB.status, 200);
  const dataB = await resB.json();
  assert.ok(dataB.files.some((f: any) => f.id === uploadedB.id), 'Org BBB must see its own file');
  assert.equal(dataB.files.some((f: any) => f.id === uploadedA.id), false, 'Org BBB must NEVER see Org AAA file');
});

test('Multi-tenant Google Drive API: POST /api/photos/link rejects linking file belonging to another tenant', async t => {
  const env = process.env as Record<string, string | undefined>;
  const origNodeEnv = env.NODE_ENV;
  const origMock = env.GOOGLE_DRIVE_MOCK_ENABLED;
  const origFolder = env.GOOGLE_DRIVE_FOLDER_ID;

  env.NODE_ENV = 'development';
  env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';
  env.GOOGLE_DRIVE_FOLDER_ID = 'root-company-drive';

  let currentAuth = { id: 'user-b', organizationId: 'org-bbb', role: 'ADMIN' };

  // Pre-seed file for Org AAA
  const fileA = new File(['content A'], 'org-a-private.jpg', { type: 'image/jpeg' });
  const uploadedA = await runWithTenantContext(
    { organizationId: 'org-aaa', userId: 'user-a', source: 'session' },
    async () => uploadPhotoToGoogleDrive(fileA, 'org-a-private.jpg', 'private-a'),
  );

  const mockCarrier = { id: 'carrier-bbb-1', organizationId: 'org-bbb' };
  const createdPhotos: any[] = [];

  const mockPrisma = {
    advertisingCarrier: {
      count: async () => 1,
    },
    advertisingSurface: {
      count: async () => 0,
      findUnique: async () => null,
    },
    photo: {
      findFirst: async () => null,
      count: async () => 0,
      create: async ({ data }: any) => {
        createdPhotos.push(data);
        return { ...data, id: 'photo-new-id' };
      },
    },
    $transaction: async (fn: any) => {
      const tx = {
        $executeRaw: async () => 1,
        photo: {
          count: async () => 0,
          create: async ({ data }: any) => {
            createdPhotos.push(data);
            return { ...data, id: 'photo-new-id' };
          },
        },
      };
      return fn(tx);
    },
  };

  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const originalLoad = loader._load;
  loader._load = function (id: string, ...args: any[]) {
    if (id === 'server-only') return {};
    if (id === '@/lib/api-auth') {
      return {
        requireApiAccess: async () => currentAuth,
        isApiDenied: () => false,
      };
    }
    if (id === '@/lib/db') {
      return { prisma: mockPrisma };
    }
    return originalLoad.call(this, id, ...args);
  };

  t.after(() => {
    loader._load = originalLoad;
    env.NODE_ENV = origNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = origMock;
    env.GOOGLE_DRIVE_FOLDER_ID = origFolder;
  });

  const { POST } = await import('../app/api/photos/link/route');

  // Org BBB tries to link Org AAA's drive file!
  currentAuth = { id: 'user-b', organizationId: 'org-bbb', role: 'ADMIN' };
  const crossTenantReq = new Request('http://localhost/api/photos/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driveFileId: uploadedA.id,
      carrierId: mockCarrier.id,
      fileName: 'org-a-private.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      type: 'CARRIER',
    }),
  });

  const crossTenantRes = await runWithTenantContext(
    { organizationId: 'org-bbb', userId: 'user-b', source: 'session' },
    async () => POST(crossTenantReq),
  );

  assert.equal(crossTenantRes.status, 403, 'Cross-tenant Google Drive file linking must be strictly rejected with 403');
  const crossData = await crossTenantRes.json();
  assert.match(crossData.error, /nenachází v povolené/);
  assert.equal(createdPhotos.length, 0, 'No photo must be linked');

  // Now Org AAA links its own file
  currentAuth = { id: 'user-a', organizationId: 'org-aaa', role: 'ADMIN' };
  const legitimateReq = new Request('http://localhost/api/photos/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      driveFileId: uploadedA.id,
      carrierId: 'carrier-aaa-1',
      fileName: 'org-a-private.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      type: 'CARRIER',
    }),
  });

  const legitRes = await runWithTenantContext(
    { organizationId: 'org-aaa', userId: 'user-a', source: 'session' },
    async () => POST(legitimateReq),
  );

  assert.equal(legitRes.status, 201, 'Tenant must be able to link its own Google Drive file');
  assert.equal(createdPhotos.length, 1);
  assert.equal(createdPhotos[0].driveFileId, uploadedA.id);
});
