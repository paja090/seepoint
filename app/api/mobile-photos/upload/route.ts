import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { analyzeCarrierPhotoWithAI } from '@/lib/ai-carrier-recognition';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { getCurrentUser } from '@/lib/auth';
import {
  normalizeImageMimeType,
  parseRequiredCoordinates,
  runPostSaveTasks,
  runWithRetry,
  stablePhotoUrl,
  storeMobilePhoto,
} from '@/lib/mobile-photo-upload';
import { MOBILE_PHOTO_DAMAGE_LABELS, isMobilePhotoDamageType } from '@/lib/mobile-photo-damage';

export const runtime = 'nodejs';

const sideLabels: Record<string, string> = {
  SIDE_A: 'Strana A', SIDE_B: 'Strana B', BOTH: 'Obě strany (A i B)',
};

const purposeLabels: Record<string, string> = {
  CLIENT_REPORT: 'Doložení výlepu pro klienta', DAMAGE: 'Poškození / závada na ploše',
  INSPECTION: 'Pravidelná kontrola / údržba', MOTIF_CHANGE: 'Výměna motivu / přelep',
};

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get('file');
    const carrierId = formData.get('carrierId');
    const surfaceId = formData.get('surfaceId');
    const side = String(formData.get('side') || 'SIDE_A');
    const purpose = String(formData.get('purpose') || 'CLIENT_REPORT');
    const damageType = formData.get('damageType') ? String(formData.get('damageType')) : null;
    const rawNote = String(formData.get('note') || '').trim();

    if (!(file instanceof File)) {
      return jsonError('INVALID_UPLOAD', 'Chybí soubor fotografie.', 400);
    }
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) {
      return jsonError('INVALID_IMAGE', 'Vybraný soubor není podporovaná fotografie.', 415);
    }
    if (purpose === 'DAMAGE' && (!damageType || !isMobilePhotoDamageType(damageType))) {
      return jsonError('DAMAGE_TYPE_REQUIRED', 'Vyberte typ závady.', 400);
    }

    const validCarrierId = typeof carrierId === 'string' && carrierId.trim() ? carrierId.trim() : null;

    const carrier = validCarrierId
      ? await prisma.advertisingCarrier.findUnique({
          where: { id: validCarrierId },
          select: { id: true, code: true, name: true, city: true, note: true, latitude: true, longitude: true },
        })
      : null;

    const clientCoordinates = parseRequiredCoordinates(formData.get('latitude'), formData.get('longitude'));
    const coordinates = clientCoordinates || {
      lat: carrier?.latitude ?? 0,
      lng: carrier?.longitude ?? 0,
    };

    const accuracyValue = Number(formData.get('accuracyMeters'));
    const accuracy = Number.isFinite(accuracyValue) && accuracyValue >= 0 ? accuracyValue : null;

    const requestedSurfaceId = typeof surfaceId === 'string' && surfaceId ? surfaceId : null;
    const now = new Date();
    const surface = (requestedSurfaceId && validCarrierId)
      ? await prisma.advertisingSurface.findFirst({ where: { id: requestedSurfaceId, carrierId: validCarrierId }, select: {
          id: true,
          occupancies: { where: { dateFrom: { lte: now }, dateTo: { gte: now }, status: { in: ['RESERVED', 'OCCUPIED'] } },
            orderBy: { dateFrom: 'desc' }, take: 1, select: { clientName: true, client: { select: { name: true } } } },
        } })
      : null;

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
    const mimeType = normalizeImageMimeType(file);
    const extension = mimeType === 'image/heic' ? 'heic' : mimeType === 'image/heif' ? 'heif' : mimeType.split('/')[1] || 'jpg';
    const safeCode = carrier ? carrier.code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'SURVEY';
    const fileName = `PHOTO_${safeCode}_${new Date().toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;
    const stored = await storeMobilePhoto(file, fileName, photoId, uploadPhotoToGoogleDrive);
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
          content: stored.storageProvider === 'LOCAL' ? Buffer.from(stored.bytes) : undefined,
          fileName, mimeType, size: stored.bytes.byteLength, type: purpose === 'DAMAGE' ? 'DAMAGE' : 'CARRIER',
          note: photoNote, isClientVisible: purpose === 'CLIENT_REPORT', storageProvider: stored.storageProvider,
          capturedLatitude: coordinates.lat, capturedLongitude: coordinates.lng, capturedAccuracyMeters: accuracy,
          capturedByWorkerUserId: workerUserId, capturedByWorkerName: workerName,
          aiStatus: (purpose === 'DAMAGE' || !carrier) ? 'SKIPPED' : 'PENDING',
        },
      });
    } catch (error) {
      console.error('[mobile-photos/upload] DB zápis fotografie selhal', error);
      return jsonError('DATABASE_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
    }

    const expectedClient = surface?.occupancies[0]?.client?.name || surface?.occupancies[0]?.clientName || null;
    const historyTask = () => logCarrierHistoryEvent({
      carrierId, surfaceId: surface?.id || null, eventType: purpose === 'DAMAGE' ? 'REPAIR' : 'SERVICE',
      title: purpose === 'DAMAGE' ? `ZÁVADA: ${damageText || 'Poškozeno'}` : 'Mobilní fotodokumentace z terénu',
      description: `${photoNote}. GPS: ${coordinates.lat}, ${coordinates.lng}.`, performedBy: workerName, photoUrl,
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
        capturedByWorkerName: photo.capturedByWorkerName, createdAt: photo.createdAt },
      warnings: [...(stored.driveWarning ? ['google-drive'] : []), ...warnings],
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
    return jsonError('UPLOAD_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
  }
}
