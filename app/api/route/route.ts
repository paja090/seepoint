import { NextResponse } from 'next/server';
import { computeGoogleRoute } from '@/lib/google-maps';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
