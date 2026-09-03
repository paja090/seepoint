import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { MOBILE_PHOTO_DAMAGE_LABELS, isMobilePhotoDamageType } from '@/lib/mobile-photo-damage';
import { PhotoValidationError, photoFileFromDataUrl, validatePhotoFile } from '@/lib/photo-validation';
import { deleteStoredPhoto, storeTenantPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const sideLabels: Record<string, string> = { SIDE_A: 'Strana A', SIDE_B: 'Strana B', BOTH: 'Obě strany' };
const purposeLabels: Record<string, string> = {
  CLIENT_REPORT: 'Doložení výlepu pro klienta', DAMAGE: 'Poškození / závada na ploše',
  INSPECTION: 'Pravidelná kontrola / údržba', MOTIF_CHANGE: 'Výměna motivu / přelep',
};

export async function POST(request: Request) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;
  const limited = await enforcePhotoUploadRateLimit(request, auth);
  if (limited) return limited;
  if (!['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN'].includes(auth.role)) {
    return NextResponse.json({ error: 'Nemáte oprávnění ukládat fotografie nosičů.' }, { status: 403 });
  }
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });

  let stored: Awaited<ReturnType<typeof storeTenantPhoto>> | undefined;
  try {
    const body = (await request.json().catch(() => null)) as {
      carrierId?: string; side?: string; purpose?: string; damageType?: string; note?: string; imageUrl?: string;
    } | null;
    if (!body?.carrierId || !body.imageUrl || !body.purpose) {
      return NextResponse.json({ error: 'Chybí povinné údaje (nosič, fotka, účel).' }, { status: 400 });
    }
    if (!sideLabels[body.side || '']) return NextResponse.json({ error: 'Vyberte platnou stranu nosiče.' }, { status: 400 });
    if (!purposeLabels[body.purpose]) return NextResponse.json({ error: 'Vyberte platný účel fotografie.' }, { status: 400 });
    if (body.purpose === 'DAMAGE' && (!body.damageType || !isMobilePhotoDamageType(body.damageType))) {
      return NextResponse.json({ error: 'Vyberte typ závady.' }, { status: 400 });
    }

    const carrier = await prisma.advertisingCarrier.findUnique({
      where: { id: String(body.carrierId) },
      select: { id: true, name: true, code: true, city: true, note: true },
    });
    if (!carrier) return NextResponse.json({ error: 'Nosič nebyl nalezen.' }, { status: 404 });

    const photoId = randomUUID();
    const file = photoFileFromDataUrl(body.imageUrl, `carrier-${carrier.code}-${photoId}.jpg`);
    const validated = await validatePhotoFile(file);
    const fileName = `carrier-${carrier.code.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}.jpg`;
    stored = await storeTenantPhoto({ organizationId, photoId, fileName, file: validated!.file });
    const photoUrl = `/api/photos/${photoId}/file`;
    const sideText = sideLabels[body.side!];
    const purposeText = purposeLabels[body.purpose];
    const damageText = body.damageType && isMobilePhotoDamageType(body.damageType) ? MOBILE_PHOTO_DAMAGE_LABELS[body.damageType] : '';
    const note = String(body.note || '').trim().slice(0, 1000);
    const photoNote = [
      `Účel: ${purposeText}`, `Strana: ${sideText}`, damageText ? `Závada: ${damageText}` : null,
      note ? `Poznámka: ${note}` : null,
    ].filter(Boolean).join(' | ');

    const photo = await prisma.$transaction(async (tx) => {
      const created = await tx.photo.create({
        data: {
          id: photoId,
          carrierId: carrier.id,
          url: photoUrl,
          driveFileId: stored!.driveFileId,
          content: stored!.storageProvider === 'DATABASE' ? Buffer.from(stored!.bytes) : undefined,
          storageProvider: stored!.storageProvider,
          storageKey: stored!.storageKey,
          contentChecksum: stored!.contentChecksum,
          fileName,
          mimeType: validated!.mimeType,
          size: stored!.bytes.byteLength,
          type: body.purpose === 'DAMAGE' ? 'DAMAGE' : 'CARRIER',
          note: photoNote,
          capturedByWorkerUserId: auth.id,
          capturedByWorkerName: auth.name || auth.email,
          isClientVisible: body.purpose === 'CLIENT_REPORT',
          aiStatus: 'SKIPPED',
        },
      });

      if (body.purpose === 'DAMAGE') {
        await tx.chatMessage.create({ data: {
          channel: 'urgent', userId: auth.id, userName: auth.name || auth.email, userRole: auth.role, imageUrl: photoUrl,
          content: `🚨 Závada – ${carrier.name} (${carrier.code}), ${sideText}${damageText ? `: ${damageText}` : ''}${note ? `\n${note}` : ''}`,
        } });
        await tx.advertisingCarrier.update({
          where: { id: carrier.id },
          data: { note: `[ZÁVADA: ${damageText || 'Poškozeno'} (${sideText})] ${note} | ${carrier.note || ''}`.trim().slice(0, 500) },
        });
      } else if (body.purpose === 'CLIENT_REPORT') {
        await tx.chatMessage.create({ data: {
          channel: 'installations', userId: auth.id, userName: auth.name || auth.email, userRole: auth.role, imageUrl: photoUrl,
          content: `📸 Doložení výlepu – ${carrier.name} (${carrier.code}), ${sideText}${note ? `\n${note}` : ''}`,
        } });
      }
      return created;
    });

    return NextResponse.json({ ok: true, photoId: photo.id, storageWarning: stored.warning });
  } catch (error) {
    if (stored) await deleteStoredPhoto(stored).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('[carriers/photo] Uložení fotografie selhalo', error);
    return NextResponse.json({ error: 'Fotografii se nepodařilo uložit.' }, { status: 500 });
  }
}
