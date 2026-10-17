import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestActor } from '@/lib/api-auth';
import { canReadPhoto } from '@/lib/photo-access';
import { downloadFileFromGoogleDrive } from '@/lib/storage/google-drive';
import { generateWebpThumbnail, getCachedThumbnail } from '@/lib/storage/thumbnail-cache';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const THUMBNAIL_HEADERS = {
  'Content-Type': 'image/webp',
  'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await getRequestActor();
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First query lightweight metadata without pulling `content` bytea from PostgreSQL
    const photoMeta = await prisma.photo.findUnique({
      where: { id },
      select: {
        id: true,
        filePath: true,
        mimeType: true,
        organizationId: true,
        rentalId: true,
        carrierId: true,
        surfaceId: true,
        rental: {
          select: {
            organizationId: true,
            carrier: {
              select: {
                organizationId: true,
                ownerId: true,
              },
            },
          },
        },
        carrier: {
          select: {
            organizationId: true,
            ownerId: true,
          },
        },
        surface: {
          select: {
            carrier: {
              select: {
                organizationId: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!photoMeta || !canReadPhoto(actor, photoMeta)) {
      return NextResponse.json({ error: 'Fotografie nenalezena' }, { status: 404 });
    }

    const cacheKey = `photo:${photoMeta.id}`;
    const cachedThumb = getCachedThumbnail(cacheKey);
    if (cachedThumb) {
      return new NextResponse(new Uint8Array(cachedThumb), {
        status: 200,
        headers: THUMBNAIL_HEADERS,
      });
    }

    let rawBuffer: Buffer | null = null;

    if (photoMeta.filePath.startsWith('gdrive:')) {
      const fileId = photoMeta.filePath.slice('gdrive:'.length).trim();
      if (fileId) {
        const downloaded = await downloadFileFromGoogleDrive(fileId);
        rawBuffer = downloaded.buffer;
      }
    }

    if (!rawBuffer) {
      const photoContent = await prisma.photo.findUnique({
        where: { id },
        select: { content: true },
      });
      if (photoContent?.content) {
        rawBuffer = Buffer.from(photoContent.content);
      }
    }

    if (!rawBuffer) {
      return NextResponse.json({ error: 'Obsah fotografie nenalezen' }, { status: 404 });
    }

    try {
      const thumbnailBuffer = await generateWebpThumbnail(cacheKey, rawBuffer);

      return new NextResponse(new Uint8Array(thumbnailBuffer), {
        status: 200,
        headers: THUMBNAIL_HEADERS,
      });
    } catch {
      return new NextResponse(new Uint8Array(rawBuffer), {
        status: 200,
        headers: {
          'Content-Type': photoMeta.mimeType || 'image/jpeg',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }
  } catch (error) {
    console.error('Failed to serve photo thumbnail:', error);
    return NextResponse.json({ error: 'Chyba při načítání náhledu fotografie' }, { status: 500 });
  }
}
