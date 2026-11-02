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

/**
 * Detects whether the target or context is in Ostrava.
 */
export function isCityOstrava(city?: string, addressText?: string): boolean {
  const combined = `${city || ''} ${addressText || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /ostrav|porub|svinov|vitkovic|hrabuvk|zabreh|privoz|radvanic|michalkovic|krasne pole/i.test(combined);
}

/**
 * Checks if a road/street is a restricted motorway, highway or 1st-class expressway.
 * - National motorways (D0-D55, dálnice, silnice I. třídy) apply nationwide.
 * - Ostrava-specific trunk expressways (Rudná, Místecká, Bohumínská, Mariánskohorská)
 *   are only evaluated if the location is in Ostrava, so agencies operating elsewhere
 *   are not restricted by Ostrava's local street names.
 */
export function isRestrictedHighwayOr1stClassRoad(text: string, city?: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // National motorways and numbered 1st class roads (prohibited for VO navigation signs nationwide without special transit permit)
  const nationalForbidden = [
    'dalnice', 'dalnici', 'dalnic', 'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd10', 'd11',
    'd35', 'd46', 'd48', 'd52', 'd55', 'd56',
    'silnice 1', 'silnici 1', '1. trid', 'i. trid',
  ];

  const hasNational = nationalForbidden.some((keyword) =>
    keyword.length <= 3
      ? new RegExp(`\\b${keyword}\\b`, 'i').test(normalized)
      : normalized.includes(keyword)
  ) || /\bi\/\d+\b/i.test(normalized);
  if (hasNational) return true;

  // Ostrava-specific primary expressways where light-pole navigation is prohibited by municipal administration / ŘSD
  const inOstrava = !city || isCityOstrava(city, text);
  if (inOstrava) {
    const ostravaForbidden = [
      'rudna', 'rudne', 'mistecka', 'mistecke', 'bohuminska', 'bohuminske',
      'marianskohorska', 'marianskohorske', 'plzenska', 'plzenske', 'opavska',
      'opavske', 'slovenska',
    ];
    return ostravaForbidden.some((keyword) =>
      keyword.length <= 4
        ? new RegExp(`\\b${keyword}\\b`, 'i').test(normalized)
        : normalized.includes(keyword)
    );
  }

  return false;
}

/**
 * Checks if a location is within the Historical Heritage Zone of Ostrava (Městská památková zóna - MPZ).
 * In this historical core (Moravská Ostrava center, Poruba Sorela 1. obvod, Přívoz square, Vítkovice center),
 * navigation signs on light poles are STRICTLY PROHIBITED by heritage protection authorities.
 */
export function isOstravaHistoricalHeritageZone(lat: number, lng: number, addressText = ''): boolean {
  // 1. Moravská Ostrava historical core (Masarykovo náměstí, Kostelní, 28. října center, Kuří rynek, Smetanovo nám.)
  if (lat >= 49.8310 && lat <= 49.8420 && lng >= 18.2810 && lng <= 18.2980) return true;

  // 2. Poruba 1. stavební obvod / Sorela (Oblouk, Alšovo náměstí, Porubská)
  if (lat >= 49.8235 && lat <= 49.8355 && lng >= 18.1600 && lng <= 18.1760) return true;

  // 3. Vítkovice historické centrum (Mírové náměstí a Štítová kolonie)
  if (lat >= 49.8105 && lat <= 49.8185 && lng >= 18.2640 && lng <= 18.2760) return true;

  // 4. Přívoz historické centrum (Náměstí Svatopluka Čecha a okolí kostela)
  if (lat >= 49.8500 && lat <= 49.8545 && lng >= 18.2665 && lng <= 18.2740) return true;

  const normalized = addressText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [
    'masarykovo namesti',
    'jiraskovo namesti',
    'kuri rynek',
    'smetanovo namesti',
    'kostelni',
    'alsovo namesti',
    'oblouk poruba',
    'hlavni trida poruba',
    'mirove namesti vitkovice',
    'namesti svatopluka cecha',
    'pamatkova zona',
    'pamatkove zone',
    'mpz ostrava',
  ].some((keyword) => normalized.includes(keyword));
}

/**
 * Checks whether location is in Ostrava's wider Regulated Advertising Zone (Nařízení města č. 2/2020).
 * Directional navigation boards on lighting poles ARE PERMITTED here because they serve traffic orientation.
 */
export function isOstravaRegulatedZone(lat: number, lng: number): boolean {
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
    // Fallback if geojson is unparsed
  }
  return false;
}

/**
 * Generic historical heritage zone check for non-Ostrava cities (Praha, Brno, Olomouc, etc.).
 */
export function isGenericHistoricalZone(addressText = ''): boolean {
  const normalized = addressText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return [
    'pamatkova rezervace',
    'pamatkove rezervaci',
    'pamatkova zona',
    'pamatkove zone',
    'historicke centrum',
    'historickem centru',
    'stare mesto',
    'starem meste',
    'hradcany',
    'mala strana',
    'staromestske namesti',
  ].some((keyword) => normalized.includes(keyword));
}

export type NavigationZoningResult = {
  city: string;
  isOstrava: boolean;
  isHighway: boolean;
  isHistoricalHeritageZone: boolean; // STRICTLY FORBIDDEN
  isRegulatedZone: boolean;          // PERMITTED with orientation regulation standard
  isAllowed: boolean;                // true if NOT highway and NOT historical heritage zone
  badge: string;
  reason: string;
  warning?: string;
};

/**
 * Comprehensive zoning evaluation considering city context:
 * - Ostrava: Navigation is PERMITTED in the regulated zone (Nařízení č. 2/2020),
 *   but STRICTLY PROHIBITED in the Historical Heritage Zone (MPZ).
 * - Other cities: Generic national highway and heritage checks, without Ostrava specific regulations.
 */
export function evaluateNavigationZoning(input: {
  latitude: number;
  longitude: number;
  addressText?: string;
  city?: string;
}): NavigationZoningResult {
  const address = input.addressText || '';
  const city = input.city || (isCityOstrava(input.city, address) ? 'Ostrava' : '');
  const inOstrava = isCityOstrava(city, address);

  const isHighway = isRestrictedHighwayOr1stClassRoad(address, inOstrava ? 'Ostrava' : city);

  if (inOstrava) {
    const isHeritage = isOstravaHistoricalHeritageZone(input.latitude, input.longitude, address);
    const isRegulated = isOstravaRegulatedZone(input.latitude, input.longitude);

    if (isHighway) {
      return {
        city: 'Ostrava',
        isOstrava: true,
        isHighway: true,
        isHistoricalHeritageZone: isHeritage,
        isRegulatedZone: isRegulated,
        isAllowed: false,
        badge: '⛔ Dálnice / I. třída (Zákaz navigací na VO)',
        reason: 'Přímo na dálnicích a silnicích I. třídy (Rudná, Místecká, D1 apod.) nelze umisťovat navigační tabule na sloupy VO.',
        warning: 'Bod byl automaticky přesunut na navazující městskou obslužnou komunikaci.',
      };
    }

    if (isHeritage) {
      return {
        city: 'Ostrava',
        isOstrava: true,
        isHighway: false,
        isHistoricalHeritageZone: true,
        isRegulatedZone: isRegulated,
        isAllowed: false,
        badge: '⛔ Historická památková zóna (Zákaz navigací na VO)',
        reason: 'V historické památkové zóně (MPZ) města Ostravy je umísťování navigačních poutačů na sloupech VO zakázáno památkovou péčí.',
        warning: 'Navigační bod musí být umístěn vně památkové zóny na navazující příjezdové třídě.',
      };
    }

    if (isRegulated) {
      return {
        city: 'Ostrava',
        isOstrava: true,
        isHighway: false,
        isHistoricalHeritageZone: false,
        isRegulatedZone: true,
        isAllowed: true,
        badge: '✓ Regulovaná zóna Ostrava (Nařízení 2/2020)',
        reason: 'Bod leží v regulované zóně města Ostravy – navigační deska na sloupu VO je povolena v souladu se schváleným technickým určením.',
      };
    }

    return {
      city: 'Ostrava',
      isOstrava: true,
      isHighway: false,
      isHistoricalHeritageZone: false,
      isRegulatedZone: false,
      isAllowed: true,
      badge: '✓ Městská zóna Ostrava (Standardní sloup VO)',
      reason: 'Standardní městská komunikace s možností instalace schválené navigační tabule na sloup veřejného osvětlení.',
    };
  }

  // Non-Ostrava city / other regional agencies
  const isGenericHeritage = isGenericHistoricalZone(address);
  const cityLabel = city || 'region';

  if (isHighway) {
    return {
      city: cityLabel,
      isOstrava: false,
      isHighway: true,
      isHistoricalHeritageZone: isGenericHeritage,
      isRegulatedZone: false,
      isAllowed: false,
      badge: `⛔ Dálniční tah (${cityLabel})`,
      reason: 'Na dálničních tazích a rychlostních komunikacích nelze umisťovat navigační tabule bez zvláštního povolení silničního správního úřadu.',
      warning: 'Bod byl situován na přivaděč nebo městskou sběrnou komunikaci.',
    };
  }

  if (isGenericHeritage) {
    return {
      city: cityLabel,
      isOstrava: false,
      isHighway: false,
      isHistoricalHeritageZone: true,
      isRegulatedZone: false,
      isAllowed: false,
      badge: `⚠️ Památková zóna (${cityLabel})`,
      reason: `Bod leží v historické / památkové zóně města ${cityLabel}. Umístění navigační tabule vyžaduje stanovisko orgánu památkové péče.`,
      warning: 'Doporučeno umístit bod na příjezdovou třídu před památkovou zónou.',
    };
  }

  return {
    city: cityLabel,
    isOstrava: false,
    isHighway: false,
    isHistoricalHeritageZone: false,
    isRegulatedZone: false,
    isAllowed: true,
    badge: `✓ Městská komunikace (${cityLabel})`,
    reason: `Standardní městská třída pro umístění navigační desky na sloup veřejného osvětlení v lokalitě ${cityLabel}.`,
  };
}

/**
 * Backward-compatible alias for existing tests and call sites.
 * Returns true if location is in Ostrava's restricted historical heritage zone (where placement is blocked).
 */
export function isOstravaRestrictedZone(lat: number, lng: number, addressText = ''): boolean {
  return isOstravaHistoricalHeritageZone(lat, lng, addressText);
}

