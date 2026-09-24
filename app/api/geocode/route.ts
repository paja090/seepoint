import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { reverseGeocode } from '@/lib/google-maps';

export async function GET(request: Request) {
  const auth = await requireApiAccess('offers'); if (isApiDenied(auth)) return auth;
  const url = new URL(request.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');
  if (latStr && lngStr) {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        const result = await reverseGeocode(lat, lng);
        if (result) {
          return NextResponse.json({ latitude: result.latitude, longitude: result.longitude, address: result.formattedAddress });
        }
        return NextResponse.json({ latitude: lat, longitude: lng, address: null });
      } catch {
        return NextResponse.json({ latitude: lat, longitude: lng, address: null });
      }
    }
  }

  const query = url.searchParams.get('q')?.trim();
  if (!query || query.length < 3) return NextResponse.json({ error: 'Zadejte přesnější adresu.' }, { status: 400 });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=cz&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'SeePOINT-internal/1.0' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Geocoding failed');
    const rows = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;
    return NextResponse.json(rows.map((row) => ({ latitude: Number(row.lat), longitude: Number(row.lon), label: row.display_name })));
  } catch { return NextResponse.json({ error: 'Adresu se nepodařilo vyhledat. Bod můžete označit ručně v mapě.' }, { status: 502 }); }
}
