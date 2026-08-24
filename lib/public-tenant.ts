import 'server-only';
import { platformPrisma } from './db';
import { enterTenantContext } from './tenant-context';
import { hashPublicOfferToken } from '@/lib/offers/token';

export async function enterPublicOfferTenant(tokenOrHash: string) {
  if (!tokenOrHash || typeof tokenOrHash !== 'string') return null;
  const clean = tokenOrHash.trim();
  const sha = hashPublicOfferToken(clean);

  const owner = await platformPrisma.offer.findFirst({
    where: {
      OR: [
        { publicTokenHash: clean },
        { publicTokenHash: sha },
        { id: clean },
        { publicTokenHash: { startsWith: clean } },
      ],
    },
    select: { id: true, organizationId: true, publishedAt: true, archivedAt: true },
  });
  if (!owner || owner.archivedAt) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}

export async function enterPublicNavigationReportTenant(publicTokenHash: string) {
  const clean = publicTokenHash.trim();
  const owner = await platformPrisma.navigationDocumentationReport.findFirst({
    where: {
      OR: [
        { publicTokenHash: clean },
        { id: clean },
      ],
    },
    select: { id: true, organizationId: true },
  });
  if (!owner) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}
