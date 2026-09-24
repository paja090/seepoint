import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deletePhotoFromGoogleDrive, uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const limited = await enforcePhotoUploadRateLimit(request, auth);
  if (limited) return limited;
  let uploadedFileId: string | undefined;
  try {
    const id = (await params).id;
    const client = await prisma.client.findFirst({
      where: { id },
      select: { id: true, organizationId: true, companyId: true, normalizedName: true, logoDriveFileId: true },
    });
    if (!client) return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    const form = await request.formData();
    const validated = await validatePhotoFile(form.get('file'), { maxBytes: MAX_LOGO_SIZE });
    const file = validated!.file;
    const safeName = safePhotoFileName(file.name, 'client-logo.png');

    let storedId: string;
    let storedName = safeName;
    let storedMime = file.type || 'image/png';

    try {
      const stored = await uploadPhotoToGoogleDrive(file, `client-logo-${id}-${Date.now()}-${safeName}`, `client-logo-${randomUUID()}`);
      uploadedFileId = stored.id;
      storedId = stored.id;
      storedName = stored.name;
      storedMime = stored.mimeType;
    } catch {
      const bytes = Buffer.from(await file.arrayBuffer());
      storedId = `data:${storedMime};base64,${bytes.toString('base64')}`;
    }

    const now = new Date();
    await prisma.client.update({
      where: { id },
      data: { logoDriveFileId: storedId, logoFileName: storedName, logoMimeType: storedMime, logoUpdatedAt: now },
    });

    // Also synchronize logo onto any duplicate client records sharing companyId or normalizedName in the same org
    const siblingOr: Array<Record<string, unknown>> = [];
    if (client.companyId) siblingOr.push({ companyId: client.companyId });
    if (client.normalizedName) siblingOr.push({ normalizedName: client.normalizedName });
    if (siblingOr.length > 0) {
      await prisma.client.updateMany({
        where: {
          organizationId: client.organizationId,
          id: { not: id },
          OR: siblingOr,
        },
        data: { logoDriveFileId: storedId, logoFileName: storedName, logoMimeType: storedMime, logoUpdatedAt: now },
      }).catch(() => undefined);
    }

    if (client.logoDriveFileId && !client.logoDriveFileId.startsWith('data:') && client.logoDriveFileId !== storedId) {
      await deletePhotoFromGoogleDrive(client.logoDriveFileId).catch(() => undefined);
    }
    return NextResponse.json({ logoUrl: `/api/clients/${id}/logo/file?t=${now.getTime()}` });
  } catch (error) {
    if (uploadedFileId) await deletePhotoFromGoogleDrive(uploadedFileId).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Client logo upload failed', error);
    return NextResponse.json({ error: 'Logo se nepodařilo uložit.' }, { status: 502 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const id = (await params).id;
  const client = await prisma.client.findUnique({ where: { id }, select: { logoDriveFileId: true } });
  if (!client) return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
  await prisma.client.update({ where: { id }, data: { logoDriveFileId: null, logoFileName: null, logoMimeType: null, logoUpdatedAt: null } });
  if (client.logoDriveFileId && !client.logoDriveFileId.startsWith('data:')) {
    await deletePhotoFromGoogleDrive(client.logoDriveFileId).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
