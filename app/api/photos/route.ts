import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { requireTenantContext } from '@/lib/tenant-context';
import { deleteStoredPhoto, storeTenantPhoto, type StoredTenantPhoto } from '@/lib/storage/photo-storage';
import { canAccessOffer } from '@/lib/offers/domain';

export const runtime = 'nodejs';
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_TYPES = new Set(['LOCATION', 'CARRIER', 'CAMPAIGN', 'INSTALLATION', 'CHECK', 'ARCHIVE', 'EMPLOYEE_PROFILE']);

export async function POST(request: Request) {
  let storedFile: StoredTenantPhoto | undefined;
  try {
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Fotografie je povinná.' }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: 'Povolené formáty jsou JPEG, PNG a WebP.' }, { status: 415 });
    if (file.size === 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Fotografie musí mít nejvýše 4 MB.' }, { status: 413 });
    let carrierId = form.get('carrierId') ? String(form.get('carrierId')) : null;
    const surfaceId = form.get('surfaceId') ? String(form.get('surfaceId')) : null;
    const employeeId = form.get('employeeId') ? String(form.get('employeeId')) : null;
    const navigationPointId = form.get('navigationPointId') ? String(form.get('navigationPointId')) : null;
    if ([carrierId, surfaceId, employeeId, navigationPointId].filter(Boolean).length === 0) {
      return NextResponse.json({ error: 'Fotografie musí patřit nosiči, ploše, navigačnímu bodu nebo zaměstnanci.' }, { status: 400 });
    }
    if (surfaceId && !carrierId) {
      const surf = await prisma.advertisingSurface.findUnique({ where: { id: surfaceId }, select: { carrierId: true } });
      if (surf) carrierId = surf.carrierId;
    }
    const auth = await requireApiAccess(employeeId ? 'employees' : navigationPointId ? 'offers' : 'carriers'); if (isApiDenied(auth)) return auth;
    if (employeeId && auth.role !== 'ADMIN') return NextResponse.json({ error: 'Fotografii zaměstnance může měnit pouze administrátor.' }, { status: 403 });
    if (navigationPointId) {
      const point = await prisma.navigationPoint.findUnique({ where: { id: navigationPointId }, select: { navigationOffer: { select: { offer: { select: { createdByUserId: true } } } } } });
      if (!point) return NextResponse.json({ error: 'Cílový navigační bod neexistuje.' }, { status: 404 });
      if (!canAccessOffer(auth, point.navigationOffer?.offer.createdByUserId ?? null)) return NextResponse.json({ error: 'K navigačnímu bodu nemáte přístup.' }, { status: 403 });
    }
    const targetExists = carrierId ? await prisma.advertisingCarrier.count({ where: { id: carrierId } }) : surfaceId ? await prisma.advertisingSurface.count({ where: { id: surfaceId } }) : navigationPointId ? await prisma.navigationPoint.count({ where: { id: navigationPointId } }) : await prisma.employee.count({ where: { id: employeeId! } });
    if (!targetExists) return NextResponse.json({ error: 'Cílový záznam neexistuje.' }, { status: 404 });
    const rawType = String(form.get('type') ?? (employeeId ? 'EMPLOYEE_PROFILE' : 'CARRIER'));
    if (!PHOTO_TYPES.has(rawType)) return NextResponse.json({ error: 'Neplatný typ fotografie.' }, { status: 400 });
    if (employeeId && rawType !== 'EMPLOYEE_PROFILE') return NextResponse.json({ error: 'Profilová fotografie má neplatný typ.' }, { status: 400 });
    const photoId = randomUUID(); const safeOriginalName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-120) || 'photo';
    const storedName = `${Date.now()}-${safeOriginalName}`;
    const storage = await storeTenantPhoto({ organizationId: requireTenantContext().organizationId, photoId, fileName: storedName, file });
    storedFile = storage;
    const photo = await prisma.$transaction(async (tx) => {
      if (carrierId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingCarrier" WHERE "organizationId" = ${requireTenantContext().organizationId} AND id = ${carrierId} FOR UPDATE`;
      } else if (surfaceId) {
        await tx.$executeRaw`SELECT id FROM "AdvertisingSurface" WHERE "organizationId" = ${requireTenantContext().organizationId} AND id = ${surfaceId} FOR UPDATE`;
      } else if (navigationPointId) {
        await tx.$executeRaw`SELECT id FROM "NavigationPoint" WHERE "organizationId" = ${requireTenantContext().organizationId} AND id = ${navigationPointId} FOR UPDATE`;
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
          mimeType: file.type,
          size: storage.bytes.byteLength,
          type: rawType as 'LOCATION'|'CARRIER'|'CAMPAIGN'|'INSTALLATION'|'CHECK'|'ARCHIVE'|'EMPLOYEE_PROFILE',
          carrierId,
          surfaceId,
          employeeId,
          sortOrder: count,
          isPrimary,
          note: form.get('note') ? String(form.get('note')) : null,
        },
      });
      if (navigationPointId) await tx.navigationPoint.update({ where: { id: navigationPointId }, data: { sitePhotoId: created.id } });
      return created;
    });
    return NextResponse.json({ ...photo, storageWarning: storage.warning }, { status: 201 });
  } catch (error) {
    if (storedFile) await deleteStoredPhoto(storedFile).catch(() => undefined);
    console.error('Photo upload failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Fotografii se nepodařilo uložit.' }, { status: 502 });
  }
}
