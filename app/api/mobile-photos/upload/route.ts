import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { analyzeCarrierPhotoWithAI } from '@/lib/ai-carrier-recognition';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const carrierId = formData.get('carrierId') as string | null;
    const surfaceId = formData.get('surfaceId') as string | null;
    const latStr = formData.get('latitude') as string | null;
    const lngStr = formData.get('longitude') as string | null;
    const accuracyStr = formData.get('accuracyMeters') as string | null;
    const note = (formData.get('note') as string | null) || 'Mobilní fotodokumentace v terénu';

    if (!file || !carrierId) {
      return NextResponse.json({ error: 'Chybí soubor fotografie nebo ID nosiče' }, { status: 400 });
    }

    const carrier = await prisma.advertisingCarrier.findUnique({
      where: { id: carrierId },
      select: { id: true, code: true, name: true },
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
      : user?.email || 'Pracovník v terénu';

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
      photoUrl = `/api/photos/drive/${driveFileId}`;
      storageProvider = 'GOOGLE_DRIVE';
    } catch (driveErr) {
      console.warn('Google Drive storage fallback to local:', driveErr);
      // Fallback: Convert to Data URL / Local Storage
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
        note,
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
      eventType: 'SERVICE',
      title: 'Mobilní fotodokumentace z terénu',
      description: `Pořízena mobilní fotodokumentace (${storageProvider === 'GOOGLE_DRIVE' ? 'Google Drive Cloud' : 'Lokální úložiště'}). GPS: ${lat ?? '?'}, ${lng ?? '?'}. Poznámka: ${note}`,
      performedBy: workerName,
      photoUrl,
    });

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
    });
  } catch (error) {
    console.error('Mobile photo upload error:', error);
    return NextResponse.json({ error: 'Chyba při nahrávání fotografie' }, { status: 500 });
  }
}
