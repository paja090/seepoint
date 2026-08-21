import { NextResponse } from 'next/server';
import { getPublicPhoto } from '@/lib/offers/service';
import { offerErrorResponse } from '@/lib/offers/http';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  try {
    const { token, photoId } = await params;
    const photo = await getPublicPhoto(token, photoId) as {
      driveFileId?: string | null;
      fileName?: string | null;
      mimeType?: string | null;
      url?: string | null;
      content?: Buffer | Uint8Array | null;
    };

    // 1. Binary content stored directly in DB (Buffer)
    if (photo.content) {
      return new Response(photo.content, {
        status: 200,
        headers: {
          'Content-Type': photo.mimeType ?? 'image/jpeg',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 2. Base64 Data URL in url field
    if (photo.url && photo.url.startsWith('data:')) {
      const parts = photo.url.split(';');
      const mime = parts[0].replace('data:', '') || photo.mimeType || 'image/jpeg';
      const base64Data = parts[1].replace('base64,', '');
      const buffer = Buffer.from(base64Data, 'base64');
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 3. Google Drive file storage
    if (photo.driveFileId) {
      const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
      if (!file.ok || !file.body) {
        return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: file.status === 404 ? 404 : 502 });
      }
      return new Response(file.body, {
        headers: {
          'Content-Type': photo.mimeType ?? file.headers.get('Content-Type') ?? 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 4. External HTTP(S) URL or fallback
    if (
      photo.url &&
      (photo.url.startsWith('http://') || photo.url.startsWith('https://')) &&
      !photo.url.includes(`/api/photos/${photoId}`)
    ) {
      return NextResponse.redirect(photo.url);
    }

    return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Úložiště fotografií není dostupné.' }, { status: 503 });
    }
    return offerErrorResponse(error);
  }
}
