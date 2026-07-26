import assert from 'node:assert/strict';
import test from 'node:test';
import { isGoogleDriveMockEnabled, listImagesInFolder, verifyFileInFolder, uploadPhotoToGoogleDrive, downloadPhotoFromGoogleDrive } from '../lib/google-drive.ts';

// Cast process.env to allow modification of NODE_ENV in tests
const env = process.env as Record<string, string | undefined>;

// Sorting mock helper matching PATCH/DELETE transaction logic
function reorderPhotos(photos: Array<{ id: string; sortOrder: number }>, photoId: string, targetIndex: number) {
  const photo = photos.find(p => p.id === photoId);
  if (!photo) return photos;
  const remaining = photos.filter(p => p.id !== photoId).sort((l, r) => l.sortOrder - r.sortOrder);
  const target = Math.max(0, Math.min(targetIndex, remaining.length));
  remaining.splice(target, 0, photo);
  return remaining.map((p, idx) => ({ ...p, sortOrder: idx }));
}

function handlePhotoDelete(photos: Array<{ id: string; sortOrder: number; isPrimary: boolean }>, deleteId: string) {
  const photo = photos.find(p => p.id === deleteId);
  if (!photo) return photos;
  const cloned = photos.map(p => ({ ...p }));
  const remaining = cloned.filter(p => p.id !== deleteId).sort((l, r) => l.sortOrder - r.sortOrder);
  
  if (photo.isPrimary && remaining.length > 0) {
    remaining[0].isPrimary = true;
  }
  return remaining.map((p, idx) => ({ ...p, sortOrder: idx }));
}

test('1. Mock cannot be activated in production', () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalMockEnabled = env.GOOGLE_DRIVE_MOCK_ENABLED;

  try {
    env.NODE_ENV = 'production';
    env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';
    assert.equal(isGoogleDriveMockEnabled(), false);
  } finally {
    env.NODE_ENV = originalNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = originalMockEnabled;
  }
});

test('2. Missing credentials without mock enabled throws error', async () => {
  const originalMockEnabled = env.GOOGLE_DRIVE_MOCK_ENABLED;
  const originalEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalClientId = env.GOOGLE_DRIVE_CLIENT_ID;
  const originalClientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  const originalRefreshToken = env.GOOGLE_DRIVE_REFRESH_TOKEN;

  try {
    env.GOOGLE_DRIVE_MOCK_ENABLED = 'false';
    delete env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete env.GOOGLE_DRIVE_CLIENT_ID;
    delete env.GOOGLE_DRIVE_CLIENT_SECRET;
    delete env.GOOGLE_DRIVE_REFRESH_TOKEN;

    const dummyFile = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
    await assert.rejects(
      async () => {
        await uploadPhotoToGoogleDrive(dummyFile, 'test.jpg', 'photo1');
      },
      (err: unknown) => {
        return err instanceof Error && err.message.includes('Chybí konfigurace Google Drive OAuth');
      }
    );
  } finally {
    env.GOOGLE_DRIVE_MOCK_ENABLED = originalMockEnabled;
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    env.GOOGLE_DRIVE_CLIENT_ID = originalClientId;
    env.GOOGLE_DRIVE_CLIENT_SECRET = originalClientSecret;
    env.GOOGLE_DRIVE_REFRESH_TOKEN = originalRefreshToken;
  }
});

test('3. verifyFileInFolder strictly checks parent folder alignment', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalMockEnabled = env.GOOGLE_DRIVE_MOCK_ENABLED;
  const originalFolderId = env.GOOGLE_DRIVE_FOLDER_ID;

  try {
    env.NODE_ENV = 'development';
    env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';
    env.GOOGLE_DRIVE_FOLDER_ID = 'valid-folder-id';

    // Verify file that belongs to target folder
    const dummyFile = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    const uploaded = await uploadPhotoToGoogleDrive(dummyFile, 'photo.png', 'p1');
    
    const isValid = await verifyFileInFolder(uploaded.id, 'valid-folder-id');
    assert.equal(isValid, true);

    // Verify folder check fails for a different parent ID
    const isInvalid = await verifyFileInFolder(uploaded.id, 'different-folder-id');
    assert.equal(isInvalid, false);
  } finally {
    env.NODE_ENV = originalNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = originalMockEnabled;
    env.GOOGLE_DRIVE_FOLDER_ID = originalFolderId;
  }
});

