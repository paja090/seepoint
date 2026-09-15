import type { NavigationPoint } from '@prisma/client';
import type { PlanningJob } from './contracts';
import { navigationJobId } from './contracts';
import { coordinates } from './profile';

/** Navigation uses the order's installation readiness; PLANNED points are canonical before mounting. */
export function navigationPointJobs(base: PlanningJob, order: { id: string; status: string; installerUserId?: string | null; points: NavigationPoint[] },
  employees: Array<{ id: string; userId: string | null }>, durations: Record<string, number> = {}): PlanningJob[] {
  return order.points.filter(p => p.isSelectedByClient).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map(point => {
    if (point.organizationId !== base.organizationId || point.navigationOrderId !== order.id) throw new Error('Cross-tenant NavigationPoint rejected.');
    const requiredEmployeeIds = [...(base.constraints.requiredEmployeeIds ?? [])];
    let blockedReason = base.blockedReason;
    const installerUserId = point.installerUserId ?? order.installerUserId;
    if (installerUserId) {
      const installer = employees.find(e => e.userId === installerUserId);
      if (!installer) blockedReason = 'Navigation instalátor nemá Employee profil.';
      else requiredEmployeeIds.push(installer.id);
    }
    if (!['PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'].includes(order.status)
      || ['APPROVAL_REQUIRED', 'TECHNICAL_CHECK', 'REMOVED'].includes(point.status)) blockedReason = 'Bod není připraven k instalaci.';
    if (point.issueReported) blockedReason = 'Bod má nevyřešený provozní problém.';
    if (!coordinates(point)) blockedReason = 'Chybí GPS.';
    return { ...base, id: navigationJobId(point.id), sourceType: 'NAVIGATION_POINT', sourceId: point.id,
      parentWorkOrderId: base.id || undefined, navigationOrderId: order.id, navigationPointId: point.id,
      title: point.label, address: point.address, workType: 'NAVIGATION_INSTALLATION',
      status: ['DONE', 'CANCELLED'].includes(base.status) ? base.status : point.status === 'INSTALLED' ? 'DONE' : point.status === 'CANCELLED' ? 'CANCELLED' : 'PLANNED',
      location: coordinates(point) ? { latitude: point.latitude, longitude: point.longitude } : null,
      serviceMinutes: durations[point.id] ?? null,
      constraints: { ...base.constraints, requiredEmployeeIds: [...new Set(requiredEmployeeIds)] },
      blockedReason, updatedAt: `${base.updatedAt}/${point.updatedAt.toISOString()}` };
  });
}
