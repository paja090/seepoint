import { Prisma, type PrintProductionStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import { assertPrintProductionTransition, validatePrintJob } from './production-policy';

export type ProductionActor = { id?: string; email?: string; name?: string };
export async function auditProduction(tx: Prisma.TransactionClient, id: string, actor: ProductionActor, previousStatus: string | null, nextStatus: string, note?: string) {
  await tx.crmAuditLog.create({ data: {
    organizationId: requireTenantContext().organizationId, userId: actor.id ?? null, userEmail: actor.email ?? '',
    entityType: 'PrintProductionJob', entityId: id, action: previousStatus ? 'PRINT_STATUS_CHANGED' : 'PRINT_CREATED',
    detailsJson: JSON.stringify({ printProductionJobId: id, actorName: actor.name, previousStatus, nextStatus, note, timestamp: new Date().toISOString() }),
  } });
}
export async function createProductionJob(raw: unknown, actor: ProductionActor, db = prisma) {
  const data = validatePrintJob(raw);
  const { organizationId } = requireTenantContext();
  return db.$transaction(async tx => {
    const offer = data.offerId ? await tx.offer.findUnique({ where: { id: data.offerId, organizationId }, select: { id: true, clientId: true } }) : null;
    if (data.offerId && !offer) throw new Error('Nabídka nebyla nalezena.');
    const clientId = data.clientId ?? offer?.clientId;
    if (offer && clientId !== offer.clientId) throw new Error('Klient neodpovídá nabídce.');
    if (clientId && !await tx.client.findUnique({ where: { id: clientId, organizationId }, select: { id: true } })) throw new Error('Klient nebyl nalezen.');
    const job = await tx.printProductionJob.create({ data: { ...data, clientId, organizationId } });
    await auditProduction(tx, job.id, actor, null, job.status);
    return job;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function transitionProductionJob(tx: Prisma.TransactionClient, id: string, status: PrintProductionStatus, actor: ProductionActor,
  approval?: { offerId: string; name: string; note?: string; artworkUrl?: string }) {
  const { organizationId } = requireTenantContext();
  const job = await tx.printProductionJob.findUnique({ where: { id, organizationId } });
  if (!job || (approval && job.offerId !== approval.offerId)) throw new Error('Tisková zakázka nebyla nalezena.');
  if (approval && (job.status !== 'CLIENT_APPROVAL' || job.clientApprovedAt)) throw new Error('Schválení již není možné.');
  assertPrintProductionTransition(job.status, status);
  const changed = await tx.printProductionJob.updateMany({ where: { id, organizationId, status: job.status, ...(approval ? { clientApprovedAt: null } : {}) }, data: {
    status, ...(status === 'DELIVERED_TO_WAREHOUSE' ? { deliveredAt: new Date() } : {}),
    ...(approval ? { clientApprovedAt: new Date(), clientApprovedBy: approval.name, clientApprovalNote: approval.note ?? null, artworkUrl: approval.artworkUrl ?? job.artworkUrl } : {}),
  } });
  if (changed.count !== 1) throw new Error('Stav se mezitím změnil. Načtěte stránku znovu.');
  if (status === 'DELIVERED_TO_WAREHOUSE' && job.offerId) {
    const pending = await tx.printProductionJob.count({ where: { offerId: job.offerId, organizationId, status: { not: 'DELIVERED_TO_WAREHOUSE' } } });
    if (!pending) {
      const order = await tx.crmOrder.findFirst({ where: { offerId: job.offerId, organizationId }, select: { id: true } });
      if (order) await tx.crmRealization.updateMany({ where: { crmOrderId: order.id, organizationId, status: 'WAITING_FOR_PRODUCTION' }, data: { status: 'PRODUCED' } });
    }
  }
  await auditProduction(tx, id, actor, job.status, status, approval?.note);
  return { id, status };
}
