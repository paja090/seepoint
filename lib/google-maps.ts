import crypto from 'crypto';

export type RouteComputeResult = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  status: 'OK' | 'NOT_FOUND' | 'FAILED';
  error?: string;
};

/**
 * Computes route driving distance and polyline using Google Routes API (New).
 * Only called on point creation, drag end, or explicit recalculation request.
 */
export async function computeGoogleRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  travelMode: 'DRIVING' | 'BICYCLING' | 'WALKING' = 'DRIVING'
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

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
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