test('4. downloadPhotoFromGoogleDrive returns binary response stream', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalMockEnabled = env.GOOGLE_DRIVE_MOCK_ENABLED;

  try {
    env.NODE_ENV = 'development';
    env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';

    const dummyFile = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    const uploaded = await uploadPhotoToGoogleDrive(dummyFile, 'photo.png', 'p1');

    const response = await downloadPhotoFromGoogleDrive(uploaded.id);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/png');

    const buffer = Buffer.from(await response.arrayBuffer());
    assert.equal(buffer.toString(), 'dummy content');
  } finally {
    env.NODE_ENV = originalNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = originalMockEnabled;
  }
});

test('5. Photo reordering logic prevents duplicates and preserves contiguous index orders', () => {
  const initialPhotos = [
    { id: 'p1', sortOrder: 0 },
    { id: 'p2', sortOrder: 1 },
    { id: 'p3', sortOrder: 2 },
  ];

  // Move p3 to index 0
  const reordered = reorderPhotos(initialPhotos, 'p3', 0);
  assert.deepEqual(reordered, [
    { id: 'p3', sortOrder: 0 },
    { id: 'p1', sortOrder: 1 },
    { id: 'p2', sortOrder: 2 },
  ]);

  // Move p1 to index 2
  const reordered2 = reorderPhotos(initialPhotos, 'p1', 2);
  assert.deepEqual(reordered2, [
    { id: 'p2', sortOrder: 0 },
    { id: 'p3', sortOrder: 1 },
    { id: 'p1', sortOrder: 2 },
  ]);
});

test('6. Primary photo re-election when deleting primary photo', () => {
  const initialPhotos = [
    { id: 'p1', sortOrder: 0, isPrimary: true },
    { id: 'p2', sortOrder: 1, isPrimary: false },
    { id: 'p3', sortOrder: 2, isPrimary: false },
  ];

  // Delete primary photo 'p1'
  const afterDelete = handlePhotoDelete(initialPhotos, 'p1');
  assert.deepEqual(afterDelete, [
    { id: 'p2', sortOrder: 0, isPrimary: true },
    { id: 'p3', sortOrder: 1, isPrimary: false },
  ]);

  // Delete non-primary photo 'p3'
  const afterDeleteNonPrimary = handlePhotoDelete(initialPhotos, 'p3');
  assert.deepEqual(afterDeleteNonPrimary, [
    { id: 'p1', sortOrder: 0, isPrimary: true },
    { id: 'p2', sortOrder: 1, isPrimary: false },
  ]);
});

test('7. listImagesInFolder lists files in the mock folder', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalMockEnabled = env.GOOGLE_DRIVE_MOCK_ENABLED;
  const originalFolderId = env.GOOGLE_DRIVE_FOLDER_ID;

  try {
    env.NODE_ENV = 'development';
    env.GOOGLE_DRIVE_MOCK_ENABLED = 'true';
    env.GOOGLE_DRIVE_FOLDER_ID = 'test-folder-123';

    const dummyFile = new File(['mock content'], 'test-list.jpg', { type: 'image/jpeg' });
    await uploadPhotoToGoogleDrive(dummyFile, 'test-list.jpg', 'photo-l1');

    const files = await listImagesInFolder('test-folder-123');
    assert.ok(files.length > 0);
    assert.ok(files.some(f => f.name === 'test-list.jpg'));
  } finally {
    env.NODE_ENV = originalNodeEnv;
    env.GOOGLE_DRIVE_MOCK_ENABLED = originalMockEnabled;
    env.GOOGLE_DRIVE_FOLDER_ID = originalFolderId;
  }
});
