import assert from 'node:assert/strict';
import test from 'node:test';
import { tenantStorageKey } from '../lib/storage/tenant-storage-key.ts';

test('storage keys are namespaced by organization, resource and variant', () => {
  assert.equal(tenantStorageKey({ organizationId: 'org-a', resource: 'photos', resourceId: 'photo-1', variant: 'thumbnail', fileName: 'plocha.jpg' }), 'organizations/org-a/photos/photo-1/thumbnail/plocha.jpg');
});

test('storage keys neutralize path traversal and unsafe characters', () => {
  const key = tenantStorageKey({ organizationId: 'org/../../b', resource: 'documents', resourceId: 'doc/1', fileName: '../faktura č. 1.pdf' });
  assert.equal(key.split('/').length, 6);
  assert.equal(key.startsWith('organizations/org_.._.._b/documents/doc_1/original/'), true);
  assert.equal(key.slice('organizations/'.length).includes('/../'), false);
});
