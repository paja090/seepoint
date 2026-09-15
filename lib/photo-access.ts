import 'server-only';
import { requireTenantContext } from './tenant-context';
import type { PlanningResult } from './field-planning/contracts';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';

type PhotoAccessUser = {
  id: string;
  role: string;
  employee?: { id: string } | null;
};

type PhotoAccessRecord = {
  id?: string;
  employeeId: string | null;
  type: string;
  workEntryId: string | null;
  workOrderItemId?: string | null;
  isPrivate: boolean;
  carrierId: string | null;
  surfaceId: string | null;
  siteNavigationPoints?: readonly unknown[];
};

const NAVIGATION_PHOTO_TYPES = new Set(['SURVEY', 'BEFORE_INSTALLATION', 'AFTER_INSTALLATION', 'INSTALLATION']);

export async function canReadPhoto(user: PhotoAccessUser, photo: PhotoAccessRecord) {
  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  if (photo.type === 'EXPENSE_RECEIPT' || photo.isPrivate) {
    if (isManagerOrAdmin) return true;
    if (!photo.workEntryId) return false;
    const entry = await prisma.workEntry.findUnique({
      where: { id: photo.workEntryId },
      select: { employee: { select: { id: true, userId: true } } },
    });
    return Boolean(entry && (entry.employee.userId === user.id || entry.employee.id === user.employee?.id));
  }

  if (photo.workOrderItemId) {
    if (isManagerOrAdmin) return true;
    const { organizationId } = requireTenantContext();
    const employee = await prisma.employee.findFirst({ where: { organizationId, userId: user.id, isActive: true }, select: { id: true } });
    if (!employee) return false;
    const plans = await prisma.fieldPlan.findMany({ where: { organizationId, status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } }, select: { planningSummary: true } });
    return plans.some(p => (p.planningSummary as unknown as PlanningResult).crews.some(c => c.employeeIds.includes(employee.id) && c.stops.some(s => s.workOrderItemId === photo.workOrderItemId)));
  }

  if (photo.employeeId) return user.employee?.id === photo.employeeId || canAccess(user.role, 'employees');

  if (photo.id?.startsWith('vehicle-')) return canAccess(user.role, 'vehicles');

  if (NAVIGATION_PHOTO_TYPES.has(photo.type) || photo.siteNavigationPoints?.length) {
    return canAccess(user.role, 'navigationProjects') || canAccess(user.role, 'offers');
  }

  if (photo.carrierId || photo.surfaceId || ['CARRIER', 'SURFACE', 'LOCATION', 'DAMAGE', 'CONTROL', 'CHECK', 'ARCHIVE', 'CAMPAIGN'].includes(photo.type)) {
    return canAccess(user.role, 'carriers') || canAccess(user.role, 'navigationProjects') || canAccess(user.role, 'team');
  }

  return isManagerOrAdmin;
}
