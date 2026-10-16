import type { PhotoType } from '@prisma/client';
import type { PlannerActor } from '../field-planning/service';
import { hash, plannerTransaction } from '../field-planning/service';
import { executeStop } from '../field-planning/execution';
import { executeFieldStep } from './step-execution';
import { requireTenantContext } from '../tenant-context';
import { safePhotoFileName, validatePhotoFile } from '../photo-validation';
import { storeTenantPhoto } from '../storage/photo-storage';
import type { PlanningResult } from '../field-planning/contracts';
import { prisma } from '../db';
import { createHash, randomUUID } from 'node:crypto';

type VerifiedStopResult = {
  fieldWorkStepId?: string | null;
  electionRemovalPointId?: string | null;
  photoType?: PhotoType | null;
};

export async function uploadFieldPhoto(form: FormData, actor: PlannerActor) {
  const { organizationId } = requireTenantContext();
  const input = { planId: String(form.get('planId') || ''), jobId: String(form.get('jobId') || ''), workOrderId: '', action: 'inspect' };
  const verified = (await executeStop(input, actor)) as unknown as VerifiedStopResult;
  const targetStepId = verified.fieldWorkStepId || null;
  const targetPointId = verified.electionRemovalPointId || null;
  if (!targetStepId && !targetPointId) throw new Error('Krok ani bod nebyl nalezen.');

  const rawKey = String(form.get('requestKey') || form.get('key') || '');
  const requestKey = /^[\w-]{8,100}$/.test(rawKey) ? rawKey : randomUUID();
  const fileCandidate = form.get('file') ?? form.get('afterPhoto') ?? form.get('photo');
  const validated = await validatePhotoFile(fileCandidate);
  if (!validated) throw new Error('Vyberte fotografii.');
  const file = validated.file;

  const idSeed = targetStepId || targetPointId || 'generic';
  const photoId = 'field-photo-' + hash([organizationId, idSeed, requestKey]).slice(0, 32);
  const checksum = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
  const prior = await prisma.photo.findUnique({ where: { id: photoId, organizationId } });
  if (prior) {
    if (prior.contentChecksum !== checksum) throw new Error('Klíč nahrávání patří jiné fotografii.');
    return { ok: true, photo: { id: prior.id, url: prior.url } };
  }
  const fileName = safePhotoFileName(file.name, 'fotodokumentace.jpg');
  const stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
  return plannerTransaction(async tx => {
    const plan = await tx.fieldPlan.findFirst({ where: { id: input.planId, organizationId, status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } } });
    const employee = await tx.employee.findFirst({ where: { organizationId, userId: actor.id, isActive: true } });
    const crew = (plan?.planningSummary as unknown as PlanningResult | undefined)?.crews.find(c => employee && c.employeeIds.includes(employee.id) && c.stops.some(s => s.jobId === input.jobId));
    const stop = crew?.stops.find(s => s.jobId === input.jobId);
    if (!plan || !crew || !stop) throw new Error('FORBIDDEN: přiřazení se změnilo.');
    if (targetStepId) {
      await executeFieldStep(tx, stop, plan.id, crew.id, input, actor);
    }
    const existing = await tx.photo.findUnique({ where: { id: photoId, organizationId } });
    if (existing) {
      if (existing.contentChecksum !== stored.contentChecksum) throw new Error('Klíč nahrávání patří jiné fotografii.');
      return { ok: true, photo: { id: existing.id, url: existing.url } };
    }
    const resolvedPointId = targetPointId || stop.electionRemovalPointId;
    const pointMeta = resolvedPointId
      ? await tx.electionRemovalPoint.findFirst({ where: { id: resolvedPointId, organizationId }, select: { carrierId: true, surfaceId: true, campaignId: true, operationType: true } })
      : null;

    const latStr = form.get('latitude') ?? form.get('capturedLatitude');
    const lngStr = form.get('longitude') ?? form.get('capturedLongitude');
    const accStr = form.get('accuracy') ?? form.get('capturedAccuracyMeters');
    const noteStr = form.get('note');
    const capturedLatitude = latStr ? parseFloat(String(latStr)) : null;
    const capturedLongitude = lngStr ? parseFloat(String(lngStr)) : null;
    const capturedAccuracyMeters = accStr ? parseFloat(String(accStr)) : null;

    const fallbackPhotoType: PhotoType =
      pointMeta?.operationType === 'INSPECTION' || pointMeta?.operationType === 'REPAIR'
        ? 'CONTROL'
        : pointMeta?.operationType === 'REMOVE_AD' || pointMeta?.operationType === 'REMOVE_OBJECT'
          ? 'AFTER_DEINSTALLATION'
          : 'AFTER_INSTALLATION';
    const photoType = verified.photoType ?? fallbackPhotoType;

    const photo = await tx.photo.create({
      data: {
        id: photoId,
        organizationId,
        carrierId: pointMeta?.carrierId ?? null,
        surfaceId: pointMeta?.surfaceId ?? null,
        electionRemovalPointId: resolvedPointId,
        fieldWorkStepId: targetStepId,
        type: photoType,
        url: `/api/photos/${photoId}/file`,
        fileName,
        mimeType: file.type,
        size: file.size,
        note: typeof noteStr === 'string' && noteStr.trim() ? noteStr.trim().slice(0, 1000) : null,
        isClientVisible: true,
        isPrivate: false,
        capturedLatitude: capturedLatitude != null && !isNaN(capturedLatitude) ? capturedLatitude : null,
        capturedLongitude: capturedLongitude != null && !isNaN(capturedLongitude) ? capturedLongitude : null,
        capturedAccuracyMeters: capturedAccuracyMeters != null && !isNaN(capturedAccuracyMeters) ? capturedAccuracyMeters : null,
        capturedByWorkerUserId: actor.id,
        capturedByWorkerName: actor.email,
        storageProvider: stored.storageProvider,
        storageKey: stored.storageKey,
        driveFileId: stored.driveFileId,
        contentChecksum: stored.contentChecksum,
        content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : null,
      }
    });

    await tx.crmAuditLog.create({
      data: {
        id: 'audit-' + photoId,
        organizationId,
        entityType: targetStepId ? 'FieldWorkStep' : 'ElectionRemovalPoint',
        entityId: String(targetStepId || resolvedPointId),
        userId: actor.id,
        userEmail: actor.email,
        action: 'FIELD_STEP_PHOTO_UPLOADED',
        detailsJson: JSON.stringify({
          photoId,
          planId: plan.id,
          crewId: crew.id,
          type: photo.type,
          campaignId: pointMeta?.campaignId,
        })
      }
    });

    return { ok: true, photo: { id: photo.id, url: photo.url } };
  });
}
