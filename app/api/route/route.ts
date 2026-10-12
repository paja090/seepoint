import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { computeGoogleRoute, getGoogleMapsKeyDetails } from '@/lib/google-maps';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireApiAccess('work', 'workRoute');
  if (isApiDenied(user)) return user;
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });

  const { key, sourceName } = getGoogleMapsKeyDetails();
  const maskedKey = key ? `${key.slice(0, 8)}...${key.slice(-4)} (${key.length} znaků)` : null;

  // Testovací úsek v Ostravě (Nádražní -> Poruba)
  const sampleOrigin = { latitude: 49.8355, longitude: 18.2925 };
  const sampleDestination = { latitude: 49.8282, longitude: 18.1722 };

  const reqReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;
  const result = await computeGoogleRoute(sampleOrigin, sampleDestination, 'DRIVING', reqReferer);

  return NextResponse.json({
    hasKey: Boolean(key),
    sourceVariable: sourceName || null,
    maskedKey,
    routeStatus: result.status,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
    hasPolyline: Boolean(result.polyline),
    error: result.error || null,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const user=await requireApiAccess('work', 'workRoute');if(isApiDenied(user))return user;
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  try {
    const body = (await request.json()) as {
      origin?: { latitude: number; longitude: number };
      destination?: { latitude: number; longitude: number };
      travelMode?: 'DRIVING' | 'BICYCLING' | 'WALKING';
    };

    if (!body.origin || !body.destination) {
      return NextResponse.json({ error: 'Origin and destination coordinates are required.' }, { status: 400 });
    }

    const reqReferer = request.headers.get('referer') || request.headers.get('origin') || undefined;
    const result = await computeGoogleRoute(body.origin, body.destination, body.travelMode || 'DRIVING', reqReferer);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Route calculation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
