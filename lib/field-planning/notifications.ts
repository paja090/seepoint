import { prisma } from '../db';
import type { NotificationProvider, SystemNotificationItem } from '../notifications-service';
import type { PlanningResult, PlanningInput } from './contracts';
export const fieldPlanningNotifications: NotificationProvider = {
  name: 'field-planning',
  shouldRun: ctx => ctx.enabled('workRoute'),
  async getNotifications(ctx) {
    const manager = ['ADMIN', 'MANAGER'].includes(ctx.userRole);
    const employee = !manager && ctx.userId ? await prisma.employee.findFirst({ where: { organizationId: ctx.organizationId, userId: ctx.userId, isActive: true }, select: { id: true } }) : null;
    if (!manager && !employee) return [];
    const plans = await prisma.fieldPlan.findMany({ where: { organizationId: ctx.organizationId, status: { in: manager ? ['DRAFT', 'APPROVED', 'ACTIVE'] : ['APPROVED', 'ACTIVE'] }, generatedAt: { gte: new Date(ctx.now.getTime() - 7 * 86400000) } }, orderBy: { version: 'desc' }, take: 30 });
    const items: SystemNotificationItem[] = [];
    const days = new Set<string>();
    for (const plan of plans) {
      if (days.has(plan.date)) continue;
      const result = plan.planningSummary as unknown as PlanningResult;
      if (!ctx.enabled('navigation') && (plan.planningInputSnapshot as unknown as PlanningInput).jobs.some(j => j.navigationPointId)) continue;
      if (manager) {
        days.add(plan.date);
        for (const alert of [...result.conflicts, ...result.unassigned]) items.push({ id: `field-${plan.id}-${alert.code}-${alert.workOrderId ?? alert.crewId ?? ''}`, type: 'FIELD_PLAN_CONFLICT', title: 'Plán práce vyžaduje kontrolu', message: alert.message, severity: 'HIGH', link: '/work/route', createdAt: plan.createdAt.toISOString() });
      } else {
        const crew = result.crews.find(c => c.employeeIds.includes(employee!.id));
        if (crew) { days.add(plan.date); items.push({ id: `field-${plan.id}-${employee!.id}`, type: 'FIELD_PLAN_ASSIGNED', title: 'Máte schválenou trasu', message: `Na ${plan.date} máte naplánováno ${crew.stops.length} úkolů.`, severity: 'MEDIUM', link: '/my-route', createdAt: (plan.approvedAt ?? plan.createdAt).toISOString() }); }
      }
    }
    if (manager) {
      const problems = await prisma.crmAuditLog.findMany({ where: { organizationId: ctx.organizationId, action: { in: ['FIELD_EXECUTION_BLOCKED', 'FIELD_EXECUTION_RESOLVED'] }, createdAt: { gte: new Date(ctx.now.getTime() - 7 * 86400000) } }, orderBy: { createdAt: 'desc' }, take: 50 });
      const seen = new Set<string>();
      for (const p of problems) {
        if (seen.has(p.entityId)) continue; seen.add(p.entityId);
        if (p.action === 'FIELD_EXECUTION_RESOLVED') continue;
        if (p.entityType === 'NavigationPoint' && !ctx.enabled('navigation')) continue;
        if (p.entityType === 'WorkOrderItem') { const item = await prisma.workOrderItem.findFirst({ where: { organizationId: ctx.organizationId, id: p.entityId }, include: { crmRealization: true } }); if (!item || (!item.issueNote && !item.crmRealization?.claimNote)) continue; }
        if (p.entityType === 'NavigationPoint' && !await prisma.navigationPoint.count({ where: { organizationId: ctx.organizationId, id: p.entityId, issueReported: true } })) continue;
        const details = JSON.parse(p.detailsJson ?? '{}');
        items.push({ id: p.id, type: 'FIELD_EXECUTION_BLOCKED', title: 'Problém v terénu', message: JSON.parse(p.detailsJson ?? '{}').note ?? 'Pracovník nahlásil problém.', severity: 'HIGH', link: p.entityType === 'NavigationPoint' ? `/navigation/orders/${details.navigationOrderId}` : `/work/${p.entityType === 'WorkOrderItem' ? details.workOrderId : p.entityId}`, createdAt: p.createdAt.toISOString() });
      }
    }
    return items;
  },
};
