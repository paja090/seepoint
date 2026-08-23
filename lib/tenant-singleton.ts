import { requireTenantContext } from './tenant-context';

export function tenantSingletonId(name: string) {
  const { organizationId } = requireTenantContext();
  return `${name}:${organizationId}`;
}
