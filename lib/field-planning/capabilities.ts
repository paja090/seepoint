import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { isModuleEnabled } from '../organization-modules';
export async function navigationAvailable(db: Prisma.TransactionClient = prisma) {
  const organization = await db.organization.findUnique({ where: { id: requireTenantContext().organizationId }, select: { plan: true, enabledModules: true } });
  return isModuleEnabled(organization, 'navigation');
}
