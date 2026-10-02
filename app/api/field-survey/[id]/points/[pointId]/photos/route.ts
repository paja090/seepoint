import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { validatePhotoFile, PhotoValidationError } from '@/lib/photo-validation';
import { storeTenantPhoto, deleteStoredPhoto } from '@/lib/storage/photo-storage';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';
import { createFieldSurveyPhotoRecord, deleteFieldSurveyPhoto, getFieldSurveyPoint } from '@/lib/field-survey/data';

export const runtime = 'nodejs';

function jsonError(code: string, error: string, status: number) {
  return NextResponse.json({ success: false, code, error }, { status });
}

/**
 * POST /api/field-survey/[id]/points/[pointId]/photos
 * Upload fotografie k průzkumnému bodu.
 *
 * KLÍČOVÁ BEZPEČNOSTNÍ ZÁSADA:
 * Tato fotografie se NIKDY neuloží do modelu Photo (AdvertisingCarrier galerie).
 * Ukládá se výhradně do FieldSurveyPhoto, která NENÍ zobrazena v žádném existujícím workflow.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  const { pointId } = await params;

  const auth = await requireApiAccess('fieldSurvey');
  if (isApiDenied(auth)) return auth;

  // Rate limit – sdílíme existující infrastrukturu
  const limited = await enforcePhotoUploadRateLimit(req, auth);
  if (limited) return limited;

  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  // Ověříme, že bod patří tenantu
  const point = await getFieldSurveyPoint(pointId);
  if (!point) return jsonError('NOT_FOUND', 'Průzkumný bod nebyl nalezen.', 404);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError('INVALID_FORM', 'Neplatný formát nahrávání.', 400);
  }

  // Validace souboru – sdílíme existující photo-validation infrastrukturu
  let validatedPhoto: { file: File; mimeType: string };
  try {
    const result = await validatePhotoFile(formData.get('file'));
    if (!result) return jsonError('FILE_REQUIRED', 'Soubor fotografie nebyl nahrán.', 400);
    validatedPhoto = result;
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return jsonError(error.code, error.message, error.status);
    }
    throw error;
  }

  const note = formData.get('note') ? String(formData.get('note')).trim().slice(0, 500) : undefined;

  // Generujeme ID a klíč pro storage
  const photoId = `fsp-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const extension = validatedPhoto.mimeType === 'image/jpeg' ? 'jpg' : validatedPhoto.mimeType.split('/')[1] ?? 'jpg';
  const fileName = `SURVEY_${organizationId.slice(-6)}_${new Date().toISOString().slice(0, 10)}_${photoId.slice(-8)}.${extension}`;

  // Upload do storage (Google Drive nebo DB fallback) – stejná infrastruktura jako existující focení
  let stored: Awaited<ReturnType<typeof storeTenantPhoto>>;
  try {
    stored = await storeTenantPhoto({ organizationId, photoId, fileName, file: validatedPhoto.file });
  } catch (error) {
    console.error('[field-survey/photos] Upload do storage selhal', error);
    return jsonError('STORAGE_ERROR', 'Fotografii se nepodařilo nahrát. Zkuste akci zopakovat.', 500);
  }

  // Uložení do FieldSurveyPhoto (NE do Photo modelu!)
  let photo: Awaited<ReturnType<typeof createFieldSurveyPhotoRecord>>;
  try {
    photo = await createFieldSurveyPhotoRecord({
      surveyPointId: pointId,
      url: `/api/field-survey/photos/${photoId}/file`,
      driveFileId: stored.driveFileId,
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      contentChecksum: stored.contentChecksum,
      content: stored.storageProvider === 'DATABASE' ? Buffer.from(stored.bytes) : null,
      fileName,
      mimeType: validatedPhoto.mimeType,
      size: stored.bytes.byteLength,
      note,
    });
  } catch (error) {
    // Pokud DB selže, smazat storage
    await deleteStoredPhoto(stored).catch((cleanupError) =>
      console.error('[field-survey/photos] Cleanup po DB chybě selhal', cleanupError)
    );
    if (error instanceof Error && error.message.includes('access denied')) {
      return jsonError('ACCESS_DENIED', 'Průzkumný bod nebyl nalezen nebo nemáte přístup.', 403);
    }
    console.error('[field-survey/photos] DB zápis fotografie selhal', error);
    return jsonError('DATABASE_ERROR', 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.', 500);
  }

  const storageWarning = stored.warning === 'google-drive'
    ? 'Google Drive nebyl dostupný. Fotografie je bezpečně uložena záložní metodou.'
    : null;

  console.info('[field-survey] Fotografie průzkumu uložena', {
    photoId: photo.id, pointId, surveyId: point.surveyId, orgId: organizationId, userId: auth.id,
  });

  return NextResponse.json({
    success: true,
    photo: {
      id: photo.id,
      url: photo.url,
      fileName: photo.fileName,
      storageProvider: photo.storageProvider,
      sortOrder: photo.sortOrder,
    },
    warning: storageWarning,
    message: 'Fotografie průzkumu byla bezpečně uložena.',
  }, { status: 201 });
}

/** DELETE /api/field-survey/[id]/points/[pointId]/photos?photoId=... */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; pointId: string }> }
) {
  await params;
  const url = new URL(req.url);
  const photoId = url.searchParams.get('photoId');
  if (!photoId) return jsonError('PHOTO_ID_REQUIRED', 'Identifikátor fotografie je povinný.', 400);

  const auth = await requireApiAccess('fieldSurvey');
  if (isApiDenied(auth)) return auth;
  const organizationId = auth.organizationId || auth.membership?.organizationId;
  if (!organizationId) return jsonError('TENANT_REQUIRED', 'Organizace nebyla nalezena.', 400);
  enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

  let deletedPhoto: Awaited<ReturnType<typeof deleteFieldSurveyPhoto>>;
  try {
    deletedPhoto = await deleteFieldSurveyPhoto(photoId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return jsonError('NOT_FOUND', 'Fotografie nebyla nalezena.', 404);
    }
    return jsonError('DATABASE_ERROR', 'Fotografii se nepodařilo smazat.', 500);
  }

  // Smazat ze storage
  await deleteStoredPhoto({
    driveFileId: deletedPhoto.driveFileId,
    storageProvider: deletedPhoto.storageProvider,
  }).catch((err) => console.error('[field-survey/photos] Cleanup storage selhal', err));

  return NextResponse.json({ success: true, message: 'Fotografie byla smazána.' });
}
