import 'server-only';
import { platformPrisma } from './db';
import { enterTenantContext } from './tenant-context';

export async function enterPublicOfferTenant(tokenOrHash: string) {
  const owner = await platformPrisma.offer.findFirst({
    where: {
      OR: [
        { publicTokenHash: tokenOrHash },
        { id: tokenOrHash },
      ],
    },
    select: { id: true, organizationId: true, publishedAt: true, archivedAt: true },
  });
  if (!owner || owner.archivedAt) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}

export async function enterPublicNavigationReportTenant(publicTokenHash: string) {
  const owner = await platformPrisma.navigationDocumentationReport.findUnique({
    where: { publicTokenHash },
    select: { id: true, organizationId: true },
  });
  if (!owner) return null;
  enterTenantContext({ organizationId: owner.organizationId, source: 'public-token' });
  return owner;
}
