import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deletePhotoFromGoogleDrive, GoogleDriveConfigurationError, uploadPhotoToGoogleDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_TYPES = new Set(['LOCATION', 'CARRIER', 'CAMPAIGN', 'INSTALLATION', 'CHECK', 'ARCHIVE', 'EMPLOYEE_PROFILE']);

export async function POST(request: Request) {
  let driveFileId: string | undefined;
  try {
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Fotografie je povinná.' }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: 'Povolené formáty jsou JPEG, PNG a WebP.' }, { status: 415 });
    if (file.size === 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Fotografie musí mít nejvýše 4 MB.' }, { status: 413 });
    const carrierId = form.get('carrierId') ? String(form.get('carrierId')) : null;
    const surfaceId = form.get('surfaceId') ? String(form.get('surfaceId')) : null;
    const employeeId = form.get('employeeId') ? String(form.get('employeeId')) : null;
    if ([carrierId, surfaceId, employeeId].filter(Boolean).length !== 1) return NextResponse.json({ error: 'Fotografie musí patřit právě jednomu nosiči, ploše nebo zaměstnanci.' }, { status: 400 });
    const auth = await requireApiAccess(employeeId ? 'employees' : 'carriers'); if (isApiDenied(auth)) return auth;
    if (employeeId && auth.role !== 'ADMIN') return NextResponse.json({ error: 'Fotografii zaměstnance může měnit pouze administrátor.' }, { status: 403 });
    const targetExists = carrierId ? await prisma.advertisingCarrier.count({ where: { id: carrierId } }) : surfaceId ? await prisma.advertisingSurface.count({ where: { id: surfaceId } }) : await prisma.employee.count({ where: { id: employeeId! } });
    if (!targetExists) return NextResponse.json({ error: 'Cílový záznam neexistuje.' }, { status: 404 });
    const rawType = String(form.get('type') ?? (employeeId ? 'EMPLOYEE_PROFILE' : 'CARRIER'));
    if (!PHOTO_TYPES.has(rawType)) return NextResponse.json({ error: 'Neplatný typ fotografie.' }, { status: 400 });
    if (employeeId && rawType !== 'EMPLOYEE_PROFILE') return NextResponse.json({ error: 'Profilová fotografie má neplatný typ.' }, { status: 400 });
    const photoId = randomUUID(); const safeOriginalName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-120) || 'photo';
    const storedFile = await uploadPhotoToGoogleDrive(file, `${Date.now()}-${safeOriginalName}`, photoId); driveFileId = storedFile.id;
    const photo = await prisma.photo.create({ data: { id: photoId, url: `/api/photos/${photoId}/file`, driveFileId: storedFile.id, fileName: storedFile.name, mimeType: storedFile.mimeType, size: storedFile.size, type: rawType as 'LOCATION'|'CARRIER'|'CAMPAIGN'|'INSTALLATION'|'CHECK'|'ARCHIVE'|'EMPLOYEE_PROFILE', carrierId, surfaceId, employeeId, note: form.get('note') ? String(form.get('note')) : null } });
    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    if (driveFileId) await deletePhotoFromGoogleDrive(driveFileId).catch(() => undefined);
    console.error('Photo upload failed', error instanceof Error ? error.message : 'unknown error');
    if (error instanceof GoogleDriveConfigurationError) return NextResponse.json({ error: 'Google Drive úložiště zatím není nakonfigurované.' }, { status: 503 });
    return NextResponse.json({ error: 'Fotografii se nepodařilo uložit.' }, { status: 502 });
  }
}
