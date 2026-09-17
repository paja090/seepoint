import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AuthenticatedPlannerActor } from './auth';
import { PlannerError, textInput } from './domain';
import { assertTaskReference } from './repository';

function blockData(value: Record<string, unknown>) {
  const startAt = new Date(String(value.startAt)), endAt = new Date(String(value.endAt));
  if (!Number.isFinite(+startAt) || !Number.isFinite(+endAt) || endAt <= startAt || +endAt - +startAt > 16 * 3600000) throw new PlannerError('Blok musí mít platný začátek a konec, nejvýše 16 hodin.');
  if (!['FOCUS', 'MEETING', 'PROJECT', 'OPERATIONS', 'DEVELOPMENT'].includes(String(value.category))) throw new PlannerError('Vyberte druh práce.');
  return { title: textInput(value.title), startAt, endAt, category: String(value.category) };
}
export async function createBlock(actor: AuthenticatedPlannerActor, value: Record<string, unknown>) {
  const data = blockData(value), requestKey = textInput(value.requestKey, 100);
  await assertTaskReference(actor, value.sourceKind, value.sourceId);
  return prisma.$transaction(async tx => {
    const existing = await tx.plannerBlock.findUnique({ where: { organizationId_userId_requestKey: { organizationId: actor.organizationId, userId: actor.id, requestKey } } });
    if (existing) {
      if (existing.title !== data.title || existing.category !== data.category || +existing.startAt !== +data.startAt || +existing.endAt !== +data.endAt || existing.sourceKind !== (value.sourceKind ?? null) || existing.sourceId !== (value.sourceId ?? null)) throw new PlannerError('Tento požadavek už byl použit.', 409);
      return existing;
    }
    const conflict = await tx.plannerBlock.count({ where: { organizationId: actor.organizationId, userId: actor.id, startAt: { lt: data.endAt }, endAt: { gt: data.startAt } } });
    if (conflict) throw new PlannerError('V tomto čase už máte pracovní blok.', 409);
    const block = await tx.plannerBlock.create({ data: { ...data, organizationId: actor.organizationId, userId: actor.id, requestKey, sourceKind: typeof value.sourceKind === 'string' ? value.sourceKind : null, sourceId: typeof value.sourceId === 'string' ? value.sourceId : null } });
    await tx.userAuditLog.create({ data: { organizationId: actor.organizationId, action: 'PLANNER_CHANGED', actorUserId: actor.id, targetUserId: actor.id, metadata: { event: 'BLOCK_CREATED', blockId: block.id, source: 'USER' } } });
    return block;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function changeBlock(actor: AuthenticatedPlannerActor, id: string, value: Record<string, unknown>, remove = false) {
  if (!Number.isInteger(value.version)) throw new PlannerError('Chybí verze bloku.');
  const data = remove ? null : blockData(value);
  return prisma.$transaction(async tx => {
    const existing = await tx.plannerBlock.findFirst({ where: { id, organizationId: actor.organizationId, userId: actor.id, version: value.version as number } });
    if (!existing) throw new PlannerError('Blok se změnil nebo není dostupný. Obnovte plán.', 409);
    if (data && await tx.plannerBlock.count({ where: { organizationId: actor.organizationId, userId: actor.id, id: { not: id }, startAt: { lt: data.endAt }, endAt: { gt: data.startAt } } })) throw new PlannerError('V tomto čase už máte pracovní blok.', 409);
    if (remove) await tx.plannerBlock.delete({ where: { id, organizationId: actor.organizationId, userId: actor.id } });
    else await tx.plannerBlock.update({ where: { id, organizationId: actor.organizationId, userId: actor.id }, data: { ...data!, version: { increment: 1 } } });
    await tx.userAuditLog.create({ data: { organizationId: actor.organizationId, action: 'PLANNER_CHANGED', actorUserId: actor.id, targetUserId: actor.id, metadata: { event: remove ? 'BLOCK_DELETED' : 'BLOCK_MOVED', blockId: id } } });
    return { ok: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
