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

export async function enterPublicNavigationReportTenant(publicTokenHash: string) {
  const clean = publicTokenHash.trim();
  if (!/^[a-f0-9]{64}$/i.test(clean)) return null;
  const owner = await platformPrisma.navigationDocumentationReport.findFirst({
    where: {
      publicTokenHash: clean,
      status: { in: ['PUBLISHED', 'SENT'] },
      publishedAt: { not: null },
      tokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, organizationId: true },
  });
  if (!owner) return null;
  const organization = await platformPrisma.organization.findUnique({
    where: { id: owner.organizationId }, select: { isActive: true },
  });
  if (!organization?.isActive) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}
