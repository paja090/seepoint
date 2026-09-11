import { TenantContextError } from './tenant-context';

// Fail closed on historical foreign-key corruption in a fully loaded public graph.
// Global identities have no organizationId and are checked through their membership guards.
export function assertTenantResult(value: unknown, organizationId: string): void {
  if (!value || typeof value !== 'object' || value instanceof Date) return;
  if (Array.isArray(value)) { for (const item of value) assertTenantResult(item, organizationId); return; }
  const record = value as Record<string, unknown>;
  if ('organizationId' in record && record.organizationId !== organizationId) throw new TenantContextError('Related record belongs to another organization.');
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object' && (Array.isArray(nested) || Object.getPrototypeOf(nested) === Object.prototype)) assertTenantResult(nested, organizationId);
  }
}
