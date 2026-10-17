import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyNavigationClientPortalToken } from '@/lib/navigation-maintenance/client-portal';
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

    const verified = verifyNavigationClientPortalToken(token);
    if (!verified) {
      return NextResponse.json({ error: 'Neplatný nebo expirovaný odkaz.' }, { status: 404 });
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
        organizationId: true,
        carrierId: true,
        surface: {
          select: {
            carrierId: true,
          },
        },
        rental: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Fotografie nenalezena.' }, { status: 404 });
    }

    const report = await prisma.navigationInspectionReport.findFirst({
      where: {
        id: verified.reportId,
        organizationId: verified.organizationId,
      },
      select: {
        id: true,
        carrierId: true,
        photoUrl: true,
        secondPhotoUrl: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Kontrola nenalezena.' }, { status: 404 });
    }

    const belongsToReport =
      report.photoUrl?.includes(photo.id) ||
      report.secondPhotoUrl?.includes(photo.id) ||
      photo.carrierId === report.carrierId ||
      photo.surface?.carrierId === report.carrierId ||
      photo.rental?.carrierId === report.carrierId;

    if (!belongsToReport) {
      return NextResponse.json({ error: 'Fotografie nepatří k této kontrole.' }, { status: 403 });
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
    console.error('Failed to serve navigation portal photo:', error);
    return NextResponse.json({ error: 'Chyba při načítání fotografie.' }, { status: 500 });
  }
}
