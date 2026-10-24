import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { hash, plannerTransaction, requirePlannerManager, type PlannerActor } from '../field-planning/service';
import { parseTaskSpec, type TaskSpec } from '../election-removal/task-spec';
import { saveFieldTaskTx } from '../election-removal/tasks';

export async function createDispatchWork(raw: unknown, actor: PlannerActor, db = prisma) {
  requirePlannerManager(actor);
  const { organizationId } = requireTenantContext();
  if (!raw || typeof raw !== 'object') throw new Error('Chybí zadání práce.');
  const body = raw as Record<string, unknown>;
  if (typeof body.requestKey !== 'string' || !/^[\w-]{8,100}$/.test(body.requestKey)) {
    throw new Error('Chybí klíč požadavku. Obnovte formulář.');
  }
  if (body.clientName != null && (typeof body.clientName !== 'string' || body.clientName.length > 200)) {
    throw new Error('Neplatný název klienta.');
  }
  const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';

  const rawTasks: unknown[] = Array.isArray(body.tasks) && body.tasks.length > 0
    ? body.tasks
    : body.task
    ? [body.task]
    : [];
  if (rawTasks.length === 0) throw new Error('Chybí zadání práce.');

  const specs: TaskSpec[] = rawTasks.map(parseTaskSpec);

  const dateStr = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date.trim()) ? body.date.trim() : null;
  const targetDate = dateStr ? new Date(`${dateStr}T12:00:00Z`) : null;
  const employeeId = typeof body.employeeId === 'string' && body.employeeId.trim() ? body.employeeId.trim() : null;
  const vehicleId = typeof body.vehicleId === 'string' && body.vehicleId.trim() ? body.vehicleId.trim() : null;

  // Single-task backwards-compatible hash payload if legacy payload
  const requestHash = hash(
    body.task && !Array.isArray(body.tasks) && !dateStr && !employeeId && !vehicleId
      ? { spec: JSON.parse(JSON.stringify(specs[0])), clientName }
      : { specs: JSON.parse(JSON.stringify(specs)), clientName, date: dateStr, employeeId, vehicleId }
  );
  const requestId = 'dispatch-' + hash([organizationId, body.requestKey]).slice(0, 32);

  return plannerTransaction(async (tx) => {
    const existing = await tx.crmAuditLog.findFirst({
      where: { id: requestId, organizationId, action: 'DISPATCH_WORK_CREATED' },
      select: { detailsJson: true },
    });
    if (existing) {
      const saved = JSON.parse(existing.detailsJson ?? '{}') as {
        requestHash?: string;
        campaignId: string;
        pointId: string;
        pointIds?: string[];
      };
      if (saved.requestHash !== requestHash) {
        throw new Error('Požadavek už byl uložen s jiným zadáním. Obnovte formulář.');
      }
      return {
        campaignId: saved.campaignId,
        pointId: saved.pointId,
        pointIds: saved.pointIds ?? [saved.pointId],
      };
    }

    // Reuse open intake campaign for the same client (and target date if set)
    let campaign = await tx.electionCampaign.findFirst({
      where: {
        organizationId,
        clientName: clientName || null,
        targetDate: targetDate,
        status: { notIn: ['COMPLETED', 'ARCHIVED', 'CANCELLED'] },
        mediaDefaults: { path: ['dispatchIntake'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!campaign) {
      const name = clientName
        ? `Práce pro ${clientName}${dateStr ? ` (${dateStr})` : ''}`
        : `Průběžná terénní práce${dateStr ? ` (${dateStr})` : ''}`;

      campaign = await tx.electionCampaign.create({
        data: {
          organizationId,
          name,
          clientName: clientName || null,
          targetDate: targetDate,
          status: 'DRAFT',
          totalPoints: 0,
          completedPoints: 0,
          mediaDefaults: {
            dispatchIntake: true,
            preferredEmployeeId: employeeId,
            preferredVehicleId: vehicleId,
          },
        },
        select: { id: true },
      });
    }

    const createdPointIds: string[] = [];
    for (const spec of specs) {
      const taskPayload = {
        ...spec,
        ...(targetDate ? { deadlineAt: targetDate } : {}),
      };
      const point = await saveFieldTaskTx(tx, campaign.id, taskPayload, actor);
      createdPointIds.push(point.id);
    }

    await tx.crmAuditLog.create({
      data: {
        id: requestId,
        organizationId,
        userId: actor.id,
        userEmail: actor.email,
        entityType: 'ElectionRemovalPoint',
        entityId: createdPointIds[0],
        action: 'DISPATCH_WORK_CREATED',
        detailsJson: JSON.stringify({
          requestHash,
          campaignId: campaign.id,
          pointId: createdPointIds[0],
          pointIds: createdPointIds,
          employeeId,
          vehicleId,
          date: dateStr,
        }),
      },
    });

    return {
      campaignId: campaign.id,
      pointId: createdPointIds[0],
      pointIds: createdPointIds,
    };
  }, db);
}
