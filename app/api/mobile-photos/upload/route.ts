import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeCarrierPhotoWithAI } from '@/lib/ai-carrier-recognition';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
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
  SIDE_A: 'Strana A', SIDE_B: 'Strana B', BOTH: 'Obě strany (A i B)',
};

const purposeLabels: Record<string, string> = {
  CLIENT_REPORT: 'Doložení výlepu pro klienta', DAMAGE: 'Poškození / závada na ploše',
  INSPECTION: 'Pravidelná kontrola / údržba', MOTIF_CHANGE: 'Výměna motivu / přelep',
};

const allowedSides = new Set(['SIDE_A', 'SIDE_B', 'BOTH']);
const allowedPurposes = new Set(Object.keys(purposeLabels));

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAccess('navigationProjects');
    if (isApiDenied(auth)) return auth;
    const user = auth;
    const limited = await enforcePhotoUploadRateLimit(req, user);
    if (limited) return limited;
    const organizationId = user.organizationId || user.membership?.organizationId;
    if (!organizationId) return jsonError('TENANT_REQUIRED', 'Nebyla nalezena organizace pro uložení fotografie.', 400);
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const formData = await req.formData();
    const validatedPhoto = await validatePhotoFile(formData.get('file'));
    const file = validatedPhoto!.file;
    const mimeType = validatedPhoto!.mimeType;
    const carrierId = formData.get('carrierId');
    const surfaceId = formData.get('surfaceId');
    const side = String(formData.get('side') || 'SIDE_A');
    const purpose = String(formData.get('purpose') || 'CLIENT_REPORT');
    const requestedType = String(formData.get('type') || '').trim().toUpperCase();
    const isSurveyUpload = requestedType === 'SURVEY';
    const damageType = formData.get('damageType') ? String(formData.get('damageType')) : null;
    const rawNote = String(formData.get('note') || '').trim().slice(0, 1000);

    if (requestedType && !isSurveyUpload) return jsonError('INVALID_PHOTO_TYPE', 'Tento typ fotografie nelze tímto endpointem uložit.', 400);
    if (!allowedSides.has(side)) return jsonError('INVALID_SIDE', 'Vyberte platnou stranu nosiče.', 400);
    if (!allowedPurposes.has(purpose)) return jsonError('INVALID_PURPOSE', 'Vyberte platný účel fotografie.', 400);
    if (purpose === 'DAMAGE' && (!damageType || !isMobilePhotoDamageType(damageType))) {
      return jsonError('DAMAGE_TYPE_REQUIRED', 'Vyberte typ závady.', 400);
    }

    const validCarrierId = typeof carrierId === 'string' && carrierId.trim() ? carrierId.trim() : null;
    if (!isSurveyUpload && !validCarrierId) return jsonError('CARRIER_REQUIRED', 'Vyberte nosič, ke kterému fotografie patří.', 400);

    const carrier = validCarrierId
      ? await prisma.advertisingCarrier.findUnique({
          where: { id: validCarrierId },
          select: { id: true, code: true, name: true, city: true, note: true, latitude: true, longitude: true },
        })
      : null;

    if (validCarrierId && !carrier) return jsonError('CARRIER_NOT_FOUND', 'Vybraný nosič nebyl nalezen.', 404);

    const clientCoordinates = parseRequiredCoordinates(formData.get('latitude'), formData.get('longitude'));
    const requiresGps = String(formData.get('requireGps') || '') === 'true';
    if (requiresGps && !clientCoordinates) return jsonError('GPS_REQUIRED', 'Před uložením fotografie je nutná GPS poloha zařízení.', 400);

    const accuracyValue = Number(formData.get('accuracyMeters'));
    const accuracy = clientCoordinates && Number.isFinite(accuracyValue) && accuracyValue >= 0 ? accuracyValue : null;

    const requestedSurfaceId = typeof surfaceId === 'string' && surfaceId ? surfaceId : null;
    const now = new Date();
    const surface = (requestedSurfaceId && validCarrierId)
      ? await prisma.advertisingSurface.findFirst({ where: { id: requestedSurfaceId, carrierId: validCarrierId }, select: {
          id: true,
          occupancies: { where: { dateFrom: { lte: now }, dateTo: { gte: now }, status: { in: ['RESERVED', 'OCCUPIED'] } },
            orderBy: { dateFrom: 'desc' }, take: 1, select: { clientName: true, client: { select: { name: true } } } },
        } })
      : null;
    if (requestedSurfaceId && !surface) return jsonError('SURFACE_NOT_FOUND', 'Vybraná plocha nepatří k nosiči.', 400);

    const workerUserId = user?.id || 'MOBILE_WORKER';
    const workerName = user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user?.email || user?.name || 'Pracovník v terénu';
    const sideText = sideLabels[side] || side;
    const damageText = damageType && isMobilePhotoDamageType(damageType) ? MOBILE_PHOTO_DAMAGE_LABELS[damageType] : '';
    const photoNote = [
      `Účel: ${purposeLabels[purpose] || purpose}`,
      `Strana: ${sideText}`,
      damageText ? `Závada: ${damageText}` : null,
      rawNote ? `Poznámka: ${rawNote}` : null,
    ].filter(Boolean).join(' | ');

    const photoId = `photo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    const safeCode = carrier ? carrier.code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'SURVEY';
    const fileName = `PHOTO_${safeCode}_${new Date().toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;
    const stored = await storeTenantPhoto({ organizationId, photoId, fileName, file });
    const photoUrl = stablePhotoUrl(photoId);

    let photo;
    try {
      photo = await prisma.photo.create({
        data: {
          id: photoId,
          carrierId: carrier?.id || null,
          surfaceId: surface?.id || null,
          url: photoUrl,
          driveFileId: stored.driveFileId,
          content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : undefined,
          storageKey: stored.storageKey,
          contentChecksum: stored.contentChecksum,
          fileName, mimeType, size: stored.bytes.byteLength,
          type: isSurveyUpload ? 'SURVEY' : purpose === 'DAMAGE' ? 'DAMAGE' : purpose === 'CLIENT_REPORT' ? 'INSTALLATION' : 'CARRIER',
          note: photoNote, isClientVisible: !isSurveyUpload && purpose === 'CLIENT_REPORT', storageProvider: stored.storageProvider,
          capturedLatitude: clientCoordinates?.lat ?? null, capturedLongitude: clientCoordinates?.lng ?? null, capturedAccuracyMeters: accuracy,
          capturedByWorkerUserId: workerUserId, capturedByWorkerName: workerName,
          aiStatus: (isSurveyUpload || purpose === 'DAMAGE' || !carrier) ? 'SKIPPED' : 'PENDING',
        },
      });
    } catch (error) {
      console.error('[mobile-photos/upload] DB zápis fotografie selhal', error);
      await deleteStoredPhoto(stored).catch((cleanupError) => console.error('[mobile-photos/upload] Úklid souboru po chybě DB selhal', cleanupError));
      return jsonError('DATABASE_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
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
    const historyTask = () => logCarrierHistoryEvent({
      carrierId: carrier.id, surfaceId: surface?.id || null, eventType: purpose === 'DAMAGE' ? 'REPAIR' : 'SERVICE',
      title: purpose === 'DAMAGE' ? `ZÁVADA: ${damageText || 'Poškozeno'}` : 'Mobilní fotodokumentace z terénu',
      description: `${photoNote}${clientCoordinates ? `. GPS: ${clientCoordinates.lat}, ${clientCoordinates.lng}.` : '.'}`, performedBy: workerName, photoUrl,
    });
    const chatTask = async () => {
      if (purpose !== 'DAMAGE') return;
      await runWithRetry(() => prisma.chatMessage.create({ data: {
          channel: 'urgent', userId: workerUserId, userName: workerName,
          userRole: user?.role || 'WORKER', imageUrl: photoUrl,
          content: [
            '🚨 **HLÁŠENÍ ZÁVADY NA PLOŠE**',
            `📍 **Nosič:** ${carrier.name} (${carrier.code}) – ${carrier.city}`,
            `📐 **Strana:** ${sideText}`, damageText ? `⚠️ **Typ závady:** ${damageText}` : null,
            rawNote ? `📝 **Poznámka:** ${rawNote}` : null, `👤 **Nahlásil/a:** ${workerName}`,
          ].filter(Boolean).join('\n'),
        } }), 2);
    };
    const carrierNoteTask = async () => {
      if (purpose !== 'DAMAGE') return;
      const updatedNote = `[ZÁVADA: ${damageText} (${sideText})] ${rawNote} | ${carrier.note || ''}`.trim();
      await prisma.advertisingCarrier.update({ where: { id: carrier.id }, data: { note: updatedNote.slice(0, 500) } });
    };

    // A damage report is operationally urgent: persist its history and chat alert
    // immediately after the photo. AI must never delay or suppress these steps.
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
    } else {
      const imageDataUrl = `data:${mimeType};base64,${Buffer.from(stored.bytes).toString('base64')}`;
      const analysis = await analyzeCarrierPhotoWithAI({ photoId: photo.id, imageUrl: imageDataUrl, expectedCarrierCode: carrier.code, expectedClient });
      detectedClient = 'detectedClient' in analysis ? analysis.detectedClient || null : null;
      confidence = 'aiConfidence' in analysis ? analysis.aiConfidence : 0;
      clientMismatch = Boolean(expectedClient && detectedClient && confidence >= 0.85
        && expectedClient.localeCompare(detectedClient, 'cs', { sensitivity: 'base' }) !== 0);
      if (clientMismatch) await prisma.photo.update({ where: { id: photo.id }, data: { surfaceId: null } });
      if (analysis.aiStatus === 'FAILED') warnings.push('ai');
      if (!clientMismatch) {
        warnings.push(...await runPostSaveTasks([
          { name: 'history', run: historyTask },
          { name: 'chat', run: chatTask },
        ]));
      }
    }

    return NextResponse.json({
      success: true,
      photo: { id: photo.id, url: photo.url, fileName: photo.fileName, storageProvider: photo.storageProvider,
        capturedLatitude: photo.capturedLatitude, capturedLongitude: photo.capturedLongitude,
        capturedAccuracyMeters: photo.capturedAccuracyMeters,
        capturedByWorkerName: photo.capturedByWorkerName, createdAt: photo.createdAt },
      warnings: [...(stored.warning ? [stored.warning] : []), ...warnings],
      chatSent: purpose !== 'DAMAGE' || !warnings.includes('chat'),
      clientMismatch: clientMismatch ? {
        photoId: photo.id, expectedSurfaceId: surface?.id || null, expectedClient,
        detectedClient, confidence,
      } : null,
      message: purpose === 'DAMAGE'
        ? warnings.includes('chat')
          ? 'Fotografie závady byla uložena, ale upozornění do chatu se nepodařilo odeslat.'
          : 'Závada byla uložena a fotografie odeslána do urgentního chatu.'
        : 'Fotografie byla bezpečně uložena k nosiči.',
    });
  } catch (error) {
    console.error('[mobile-photos/upload]', error);
    if (error instanceof PhotoValidationError) return jsonError(error.code, error.message, error.status);
    return jsonError('UPLOAD_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
  }
}
