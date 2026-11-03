import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeCarrierPhotoWithAI } from '@/lib/ai-carrier-recognition';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { attachPointInstallationPhotos, NavigationServiceError } from '@/lib/navigation/navigation-service';
import {
  parseRequiredCoordinates,
  runPostSaveTasks,
  runWithRetry,
  stablePhotoUrl,
} from '@/lib/mobile-photo-upload';
import { MOBILE_PHOTO_DAMAGE_LABELS, isMobilePhotoDamageType } from '@/lib/mobile-photo-damage';
import { enterTenantContext } from '@/lib/tenant-context';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { PhotoValidationError, validatePhotoFile } from '@/lib/photo-validation';
import { deleteStoredPhoto, storeTenantPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const sideLabels: Record<string, string> = {
  SIDE_A: 'Strana A',
  SIDE_B: 'Strana B',
  BOTH: 'Obě strany (A i B)',
};

const purposeLabels: Record<string, string> = {
  CLIENT_REPORT: 'Doložení výlepu pro klienta',
  DAMAGE: 'Poškození / závada na ploše',
  INSPECTION: 'Pravidelná kontrola / údržba',
  MOTIF_CHANGE: 'Výměna motivu / přelep',
};

const allowedSides = new Set(['SIDE_A', 'SIDE_B', 'BOTH']);
const allowedPurposes = new Set(Object.keys(purposeLabels));
const FINISHED_REALIZATION_STATUSES = new Set([
  'INSTALLED',
  'PHOTOGRAPHED',
  'DELIVERED_TO_CLIENT',
  'COMPLETED',
]);

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

function trimString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAccess(
      ['photoDocumentation', 'myTasks', 'work', 'carriers', 'offers', 'navigationProjects'],
      null
    );
    if (isApiDenied(auth)) return auth;
    const user = auth;
    const limited = await enforcePhotoUploadRateLimit(req, user);
    if (limited) return limited;
    const organizationId = user.organizationId || user.membership?.organizationId;
    if (!organizationId || !user.organization?.isActive || !user.membership?.isActive) {
      return jsonError('TENANT_REQUIRED', 'Nebyla nalezena aktivní organizace pro uložení fotografie.', 400);
    }
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const formData = await req.formData();
    const validatedPhoto = await validatePhotoFile(formData.get('file'));
    const file = validatedPhoto!.file;
    const mimeType = validatedPhoto!.mimeType;

    const validCarrierId = trimString(formData.get('carrierId'));
    const requestedSurfaceId = trimString(formData.get('surfaceId'));
    const requestedCrmRealizationId = trimString(formData.get('crmRealizationId'));
    const requestedWorkOrderItemId = trimString(formData.get('workOrderItemId'));
    const navigationOrderId = trimString(formData.get('navigationOrderId'));
    const navigationPointId = trimString(formData.get('navigationPointId'));
    const electionRemovalPointId = trimString(formData.get('electionRemovalPointId'));
    const quickCampaignCapture = String(formData.get('quickCampaignCapture') || '') === 'true';

    const side = String(formData.get('side') || 'SIDE_A');
    const purpose = String(formData.get('purpose') || 'CLIENT_REPORT');
    const requestedType = String(formData.get('type') || '').trim().toUpperCase();
    const isSurveyUpload = requestedType === 'SURVEY';
    const damageType = formData.get('damageType') ? String(formData.get('damageType')) : null;
    const rawNote = String(formData.get('note') || '').trim().slice(0, 1000);

    if (requestedType && !isSurveyUpload) {
      return jsonError('INVALID_PHOTO_TYPE', 'Tento typ fotografie nelze tímto endpointem uložit.', 400);
    }
    if (!allowedSides.has(side)) return jsonError('INVALID_SIDE', 'Vyberte platnou stranu nosiče.', 400);
    if (!allowedPurposes.has(purpose)) return jsonError('INVALID_PURPOSE', 'Vyberte platný účel fotografie.', 400);
    if (purpose === 'DAMAGE' && (!damageType || !isMobilePhotoDamageType(damageType))) {
      return jsonError('DAMAGE_TYPE_REQUIRED', 'Vyberte typ závady.', 400);
    }

    const clientCoordinates = parseRequiredCoordinates(formData.get('latitude'), formData.get('longitude'));
    const requiresGps = String(formData.get('requireGps') || '') === 'true';
    if (requiresGps && !clientCoordinates) {
      return jsonError('GPS_REQUIRED', 'Před uložením fotografie je nutná GPS poloha zařízení.', 400);
    }

    const accuracyValue = Number(formData.get('accuracyMeters'));
    const accuracy = clientCoordinates && Number.isFinite(accuracyValue) && accuracyValue >= 0 ? accuracyValue : null;

    const workerUserId = user?.id || 'MOBILE_WORKER';
    const workerName = user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user?.email || user?.name || 'Pracovník v terénu';
    const now = new Date();
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'jpg';

    // -----------------------------------------------------------------------
    // 1. Navigation Order Point 1-Tap Capture
    // -----------------------------------------------------------------------
    if (navigationOrderId && navigationPointId) {
      const photoId = `photo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const fileName = `PHOTO_NAV_${navigationPointId.slice(-6)}_${now.toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;
      const stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
      try {
        await attachPointInstallationPhotos(
          navigationOrderId,
          navigationPointId,
          [
            {
              id: photoId,
              fileName,
              mimeType,
              size: stored.bytes.byteLength,
              driveFileId: stored.driveFileId,
              storageProvider: stored.storageProvider,
              storageKey: stored.storageKey,
              contentChecksum: stored.contentChecksum,
              content: stored.storageProvider === 'DATABASE' ? stored.bytes : undefined,
              type: 'AFTER_INSTALLATION',
              note: rawNote || 'Mobilní fotodokumentace montáže navigačního bodu',
            },
          ],
          { userId: workerUserId, userName: workerName }
        );

        if (clientCoordinates) {
          await prisma.photo.update({
            where: { id: photoId },
            data: {
              capturedLatitude: clientCoordinates.lat,
              capturedLongitude: clientCoordinates.lng,
              capturedAccuracyMeters: accuracy,
            },
          }).catch(() => undefined);
        }

        return NextResponse.json({
          success: true,
          photo: {
            id: photoId,
            url: stablePhotoUrl(photoId),
            fileName,
            storageProvider: stored.storageProvider,
          },
          warnings: stored.warning ? [stored.warning] : [],
          message: 'Navigační bod byl nafocen a označen jako hotový.',
        });
      } catch (err) {
        await deleteStoredPhoto(stored).catch(() => undefined);
        if (err instanceof NavigationServiceError) {
          return jsonError(err.code || 'NAVIGATION_ERROR', err.message, 400);
        }
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // 2. Terénní práce (ElectionRemovalPoint) 1-Tap Capture
    // -----------------------------------------------------------------------
    if (electionRemovalPointId) {
      const fieldPoint = await prisma.electionRemovalPoint.findFirst({
        where: { id: electionRemovalPointId, organizationId },
        select: {
          id: true,
          campaignId: true,
          label: true,
          carrierId: true,
          surfaceId: true,
        },
      });
      if (!fieldPoint) {
        return jsonError('FIELD_POINT_NOT_FOUND', 'Terénní bod nebyl nalezen.', 404);
      }

      const photoId = `photo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const fileName = `PHOTO_FIELD_${fieldPoint.id.slice(-6)}_${now.toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;
      const stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
      const photoUrl = stablePhotoUrl(photoId);

      let photo;
      try {
        photo = await prisma.photo.create({
          data: {
            id: photoId,
            carrierId: fieldPoint.carrierId || validCarrierId || null,
            surfaceId: fieldPoint.surfaceId || requestedSurfaceId || null,
            electionRemovalPointId: fieldPoint.id,
            url: photoUrl,
            driveFileId: stored.driveFileId,
            content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : undefined,
            storageKey: stored.storageKey,
            contentChecksum: stored.contentChecksum,
            fileName,
            mimeType,
            size: stored.bytes.byteLength,
            type: 'INSTALLATION',
            note: rawNote || `Terénní práce: ${fieldPoint.label}`,
            isClientVisible: true,
            storageProvider: stored.storageProvider,
            capturedLatitude: clientCoordinates?.lat ?? null,
            capturedLongitude: clientCoordinates?.lng ?? null,
            capturedAccuracyMeters: accuracy,
            capturedByWorkerUserId: workerUserId,
            capturedByWorkerName: workerName,
            aiStatus: 'SKIPPED',
          },
        });

        await prisma.$transaction(async (tx) => {
          await tx.electionRemovalPoint.update({
            where: { id: fieldPoint.id },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              completedByUserId: user.id,
            },
          });
          await tx.fieldWorkStep.updateMany({
            where: {
              organizationId,
              pointId: fieldPoint.id,
              status: { notIn: ['COMPLETED', 'SKIPPED'] },
            },
            data: {
              status: 'COMPLETED',
              completedAt: now,
            },
          });

          const [totalPoints, completedPoints] = await Promise.all([
            tx.electionRemovalPoint.count({ where: { organizationId, campaignId: fieldPoint.campaignId } }),
            tx.electionRemovalPoint.count({
              where: { organizationId, campaignId: fieldPoint.campaignId, status: 'COMPLETED' },
            }),
          ]);
          const allDone = totalPoints > 0 && completedPoints >= totalPoints;
          await tx.electionCampaign.update({
            where: { id: fieldPoint.campaignId },
            data: {
              completedPoints,
              ...(allDone ? { status: 'COMPLETED' } : {}),
            },
          });
        });
      } catch (error) {
        await deleteStoredPhoto(stored).catch(() => undefined);
        throw error;
      }

      return NextResponse.json({
        success: true,
        photo: {
          id: photo.id,
          url: photo.url,
          fileName: photo.fileName,
          storageProvider: photo.storageProvider,
        },
        warnings: stored.warning ? [stored.warning] : [],
        message: 'Terénní bod byl nafocen a označen jako hotový.',
      });
    }

    // -----------------------------------------------------------------------
    // 3. Standard Carrier / Offer / Realization / WorkOrderItem Capture
    // -----------------------------------------------------------------------
    if (!isSurveyUpload && !validCarrierId) {
      return jsonError('CARRIER_REQUIRED', 'Vyberte nosič, ke kterému fotografie patří.', 400);
    }

    const carrier = validCarrierId
      ? await prisma.advertisingCarrier.findFirst({
          where: { id: validCarrierId, organizationId },
          select: { id: true, code: true, name: true, city: true, note: true, latitude: true, longitude: true },
        })
      : null;

    if (validCarrierId && !carrier) return jsonError('CARRIER_NOT_FOUND', 'Vybraný nosič nebyl nalezen.', 404);

    let surface =
      requestedSurfaceId && validCarrierId
        ? await prisma.advertisingSurface.findFirst({
            where: { id: requestedSurfaceId, carrierId: validCarrierId, organizationId },
            select: {
              id: true,
              name: true,
              sidePosition: true,
              sourcePosition: true,
              occupancies: {
                where: { dateFrom: { lte: now }, dateTo: { gte: now }, status: { in: ['RESERVED', 'OCCUPIED'] } },
                orderBy: { dateFrom: 'desc' },
                take: 1,
                select: { clientName: true, client: { select: { name: true } } },
              },
            },
          })
        : null;
    if (requestedSurfaceId && !surface) {
      return jsonError('SURFACE_NOT_FOUND', 'Vybraná plocha nepatří k nosiči.', 400);
    }

    // Auto-resolve matching surface of carrier (e.g. by side: SIDE_A / SIDE_B) when not explicitly passed
    if (!surface && validCarrierId) {
      const carrierSurfaces = await prisma.advertisingSurface.findMany({
        where: { carrierId: validCarrierId, organizationId },
        select: {
          id: true,
          name: true,
          sidePosition: true,
          sourcePosition: true,
          occupancies: {
            where: { dateFrom: { lte: now }, dateTo: { gte: now }, status: { in: ['RESERVED', 'OCCUPIED'] } },
            orderBy: { dateFrom: 'desc' },
            take: 1,
            select: { clientName: true, client: { select: { name: true } } },
          },
        },
      });

      if (carrierSurfaces.length > 0) {
        if (side === 'SIDE_A' || side === 'SIDE_B') {
          const matchedBySide = carrierSurfaces.find((s) => {
            const val = `${s.sidePosition || ''} ${s.sourcePosition || ''} ${s.name}`.toUpperCase();
            if (side === 'SIDE_B' && /\b(B|SIDE_B|STRANA B|ZADN[ÍI])\b/.test(val)) return true;
            if (side === 'SIDE_A' && /\b(A|SIDE_A|STRANA A|PŘEDN[ÍI])\b/.test(val)) return true;
            return false;
          });
          surface = matchedBySide || (carrierSurfaces.length === 1 ? carrierSurfaces[0] : null);
        } else if (carrierSurfaces.length === 1) {
          surface = carrierSurfaces[0];
        }
      }
    }

    // Resolve linked CrmRealization & WorkOrderItem (either explicit or active for this surface)
    let resolvedRealization = requestedCrmRealizationId
      ? await prisma.crmRealization.findFirst({
          where: { id: requestedCrmRealizationId, organizationId },
          select: { id: true, crmOrderId: true, status: true, workOrderItem: { select: { id: true, workOrderId: true } } },
        })
      : null;

    if (!resolvedRealization && !isSurveyUpload && purpose === 'CLIENT_REPORT' && surface?.id) {
      resolvedRealization = await prisma.crmRealization.findFirst({
        where: {
          organizationId,
          surfaceId: surface.id,
          status: { notIn: ['DELIVERED_TO_CLIENT', 'COMPLETED'] },
          crmOrder: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, crmOrderId: true, status: true, workOrderItem: { select: { id: true, workOrderId: true } } },
      });
    }

    let resolvedWorkOrderItem = requestedWorkOrderItemId
      ? await prisma.workOrderItem.findFirst({
          where: { id: requestedWorkOrderItemId, organizationId },
          select: { id: true, workOrderId: true, crmRealizationId: true },
        })
      : resolvedRealization?.workOrderItem
        ? {
            id: resolvedRealization.workOrderItem.id,
            workOrderId: resolvedRealization.workOrderItem.workOrderId,
            crmRealizationId: resolvedRealization.id,
          }
        : null;

    if (!resolvedWorkOrderItem && !isSurveyUpload && purpose === 'CLIENT_REPORT' && surface?.id) {
      resolvedWorkOrderItem = await prisma.workOrderItem.findFirst({
        where: {
          organizationId,
          surfaceId: surface.id,
          executionStatus: { not: 'DONE' },
          workOrder: { status: { notIn: ['DONE', 'CANCELLED'] } },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, workOrderId: true, crmRealizationId: true },
      });
    }

    const isInspection = purpose === 'INSPECTION' || purpose === 'CONTROL';
    const sideText = sideLabels[side] || side;
    const damageText = damageType && isMobilePhotoDamageType(damageType) ? MOBILE_PHOTO_DAMAGE_LABELS[damageType] : '';
    const photoNote = [
      `Účel: ${purposeLabels[purpose] || purpose}`,
      `Strana: ${sideText}`,
      damageText ? `Závada: ${damageText}` : null,
      rawNote ? `Poznámka: ${rawNote}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const photoId = `photo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const safeCode = carrier ? carrier.code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'SURVEY';
    const fileName = `PHOTO_${safeCode}_${now.toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;
    const stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
    const photoUrl = stablePhotoUrl(photoId);

    const isQuickReport =
      quickCampaignCapture || Boolean(resolvedRealization) || Boolean(resolvedWorkOrderItem);

    let photo;
    try {
      photo = await prisma.photo.create({
        data: {
          id: photoId,
          carrierId: carrier?.id || null,
          surfaceId: surface?.id || null,
          crmRealizationId: resolvedRealization?.id || resolvedWorkOrderItem?.crmRealizationId || null,
          workOrderItemId: resolvedWorkOrderItem?.id || null,
          url: photoUrl,
          driveFileId: stored.driveFileId,
          content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : undefined,
          storageKey: stored.storageKey,
          contentChecksum: stored.contentChecksum,
          fileName,
          mimeType,
          size: stored.bytes.byteLength,
          type: isSurveyUpload ? 'SURVEY'
            : purpose === 'DAMAGE'
              ? 'DAMAGE'
              : isInspection
                ? 'CONTROL'
                : purpose === 'CLIENT_REPORT'
                  ? 'INSTALLATION'
                  : 'CARRIER',
          note: photoNote,
          isClientVisible: !isSurveyUpload && (purpose === 'CLIENT_REPORT' || isInspection),
          storageProvider: stored.storageProvider,
          capturedLatitude: clientCoordinates?.lat ?? null,
          capturedLongitude: clientCoordinates?.lng ?? null,
          capturedAccuracyMeters: accuracy,
          capturedByWorkerUserId: workerUserId,
          capturedByWorkerName: workerName,
          aiStatus: isSurveyUpload || purpose === 'DAMAGE' || isInspection || !carrier || isQuickReport ? 'SKIPPED' : 'PENDING',
        },
      });
    } catch (error) {
      console.error('[mobile-photos/upload] DB zápis fotografie selhal', error);
      await deleteStoredPhoto(stored).catch((cleanupError) =>
        console.error('[mobile-photos/upload] Úklid souboru po chybě DB selhal', cleanupError)
      );
      return jsonError('DATABASE_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
    }

    // Advance linked CrmRealization / WorkOrderItem / WorkOrder / CrmOrder when photographing a campaign item
    if (!isSurveyUpload && purpose === 'CLIENT_REPORT' && (resolvedRealization || resolvedWorkOrderItem)) {
      await prisma.$transaction(async (tx) => {
        const realizationId = resolvedRealization?.id || resolvedWorkOrderItem?.crmRealizationId || null;
        if (realizationId) {
          const currentRel = await tx.crmRealization.findFirst({
            where: { id: realizationId, organizationId },
            select: { id: true, crmOrderId: true, status: true },
          });
          if (currentRel && !['DELIVERED_TO_CLIENT', 'COMPLETED'].includes(currentRel.status)) {
            await tx.crmRealization.update({
              where: { id: currentRel.id },
              data: { status: 'PHOTOGRAPHED', actualDate: now },
            });
          }
          if (currentRel) {
            const siblingStatuses = await tx.crmRealization.findMany({
              where: { crmOrderId: currentRel.crmOrderId, organizationId },
              select: { status: true },
            });
            if (
              siblingStatuses.length > 0 &&
              siblingStatuses.every((r) => FINISHED_REALIZATION_STATUSES.has(r.status))
            ) {
              await tx.crmOrder.updateMany({
                where: {
                  id: currentRel.crmOrderId,
                  organizationId,
                  status: { notIn: ['CANCELLED', 'COMPLETED'] },
                },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }

        if (resolvedWorkOrderItem) {
          await tx.workOrderItem.update({
            where: { id: resolvedWorkOrderItem.id },
            data: { executionStatus: 'DONE', completedAt: now },
          });
          const remainingItems = await tx.workOrderItem.count({
            where: {
              workOrderId: resolvedWorkOrderItem.workOrderId,
              organizationId,
              OR: [{ executionStatus: null }, { executionStatus: { not: 'DONE' } }],
            },
          });
          if (remainingItems === 0) {
            await tx.workOrder.updateMany({
              where: {
                id: resolvedWorkOrderItem.workOrderId,
                organizationId,
                status: { notIn: ['DONE', 'CANCELLED'] },
              },
              data: { status: 'DONE' },
            });
            await tx.workTask.updateMany({
              where: {
                workOrderId: resolvedWorkOrderItem.workOrderId,
                organizationId,
                status: { notIn: ['DONE', 'CANCELLED'] },
              },
              data: { status: 'DONE' },
            });
          }
        }
      }).catch((syncErr) => {
        console.warn('[mobile-photos/upload] Post-upload realization/work-order sync warning:', syncErr);
      });
    }

    if (!carrier) {
      return NextResponse.json({
        success: true,
        photo: {
          id: photo.id,
          url: photo.url,
          fileName: photo.fileName,
          storageProvider: photo.storageProvider,
        },
      });
    }

    const expectedClient = surface?.occupancies[0]?.client?.name || surface?.occupancies[0]?.clientName || null;
    const historyTask = () =>
      logCarrierHistoryEvent({
        carrierId: carrier.id,
        surfaceId: surface?.id || null,
        eventType: purpose === 'DAMAGE' ? 'REPAIR' : isInspection ? 'INSPECTION' : 'SERVICE',
        title:
          purpose === 'DAMAGE'
            ? `ZÁVADA: ${damageText || 'Poškozeno'}`
            : isInspection
              ? 'Kontrola nosiče a plochy'
              : 'Mobilní fotodokumentace z terénu',
        description: `${photoNote}${clientCoordinates ? `. GPS: ${clientCoordinates.lat}, ${clientCoordinates.lng}.` : '.'}`,
        performedBy: workerName,
        photoUrl,
      });
    const chatTask = async () => {
      if (purpose !== 'DAMAGE') return;
      await runWithRetry(
        () =>
          prisma.chatMessage.create({
            data: {
              channel: 'urgent',
              userId: workerUserId,
              userName: workerName,
              userRole: user?.role || 'WORKER',
              imageUrl: photoUrl,
              content: [
                '🚨 **HLÁŠENÍ ZÁVADY NA PLOŠE**',
                `📍 **Nosič:** ${carrier.name} (${carrier.code}) – ${carrier.city}`,
                `📐 **Strana:** ${sideText}`,
                damageText ? `⚠️ **Typ závady:** ${damageText}` : null,
                rawNote ? `📝 **Poznámka:** ${rawNote}` : null,
                `👤 **Nahlásil/a:** ${workerName}`,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          }),
        2
      );
    };
    const carrierNoteTask = async () => {
      if (purpose !== 'DAMAGE') return;
      const updatedNote = `[ZÁVADA: ${damageText} (${sideText})] ${rawNote} | ${carrier.note || ''}`.trim();
      await prisma.advertisingCarrier.update({
        where: { id: carrier.id },
        data: { note: updatedNote.slice(0, 500) },
      });
    };

    let warnings: string[] = [];
    let clientMismatch = false;
    let detectedClient: string | null = null;
    let confidence = 0;
    if (purpose === 'DAMAGE') {
      warnings = await runPostSaveTasks([
        { name: 'history', run: historyTask },
        { name: 'chat', run: chatTask },
        { name: 'carrier-note', run: carrierNoteTask },
      ]);
    } else if (isInspection || isQuickReport) {
      warnings = await runPostSaveTasks([{ name: 'history', run: historyTask }]);
    } else {
      const imageDataUrl = `data:${mimeType};base64,${Buffer.from(stored.bytes).toString('base64')}`;
      const analysis = await analyzeCarrierPhotoWithAI({
        photoId: photo.id,
        imageUrl: imageDataUrl,
        expectedCarrierCode: carrier.code,
        expectedClient,
      });
      detectedClient = 'detectedClient' in analysis ? analysis.detectedClient || null : null;
      confidence = 'aiConfidence' in analysis ? analysis.aiConfidence : 0;
      clientMismatch = Boolean(
        expectedClient &&
          detectedClient &&
          confidence >= 0.85 &&
          expectedClient.localeCompare(detectedClient, 'cs', { sensitivity: 'base' }) !== 0
      );
      if (clientMismatch) await prisma.photo.update({ where: { id: photo.id }, data: { surfaceId: null } });
      if (analysis.aiStatus === 'FAILED') warnings.push('ai');
      if (!clientMismatch) {
        warnings.push(
          ...(await runPostSaveTasks([
            { name: 'history', run: historyTask },
            { name: 'chat', run: chatTask },
          ]))
        );
      }
    }

    return NextResponse.json({
      success: true,
      photo: {
        id: photo.id,
        url: photo.url,
        fileName: photo.fileName,
        storageProvider: photo.storageProvider,
        capturedLatitude: photo.capturedLatitude,
        capturedLongitude: photo.capturedLongitude,
        capturedAccuracyMeters: photo.capturedAccuracyMeters,
        capturedByWorkerName: photo.capturedByWorkerName,
        createdAt: photo.createdAt,
      },
      warnings: [...(stored.warning ? [stored.warning] : []), ...warnings],
      chatSent: purpose !== 'DAMAGE' || !warnings.includes('chat'),
      clientMismatch: clientMismatch
        ? {
            photoId: photo.id,
            expectedSurfaceId: surface?.id || null,
            expectedClient,
            detectedClient,
            confidence,
          }
        : null,
      message:
        purpose === 'DAMAGE'
          ? warnings.includes('chat')
            ? 'Fotografie závady byla uložena, ale upozornění do chatu se nepodařilo odeslat.'
            : 'Závada byla uložena a fotografie odeslána do urgentního chatu.'
          : isInspection
            ? 'Kontrola plochy byla zaznamenána a fotografie uložena do fotodokumentace.'
            : 'Fotografie byla bezpečně uložena k zakázce a nosiči.',
    });
  } catch (error) {
    console.error('[mobile-photos/upload]', error);
    if (error instanceof PhotoValidationError) return jsonError(error.code, error.message, error.status);
    return jsonError('UPLOAD_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
  }
}
