import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { extractFromPhotoList } from '@/lib/navigation-photo-ocr';
import { getGeminiApiKey, extractNavigationFromPhotoWithGemini } from '@/lib/ai-gemini';
import { readStoredPhoto } from '@/lib/storage/photo-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadPhotoDataUrl(photo: {
  id: string;
  url: string;
  content: Uint8Array | null;
  driveFileId: string | null;
  mimeType: string | null;
  storageKey?: string | null;
  storageProvider?: string | null;
}): Promise<string | null> {
  try {
    const mimeType = photo.mimeType || 'image/jpeg';
    if (photo.content && photo.content.byteLength > 0) {
      return `data:${mimeType};base64,${Buffer.from(photo.content).toString('base64')}`;
    }

    if (photo.url && photo.url.startsWith('data:')) {
      return photo.url;
    }

    const stored = await readStoredPhoto(photo);
    if (stored?.body) {
      const response = new Response(stored.body);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${stored.contentType || mimeType};base64,${base64}`;
    }

    if (stored?.redirectUrl) {
      const res = await fetch(stored.redirectUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const ct = res.headers.get('content-type') || mimeType;
        return `data:${ct};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
      }
    }

    if (photo.url && /^https?:\/\//.test(photo.url)) {
      const res = await fetch(photo.url);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const ct = res.headers.get('content-type') || mimeType;
        return `data:${ct};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
      }
    }

    return null;
  } catch (err) {
    console.warn('Failed to load photo bytes for AI:', err);
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const surface = await prisma.advertisingSurface.findUnique({
      where: { id },
      include: {
        photos: true,
        carrier: {
          include: {
            photos: true,
          },
        },
      },
    });

    if (!surface) {
      return NextResponse.json({ error: 'Navigační pozice nebyla nalezena.' }, { status: 404 });
    }

    // 1. If Gemini Vision is configured, attempt real OCR on actual photo images
    if (getGeminiApiKey()) {
      const allPhotos = [
        ...surface.photos,
        ...surface.carrier.photos,
      ].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      for (const photo of allPhotos.slice(0, 3)) {
        const dataUrl = await loadPhotoDataUrl(photo);
        if (!dataUrl) continue;

        const aiExtracted = await extractNavigationFromPhotoWithGemini({
          imageBase64OrUrl: dataUrl,
          organizationId: surface.organizationId,
          photoId: photo.id,
        });

        if (aiExtracted && (aiExtracted.destinationName || aiExtracted.directionDescription || aiExtracted.distanceMeters)) {
          return NextResponse.json({
            found: true,
            extracted: aiExtracted,
            source: 'AI_VISION',
          });
        }
      }
    }

    // 2. Fallback to existing text/metadata regex matching
    const photos = [
      ...surface.photos,
      ...surface.carrier.photos,
    ].map((p) => ({
      url: p.url,
      note: p.note ?? undefined,
      filename: p.fileName ?? p.url.split('/').pop(),
    }));

    const extraTextSources = [
      surface.directionDescription,
      surface.name,
      surface.rawMediaType,
      surface.note,
      surface.carrier.note,
      surface.carrier.description,
      surface.carrier.placementDescription,
    ].filter((t): t is string => Boolean(t?.trim()));

    const result = extractFromPhotoList(photos, extraTextSources);

    if (!result) {
      return NextResponse.json({
        found: false,
        message: 'Z fotek ani popisů nosiče se nepodařilo automaticky rozpoznat cíl, směr ani vzdálenost.',
      });
    }

    return NextResponse.json({
      found: true,
      extracted: result,
      source: 'METADATA',
    });
  } catch (err) {
    console.error('Extraction error:', err);
    return NextResponse.json({ error: 'Chyba při rozpoznávání fotek.' }, { status: 500 });
  }
}
