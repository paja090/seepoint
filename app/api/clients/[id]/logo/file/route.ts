import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { downloadPhotoFromGoogleDrive } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('clients'); if (isApiDenied(auth)) return auth;
  const client = await prisma.client.findUnique({ where: { id: (await params).id }, select: { logoDriveFileId: true, logoFileName: true, logoMimeType: true } });
  if (!client?.logoDriveFileId) return NextResponse.json({ error: 'Logo nebylo nalezeno.' }, { status: 404 });
  const file = await downloadPhotoFromGoogleDrive(client.logoDriveFileId);
  if (!file.ok) return NextResponse.json({ error: 'Logo se nepodařilo načíst.' }, { status: 502 });
  return new Response(file.body, { headers: { 'Content-Type': client.logoMimeType ?? file.headers.get('Content-Type') ?? 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(client.logoFileName ?? 'logo')}`, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
