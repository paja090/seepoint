import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecureToken,
  hashToken,
  runPrePublishChecks,
  buildSnapshotItem,
  type SnapshotItemData,
} from '../lib/navigation-documentation.js';
import { canAccess } from '../lib/rbac.js';

test('1. Token generation creates cryptographically random token and valid SHA-256 hash', () => {
  const { token, hash } = generateSecureToken();

  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);

  // Hash of token matches hashToken function
  const computedHash = hashToken(token);
  assert.equal(computedHash, hash);
});

test('2. Two generated tokens are unique and non-colliding', () => {
  const t1 = generateSecureToken();
  const t2 = generateSecureToken();

  assert.notEqual(t1.token, t2.token);
  assert.notEqual(t1.hash, t2.hash);
});

test('3. Pre-publish checks detect empty report', () => {
  const warnings = runPrePublishChecks('client@test.cz', []);

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, 'EMPTY_REPORT');
});

test('4. Pre-publish checks detect missing client email', () => {
  const warnings = runPrePublishChecks(null, [
    {
      id: 'item-1',
      isVisible: true,
      navigationPoint: { label: 'NAV-1', latitude: 50.0, longitude: 14.4 },
      selectedPhoto: { url: 'https://example.com/p.jpg', isClientVisible: true, isPrivate: false },
    },
  ]);

  assert.equal(warnings.some((w) => w.type === 'MISSING_CLIENT_EMAIL'), true);
});

test('5. Pre-publish checks detect missing photos and unapproved photos', () => {
  const warnings = runPrePublishChecks('client@test.cz', [
    {
      id: 'item-1',
      isVisible: true,
      navigationPoint: { label: 'NAV-1', latitude: 50.0, longitude: 14.4 },
      selectedPhoto: null, // missing photo
    },
    {
      id: 'item-2',
      isVisible: true,
      navigationPoint: { label: 'NAV-2', latitude: 50.0, longitude: 14.4 },
      selectedPhoto: { url: 'https://example.com/p2.jpg', isClientVisible: false, isPrivate: true }, // unapproved
    },
  ]);

  assert.equal(warnings.some((w) => w.type === 'MISSING_PHOTO'), true);
  assert.equal(warnings.some((w) => w.type === 'UNAPPROVED_PHOTO'), true);
});

test('6. Pre-publish checks detect missing GPS coordinates', () => {
  const warnings = runPrePublishChecks('client@test.cz', [
    {
      id: 'item-1',
      isVisible: true,
      navigationPoint: { label: 'NAV-1', latitude: 0, longitude: 0 }, // missing GPS
      selectedPhoto: { url: 'https://example.com/p.jpg', isClientVisible: true },
    },
  ]);

  assert.equal(warnings.some((w) => w.type === 'MISSING_GPS'), true);
});

test('7. Immutable snapshot builder freezes item details correctly', () => {
  const snapshot: SnapshotItemData = buildSnapshotItem({
    id: 'item-100',
    clientNote: 'Instalováno u hlavní křižovatky',
    navigationPoint: {
      id: 'np-1',
      label: 'NAV-100',
      address: 'Hlavní 15',
      latitude: 50.08,
      longitude: 14.42,
      status: 'INSTALLED',
      orientation: 'Pravoběžné',
      variant: 'Standard',
      updatedAt: new Date('2026-06-15T10:00:00Z'),
    },
    carrier: {
      id: 'c-1',
      code: 'NAV-100',
      name: 'Nosič 100',
      address: 'Hlavní 15',
      city: 'Pardubice',
      district: 'Centrum',
      latitude: 50.08,
      longitude: 14.42,
    },
    selectedPhoto: {
      id: 'photo-1',
      url: 'https://example.com/photo100.jpg',
      createdAt: new Date('2026-06-16T12:00:00Z'),
    },
  });

  assert.equal(snapshot.id, 'item-100');
  assert.equal(snapshot.pointCode, 'NAV-100');
  assert.equal(snapshot.address, 'Hlavní 15');
  assert.equal(snapshot.city, 'Pardubice');
  assert.equal(snapshot.latitude, 50.08);
  assert.equal(snapshot.longitude, 14.42);
  assert.equal(snapshot.status, 'INSTALLED');
  assert.equal(snapshot.clientNote, 'Instalováno u hlavní křižovatky');
  assert.equal(snapshot.photoUrl, 'https://example.com/photo100.jpg');
});

test('8. RBAC section navigationDocumentation access control', () => {
  assert.equal(canAccess('ADMIN', 'navigationDocumentation'), true);
  assert.equal(canAccess('MANAGER', 'navigationDocumentation'), true);
  assert.equal(canAccess('SALES', 'navigationDocumentation'), true);
  assert.equal(canAccess('WORKER', 'navigationDocumentation'), false);
  assert.equal(canAccess('ACCOUNTANT', 'navigationDocumentation'), false);
  assert.equal(canAccess('VIEWER', 'navigationDocumentation'), false);
});
