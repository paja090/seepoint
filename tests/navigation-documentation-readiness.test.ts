import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPublicNavigationReport,
  isClientApprovedPhoto,
  isPublicNavigationReportStatus,
  NavigationDocumentationValidationError,
  parseQuarter,
  parseRecipientEmail,
  parseReportYear,
  parseTokenExpiry,
} from '../lib/navigation-documentation-policy.js';

test('public navigation reports are limited to PUBLISHED and SENT states', () => {
  assert.equal(isPublicNavigationReportStatus('DRAFT'), false);
  assert.equal(isPublicNavigationReportStatus('REVIEW'), false);
  assert.equal(isPublicNavigationReportStatus('PUBLISHED'), true);
  assert.equal(isPublicNavigationReportStatus('SENT'), true);
  assert.equal(isPublicNavigationReportStatus('ARCHIVED'), false);
});

test('public link requires an unexpired expiry date', () => {
  const now = new Date('2026-08-31T10:00:00Z');
  assert.doesNotThrow(() => assertPublicNavigationReport('PUBLISHED', new Date('2026-09-01T10:00:00Z'), now));
  assert.throws(() => assertPublicNavigationReport('DRAFT', new Date('2026-09-01T10:00:00Z'), now), NavigationDocumentationValidationError);
  assert.throws(() => assertPublicNavigationReport('SENT', new Date('2026-08-31T09:59:59Z'), now), NavigationDocumentationValidationError);
  assert.throws(() => assertPublicNavigationReport('PUBLISHED', null, now), NavigationDocumentationValidationError);
});

test('only explicitly client-visible non-private photos are approved', () => {
  assert.equal(isClientApprovedPhoto({ isClientVisible: true, isPrivate: false }), true);
  assert.equal(isClientApprovedPhoto({ isClientVisible: false, isPrivate: false }), false);
  assert.equal(isClientApprovedPhoto({ isClientVisible: true, isPrivate: true }), false);
  assert.equal(isClientApprovedPhoto(undefined), false);
});

test('quarter and report year validation is strict', () => {
  assert.equal(parseQuarter('4'), 4);
  assert.equal(parseReportYear('2026'), 2026);
  assert.throws(() => parseQuarter(0), NavigationDocumentationValidationError);
  assert.throws(() => parseQuarter(2.5), NavigationDocumentationValidationError);
  assert.throws(() => parseReportYear(1999), NavigationDocumentationValidationError);
});

test('recipient email rejects malformed input and normalizes casing', () => {
  assert.equal(parseRecipientEmail(' CLIENT@Example.cz '), 'client@example.cz');
  assert.throws(() => parseRecipientEmail('not-an-email'), NavigationDocumentationValidationError);
});

test('custom token expiry is bounded to one year', () => {
  const now = new Date('2026-08-31T10:00:00Z');
  assert.equal(parseTokenExpiry(undefined, now).toISOString(), '2026-11-29T10:00:00.000Z');
  assert.throws(() => parseTokenExpiry('2026-08-31T09:00:00Z', now), NavigationDocumentationValidationError);
  assert.throws(() => parseTokenExpiry('2028-01-01T00:00:00Z', now), NavigationDocumentationValidationError);
});
