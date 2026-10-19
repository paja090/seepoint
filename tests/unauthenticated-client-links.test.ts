/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCampaignAlbumSlug,
  verifyCampaignAlbumSlug,
  buildSurfaceAlbumSlug,
  verifySurfaceAlbumSlug,
} from '../lib/election-removal/album-token';
import { platformPrisma } from '../lib/db';
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

test('enterPublicCampaignAlbumTenant - supports both signed slugs and raw campaign CUIDs', async (t) => {
  const campaignId = 'cmvb9j2hp0001jz07a738oqo3';
  const orgId = 'org_seepoint_default';
  const signedSlug = buildCampaignAlbumSlug(campaignId);

  const originalCampaignFindUnique = platformPrisma.electionCampaign.findUnique;
  const originalOrgFindUnique = platformPrisma.organization.findUnique;
  t.after(() => {
    platformPrisma.electionCampaign.findUnique = originalCampaignFindUnique;
    platformPrisma.organization.findUnique = originalOrgFindUnique;
  });

  (platformPrisma.electionCampaign as any).findUnique = (async ({ where }: any) => {
    if (where.id === campaignId) {
      return {
        id: campaignId,
        name: 'Volební kampaň 2026',
        clientName: 'Město Ostrava',
        description: null,
        status: 'IN_PROGRESS',
        organizationId: orgId,
      };
    }
    return null;
  }) as typeof platformPrisma.electionCampaign.findUnique;

  (platformPrisma.organization as any).findUnique = (async ({ where }: any) => {
    if (where.id === orgId) {
      return { id: orgId, isActive: true };
    }
    return null;
  }) as typeof platformPrisma.organization.findUnique;

  // 1. Signed slug
  const metaSigned = await enterPublicCampaignAlbumTenant(signedSlug);
  assert.ok(metaSigned);
  assert.equal(metaSigned.id, campaignId);
  assert.equal(metaSigned.organizationId, orgId);

  const scopedOrg = runWithTenantContext(
    { organizationId: metaSigned.organizationId, source: 'public-token' },
    () => getTenantContext()?.organizationId
  );
  assert.equal(scopedOrg, metaSigned.organizationId);

  // 2. Raw CUID token
  const metaRaw = await enterPublicCampaignAlbumTenant(campaignId);
  assert.ok(metaRaw);
  assert.equal(metaRaw.id, campaignId);
  assert.equal(metaRaw.organizationId, orgId);

  // 3. Invalid tokens must return null
  assert.equal(await enterPublicCampaignAlbumTenant('non-existent-campaign-id'), null);
  assert.equal(await enterPublicCampaignAlbumTenant(''), null);
});

test('enterPublicSurfaceAlbumTenant - activates tenant context for valid surface tokens', async (t) => {
  const orgId = 'org_seepoint_default';
  const client = 'Petlando';
  const slug = buildSurfaceAlbumSlug(orgId, client);

  const originalFindUnique = platformPrisma.organization.findUnique;
  t.after(() => {
    platformPrisma.organization.findUnique = originalFindUnique;
  });

  (platformPrisma.organization as any).findUnique = (async ({ where }: any) => {
    if (where.id === orgId) {
      return { id: orgId, isActive: true };
    }
    return null;
  }) as typeof platformPrisma.organization.findUnique;

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

test('enterPublicNavigationReportTenant - resolves active reports with future tokenExpiresAt', async (t) => {
  const reportId = 'nav-report-xyz-123';
  const orgId = 'org_seepoint_default';
  const { getDeterministicReportToken } = await import('../lib/navigation-documentation');
  const { enterPublicNavigationReportTenant } = await import('../lib/public-tenant');
  const { hash } = getDeterministicReportToken(reportId);

  const originalReportFindFirst = platformPrisma.navigationDocumentationReport.findFirst;
  const originalOrgFindUnique = platformPrisma.organization.findUnique;

  t.after(() => {
    platformPrisma.navigationDocumentationReport.findFirst = originalReportFindFirst;
    platformPrisma.organization.findUnique = originalOrgFindUnique;
  });

  (platformPrisma.organization as any).findUnique = (async ({ where }: any) => {
    if (where.id === orgId) {
      return { id: orgId, isActive: true };
    }
    return null;
  }) as typeof platformPrisma.organization.findUnique;

  (platformPrisma.navigationDocumentationReport as any).findFirst = (async ({ where }: any) => {
    if (where.publicTokenHash === hash && where.status?.in?.includes('PUBLISHED') && where.publishedAt && where.tokenExpiresAt?.gt) {
      return { id: reportId, organizationId: orgId };
    }
    return null;
  }) as typeof platformPrisma.navigationDocumentationReport.findFirst;

  const res = await enterPublicNavigationReportTenant(hash);
  assert.ok(res);
  assert.equal(res.id, reportId);
  assert.equal(res.organizationId, orgId);

  // Invalid token format
  assert.equal(await enterPublicNavigationReportTenant('short-invalid'), null);
  assert.equal(await enterPublicNavigationReportTenant(''), null);
});
