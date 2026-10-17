import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePublicCampaignPortalToken } from '@/lib/election-removal/client-portal';
import { downloadFileFromGoogleDrive } from '@/lib/storage/google-drive';
import { generateWebpThumbnail, getCachedThumbnail } from '@/lib/storage/thumbnail-cache';

type RouteContext = {
  params: Promise<{ token: string; photoId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token, photoId } = await context.params;
    const url = new URL(request.url);
    const isThumbnail = url.searchParams.get('thumbnail') === '1';

    const resolved = await resolvePublicCampaignPortalToken(token);
    if (!resolved) {
      return NextResponse.json({ error: 'Neplatný nebo expirovaný odkaz.' }, { status: 404 });
    }

    const link = await prisma.electionPointPhoto.findFirst({
      where: {
        photoId,
        point: {
          campaignId: resolved.campaignId,
        },
      },
      select: {
        photoId: true,
        point: {
          select: {
            clientName: true,
            layerName: true,
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json({ error: 'Fotografie nenalezena v tomto albu.' }, { status: 404 });
    }

    if (resolved.clientFilter) {
      const normalizedFilter = resolved.clientFilter.trim().toLocaleLowerCase('cs');
      const pClient = (link.point.clientName || link.point.layerName || '').trim().toLocaleLowerCase('cs');
      if (pClient !== normalizedFilter) {
        return NextResponse.json({ error: 'Fotografie nepatří do klientského filtru.' }, { status: 403 });
      }
    }

    const cacheKey = `photo:${photoId}`;
    if (isThumbnail) {
      const cachedThumb = getCachedThumbnail(cacheKey);
      if (cachedThumb) {
        return new NextResponse(new Uint8Array(cachedThumb), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        fileName: true,
        filePath: true,
        mimeType: true,
        content: true,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Fotografie nenalezena.' }, { status: 404 });
    }

    let rawBuffer: Buffer | null = null;
    let mimeType = photo.mimeType || 'image/jpeg';

    if (photo.filePath.startsWith('gdrive:')) {
      const fileId = photo.filePath.slice('gdrive:'.length).trim();
      if (fileId) {
        const downloaded = await downloadFileFromGoogleDrive(fileId);
        rawBuffer = downloaded.buffer;
        mimeType = downloaded.mimeType || mimeType;
      }
    }

    if (!rawBuffer && photo.content) {
      rawBuffer = Buffer.from(photo.content);
    }

    if (!rawBuffer) {
      return NextResponse.json({ error: 'Obsah fotografie nenalezen.' }, { status: 404 });
    }

    if (isThumbnail) {
      try {
        const thumbBuffer = await generateWebpThumbnail(cacheKey, rawBuffer);

        return new NextResponse(new Uint8Array(thumbBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      } catch {
        // Fallback to original image if sharp resize fails
      }
    }

    return new NextResponse(new Uint8Array(rawBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(photo.fileName)}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Failed to serve public campaign photo:', error);
    return NextResponse.json({ error: 'Chyba při načítání fotografie.' }, { status: 500 });
  }
}
