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

function cleanEnvValue(val?: string): string | undefined {
  if (!val) return undefined;
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || undefined;
}

export function getGoogleMapsKeyDetails(): { key: string | undefined; sourceName: string | undefined } {
  const candidates = [
    'GOOGLE_MAPS_SERVER_API_KEY',
    'GOOGLE_MAPS_SERVER_KEY',
    'GOOGLE_MAPS_API_KEY',
    'GOOGLE_ROUTES_API_KEY',
    'GOOGLE_API_KEY',
    'MAPS_API_KEY',
    'GOOGLE_MAPS',
    'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY',
    'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY',
    'NEXT_PUBLIC_GOOGLE_MAPS_KEY',
  ];
  for (const name of candidates) {
    const val = cleanEnvValue(process.env[name]);
    if (val) return { key: val, sourceName: name };
  }
  return { key: undefined, sourceName: undefined };
}

/**
 * Resolves the Google Maps API key on the server side:
 * Checks server keys, alternative names, and browser key fallbacks.
 */
export function getGoogleMapsServerApiKey(): string | undefined {
  return getGoogleMapsKeyDetails().key;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const apiKey = getGoogleMapsServerApiKey();
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
  const apiKey = getGoogleMapsServerApiKey();

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

function toGoogleRoutesTravelMode(mode?: string): 'DRIVE' | 'BICYCLE' | 'WALK' | 'TWO_WHEELER' {
  switch (mode?.toUpperCase()) {
    case 'BICYCLING':
    case 'BICYCLE':
      return 'BICYCLE';
    case 'WALKING':
    case 'WALK':
      return 'WALK';
    case 'TWO_WHEELER':
      return 'TWO_WHEELER';
    case 'DRIVING':
    case 'DRIVE':
    default:
      return 'DRIVE';
  }
}

async function fetchOsrmRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  travelMode: string = 'DRIVING'
): Promise<RouteComputeResult | null> {
  try {
    const mode = travelMode.toUpperCase();
    const profile =
      mode === 'WALK' || mode === 'WALKING'
        ? 'foot'
        : mode === 'BICYCLE' || mode === 'BICYCLING'
        ? 'bike'
        : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SeePOINT-internal/1.0' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: string;
      }>;
    };
    if (data.code === 'Ok' && data.routes?.[0]) {
      const first = data.routes[0];
      const rawDistance = first.distance || 0;
      const distanceMeters = rawDistance > 0 ? Math.max(50, Math.round(rawDistance / 50) * 50) : 0;
      const durationSeconds = Math.round(first.duration || 0);
      return {
        distanceMeters,
        durationSeconds,
        polyline: first.geometry || '',
        status: 'OK',
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Computes route driving distance and polyline using Google Routes API (New).
 * Falls back to OpenStreetMap OSRM if Google Maps API key is missing or encounters errors.
 */
export async function computeGoogleRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  travelMode: 'DRIVING' | 'BICYCLING' | 'WALKING' | string = 'DRIVING',
  requestReferer?: string
): Promise<RouteComputeResult> {
  const apiKey = getGoogleMapsServerApiKey();

  if (!apiKey) {
    const osrm = await fetchOsrmRoute(origin, destination, travelMode);
    if (osrm) return osrm;

    return {
      distanceMeters: 0,
      durationSeconds: 0,
      polyline: '',
      status: 'FAILED',
      error: 'Google Maps API key is missing and OSRM fallback failed.',
    };
  }

  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const googleTravelMode = toGoogleRoutesTravelMode(travelMode);
    const body: Record<string, unknown> = {
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
      travelMode: googleTravelMode,
      polylineQuality: 'OVERVIEW',
    };
    if (googleTravelMode === 'DRIVE' || googleTravelMode === 'TWO_WHEELER') {
      body.routingPreference = 'TRAFFIC_UNAWARE';
    }

    const referer = requestReferer || process.env.APP_URL || 'https://seepoint.vercel.app/';
    let originHeader: string | undefined;
    try { originHeader = new URL(referer).origin; } catch {}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      'Referer': referer,
    };
    if (originHeader) headers['Origin'] = originHeader;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text();

      // Fallback: Try Google Directions API v1 if available with the same key
      try {
        const directionsMode = googleTravelMode === 'BICYCLE' ? 'bicycling' : googleTravelMode === 'WALK' ? 'walking' : 'driving';
        const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
        directionsUrl.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
        directionsUrl.searchParams.set('destination', `${destination.latitude},${destination.longitude}`);
        directionsUrl.searchParams.set('mode', directionsMode);
        directionsUrl.searchParams.set('key', apiKey);

        const dirRes = await fetch(directionsUrl, {
          headers: originHeader ? { Referer: referer, Origin: originHeader } : { Referer: referer },
          signal: AbortSignal.timeout(5000),
        });
        if (dirRes.ok) {
          const dirData = (await dirRes.json()) as {
            status?: string;
            routes?: Array<{
              overview_polyline?: { points?: string };
              legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
            }>;
            error_message?: string;
          };
          if (dirData.status === 'OK' && dirData.routes?.[0]) {
            const firstRoute = dirData.routes[0];
            const firstLeg = firstRoute.legs?.[0];
            const rawDistance = firstLeg?.distance?.value || 0;
            const distanceMeters = rawDistance > 0 ? Math.max(50, Math.round(rawDistance / 50) * 50) : 0;
            const durationSeconds = firstLeg?.duration?.value || 0;
            const polyline = firstRoute.overview_polyline?.points || '';
            return {
              distanceMeters,
              durationSeconds,
              polyline,
              status: 'OK',
            };
          }
        }
      } catch {
        /* Fall through to report primary Routes API error */
      }

      const osrmFallback = await fetchOsrmRoute(origin, destination, travelMode);
      if (osrmFallback) return osrmFallback;

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
      const osrmFallback = await fetchOsrmRoute(origin, destination, travelMode);
      if (osrmFallback) return osrmFallback;

      return {
        distanceMeters: 0,
        durationSeconds: 0,
        polyline: '',
        status: 'NOT_FOUND',
        error: 'No route found between coordinates.',
      };
    }

    const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);
    const rawDistance = route.distanceMeters || 0;
    const distanceMeters = rawDistance > 0 ? Math.max(50, Math.round(rawDistance / 50) * 50) : 0;

    return {
      distanceMeters,
      durationSeconds,
      polyline: route.polyline?.encodedPolyline || '',
      status: 'OK',
    };
  } catch (err: unknown) {
    const osrmFallback = await fetchOsrmRoute(origin, destination, travelMode);
    if (osrmFallback) return osrmFallback;

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
  const apiKey = getGoogleMapsServerApiKey();
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
