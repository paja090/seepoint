import { NextResponse } from 'next/server';
import { getPublicPhoto } from '@/lib/offers/service';
import { offerErrorResponse } from '@/lib/offers/http';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';
export const runtime = 'nodejs';
export async function GET(_: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  try {
    const { token, photoId } = await params;
    const photo = await getPublicPhoto(token, photoId);
    if (!photo.driveFileId) return NextResponse.json({ error: 'Fotografie není dostupná.' }, { status: 404 });
    const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
    if (!file.ok || !file.body) return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: file.status === 404 ? 404 : 502 });
    return new Response(file.body, { headers: { 'Content-Type': photo.mimeType ?? file.headers.get('Content-Type') ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) return NextResponse.json({ error: 'Úložiště fotografií není dostupné.' }, { status: 503 });
    return offerErrorResponse(error);
  }
}
