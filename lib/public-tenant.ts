import 'server-only';
import { platformPrisma } from './db';
import { enterTenantContext } from './tenant-context';
import { getDeterministicOfferToken, hashPublicOfferToken, isPlausiblePublicOfferToken, encryptPortalToken } from '@/lib/offers/token';
import { hashToken, getDeterministicReportToken } from '@/lib/navigation-documentation';

function getNavdocCandidateSecrets(): string[] {
  const list = [
    process.env.NEXTAUTH_SECRET,
    process.env.AUTH_SECRET,
    process.env.CRON_SECRET,
    'seepoint-navdoc-token-salt-2026',
  ].filter(Boolean) as string[];
  return Array.from(new Set(list));
}


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

export async function enterPublicNavigationReportTenant(publicTokenHash: string) {
  if (!publicTokenHash || typeof publicTokenHash !== 'string') return null;
  const clean = publicTokenHash.trim();
  if (!/^[a-f0-9]{64}$/i.test(clean)) return null;

  let owner = await platformPrisma.navigationDocumentationReport.findFirst({
    where: {
      AND: [
        {
          OR: [
            { publicTokenHash: clean },
            { publicTokenHash: hashToken(clean) },
          ],
        },
        {
          status: { in: ['PUBLISHED', 'SENT'] },
        },
        {
          publishedAt: { not: null },
        },
        {
          OR: [
            { tokenExpiresAt: null },
            { tokenExpiresAt: { gt: new Date() } },
          ],
        },
      ],
    },
    select: { id: true, organizationId: true },
  });

  if (!owner) {
    const candidates = await platformPrisma.navigationDocumentationReport.findMany({
      where: {
        status: { not: 'ARCHIVED' },
        OR: [
          { tokenExpiresAt: null },
          { tokenExpiresAt: { gt: new Date() } },
        ],
      },
      select: { id: true, organizationId: true, publicTokenHash: true, publishedAt: true, status: true },
    });
    const secrets = getNavdocCandidateSecrets();
    const matched = candidates.find((c) => {
      for (const secret of secrets) {
        const { token: detToken, hash: detHash } = getDeterministicReportToken(c.id, secret);
        if (clean === detToken || clean === detHash || hashToken(clean) === detHash) {
          return true;
        }
      }
      return false;
    });

    if (matched) {
      const { hash: detHash } = getDeterministicReportToken(matched.id);
      const now = matched.publishedAt || new Date();
      await platformPrisma.navigationDocumentationReport.update({
        where: { id: matched.id },
        data: {
          publicTokenHash: detHash,
          publishedAt: now,
          ...(matched.status === 'DRAFT' ? { status: 'PUBLISHED' } : {}),
        },
      }).catch(() => {});
      owner = { id: matched.id, organizationId: matched.organizationId };
    }
  }

  if (!owner) return null;
  const organization = await platformPrisma.organization.findUnique({
    where: { id: owner.organizationId },
    select: { isActive: true },
  });
  if (organization && organization.isActive === false) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}

export async function enterPublicCampaignAlbumTenant(slug: string) {
  if (!slug || typeof slug !== 'string') return null;
  const clean = slug.trim();
  const { verifyCampaignAlbumSlug } = await import('@/lib/election-removal/album-token');
  const campaignId =
    verifyCampaignAlbumSlug(clean) ||
    (clean.includes('.') ? clean.split('.')[0] : clean);
  if (!campaignId || !/^[a-z0-9_-]{10,60}$/i.test(campaignId)) return null;

  const campaign = await platformPrisma.electionCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, organizationId: true, name: true, clientName: true, status: true },
  });

  if (!campaign) return null;

  const organization = await platformPrisma.organization.findUnique({
    where: { id: campaign.organizationId },
    select: { isActive: true },
  });

  if (organization && organization.isActive === false) return null;

  enterTenantContext({ organizationId: campaign.organizationId, source: 'public-token' });
  return campaign;
}

export async function enterPublicSurfaceAlbumTenant(slug: string) {
  if (!slug || typeof slug !== 'string') return null;
  const clean = slug.trim();
  const { verifySurfaceAlbumSlug } = await import('@/lib/election-removal/album-token');
  const verified = verifySurfaceAlbumSlug(clean);
  if (!verified) return null;

  const organization = await platformPrisma.organization.findUnique({
    where: { id: verified.organizationId },
    select: { id: true, isActive: true },
  });

  if (!organization || organization.isActive === false) return null;

  enterTenantContext({ organizationId: organization.id, source: 'public-token' });
  return { organizationId: organization.id, clientName: verified.clientName };
}

