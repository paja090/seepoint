import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { requireTenantContext } from './tenant-context';

export class PhotoDeleteError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
// Never group unrelated field photos together merely because both carrier IDs are null.
export function photoSiblingScope(photo: { id: string; carrierId: string | null; surfaceId: string | null; employeeId: string | null; electionRemovalPointId: string | null; fieldWorkStepId: string | null; workOrderItemId: string | null }, organizationId: string): Prisma.PhotoWhereInput {
  const base = { organizationId, id: { not: photo.id } };
  if (photo.fieldWorkStepId) return { ...base, fieldWorkStepId: photo.fieldWorkStepId };
  if (photo.electionRemovalPointId) return { ...base, electionRemovalPointId: photo.electionRemovalPointId };
  if (photo.workOrderItemId) return { ...base, workOrderItemId: photo.workOrderItemId };
  if (photo.employeeId) return { ...base, employeeId: photo.employeeId };
  if (photo.surfaceId || photo.carrierId) return { ...base, carrierId: photo.carrierId, surfaceId: photo.surfaceId };
  return { organizationId, id: { in: [] } };
}
export async function deletePhotoRecord(id: string, actor: { id: string; role: string; email: string }, db = prisma) {
  const { organizationId } = requireTenantContext();
  return db.$transaction(async tx => {
    const photo = await tx.photo.findUnique({ where: { id, organizationId }, select: { id:true, organizationId:true, driveFileId:true, storageProvider:true, employeeId:true, carrierId:true, surfaceId:true, isPrimary:true, sortOrder:true, capturedByWorkerUserId:true, workOrderItemId:true, electionRemovalPointId:true, fieldWorkStepId:true } });
    if (!photo) throw new PhotoDeleteError('Fotografie nebyla nalezena.',404);
    if (photo.workOrderItemId && actor.role !== 'ADMIN') throw new PhotoDeleteError('Fotografie je dokladem realizace pracovní položky a její historii může odstranit pouze administrátor.',409);
    if (photo.employeeId && actor.role !== 'ADMIN') throw new PhotoDeleteError('Fotografii zaměstnance může odstranit pouze administrátor.',403);
    if (!['ADMIN','MANAGER'].includes(actor.role) && photo.capturedByWorkerUserId !== actor.id) throw new PhotoDeleteError('Tuto fotografii nemáte oprávnění odstranit.',403);
    const siblings = photoSiblingScope(photo, organizationId);
    await tx.photo.delete({ where: { id, organizationId }, select:{id:true} });
    if (photo.isPrimary) {
      const next = await tx.photo.findFirst({ where: siblings, orderBy: [{sortOrder:'asc'},{id:'asc'}], select: {id:true} });
      if (next) await tx.photo.update({ where: {id:next.id,organizationId}, data:{isPrimary:true},select:{id:true} });
    }
    await tx.photo.updateMany({ where: {...siblings,sortOrder:{gt:photo.sortOrder}}, data:{sortOrder:{decrement:1}} });
    await tx.crmAuditLog.create({ data: {organizationId,entityType:'Photo',entityId:id,userId:actor.id,userEmail:actor.email,action:'PHOTO_DELETED',detailsJson:JSON.stringify({electionRemovalPointId:photo.electionRemovalPointId,fieldWorkStepId:photo.fieldWorkStepId,workOrderItemId:photo.workOrderItemId})} });
    return photo;
  }, {timeout:15000});
}
