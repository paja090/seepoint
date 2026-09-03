import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { deleteStoredPhoto, storeTenantPhoto, type StoredTenantPhoto } from '@/lib/storage/photo-storage';
import { canAccessOffer } from '@/lib/offers/domain';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const PHOTO_TYPES = new Set(['LOCATION', 'CARRIER', 'CAMPAIGN', 'INSTALLATION', 'CHECK', 'ARCHIVE', 'EMPLOYEE_PROFILE']);

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get('x-vercel-id');
  let storedFile: StoredTenantPhoto | undefined;
  let stage = 'parse-form';
  try {
    const form = await request.formData();
    const validatedPhoto = await validatePhotoFile(form.get('file'));
    const file = validatedPhoto!.file;
    let carrierId = form.get('carrierId') ? String(form.get('carrierId')) : null;
    const surfaceId = form.get('surfaceId') ? String(form.get('surfaceId')) : null;
    const employeeId = form.get('employeeId') ? String(form.get('employeeId')) : null;
    const navigationPointId = form.get('navigationPointId') ? String(form.get('navigationPointId')) : null;
    if ([carrierId, surfaceId, employeeId, navigationPointId].filter(Boolean).length === 0) {
      return NextResponse.json({ error: 'Fotografie musí patřit nosiči, ploše, navigačnímu bodu nebo zaměstnanci.' }, { status: 400 });
    }
    const targetGroups = Number(Boolean(carrierId || surfaceId)) + Number(Boolean(employeeId)) + Number(Boolean(navigationPointId));
    if (targetGroups !== 1) return NextResponse.json({ error: 'Fotografie může patřit pouze k jednomu typu cíle.' }, { status: 400 });
    stage = 'authorize';
    const auth = await requireApiAccess(employeeId ? 'employees' : navigationPointId ? 'offers' : 'carriers'); if (isApiDenied(auth)) return auth;
    const organizationId = auth.organizationId || auth.membership?.organizationId;
    if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });
    // Re-enter the verified tenant explicitly at this route boundary. In a
    // serverless bundle the context established while resolving the session
    // must not be assumed to survive across module chunks.
    enterTenantContext({ organizationId, userId: auth.id, source: 'session' });
    const limited = await enforcePhotoUploadRateLimit(request, auth); if (limited) return limited;
    if (employeeId && auth.role !== 'ADMIN') return NextResponse.json({ error: 'Fotografii zaměstnance může měnit pouze administrátor.' }, { status: 403 });
    if (surfaceId && !carrierId) {
      const surf = await prisma.advertisingSurface.findUnique({ where: { id: surfaceId }, select: { carrierId: true } });
      if (surf) carrierId = surf.carrierId;
    }
    if (navigationPointId) {
      const point = await prisma.navigationPoint.findUnique({ where: { id: navigationPointId }, select: { navigationOffer: { select: { offer: { select: { createdByUserId: true } } } } } });
      if (!point) return NextResponse.json({ error: 'Cílový navigační bod neexistuje.' }, { status: 404 });
      if (!canAccessOffer(auth, point.navigationOffer?.offer.createdByUserId ?? null)) return NextResponse.json({ error: 'K navigačnímu bodu nemáte přístup.' }, { status: 403 });
    }
    if (carrierId && !await prisma.advertisingCarrier.count({ where: { id: carrierId } })) {
      return NextResponse.json({ error: 'Cílový nosič neexistuje.' }, { status: 404 });
    }
    if (surfaceId && !await prisma.advertisingSurface.count({ where: { id: surfaceId, ...(carrierId ? { carrierId } : {}) } })) {
      return NextResponse.json({ error: 'Cílová plocha neexistuje nebo nepatří k vybranému nosiči.' }, { status: 404 });
    }
    if (navigationPointId && !await prisma.navigationPoint.count({ where: { id: navigationPointId } })) {
      return NextResponse.json({ error: 'Cílový navigační bod neexistuje.' }, { status: 404 });
    }
    if (employeeId && !await prisma.employee.count({ where: { id: employeeId } })) {
      return NextResponse.json({ error: 'Cílový zaměstnanec neexistuje.' }, { status: 404 });
    }
    const rawType = String(form.get('type') ?? (employeeId ? 'EMPLOYEE_PROFILE' : 'CARRIER'));
    if (!PHOTO_TYPES.has(rawType)) return NextResponse.json({ error: 'Neplatný typ fotografie.' }, { status: 400 });
    if (employeeId && rawType !== 'EMPLOYEE_PROFILE') return NextResponse.json({ error: 'Profilová fotografie má neplatný typ.' }, { status: 400 });
    const photoId = randomUUID(); const safeOriginalName = safePhotoFileName(file.name);
    const storedName = `${Date.now()}-${safeOriginalName}`;
    stage = 'store-file';
    const storage = await storeTenantPhoto({ organizationId, photoId, fileName: storedName, file });
    storedFile = storage;
    stage = 'create-record';
    const photo = await prisma.$transaction(async (tx) => {
      if (carrierId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingCarrier" WHERE "organizationId" = ${organizationId} AND id = ${carrierId} FOR UPDATE`;
      } else if (surfaceId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingSurface" WHERE "organizationId" = ${organizationId} AND id = ${surfaceId} FOR UPDATE`;
      } else if (navigationPointId) {
        await tx.$executeRaw`SELECT id FROM "NavigationPoint" WHERE "organizationId" = ${organizationId} AND id = ${navigationPointId} FOR UPDATE`;
      }

      const count = await tx.photo.count({
        where: {
          carrierId,
          surfaceId,
        },
      });

      const hasPrimary = await tx.photo.count({
        where: {
          carrierId,
          surfaceId,
          isPrimary: true,
        },
      });

      const isPrimary = !employeeId && hasPrimary === 0;

      const created = await tx.photo.create({
        data: {
          id: photoId,
          url: `/api/photos/${photoId}/file`,
          driveFileId: storage.driveFileId,
          storageProvider: storage.storageProvider,
          storageKey: storage.storageKey,
          contentChecksum: storage.contentChecksum,
          content: storage.storageProvider === 'DATABASE' ? Buffer.from(storage.bytes) : undefined,
          fileName: storedName,
          mimeType: validatedPhoto!.mimeType,
          size: storage.bytes.byteLength,
          type: rawType as 'LOCATION'|'CARRIER'|'CAMPAIGN'|'INSTALLATION'|'CHECK'|'ARCHIVE'|'EMPLOYEE_PROFILE',
          carrierId,
          surfaceId,
          employeeId,
          sortOrder: count,
          isPrimary,
          note: form.get('note') ? String(form.get('note')).trim().slice(0, 1000) : null,
        },
      });
      if (navigationPointId) await tx.navigationPoint.update({ where: { id: navigationPointId }, data: { sitePhotoId: created.id } });
      return created;
    });
    console.log(JSON.stringify({ level: 'info', message: 'photo-upload-complete', route: '/api/photos', requestId, stage: 'done', durationMs: Date.now() - startedAt, storageProvider: storage.storageProvider }));
    return NextResponse.json({ ...photo, storageWarning: storage.warning }, { status: 201 });
  } catch (error) {
    if (storedFile) await deleteStoredPhoto(storedFile).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error(JSON.stringify({ level: 'error', message: 'photo-upload-failed', route: '/api/photos', requestId, stage, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : 'unknown error' }));
    return NextResponse.json({ error: 'Fotografii se nepodařilo uložit.' }, { status: 502 });
  }
}
