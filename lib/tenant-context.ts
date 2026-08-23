import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  organizationId: string;
  userId?: string;
  source?: 'session' | 'public-token' | 'platform-support' | 'script' | 'test';
};

export class TenantContextError extends Error {
  constructor(message = 'Tenant context is required for this database operation.') {
    super(message);
    this.name = 'TenantContextError';
  }
}

const globalForTenant = globalThis as typeof globalThis & {
  __seepointTenantStorage?: AsyncLocalStorage<TenantContext>;
};

const storage = globalForTenant.__seepointTenantStorage ?? new AsyncLocalStorage<TenantContext>();
if (process.env.NODE_ENV !== 'production') globalForTenant.__seepointTenantStorage = storage;

export function getTenantContext() {
  return storage.getStore() ?? null;
}

export function requireTenantContext() {
  const context = getTenantContext();
  if (!context) throw new TenantContextError();
  return context;
}

export function enterTenantContext(context: TenantContext) {
  storage.enterWith(context);
  return context;
}

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function assertOrganizationId(value: unknown, expected: string) {
  if (value !== undefined && value !== null && value !== expected) {
    throw new TenantContextError('A request attempted to override the active organization.');
  }
}

