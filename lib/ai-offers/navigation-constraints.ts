import { OSTRAVA_RESTRICTED_ZONES_GEOJSON } from '@/lib/maps/ostrava-restricted-zones-data';

function isPointInPolygon(point: [number, number], vs: number[][]) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Pure browser/server shared navigation placement checks. */
export function isRestrictedHighwayOr1stClassRoad(text: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const forbidden = [
    'rudna', 'rudne', 'mistecka', 'mistecke', 'bohuminska', 'bohuminske',
    'marianskohorska', 'marianskohorske', 'plzenska', 'plzenske', 'opavska',
    'opavske', 'slovenska', 'dalnice', 'dalnici', 'dalnic', 'd1', 'd56', 'd48',
    'i/11', 'i/56', 'i/59', 'i/48', 'i/58', 'silnice 1', 'silnici 1',
    '1. trid', 'i. trid',
  ];
  return forbidden.some((keyword) => keyword.length <= 3
    ? new RegExp(`\\b${keyword}\\b`, 'i').test(normalized)
    : normalized.includes(keyword));
}

export function isOstravaRestrictedZone(lat: number, lng: number, addressText = ''): boolean {
  try {
    const features = (OSTRAVA_RESTRICTED_ZONES_GEOJSON?.features ?? []) as Array<{
      geometry?: { coordinates?: number[][][] };
    }>;
    for (const feature of features) {
      const coords = feature.geometry?.coordinates?.[0];
      if (Array.isArray(coords) && isPointInPolygon([lng, lat], coords)) {
        return true;
      }
    }
  } catch {
    // Fallback to bounding boxes
  }

  if (lat >= 49.8310 && lat <= 49.8420 && lng >= 18.2810 && lng <= 18.2980) return true;
  if (lat >= 49.8235 && lat <= 49.8355 && lng >= 18.1600 && lng <= 18.1760) return true;
  if (lat >= 49.8105 && lat <= 49.8185 && lng >= 18.2640 && lng <= 18.2760) return true;
  const normalized = addressText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['masarykovo namesti', 'jiraskovo namesti', 'pamatkova zona', 'hlavni trida poruba', 'mirove namesti vitkovice']
    .some((keyword) => normalized.includes(keyword));
}
