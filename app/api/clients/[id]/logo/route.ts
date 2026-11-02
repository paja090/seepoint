import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deletePhotoFromGoogleDrive, uploadPhotoToGoogleDrive } from '@/lib/google-drive';
import { PhotoValidationError, safePhotoFileName, validatePhotoFile } from '@/lib/photo-validation';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const MAX_LOGO_SIZE = 10 * 1024 * 1024;

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
    const validated = await validatePhotoFile(form.get('file'), { maxBytes: MAX_LOGO_SIZE, allowSvg: true });
    const file = validated!.file;
    const safeName = safePhotoFileName(file.name, 'client-logo.png');

    let storedId: string;
    let storedName = safeName;
    let storedMime = validated!.mimeType || file.type || 'image/png';

    try {
      const stored = await uploadPhotoToGoogleDrive(file, `client-logo-${id}-${Date.now()}-${safeName}`, `client-logo-${randomUUID()}`);
      uploadedFileId = stored.id;
      storedId = stored.id;
      storedName = stored.name;
      storedMime = stored.mimeType;
    } catch (gdriveErr) {
      console.warn(`[client-logo] Google Drive upload failed; falling back to direct base64 data URI storage for client=${id}`, gdriveErr);
      const bytes = Buffer.from(await file.arrayBuffer());
      storedId = `data:${storedMime};base64,${bytes.toString('base64')}`;
    }

    const now = new Date();
    const updatePayload = {
      logoDriveFileId: storedId,
      logoFileName: storedName,
      logoMimeType: storedMime,
      logoUpdatedAt: now,
    };

    // Ensure legacy unique B-tree index Client_logoDriveFileId_key is dropped if still present in the DB
    // (Postgres B-tree index rejects entries > 8191 bytes with error 54000 when base64 fallback is used)
    await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Client_logoDriveFileId_key"').catch(() => undefined);

    try {
      await prisma.client.update({
        where: { id },
        data: updatePayload,
      });
    } catch (updateErr: unknown) {
      const errStr = String(updateErr);
      if (errStr.includes('54000') || errStr.includes('8191') || errStr.includes('Client_logoDriveFileId_key')) {
        console.warn('[client-logo] Hit legacy index constraint during update; dropping Client_logoDriveFileId_key and retrying...', errStr);
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Client_logoDriveFileId_key"').catch(() => undefined);
        await prisma.client.update({
          where: { id },
          data: updatePayload,
        });
      } else {
        throw updateErr;
      }
    }

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
        data: updatePayload,
      }).catch(async (syncErr: unknown) => {
        const errStr = String(syncErr);
        if (errStr.includes('54000') || errStr.includes('8191') || errStr.includes('Client_logoDriveFileId_key')) {
          await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Client_logoDriveFileId_key"').catch(() => undefined);
          await prisma.client.updateMany({
            where: {
              organizationId: client.organizationId,
              id: { not: id },
              OR: siblingOr,
            },
            data: updatePayload,
          }).catch((e) => console.warn('[client-logo] Sibling sync retry failed', e));
        } else {
          console.warn('[client-logo] Sibling sync failed', syncErr);
        }
      });
    }

    if (client.logoDriveFileId && !client.logoDriveFileId.startsWith('data:') && client.logoDriveFileId !== storedId) {
      await deletePhotoFromGoogleDrive(client.logoDriveFileId).catch(() => undefined);
    }
    return NextResponse.json({ logoUrl: `/api/clients/${id}/logo/file?t=${now.getTime()}` });
  } catch (error) {
    if (uploadedFileId) await deletePhotoFromGoogleDrive(uploadedFileId).catch(() => undefined);
    if (error instanceof PhotoValidationError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error('Client logo upload failed', error);
    const detail = error instanceof Error ? error.message : 'Logo se nepodařilo uložit.';
    return NextResponse.json({ error: `Logo se nepodařilo uložit: ${detail}` }, { status: 502 });
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
