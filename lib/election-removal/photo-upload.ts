import type { PlannerActor } from '../field-planning/service';
import { hash, plannerTransaction } from '../field-planning/service';
import { executeStop } from '../field-planning/execution';
import { executeFieldStep } from './step-execution';
import { requireTenantContext } from '../tenant-context';
import { safePhotoFileName, validatePhotoFile } from '../photo-validation';
import { storeTenantPhoto } from '../storage/photo-storage';
import type { PlanningResult } from '../field-planning/contracts';
import { prisma } from '../db';
import { createHash } from 'node:crypto';

export async function uploadFieldPhoto(form: FormData, actor: PlannerActor) {
  const { organizationId } = requireTenantContext();
  const input = { planId: String(form.get('planId') || ''), jobId: String(form.get('jobId') || ''), workOrderId: '', action: 'inspect' };
  const verified = await executeStop(input, actor);
  if (!('fieldWorkStepId' in verified) || !verified.fieldWorkStepId) throw new Error('Krok nebyl nalezen.');
  const requestKey = String(form.get('requestKey') || '');
  if (!/^[\w-]{8,100}$/.test(requestKey)) throw new Error('Chybí klíč nahrávání.');
  const validated = await validatePhotoFile(form.get('file'));
  if (!validated) throw new Error('Vyberte fotografii.');
  const file = validated.file;
  const photoId = 'field-photo-' + hash([organizationId, verified.fieldWorkStepId, requestKey]).slice(0, 32);
  const checksum = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
  const prior = await prisma.photo.findUnique({ where: { id: photoId, organizationId } });
  if (prior) {
    if (prior.contentChecksum !== checksum) throw new Error('Klíč nahrávání patří jiné fotografii.');
    return { ok: true, photo: { id: prior.id } };
  }
  const fileName = safePhotoFileName(file.name, 'teren.jpg');
  const stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
  return plannerTransaction(async tx => {
    const plan = await tx.fieldPlan.findFirst({ where: { id: input.planId, organizationId, status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } } });
    const employee = await tx.employee.findFirst({ where: { organizationId, userId: actor.id, isActive: true } });
    const crew = (plan?.planningSummary as unknown as PlanningResult | undefined)?.crews.find(c => employee && c.employeeIds.includes(employee.id) && c.stops.some(s => s.jobId === input.jobId));
    const stop = crew?.stops.find(s => s.jobId === input.jobId);
    if (!plan || !crew || !stop) throw new Error('FORBIDDEN: přiřazení se změnilo.');
    await executeFieldStep(tx, stop, plan.id, crew.id, input, actor);
    const existing = await tx.photo.findUnique({ where: { id: photoId, organizationId } });
    if (existing) {
      if (existing.contentChecksum !== stored.contentChecksum) throw new Error('Klíč nahrávání patří jiné fotografii.');
      return { ok: true, photo: { id: existing.id } };
    }
    const photo = await tx.photo.create({ data: { id: photoId, organizationId,
      electionRemovalPointId: verified.electionRemovalPointId, fieldWorkStepId: verified.fieldWorkStepId,
      type: verified.photoType ?? 'CONTROL', url: `/api/photos/${photoId}/file`, fileName, mimeType: file.type, size: file.size,
      capturedByWorkerUserId: actor.id, capturedByWorkerName: actor.email, storageProvider: stored.storageProvider,
      storageKey: stored.storageKey, driveFileId: stored.driveFileId, contentChecksum: stored.contentChecksum,
      content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : null } });
    await tx.crmAuditLog.create({ data: { id: 'audit-' + photoId, organizationId, entityType: 'FieldWorkStep', entityId: String(verified.fieldWorkStepId), userId: actor.id, userEmail: actor.email, action: 'FIELD_STEP_PHOTO_UPLOADED', detailsJson: JSON.stringify({ photoId, planId: plan.id, crewId: crew.id, type: photo.type }) } });
    return { ok: true, photo: { id: photo.id } };
  });
}
