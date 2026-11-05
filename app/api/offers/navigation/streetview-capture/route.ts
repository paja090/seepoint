import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { storeTenantPhoto } from '@/lib/storage/photo-storage';
import { getGoogleMapsKeyDetails } from '@/lib/google-maps';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const auth = await requireApiAccess('offers');
    if (isApiDenied(auth)) return auth;

    const organizationId = auth.organizationId || auth.membership?.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });
    }

    enterTenantContext({ organizationId, userId: auth.id, source: 'session' });

    const body = await request.json().catch(() => ({}));
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'Chybí platné souřadnice bodu (latitude, longitude).' }, { status: 400 });
    }

    const heading = Math.round(Number(body.heading) || 0);
    const pitch = Math.round(Number(body.pitch) || 0);
    const fov = Math.max(20, Math.min(120, Math.round(Number(body.fov) || 90)));
    const pano = typeof body.pano === 'string' && body.pano.trim() ? body.pano.trim() : null;
    const navigationPointId = typeof body.navigationPointId === 'string' && body.navigationPointId.trim() ? body.navigationPointId.trim() : null;

    const keyDetails = getGoogleMapsKeyDetails();
    const apiKey =
      (typeof body.apiKey === 'string' && body.apiKey.trim()) ||
      keyDetails.key ||
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
      process.env.GOOGLE_MAPS_SERVER_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Pro stažení snímku ze Street View není nastaven Google Maps API klíč.' },
        { status: 500 }
      );
    }

    // Build Google Street View Static API request
    const staticUrl = new URL('https://maps.googleapis.com/maps/api/streetview');
    staticUrl.searchParams.set('size', '800x600');
    if (pano) {
      staticUrl.searchParams.set('pano', pano);
    } else {
      staticUrl.searchParams.set('location', `${latitude},${longitude}`);
    }
    staticUrl.searchParams.set('heading', String(heading));
    staticUrl.searchParams.set('pitch', String(pitch));
    staticUrl.searchParams.set('fov', String(fov));
    staticUrl.searchParams.set('key', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(staticUrl.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Street View API vrátilo kód ${res.status}.`, staticUrl: staticUrl.toString() },
        { status: 502 }
      );
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Google Street View neposkytlo platný obrazový formát.', staticUrl: staticUrl.toString() },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) {
      return NextResponse.json(
        { error: 'Google Street View vrátilo prázdný snímek.', staticUrl: staticUrl.toString() },
        { status: 502 }
      );
    }

    const photoId = randomUUID();
    const fileName = `streetview-${Date.now()}-${latitude.toFixed(4)}_${longitude.toFixed(4)}.jpg`;
    const file = new File([buffer], fileName, { type: 'image/jpeg' });

    // Store in tenant photo storage (Google Drive or DB fallback)
    const storage = await storeTenantPhoto({ organizationId, photoId, fileName, file });

    // Verify if point exists in database
    const pointInDb = navigationPointId
      ? await prisma.navigationPoint.findFirst({
          where: { id: navigationPointId, organizationId },
        })
      : null;

    const photoRecord = await prisma.photo.create({
      data: {
        id: photoId,
        organizationId,
        url: `/api/photos/${photoId}/file`,
        driveFileId: storage.driveFileId,
        storageProvider: storage.storageProvider,
        storageKey: storage.storageKey,
        contentChecksum: storage.contentChecksum,
        content: storage.storageProvider === 'DATABASE' ? Buffer.from(storage.bytes) : undefined,
        fileName,
        mimeType: 'image/jpeg',
        size: storage.bytes.byteLength,
        type: 'LOCATION',
        navigationPointId: pointInDb ? pointInDb.id : undefined,
        isPrimary: true,
        isClientVisible: true,
        note: `Google Street View snímek místa (azimut ${heading}°, sklon ${pitch}°)`,
      },
    });

    if (pointInDb) {
      await prisma.navigationPoint.update({
        where: { id: pointInDb.id },
        data: { sitePhotoId: photoRecord.id },
      });
    }

    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      photoId: photoRecord.id,
      url: `/api/photos/${photoId}/file`,
      dataUrl,
      fileName,
      heading,
      pitch,
      fov,
      storageWarning: storage.warning,
    });
  } catch (error) {
    console.error('Error capturing Street View screenshot:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se pořídit snímek ze Street View.' },
      { status: 500 }
    );
  }
}
