import { canAccess, type AppRole } from '@/lib/rbac';

export function canInvoiceNavigationOrderRole(role: AppRole | string) {
  return canAccess(role, 'billing');
}
