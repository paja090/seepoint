import 'server-only';
import { platformPrisma } from './db';
import { enterTenantContext } from './tenant-context';
import { getDeterministicOfferToken, hashPublicOfferToken, isPlausiblePublicOfferToken, encryptPortalToken } from '@/lib/offers/token';
import { getDeterministicReportToken } from '@/lib/navigation-documentation';

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
  const clean = publicTokenHash.trim();
  let owner = await platformPrisma.navigationDocumentationReport.findFirst({
    where: {
      OR: [
        { publicTokenHash: clean },
        { id: clean },
      ],
    },
    select: { id: true, organizationId: true },
  });

  if (!owner) {
    const candidates = await platformPrisma.navigationDocumentationReport.findMany({
      where: { status: { not: 'ARCHIVED' } },
      select: { id: true, organizationId: true, status: true, publishedAt: true },
    });
    const matched = candidates.find((c) => getDeterministicReportToken(c.id).hash === clean);
    if (matched) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      await platformPrisma.navigationDocumentationReport.update({
        where: { id: matched.id },
        data: {
          publicTokenHash: clean,
          status: matched.status === 'DRAFT' || matched.status === 'REVIEW' ? 'PUBLISHED' : matched.status,
          publishedAt: matched.publishedAt || now,
          tokenExpiresAt: expiresAt,
        },
      }).catch(() => {});
      owner = { id: matched.id, organizationId: matched.organizationId };
    }
  }

  if (!owner) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}

