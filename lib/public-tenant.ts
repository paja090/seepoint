import 'server-only';
import { platformPrisma } from './db';
import { enterTenantContext } from './tenant-context';
import { getDeterministicOfferToken, hashPublicOfferToken, isPlausiblePublicOfferToken, encryptPortalToken } from '@/lib/offers/token';


export async function enterPublicOfferTenant(tokenOrHash: string) {
  if (!tokenOrHash || typeof tokenOrHash !== 'string') return null;
  const clean = tokenOrHash.trim();
  if (!isPlausiblePublicOfferToken(clean)) return null;
  const sha = hashPublicOfferToken(clean);

  let owner = await platformPrisma.offer.findFirst({
    where: {
      publicTokenHash: sha,
      publicTokenRevokedAt: null,
    },
    select: { id: true, organizationId: true, publishedAt: true, archivedAt: true },
  });

  if (!owner) {
    const candidates = await platformPrisma.offer.findMany({
      where: { publicTokenRevokedAt: null },
      select: { id: true, organizationId: true, publishedAt: true, archivedAt: true },
    });
    const matched = candidates.find((c) => getDeterministicOfferToken(c.id) === clean);
    if (matched) {
      let encrypted: string | null = null;
      try {
        encrypted = encryptPortalToken(clean, matched.id);
      } catch {
        encrypted = null;
      }
      const now = matched.publishedAt || new Date();
      await platformPrisma.offer.update({
        where: { id: matched.id },
        data: {
          publicTokenHash: sha,
          ...(encrypted ? { publicTokenEncrypted: encrypted } : {}),
          publishedAt: now,
        },
      }).catch(() => {});
      owner = { ...matched, publishedAt: now };
    }
  } else if (!owner.publishedAt) {
    const now = new Date();
    await platformPrisma.offer.update({
      where: { id: owner.id },
      data: { publishedAt: now },
    }).catch(() => {});
    owner = { ...owner, publishedAt: now };
  }

  if (!owner) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}

export async function enterPublicNavigationReportTenant(publicTokenHash: string, rawToken?: string) {
  const clean = publicTokenHash.trim();
  if (!/^[a-f0-9]{64}$/i.test(clean)) return null;

  let owner = await platformPrisma.navigationDocumentationReport.findFirst({
    where: {
      publicTokenHash: clean,
      status: { in: ['PUBLISHED', 'SENT'] },
      publishedAt: { not: null },
      tokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, organizationId: true, publishedAt: true, status: true },
  });

  if (!owner) {
    const { getDeterministicReportToken } = await import('@/lib/navigation-documentation');
    const candidates = await platformPrisma.navigationDocumentationReport.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        organizationId: true,
        publishedAt: true,
        status: true,
        tokenExpiresAt: true,
        publicTokenHash: true,
      },
    });
    const matched = candidates.find((c) => {
      const det = getDeterministicReportToken(c.id);
      return det.hash === clean || det.token === rawToken || det.token === clean;
    });

    if (matched) {
      const now = matched.publishedAt || new Date();
      const expires = matched.tokenExpiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const det = getDeterministicReportToken(matched.id);
      await platformPrisma.navigationDocumentationReport
        .update({
          where: { id: matched.id },
          data: {
            publicTokenHash: det.hash,
            publishedAt: now,
            tokenExpiresAt: expires,
          },
        })
        .catch(() => {});
      owner = {
        id: matched.id,
        organizationId: matched.organizationId,
        publishedAt: now,
        status: matched.status,
      };
    }
  }

  if (!owner) return null;
  const organization = await platformPrisma.organization.findUnique({
    where: { id: owner.organizationId },
    select: { isActive: true },
  });
  if (!organization?.isActive) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}

export async function enterPublicCampaignAlbumTenant(slug: string) {
  const { verifyCampaignAlbumSlug } = await import('@/lib/election-removal/album-token');
  const campaignId = verifyCampaignAlbumSlug(slug);
  if (!campaignId) return null;

  const campaign = await platformPrisma.electionCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, organizationId: true, name: true, clientName: true, status: true },
  });

  if (!campaign) return null;

  const organization = await platformPrisma.organization.findUnique({
    where: { id: campaign.organizationId },
    select: { isActive: true },
  });

  if (!organization?.isActive) return null;

  enterTenantContext({ organizationId: campaign.organizationId, source: 'public-token' });
  return campaign;
}

export async function enterPublicSurfaceAlbumTenant(slug: string) {
  const { verifySurfaceAlbumSlug } = await import('@/lib/election-removal/album-token');
  const verified = verifySurfaceAlbumSlug(slug);
  if (!verified) return null;

  const organization = await platformPrisma.organization.findUnique({
    where: { id: verified.organizationId },
    select: { id: true, isActive: true },
  });

  if (!organization?.isActive) return null;

  enterTenantContext({ organizationId: organization.id, source: 'public-token' });
  return { organizationId: organization.id, clientName: verified.clientName };
}

