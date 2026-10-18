import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { canReadPhoto } from '@/lib/photo-access';
import { formatNavigationPositionName, getNavigationPhotoDownloadName } from '@/lib/navigation/navigation-naming';
import { getCachedThumbnail } from '@/lib/storage/thumbnail-cache';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  if (!user.organizationId) return NextResponse.json({ error: 'Vyberte organizaci.' }, { status: 403 });
  enterTenantContext({ organizationId: user.organizationId, userId: user.id, source: 'session' });

  try {
    const { id } = await params;
    const photo = await prisma.photo.findUnique({
      where: { id, organizationId: user.organizationId },
      select: {
        id: true,
        url: true,
        driveFileId: true,
        storageKey: true,
        storageProvider: true,
        content: true,
        fileName: true,
        mimeType: true,
        employeeId: true,
        type: true,
        workEntryId: true,
        workOrderItemId: true,
        isPrivate: true,
        carrierId: true,
        surfaceId: true,
        carrier: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            street: true,
            address: true,
            city: true,
          },
        },
        surface: {
          select: {
            id: true,
            name: true,
            mediaType: true,
            directionDescription: true,
            distanceMeters: true,
            carrier: {
              select: {
                type: true,
                code: true,
                street: true,
                address: true,
                city: true,
              },
            },
          },
        },
        siteNavigationPoints: {
          take: 1,
          select: {
            id: true,
            label: true,
            address: true,
            arrowDirection: true,
            distanceValue: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!photo || (!photo.driveFileId && !photo.content && !photo.url && !photo.storageKey)) {
      return NextResponse.json({ error: 'Fotografie nebyla nalezena.' }, { status: 404 });
    }

    if (!await canReadPhoto(user, photo)) return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });

    const stored = await readStoredPhoto(photo);
    if (!stored) {
      const cached =
        getCachedThumbnail(`photo:${photo.id}`) ||
        (photo.driveFileId ? getCachedThumbnail(`drive:${photo.driveFileId}`) : null);

      if (cached) {
        return new Response(new Uint8Array(cached), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName ? photo.fileName.replace(/\.[^.]+$/, '.webp') : 'foto.webp')}`,
            'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            'X-Photo-Fallback': 'cached-thumbnail',
          },
        });
      }
      return NextResponse.json({ error: 'Fotografie nemá platný zdroj dat.' }, { status: 404 });
    }
    if (stored.redirectUrl) return new Response(null, { status: 307, headers: {
      Location: stored.redirectUrl,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    } });

    const urlObj = new URL(request.url);
    const isDownload = urlObj.searchParams.get('download') === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';

    const ext = photo.fileName ? photo.fileName.split('.').pop() || 'jpg' : 'jpg';
    let computedFileName = photo.fileName || `foto-${photo.id}.${ext}`;

    const isNavigation =
      photo.surface?.mediaType === 'NAVIGATION_SIGN' ||
      photo.surface?.carrier?.type === 'NAVIGATION' ||
      photo.carrier?.type === 'NAVIGATION' ||
      (photo.siteNavigationPoints && photo.siteNavigationPoints.length > 0);

    if (isNavigation) {
      if (photo.surface?.name && /^P\d+/i.test(photo.surface.name)) {
        computedFileName = getNavigationPhotoDownloadName(photo.surface.name, ext);
      } else if (photo.siteNavigationPoints?.[0]?.label && /^P\d+/i.test(photo.siteNavigationPoints[0].label)) {
        computedFileName = getNavigationPhotoDownloadName(photo.siteNavigationPoints[0].label, ext);
      } else {
        const street = photo.surface?.carrier?.street || photo.carrier?.street || photo.surface?.carrier?.address || photo.carrier?.address;
        const distAndDir = photo.surface?.directionDescription || (photo.surface?.distanceMeters ? `${photo.surface.distanceMeters}m` : null);
        const nameCandidate = formatNavigationPositionName({
          positionNumber: 1,
          street,
          rawDistanceAndDirection: distAndDir,
        });
        computedFileName = getNavigationPhotoDownloadName(nameCandidate, ext);
      }
    }

    return new Response(stored.body, { status: 200, headers: {
      'Content-Type': stored.contentType ?? photo.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `${dispositionType}; filename*=UTF-8''${encodeURIComponent(computedFileName)}`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      ...(stored.isFallback ? { 'X-Photo-Fallback': 'cached-thumbnail' } : {}),
    } });
  } catch (error) {
    console.error('Photo download failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Fotografii se nepodařilo načíst.' }, { status: 502 });
  }
}
