import { NextResponse } from 'next/server';
import { platformPrisma } from '@/lib/db';
import { hashToken } from '@/lib/navigation-documentation';
import { downloadPhotoFromGoogleDrive, GoogleDriveConfigurationError } from '@/lib/google-drive';
import { enterPublicNavigationReportTenant } from '@/lib/public-tenant';
import { isClientApprovedPhoto } from '@/lib/navigation-documentation-policy';
import { generateWebpThumbnail, getCachedThumbnail } from '@/lib/storage/thumbnail-cache';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  try {
    const { token, photoId } = await params;
    if (!token || token.length < 16) {
      return NextResponse.json({ error: 'Neplatný přístupový odkaz.' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const owner = await enterPublicNavigationReportTenant(tokenHash);
    if (!owner) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    const report = await platformPrisma.navigationDocumentationReport.findFirst({
      where: { id: owner.id, organizationId: owner.organizationId },
      select: {
        status: true,
        items: {
          where: { isVisible: true },
          select: {
            selectedPhotoId: true,
            navigationPoint: {
              select: {
                installedPhotoId: true,
                sitePhotoId: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report nebyl nalezen.' }, { status: 404 });
    }

    const allowedPhotoIds = new Set(
      report.items
        .flatMap((item) => [item.selectedPhotoId, item.navigationPoint?.installedPhotoId, item.navigationPoint?.sitePhotoId])
        .filter((id): id is string => Boolean(id)),
    );
    if (!allowedPhotoIds.has(photoId)) {
      return NextResponse.json({ error: 'Fotografie není dostupná.' }, { status: 404 });
    }

    const photo = await platformPrisma.photo.findFirst({
      where: { id: photoId, organizationId: owner.organizationId },
      select: {
        id: true,
        content: true,
        driveFileId: true,
        url: true,
        fileName: true,
        mimeType: true,
        isClientVisible: true,
        isPrivate: true,
      },
    });

    if (!photo || !isClientApprovedPhoto(photo)) {
      return NextResponse.json({ error: 'Fotografie není dostupná.' }, { status: 404 });
    }

    const urlObj = new URL(request.url);
    const isDownload = urlObj.searchParams.get('download') === '1';
    const isThumbnail = urlObj.searchParams.get('thumbnail') === '1';
    const cacheKey = `photo:${photoId}`;

    if (isThumbnail && !isDownload) {
      const cachedThumb = getCachedThumbnail(cacheKey);
      if (cachedThumb) {
        return new Response(new Uint8Array(cachedThumb), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    const disposition = isDownload
      ? `attachment; filename*=UTF-8''${encodeURIComponent(photo.fileName ?? `foto-${photoId}.jpg`)}`
      : 'inline';

    let rawBuffer: Buffer | null = null;
    let originalMime: string = photo.mimeType ?? 'image/jpeg';

    if (photo.content && photo.content.length > 0) {
      rawBuffer = Buffer.from(photo.content);
    } else if (photo.url && photo.url.startsWith('data:')) {
      const match = photo.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        originalMime = match[1];
        rawBuffer = Buffer.from(match[2], 'base64');
      }
    } else if (photo.driveFileId) {
      const file = await downloadPhotoFromGoogleDrive(photo.driveFileId);
      if (file.ok && file.body) {
        if (Buffer.isBuffer(file.body)) {
          rawBuffer = file.body;
        } else if (file.body instanceof ArrayBuffer) {
          rawBuffer = Buffer.from(file.body);
        } else if (file.body instanceof Uint8Array) {
          rawBuffer = Buffer.from(file.body);
        } else {
          const ab = await new Response(file.body as BodyInit).arrayBuffer();
          rawBuffer = Buffer.from(ab);
        }
        if (file.headers.get('Content-Type')) {
          originalMime = file.headers.get('Content-Type')!;
        }
      }
    }

    if (isThumbnail && !isDownload && rawBuffer) {
      try {
        const resized = await generateWebpThumbnail(cacheKey, rawBuffer);

        return new Response(new Uint8Array(resized), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch (sharpError) {
        console.warn('[client navigation photo] Sharp resize failed, falling back to original', sharpError);
      }
    }

    // Serve rawBuffer if already extracted
    if (rawBuffer) {
      return new Response(new Uint8Array(rawBuffer), {
        status: 200,
        headers: {
          'Content-Type': originalMime,
          'Content-Disposition': disposition,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // 4. External HTTP URL
    if (photo.url && photo.url.startsWith('http') && !photo.url.includes('/api/photos/')) {
      return new Response(null, { status: 307, headers: { Location: photo.url, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
    }

    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 404 });
  } catch (error) {
    if (error instanceof GoogleDriveConfigurationError) {
      return NextResponse.json({ error: 'Úložiště fotografií není dostupné.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 500 });
  }
}
