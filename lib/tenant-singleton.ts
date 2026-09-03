import { requireTenantContext } from './tenant-context';

export function tenantSingletonId(name: string, verifiedOrganizationId?: string) {
  const organizationId = verifiedOrganizationId || requireTenantContext().organizationId;
  return `${name}:${organizationId}`;
}
