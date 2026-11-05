import { evaluateNavigationZoning } from './navigation-constraints';

export type ArrowDirection = 'LEFT' | 'RIGHT' | 'STRAIGHT';

export type InferredDirectionResult = {
  arrowDirection: ArrowDirection;
  turnText: 'vpravo' | 'vlevo' | 'rovně';
  turnLabel: string;
  turnVerb: string;
  turnAngle: number;
};

/**
 * Decodes Google encoded polyline string into an array of { latitude, longitude }
 */
export function decodePolylinePoints(encoded: string): Array<{ latitude: number; longitude: number }> {
  if (!encoded) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Array<{ latitude: number; longitude: number }> = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}

/**
 * Encodes an array of { latitude, longitude } into a Google encoded polyline string
 */
export function encodePolylinePoints(points: Array<{ latitude: number; longitude: number }>): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);
    const dLat = lat - prevLat;
    const dLng = lng - prevLng;
    prevLat = lat;
    prevLng = lng;

    for (let num of [dLat, dLng]) {
      num = num < 0 ? ~(num << 1) : num << 1;
      while (num >= 0x20) {
        encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
        num >>= 5;
      }
      encoded += String.fromCharCode(num + 63);
    }
  }

  return encoded;
}

/**
 * Calculates geodesic distance between two points in meters using Haversine formula
 */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Computes forward azimuth/bearing from point A to point B in degrees [0, 360)
 */
export function calculateBearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Calculates the relative turn angle between two bearings in degrees [-180, 180].
 * Positive angle (> 0): clockwise turn (turn right).
 * Negative angle (< 0): counter-clockwise turn (turn left).
 */
export function calculateTurnAngle(bearingFrom: number, bearingTo: number): number {
  return ((bearingTo - bearingFrom + 540) % 360) - 180;
}

/**
 * Analyzes the driving route geometry and infers truthful turn direction (LEFT, RIGHT, STRAIGHT)
 * for a navigation sign placed at origin towards target.
 */
export function inferArrowDirectionFromRoute(
  origin: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number },
  polyline?: string
): InferredDirectionResult {
  const straightResult: InferredDirectionResult = {
    arrowDirection: 'STRAIGHT',
    turnText: 'rovně',
    turnLabel: 'Pokračovat rovně',
    turnVerb: 'Pokračovat rovně',
    turnAngle: 0,
  };

  if (!polyline) {
    // If no polyline, check bearing from origin to target
    return straightResult;
  }

  const points = decodePolylinePoints(polyline);
  if (points.length < 2) {
    return straightResult;
  }

  const pStart = points[0];

  // 1. Find initial travel vector along the road segment (first ~30-60 meters)
  let initialBearing = calculateBearing(pStart, points[1]);
  let accumulatedDist = 0;
  let initialIdx = 1;

  for (let i = 1; i < points.length; i++) {
    const segDist = haversineMeters(points[i - 1], points[i]);
    accumulatedDist += segDist;
    if (accumulatedDist >= 30) {
      initialBearing = calculateBearing(pStart, points[i]);
      initialIdx = i;
      break;
    }
  }

  // 2. Scan subsequent points along the route (up to ~450 meters) to detect the first major intersection turn
  let checkDist = 0;
  for (let i = Math.max(1, initialIdx); i < points.length - 1; i++) {
    const segDist = haversineMeters(points[i], points[i + 1]);
    checkDist += segDist;
    if (checkDist > 450) break;

    // Check bearing of segment after the intersection
    if (segDist >= 15) {
      const segBearing = calculateBearing(points[i], points[i + 1]);
      const turnAngle = calculateTurnAngle(initialBearing, segBearing);

      // Significant turn threshold: >= 25°
      if (turnAngle >= 25 && turnAngle <= 155) {
        return {
          arrowDirection: 'RIGHT',
          turnText: 'vpravo',
          turnLabel: 'Odbočit vpravo',
          turnVerb: 'Odbočení vpravo',
          turnAngle: Math.round(turnAngle),
        };
      }
      if (turnAngle <= -25 && turnAngle >= -155) {
        return {
          arrowDirection: 'LEFT',
          turnText: 'vlevo',
          turnLabel: 'Odbočit vlevo',
          turnVerb: 'Odbočení vlevo',
          turnAngle: Math.round(turnAngle),
        };
      }
    }
  }

  // 3. If no sharp turn along the initial polyline, compare initial travel vector with direct vector to target
  const targetBearing = calculateBearing(pStart, target);
  const angleToTarget = calculateTurnAngle(initialBearing, targetBearing);

  if (angleToTarget >= 30 && angleToTarget <= 150) {
    return {
      arrowDirection: 'RIGHT',
      turnText: 'vpravo',
      turnLabel: 'Odbočit vpravo',
      turnVerb: 'Odbočení vpravo',
      turnAngle: Math.round(angleToTarget),
    };
  }

  if (angleToTarget <= -30 && angleToTarget >= -150) {
    return {
      arrowDirection: 'LEFT',
      turnText: 'vlevo',
      turnLabel: 'Odbočit vlevo',
      turnVerb: 'Odbočení vlevo',
      turnAngle: Math.round(angleToTarget),
    };
  }

  return straightResult;
}

/**
 * Formats distance in Czech for navigation signs: e.g. "350 m" or "1,4 km"
 */
