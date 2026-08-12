import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { analyzeCarrierPhotoWithAI } from '@/lib/ai-carrier-recognition';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { getCurrentUser } from '@/lib/auth';

const damageTypeLabels: Record<string, string> = {
  OVERGROWN: '🌳 Zarostlá – nutný prořez stromů/keřů',
  TURNED: '🔄 Vytočená / hnutá konstrukce',
  FADED: '☀️ Vybledlý tisk / poničený motiv',
  DAMAGED_STRUCTURE: '🚨 Poškozená konstrukce / prasklé sklo',
  LIGHTING_OFF: '💡 Nesvítí osvětlení',
  OTHER: '⚠️ Jiná závada',
};

const sideLabels: Record<string, string> = {
  SIDE_A: '🅰️ Strana A (Přední)',
  SIDE_B: '🅱️ Strana B (Zadní)',
  BOTH: '🔀 Obě strany (A i B)',
};

const purposeLabels: Record<string, string> = {
  CLIENT_REPORT: '📸 Doložení výlepu pro klienta',
  DAMAGE: '🚨 Poškození / Závada na ploše',
  INSPECTION: '🧹 Pravidelná kontrola / Údržba',
  MOTIF_CHANGE: '🔄 Výměna motivu / Přelep',
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const carrierId = formData.get('carrierId') as string | null;
    const surfaceId = formData.get('surfaceId') as string | null;
    const side = (formData.get('side') as string | null) || 'SIDE_A';
    const purpose = (formData.get('purpose') as string | null) || 'CLIENT_REPORT';
    const damageType = formData.get('damageType') as string | null;
    const latStr = formData.get('latitude') as string | null;
    const lngStr = formData.get('longitude') as string | null;
    const accuracyStr = formData.get('accuracyMeters') as string | null;
    const rawNote = (formData.get('note') as string | null) || '';

    if (!file || !carrierId) {
      return NextResponse.json({ error: 'Chybí soubor fotografie nebo ID nosiče' }, { status: 400 });
    }

    const carrier = await prisma.advertisingCarrier.findUnique({
      where: { id: carrierId },
      select: { id: true, code: true, name: true, city: true, note: true },
    });

    if (!carrier) {
      return NextResponse.json({ error: 'Nosič nebyl nalezen' }, { status: 404 });
    }

    const lat = latStr ? parseFloat(latStr) : null;
    const lng = lngStr ? parseFloat(lngStr) : null;
    const accuracy = accuracyStr ? parseFloat(accuracyStr) : null;
    const workerUserId = user?.id || 'MOBILE_WORKER';
    const workerName = user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user?.email || user?.name || 'Pracovník v terénu';

    const sideText = sideLabels[side] || side;
    const purposeText = purposeLabels[purpose] || purpose;
    const damageText = damageType ? damageTypeLabels[damageType] || damageType : '';

    const photoNote = [
      `Účel: ${purposeText}`,
      `Strana: ${sideText}`,
      damageText ? `Závada: ${damageText}` : null,
      rawNote ? `Poznámka: ${rawNote}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const photoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `PHOTO_${carrier.code}_${timestamp}_${photoId.slice(-6)}.jpg`;

    let photoUrl = '';
    let driveFileId: string | null = null;
    let storageProvider = 'LOCAL';

    // 1. Try Google Drive storage first
    try {
      const driveRes = await uploadPhotoToGoogleDrive(file, fileName, photoId);
      driveFileId = driveRes.id;
      photoUrl = `/api/photos/${photoId}/file`;
      storageProvider = 'GOOGLE_DRIVE';
    } catch (driveErr) {
      console.warn('Google Drive storage fallback to local:', driveErr);
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString('base64');
      photoUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`;
      storageProvider = 'LOCAL';
    }

    // 2. Create Photo DB record
    const photo = await prisma.photo.create({
      data: {
        id: photoId,
        carrierId,
        surfaceId: surfaceId || undefined,
        url: photoUrl,
        driveFileId,
        fileName,
        mimeType: file.type || 'image/jpeg',
        size: file.size,
        type: 'CARRIER',
        note: photoNote,
        isClientVisible: purpose === 'CLIENT_REPORT',
        storageProvider,
        capturedLatitude: lat,
        capturedLongitude: lng,
        capturedAccuracyMeters: accuracy,
        capturedByWorkerUserId: workerUserId,
        capturedByWorkerName: workerName,
        aiStatus: 'PENDING',
      },
    });

    // 3. Trigger AI Carrier Recognition Architecture analysis asynchronously
    void analyzeCarrierPhotoWithAI({
      photoId: photo.id,
      imageUrl: photoUrl,
      expectedCarrierCode: carrier.code,
    });

    // 4. Log Carrier Audit Event
    await logCarrierHistoryEvent({
      carrierId,
      surfaceId: surfaceId || null,
      eventType: purpose === 'DAMAGE' ? 'REPAIR' : 'SERVICE',
      title: purpose === 'DAMAGE' ? `ZÁVADA: ${damageText || 'Poškozeno'}` : 'Mobilní fotodokumentace z terénu',
      description: `${photoNote}. GPS: ${lat ?? '?'}, ${lng ?? '?'}.`,
      performedBy: workerName,
      photoUrl,
    });

    // 5. If purpose is DAMAGE, auto-post urgent message to Team Chat
    if (purpose === 'DAMAGE') {
      const chatContent = [
        `🚨 **HLÁŠENÍ ZÁVADY NA PLOŠE**`,
        `📍 **Nosič:** ${carrier.name} (${carrier.code}) – ${carrier.city}`,
        `📐 **Strana:** ${sideText}`,
        damageText ? `⚠️ **Typ závady:** ${damageText}` : null,
        rawNote ? `📝 **Poznámka z terénu:** ${rawNote}` : null,
        `👤 **Nahlásil/a:** ${workerName}`,
      ]
        .filter(Boolean)
        .join('\n');

      await prisma.chatMessage.create({
        data: {
          channel: 'urgent',
          userId: workerUserId,
          userName: workerName,
          userRole: user?.role || 'WORKER',
          content: chatContent,
          imageUrl: photoUrl,
        },
      });

      // Update carrier note with damage warning
      const updatedNote = `[🚨 ZÁVADA: ${damageText || 'Poškozeno'} (${sideText})] ${rawNote || ''} | ${carrier.note || ''}`.trim();
      await prisma.advertisingCarrier.update({
        where: { id: carrier.id },
        data: { note: updatedNote.slice(0, 500) },
      });
    } else if (purpose === 'CLIENT_REPORT') {
      const chatContent = [
        `📸 **DOLOŽENÍ VÝLEPU PRO KLIENTA**`,
        `📍 **Nosič:** ${carrier.name} (${carrier.code}) – ${carrier.city}`,
        `📐 **Strana:** ${sideText}`,
        rawNote ? `📝 **Poznámka:** ${rawNote}` : null,
        `👤 **Vyfotil/a:** ${workerName}`,
      ]
        .filter(Boolean)
        .join('\n');

      await prisma.chatMessage.create({
        data: {
          channel: 'installations',
          userId: workerUserId,
          userName: workerName,
          userRole: user?.role || 'WORKER',
          content: chatContent,
          imageUrl: photoUrl,
        },
      });
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
        capturedByWorkerName: photo.capturedByWorkerName,
        createdAt: photo.createdAt,
      },
      message: purpose === 'DAMAGE'
        ? 'Závada byla úspěšně zaznamenána a odeslána do Týmového Chatu (Urgentní)!'
        : 'Fotografie byla úspěšně uložena k nosiči!',
    });
  } catch (error) {
    console.error('Mobile photo upload error:', error);
    return NextResponse.json({ error: 'Chyba při nahrávání fotografie' }, { status: 500 });
  }
}
