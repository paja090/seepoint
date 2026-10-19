import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCampaignAlbumSlug,
  verifyCampaignAlbumSlug,
  buildSurfaceAlbumSlug,
  verifySurfaceAlbumSlug,
} from '../lib/election-removal/album-token';
import { enterPublicCampaignAlbumTenant, enterPublicSurfaceAlbumTenant } from '../lib/public-tenant';
import { getTenantContext, runWithTenantContext } from '../lib/tenant-context';

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

test('enterPublicCampaignAlbumTenant - supports both signed slugs and raw campaign CUIDs', async () => {
  const campaignId = 'cmvb9j2hp0001jz07a738oqo3';
  const signedSlug = buildCampaignAlbumSlug(campaignId);

  // 1. Signed slug
  const metaSigned = await enterPublicCampaignAlbumTenant(signedSlug);
  assert.ok(metaSigned);
  assert.equal(metaSigned.id, campaignId);
  assert.ok(metaSigned.organizationId);

  const scopedOrg = runWithTenantContext(
    { organizationId: metaSigned.organizationId, source: 'public-token' },
    () => getTenantContext()?.organizationId
  );
  assert.equal(scopedOrg, metaSigned.organizationId);

  // 2. Raw CUID token
  const metaRaw = await enterPublicCampaignAlbumTenant(campaignId);
  assert.ok(metaRaw);
  assert.equal(metaRaw.id, campaignId);
  assert.ok(metaRaw.organizationId);

  // 3. Invalid tokens must return null
  assert.equal(await enterPublicCampaignAlbumTenant('non-existent-campaign-id'), null);
  assert.equal(await enterPublicCampaignAlbumTenant(''), null);
});

test('enterPublicSurfaceAlbumTenant - activates tenant context for valid surface tokens', async () => {
  const orgId = 'org_seepoint_default';
  const client = 'Petlando';
  const slug = buildSurfaceAlbumSlug(orgId, client);

  const meta = await enterPublicSurfaceAlbumTenant(slug);
  assert.ok(meta);
  assert.equal(meta.organizationId, orgId);
  assert.equal(meta.clientName, client);

  const scopedOrg = runWithTenantContext(
    { organizationId: meta.organizationId, source: 'public-token' },
    () => getTenantContext()?.organizationId
  );
  assert.equal(scopedOrg, orgId);

  // Tampered token must fail
  assert.equal(await enterPublicSurfaceAlbumTenant(`${slug}x`), null);
});
