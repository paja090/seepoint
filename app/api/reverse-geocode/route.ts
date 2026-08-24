import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiAccess('navigationProjects');
  if (isApiDenied(auth)) return auth;

  const url = new URL(request.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');

  const lat = latStr ? parseFloat(latStr) : null;
  const lng = lngStr ? parseFloat(lngStr) : null;

  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Zadejte platné GPS souřadnice (lat, lng).' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SeePOINT-internal/1.0',
          'Accept-Language': 'cs,en',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      throw new Error(`Nominatim reverse geocode HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        pedestrian?: string;
        street?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        suburb?: string;
        city_district?: string;
        postcode?: string;
        county?: string;
        state?: string;
      };
    };

    const addr = data.address || {};
    const street = addr.road || addr.pedestrian || addr.street || addr.suburb || '';
    const houseNumber = addr.house_number || '';
    const streetWithNumber = [street, houseNumber].filter(Boolean).join(' ');
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.county || 'Praha';
    const postalCode = addr.postcode || '';
    const locality = addr.suburb || addr.city_district || '';

    return NextResponse.json({
      success: true,
      city,
      street: streetWithNumber || street,
      locality,
      postalCode,
      displayName: data.display_name || '',
    });
  } catch (error) {
    console.error('[api/reverse-geocode]', error);
    return NextResponse.json({
      success: false,
      city: 'Praha',
      street: '',
      locality: '',
      postalCode: '',
      displayName: '',
      error: 'Nepodařilo se automaticky převést souřadnice na adresu.',
    });
  }
}
