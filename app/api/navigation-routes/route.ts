import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { computeGoogleRoute, getGoogleMapsKeyDetails } from '@/lib/google-maps';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireApiAccess(['offers', 'work']);
  if (isApiDenied(user)) return user;
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

  const { key, sourceName } = getGoogleMapsKeyDetails();
  const maskedKey = key ? `${key.slice(0, 8)}...${key.slice(-4)} (${key.length} znaků)` : null;

  // Test sample route in Ostrava
  const sampleOrigin = { latitude: 49.8355, longitude: 18.2925 };
  const sampleDestination = { latitude: 49.8282, longitude: 18.1722 };

  const reqReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;
  const result = await computeGoogleRoute(sampleOrigin, sampleDestination, 'DRIVING', reqReferer);

  return NextResponse.json({
    status: result.status,
    hasKey: Boolean(key),
    sourceVariable: sourceName || null,
    maskedKey,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
    hasPolyline: Boolean(result.polyline),
    error: result.error || null,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const user = await requireApiAccess(['offers', 'work']);
  if (isApiDenied(user)) return user;
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      originLat?: number;
      originLng?: number;
      destLat?: number;
      destLng?: number;
      origin?: { latitude: number; longitude: number };
      destination?: { latitude: number; longitude: number };
      travelMode?: 'DRIVING' | 'BICYCLING' | 'WALKING';
    };

    const fromLat = body.originLat ?? body.origin?.latitude;
    const fromLng = body.originLng ?? body.origin?.longitude;
    const toLat = body.destLat ?? body.destination?.latitude;
    const toLng = body.destLng ?? body.destination?.longitude;

    if (
      typeof fromLat !== 'number' ||
      typeof fromLng !== 'number' ||
      typeof toLat !== 'number' ||
      typeof toLng !== 'number' ||
      !Number.isFinite(fromLat) ||
      !Number.isFinite(fromLng) ||
      !Number.isFinite(toLat) ||
      !Number.isFinite(toLng)
    ) {
      return NextResponse.json(
        { status: 'FAILED', error: 'Zadejte platné souřadnice výchozího bodu a cíle.' },
        { status: 400 }
      );
    }

    const reqReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;
    const result = await computeGoogleRoute(
      { latitude: fromLat, longitude: fromLng },
      { latitude: toLat, longitude: toLng },
      body.travelMode || 'DRIVING',
      reqReferer
    );

    return NextResponse.json({
      status: result.status,
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      polyline: result.polyline || null,
      error: result.error || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chyba při výpočtu trasy';
    return NextResponse.json({ status: 'FAILED', error: msg }, { status: 500 });
  }
}
