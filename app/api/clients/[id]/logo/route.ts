import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deletePhotoFromGoogleDrive, GoogleDriveConfigurationError, uploadPhotoToGoogleDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';
const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  let uploadedFileId: string | undefined;
  try {
    const id = (await params).id;
    const client = await prisma.client.findFirst({ where: { id, active: true }, select: { id: true, logoDriveFileId: true } });
    if (!client) return NextResponse.json({ error: 'Klient nebyl nalezen.' }, { status: 404 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Logo je povinné.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Logo musí být PNG, JPEG nebo WebP.' }, { status: 415 });
    if (!file.size || file.size > MAX_LOGO_SIZE) return NextResponse.json({ error: 'Logo musí mít nejvýše 2 MB.' }, { status: 413 });
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100) || 'client-logo';
    const stored = await uploadPhotoToGoogleDrive(file, `client-logo-${id}-${Date.now()}-${safeName}`, `client-logo-${randomUUID()}`);
    uploadedFileId = stored.id;
    await prisma.client.update({ where: { id }, data: { logoDriveFileId: stored.id, logoFileName: stored.name, logoMimeType: stored.mimeType, logoUpdatedAt: new Date() } });
    if (client.logoDriveFileId && client.logoDriveFileId !== stored.id) await deletePhotoFromGoogleDrive(client.logoDriveFileId).catch(() => undefined);
    return NextResponse.json({ logoUrl: `/api/clients/${id}/logo/file` });
  } catch (error) {
    if (uploadedFileId) await deletePhotoFromGoogleDrive(uploadedFileId).catch(() => undefined);
    if (error instanceof GoogleDriveConfigurationError) return NextResponse.json({ error: 'Google Drive úložiště není nakonfigurované.' }, { status: 503 });
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
  if (client.logoDriveFileId) await deletePhotoFromGoogleDrive(client.logoDriveFileId).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
