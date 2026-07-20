// Helper for calculating real driving route distance via OSRM with Haversine fallback

export type RouteDistanceResult = {
  distanceMeters: number;
  formattedDistance: string;
  isDrivingRoute: boolean;
};

export function calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistanceText(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export async function getRealRouteDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<RouteDistanceResult> {
  const haversine = calculateHaversineMeters(fromLat, fromLng, toLat, toLng);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as { routes?: Array<{ distance?: number }> };
      const routeDist = data.routes?.[0]?.distance;
      if (typeof routeDist === 'number' && routeDist > 0) {
        const distMeters = Math.round(routeDist);
        return {
          distanceMeters: distMeters,
          formattedDistance: `${formatDistanceText(distMeters)} po silnici`,
          isDrivingRoute: true,
        };
      }
    }
  } catch {
    /* fallback to haversine estimation with +20% road multiplier */
  }

  // Fallback: Haversine distance x 1.20 estimated road factor
  const estimatedRoad = Math.round(haversine * 1.2);
  return {
    distanceMeters: estimatedRoad,
    formattedDistance: `${formatDistanceText(estimatedRoad)} (trasa k prodejně)`,
    isDrivingRoute: false,
  };
}
