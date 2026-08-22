import crypto from 'crypto';

export type RouteComputeResult = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  status: 'OK' | 'NOT_FOUND' | 'FAILED';
  error?: string;
};

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const query = address.trim();
  if (!query) return null;

  if (apiKey) try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'cs');
    url.searchParams.set('region', 'cz');
    const response = await fetch(url, {
      headers: { Referer: process.env.APP_URL || 'https://seepoint.vercel.app/' },
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json() as {
        status?: string;
        results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }>;
      };
      const first = data.status === 'OK' ? data.results?.[0] : undefined;
      const latitude = first?.geometry?.location?.lat;
      const longitude = first?.geometry?.location?.lng;
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude: latitude!, longitude: longitude!, formattedAddress: first?.formatted_address || query };
      }
    }
  } catch { /* Fall through to the existing OpenStreetMap geocoder. */ }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'cz');
    url.searchParams.set('q', query);
    const response = await fetch(url, { headers: { 'User-Agent': 'SeePOINT-internal/1.0' }, cache: 'no-store' });
    if (!response.ok) return null;
    const rows = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = rows[0];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude, formattedAddress: first?.display_name || query };
  } catch { return null; }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey) try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'cs');
    url.searchParams.set('region', 'cz');
    const response = await fetch(url, {
      headers: { Referer: process.env.APP_URL || 'https://seepoint.vercel.app/' },
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json() as {
        status?: string;
        results?: Array<{ formatted_address?: string }>;
      };
      const first = data.status === 'OK' ? data.results?.[0] : undefined;
      if (first?.formatted_address) {
        return { latitude, longitude, formattedAddress: first.formatted_address };
      }
    }
  } catch { /* Fallback */ }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    const response = await fetch(url, { headers: { 'User-Agent': 'SeePOINT-internal/1.0' }, cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json() as { display_name?: string };
    if (data.display_name) {
      return { latitude, longitude, formattedAddress: data.display_name };
    }
  } catch { return null; }

  return null;
}

/**
 * Computes route driving distance and polyline using Google Routes API (New).
 * Only called on point creation, drag end, or explicit recalculation request.
 */
export async function computeGoogleRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  travelMode: 'DRIVING' | 'BICYCLING' | 'WALKING' = 'DRIVING',
  requestReferer?: string
): Promise<RouteComputeResult> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      distanceMeters: 0,
      durationSeconds: 0,
      polyline: '',
      status: 'FAILED',
      error: 'Google Maps API key is missing in environment variables.',
    };
  }

  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: {
        location: {
          latLng: { latitude: origin.latitude, longitude: origin.longitude },
        },
      },
      destination: {
        location: {
          latLng: { latitude: destination.latitude, longitude: destination.longitude },
        },
      },
      travelMode: travelMode,
      routingPreference: 'TRAFFIC_UNAWARE',
      polylineQuality: 'OVERVIEW',
    };

    const referer = requestReferer || process.env.APP_URL || 'https://seepoint.vercel.app/';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
        'Referer': referer,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: '',
        status: 'FAILED',
        error: `Routes API returned ${res.status}: ${errText}`,
      };
    }

    const data = await res.json();
    const route = data.routes?.[0];

    if (!route) {
      return {
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: '',
        status: 'NOT_FOUND',
        error: 'No route found between coordinates.',
      };
    }

    const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);

    return {
      distanceMeters: route.distanceMeters || 0,
      durationSeconds,
      polyline: route.polyline?.encodedPolyline || '',
      status: 'OK',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown Routes API error';
    return {
      distanceMeters: 0,
      durationSeconds: 0,
      polyline: '',
      status: 'FAILED',
      error: msg,
    };
  }
}

/**
 * Generates a signed Google Static Maps API URL for PDF generation.
 * Never exposes server key or secret to the client.
 */
export function getSignedStaticMapUrl(params: {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  size?: string; // e.g. "600x400"
  markers?: Array<{ lat: number; lng: number; color?: string; label?: string }>;
  polyline?: string;
}): string {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const signingSecret = process.env.GOOGLE_MAPS_URL_SIGNING_SECRET;

  if (!apiKey) {
    return '';
  }

  const mapSize = params.size || '600x350';
  let pathAndQuery = `/maps/api/staticmap?size=${mapSize}&maptype=roadmap&key=${apiKey}`;

  if (params.centerLat && params.centerLng) {
    pathAndQuery += `&center=${params.centerLat},${params.centerLng}&zoom=${params.zoom || 14}`;
  }

  if (params.markers && params.markers.length > 0) {
    params.markers.forEach((m) => {
      const color = m.color || 'blue';
      const label = m.label ? `|label:${m.label}` : '';
      pathAndQuery += `&markers=color:${color}${label}|${m.lat},${m.lng}`;
    });
  }

  if (params.polyline) {
    pathAndQuery += `&path=color:0x0284c7ff|weight:4|enc:${encodeURIComponent(params.polyline)}`;
  }

  const fullUrl = `https://maps.googleapis.com${pathAndQuery}`;

  if (!signingSecret) {
    return fullUrl; // Return unsigned if secret is not set
  }

  try {
    const secretKey = Buffer.from(signingSecret.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const signature = crypto.createHmac('sha1', secretKey).update(pathAndQuery).digest('base64');
    const safeSignature = signature.replace(/\+/g, '-').replace(/\//g, '_');
    return `${fullUrl}&signature=${safeSignature}`;
  } catch {
    return fullUrl;
  }
}