export function formatNavigationDistance(distMeters?: number | null): string {
  if (distMeters == null || !Number.isFinite(distMeters)) return '';
  if (distMeters >= 1000) {
    const km = (distMeters / 1000).toFixed(1).replace('.0', '').replace('.', ',');
    return `${km} km`;
  }
  return `${Math.max(50, Math.round(distMeters / 50) * 50)} m`;
}

/**
 * Extracts and cleans a street name from a raw address or descriptive waypoint title
 */
export function extractCleanStreetName(raw?: string | null): string {
  if (!raw) return 'městská třída';
  let s = raw.split(',')[0].trim();
  s = s.replace(/^\[.*?\]\s*/g, '');
  s = s.replace(/^(Příjezdový\s+bod|Rozhodovací\s+bod|Navigační\s+bod|Klíčový\s+bod|Bod|Trasa|Odbočení\s+(vpravo|vlevo)|Průjezd\s+po)\s*(na|v|po|k)?\s*/i, '');
  s = s.replace(/\s*\(.*?$/, '').trim();
  s = s.replace(/\s+\d+\/\d+.*$/, '');
  s = s.replace(/\s+\d+.*$/, '');
  s = s.trim();
  if (!s || /č\.p\.|ostrava|havířov|brno|praha|česko/i.test(s)) return 'městská třída';
  return s;
}

/**
 * Formats truthful Czech title and reasons for a navigation offer point,
 * focused on selling the commercial and navigational value of the spot
 * to the client without repetitive jargon or regulatory disclaimers.
 */
export function formatNavigationPointDetails(params: {
  circuit: 'INNER' | 'OUTER';
  streetPart?: string;
  arrowDirection: ArrowDirection;
  turnText: string;
  turnVerb: string;
  distanceMeters: number;
  zoning: ReturnType<typeof evaluateNavigationZoning> | (Partial<ReturnType<typeof evaluateNavigationZoning>> & { isAllowed: boolean; reason: string });
  index?: number;
}): { title: string; reasons: string[]; commercialPitch: string } {
  const { circuit, streetPart, turnText, turnVerb, distanceMeters, zoning } = params;
  const cleanStreet = extractCleanStreetName(streetPart);
  const distFormatted = formatNavigationDistance(distanceMeters);

  if (!zoning.isAllowed) {
    const title = `${zoning.badge} (${cleanStreet})`;
    const reasons = [
      `⚠️ ${zoning.reason}`,
      zoning.warning || `Vzdálenost ${distFormatted} před cílem.`,
    ];
    return { title, reasons, commercialPitch: reasons.join(' ') };
  }

  const isInner = circuit === 'INNER';

  let title: string;
  if (isInner) {
    title = `[Vnitřní okruh] ${turnVerb} na ${cleanStreet} (${distFormatted})`;
  } else {
    const prefix = turnVerb === 'Pokračovat rovně' ? 'Průjezd po' : `${turnVerb} na`;
    title = `[Vnější okruh] ${prefix} ${cleanStreet} (${distFormatted})`;
  }

  // Direction-specific commercial benefit for the client
  let directionSalesPitch = '';
  if (turnText === 'vpravo' || turnVerb.toLowerCase().includes('vpravo')) {
    directionSalesPitch = isInner
      ? 'Umožňuje plynulé a bezpečné navedení k vjezdu do areálu / na parkoviště odbočením vpravo.'
      : 'Zajišťuje včasné a plynulé zařazení do odbočovacího pruhu vpravo bez nutnosti křížit protisměr.';
  } else if (turnText === 'vlevo' || turnVerb.toLowerCase().includes('vlevo')) {
    directionSalesPitch = isInner
      ? 'Jasně naviguje zákazníky přímo k vjezdu do areálu s odbočením vlevo na křižovatce.'
      : 'Poskytuje řidičům včasné upozornění s dostatečným předstihem pro bezpečné zařazení a odbočení vlevo.';
  } else {
    directionSalesPitch = isInner
      ? 'Finální potvrzení přímého příjezdu k provozovně v bezprostřední dojezdové zóně.'
      : 'Potvrzuje správný směr po hlavní příjezdové tepně a udržuje silnou vizibilitu značky v hustém provozu.';
  }

  // Commercial pitch selling WHY this position is advantageous (prodej pozice bez úředních frází)
  const commercialPitch = isInner
    ? `🔵 Vnitřní okruh (dojezdová zóna · ${cleanStreet} · ${distFormatted} před cílem): Klíčový rozhodovací bod v těsné blízkosti provozovny. Zajišťuje, že zákazník nemine finální odbočku a bezpečně dorazí k cíli. ${directionSalesPitch}`
    : `🟣 Vnější okruh (hlavní tah · ${cleanStreet} · ${distFormatted} před cílem): Strategická pozice na frekventované městské třídě s vysokým průjezdem vozidel. Zachycuje zákazníky s dostatečným předstihem a navádí je směrem k provozovně. ${directionSalesPitch}`;

  const reasons = [
    isInner
      ? `🔵 Vnitřní okruh (dojezd): Klíčový rozhodovací bod v těsné blízkosti provozovny (${distFormatted} před cílem). ${directionSalesPitch}`
      : `🟣 Vnější okruh (hlavní tah): Strategická pozice na městské třídě ${cleanStreet} (${distFormatted} před cílem). Zachycuje tranzitní dopravu i přijíždějící zákazníky. ${directionSalesPitch}`,
    `${turnVerb} na ${cleanStreet} (${distFormatted} před cílem).`,
  ];

  return { title, reasons, commercialPitch };
}
