import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCampaignAlbumSlug,
  verifyCampaignAlbumSlug,
  buildSurfaceAlbumSlug,
  verifySurfaceAlbumSlug,
} from '../lib/election-removal/album-token';
import { getDeterministicReportToken, hashToken } from '../lib/navigation-documentation';

test('verifyCampaignAlbumSlug - validates and rejects signatures properly', () => {
  const campaignId = 'cmvb9j2hp0001jz07a738oqo3';
  const slug = buildCampaignAlbumSlug(campaignId);
  assert.equal(verifyCampaignAlbumSlug(slug), campaignId);
  assert.equal(verifyCampaignAlbumSlug('invalid-token'), null);
  assert.equal(verifyCampaignAlbumSlug(`${campaignId}.badsignature`), null);
});

test('buildSurfaceAlbumSlug & verifySurfaceAlbumSlug - signs and verifies surface client albums', () => {
  const orgId = 'org_seepoint_default';
  const client = 'Mariánské hory radnice';

  const slug = buildSurfaceAlbumSlug(orgId, client);
  assert.ok(slug.startsWith('surface.'));

  const verified = verifySurfaceAlbumSlug(slug);
  assert.ok(verified);
  assert.equal(verified.organizationId, orgId);
  assert.equal(verified.clientName, client);

  // Tampered slug must fail
  assert.equal(verifySurfaceAlbumSlug(`${slug}tampered`), null);
  assert.equal(verifySurfaceAlbumSlug('surface.org.client'), null);
  assert.equal(verifySurfaceAlbumSlug(''), null);
});

test('getDeterministicReportToken - produces deterministic tokens and hashes', () => {
  const reportId = 'report-12345';
  const r1 = getDeterministicReportToken(reportId);
  const r2 = getDeterministicReportToken(reportId);

  assert.equal(r1.token, r2.token);
  assert.equal(r1.hash, r2.hash);
  assert.equal(hashToken(r1.token), r1.hash);
});
