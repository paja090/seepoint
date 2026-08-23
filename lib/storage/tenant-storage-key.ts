export type TenantStorageResource = 'photos' | 'documents' | 'logos' | 'imports' | 'exports';
export type TenantStorageVariant = 'original' | 'web' | 'thumbnail';

function safeSegment(value: string, label: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 160);
  if (!normalized || normalized === '.' || normalized === '..') throw new Error(`Invalid ${label}`);
  return normalized;
}

export function tenantStorageKey(input: {
  organizationId: string;
  resource: TenantStorageResource;
  resourceId: string;
  variant?: TenantStorageVariant;
  fileName: string;
}) {
  const organizationId = safeSegment(input.organizationId, 'organization id');
  const resourceId = safeSegment(input.resourceId, 'resource id');
  const variant = input.variant ?? 'original';
  const fileName = safeSegment(input.fileName, 'file name');
  return `organizations/${organizationId}/${input.resource}/${resourceId}/${variant}/${fileName}`;
}
