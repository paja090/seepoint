import { NextResponse } from 'next/server';
import { getPublicPhoto } from '@/lib/offers/service';
import { offerErrorResponse } from '@/lib/offers/http';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { GoogleDriveConfigurationError } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  try {
    const { token, photoId } = await params;
    const photo = await getPublicPhoto(token, photoId);

    const stored = await readStoredPhoto({
      id: photo.id,
      url: photo.url || '',
      content: photo.content,
      driveFileId: photo.driveFileId,
      mimeType: photo.mimeType,
      storageKey: photo.storageKey,
      storageProvider: photo.storageProvider,
    });

    if (!stored) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    if (stored.redirectUrl) {
      return NextResponse.redirect(stored.redirectUrl);
    }

    return new Response(stored.body, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType ?? photo.mimeType ?? 'image/jpeg',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Úložiště fotografií není dostupné.' }, { status: 503 });
    }
    return offerErrorResponse(error);
  }
}
