import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { deletePhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const photo = await prisma.photo.findUnique({ where: { id }, select: { driveFileId: true, employeeId: true } });
    if (!photo) return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    const auth = await requireApiAccess(photo.employeeId ? 'employees' : 'carriers'); if (isApiDenied(auth)) return auth;
    if (photo.employeeId && auth.role !== 'ADMIN') return NextResponse.json({ error: 'Fotografii zaměstnance může odstranit pouze administrátor.' }, { status: 403 });

    if (photo.driveFileId) await deletePhotoFromGoogleDrive(photo.driveFileId);
    await prisma.photo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Photo delete failed', error);
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Google Drive úložiště zatím není nakonfigurované.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Fotografii se nepodařilo odstranit.' }, { status: 502 });
  }
}
