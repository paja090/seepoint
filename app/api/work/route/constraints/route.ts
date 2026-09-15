import { navigationAvailable } from '@/lib/field-planning/capabilities';
import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { parseConstraints, parseProfile } from '@/lib/field-planning/profile';
import { auditPlan, json, plannerTransaction, requirePlannerManager } from '@/lib/field-planning/service';

export async function PATCH(request: Request) {
  const user = await requireApiAccess('work', 'workRoute'); if (isApiDenied(user)) return user;
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  try {
    requirePlannerManager(user); const { workOrderId, constraints, serviceMinutes, resolution, navigationPointId, workOrderItemId } = await request.json();
    if (typeof workOrderId !== 'string') throw new Error('Chybí zakázka.');
    if (typeof resolution === 'string') {
      if (resolution.trim().length < 3 || resolution.length > 1000) throw new Error('Doplňte popis vyřešení.');
      await plannerTransaction(async tx => {
        const order = await tx.workOrder.findUnique({ where: { id: workOrderId, organizationId: user.organizationId! }, include: { crmRealizations: true } });
        if (!order) throw new Error('Zakázka nebyla nalezena.');
        if (order.navigationOrderId || order.crmRealizations.length) throw new Error('Problém vyřešte v detailu související realizace nebo Navigation.');
        const last = await tx.crmAuditLog.findFirst({ where: { organizationId: user.organizationId!, entityType: 'WorkOrder', entityId: workOrderId, action: { in: ['FIELD_EXECUTION_BLOCKED', 'FIELD_EXECUTION_RESOLVED'] } }, orderBy: { createdAt: 'desc' } });
        if (last?.action !== 'FIELD_EXECUTION_BLOCKED') return;
        await tx.crmAuditLog.create({ data: { organizationId: user.organizationId!, entityType: 'WorkOrder', entityId: workOrderId, action: 'FIELD_EXECUTION_RESOLVED', userId: user.id, userEmail: user.email, detailsJson: JSON.stringify({ resolution: resolution.trim(), problemId: last.id }) } });
      });
      return NextResponse.json({ ok: true });
    }
    const parsed = parseConstraints(constraints);
    if (serviceMinutes !== null && (typeof serviceMinutes !== 'number' || !Number.isFinite(serviceMinutes) || serviceMinutes < 1 || serviceMinutes > 1440)) throw new Error('Neplatná délka práce.');
    const organizationId = user.organizationId!;
    await plannerTransaction(async tx => {
      if (workOrderItemId !== undefined) {
        const item = await tx.workOrderItem.findFirst({ where: { id: workOrderItemId, workOrderId, organizationId, workOrder: { organizationId, navigationOrderId: null, status: { notIn: ['DONE', 'CANCELLED'] } } } });
        if (!item) throw new Error('Cross-tenant WorkOrderItem rejected.');
        await tx.workOrderItem.update({ where: { id: item.id, organizationId }, data: { estimatedMinutes: serviceMinutes } });
        await auditPlan(tx, workOrderId, user, 'FIELD_ITEM_DURATION_UPDATED', { workOrderItemId, serviceMinutes }); return;
      }
      if (navigationPointId !== undefined) {
        if (!await navigationAvailable(tx)) throw new Error('FORBIDDEN: Navigation není aktivní.');
        if (typeof navigationPointId !== 'string') throw new Error('Neplatný bod.');
        const point = await tx.navigationPoint.findFirst({ where: { id: navigationPointId, organizationId, navigationOrder: { organizationId }, isSelectedByClient: true, status: { notIn: ['INSTALLED', 'CANCELLED'] } } });
        if (!point) throw new Error('Cross-tenant NavigationPoint rejected.');
        const row = await tx.organizationFieldPlanningProfile.findUniqueOrThrow({ where: { organizationId } });
        const profile = parseProfile(row.configuration); const durations = { ...profile.navigationPointMinutes };
        if (serviceMinutes === null) delete durations[navigationPointId]; else durations[navigationPointId] = serviceMinutes;
        await tx.organizationFieldPlanningProfile.update({ where: { organizationId }, data: { configuration: json({ ...profile, navigationPointMinutes: durations }) } });
        await tx.crmAuditLog.create({ data: { organizationId, entityType: 'NavigationPoint', entityId: point.id, userId: user.id, userEmail: user.email, action: 'FIELD_POINT_DURATION_UPDATED', detailsJson: JSON.stringify({ navigationPointId, serviceMinutes }) } }); return;
      }
      const order = await tx.workOrder.findUnique({ where: { id: workOrderId, organizationId } });
      if (!order || ['DONE', 'CANCELLED'].includes(order.status)) throw new Error('Zakázka není dostupná.');
      const workers = parsed.requiredEmployeeIds ?? []; const predecessors = parsed.predecessorIds ?? [];
      if (predecessors.includes(workOrderId)) throw new Error('Zakázka nemůže předcházet sama sobě.');
      if (await tx.employee.count({ where: { organizationId, id: { in: workers } } }) !== workers.length || await tx.workOrder.count({ where: { organizationId, id: { in: predecessors } } }) !== predecessors.length) throw new Error('Cross-tenant reference rejected.');
      await tx.workOrder.update({ where: { id: workOrderId, organizationId }, data: { planningConstraints: json(parsed), estimatedHours: serviceMinutes === null ? null : serviceMinutes / 60 } });
      await auditPlan(tx, workOrderId, user, 'FIELD_CONSTRAINTS_UPDATED', { constraints: parsed, serviceMinutes });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Změna selhala.' }, { status: e instanceof Error && e.message.startsWith('FORBIDDEN') ? 403 : 409 }); }
}
