import { NextResponse } from 'next/server';
import { getPublicPhoto } from '@/lib/offers/service';
import { offerErrorResponse } from '@/lib/offers/http';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { GoogleDriveConfigurationError } from '@/lib/google-drive';
import sharp from 'sharp';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
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

    const urlObj = new URL(request.url);
    const isThumbnail = urlObj.searchParams.get('thumbnail') === '1';

    if (isThumbnail) {
      let inputBuffer: Buffer | null = null;
      if (stored.body) {
        if (Buffer.isBuffer(stored.body)) {
          inputBuffer = stored.body;
        } else if (stored.body instanceof ArrayBuffer) {
          inputBuffer = Buffer.from(stored.body);
        } else if (stored.body instanceof Uint8Array) {
          inputBuffer = Buffer.from(stored.body);
        } else {
          const ab = await new Response(stored.body as BodyInit).arrayBuffer();
          inputBuffer = Buffer.from(ab);
        }
      } else if (stored.redirectUrl) {
        try {
          const remoteRes = await fetch(stored.redirectUrl, { cache: 'no-store' });
          if (remoteRes.ok) {
            inputBuffer = Buffer.from(await remoteRes.arrayBuffer());
          }
        } catch (fetchErr) {
          console.warn('[proposals/photos] Remote fetch for thumbnail failed', fetchErr);
        }
      }

      if (inputBuffer) {
        try {
          const resized = await sharp(inputBuffer)
            .rotate()
            .resize({
              width: 600,
              height: 600,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: 80 })
            .toBuffer();

          return new Response(new Uint8Array(resized), {
            status: 200,
            headers: {
              'Content-Type': 'image/webp',
              'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        } catch (sharpErr) {
          console.warn('[proposals/photos] Sharp resize failed, falling back to original', sharpErr);
        }
      }
    }

    if (stored.redirectUrl) {
      return new Response(null, { status: 307, headers: {
        Location: stored.redirectUrl,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      } });
    }

    return new Response(stored.body, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType ?? photo.mimeType ?? 'image/jpeg',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? 'photo')}`,
        'Cache-Control': 'private, no-store',
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
