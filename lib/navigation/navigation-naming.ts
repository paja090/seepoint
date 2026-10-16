/**
 * Navigation Position Naming Standardizer
 * 
 * Standard format: P{číslo pozice} - {Ulice} - {Vzdálenost a směr}
 * Example: P1 - Ostravská - 500m vpravo
 */

export interface FormatNavigationOptions {
  positionNumber?: number | string | null;
  street?: string | null;
  address?: string | null;
  city?: string | null;
  distanceMeters?: number | null;
  direction?: string | null;
  rawDistanceAndDirection?: string | null;
}

export function formatDistance(dist?: number | string | null): string {
  if (dist == null || dist === '') return '';
  if (typeof dist === 'number') {
    if (dist >= 1000) {
      const km = (dist / 1000).toFixed(1).replace('.0', '').replace('.', ',');
      return `${km}km`;
    }
    return `${Math.round(dist)}m`;
  }
  const s = String(dist).trim().toLowerCase();
  const m = s.match(/^([\d.,]+)\s*(m|km)$/i);
  if (m) {
    const num = m[1].replace('.', ',');
    const unit = m[2].toLowerCase();
    return `${num}${unit}`;
  }
  return s;
}

export function cleanStreetName(rawStreet?: string | null, rawAddress?: string | null, rawCity?: string | null): string {
  let val = rawStreet || rawAddress || rawCity || 'Ostravská';
  val = val.split(',')[0].trim();
  val = val.replace(/\s+\d+\/\d+.*$/, ''); // strip numbers like 748/9
  val = val.replace(/\s+\d+.*$/, ''); // strip trailing numbers
  if (/17\.\s*list/i.test(val)) return '17. listopadu';
  if (/collo/i.test(val)) return 'Collo-louky';
  if (/slav[ií]k/i.test(val)) return 'Slavíkova';
  if (/krmel/i.test(val)) return 'Krmelínská';
  return val.trim() || 'Ostravská';
}

export function cleanDirectionAndDistance(
  rawDistAndDir?: string | null,
  street?: string | null,
  distanceMeters?: number | null,
  directionDescription?: string | null
): string {
  let text = (rawDistAndDir || '').trim();

  // If text is like "řádek 18" or "Strana A", ignore it as distance
  if (/řádek|strana/i.test(text)) {
    text = '';
  }

  // Remove street repetition if present at start: e.g. "17. Listopadu 2 km..." -> "2 km..."
  if (street && text) {
    const unaccent = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const cleanSt = unaccent(street);
    if (unaccent(text).startsWith(cleanSt)) {
      text = text.slice(cleanSt.length).replace(/^[-–—\s]+/, '').trim();
    }
  }

  // If text now equals street or is empty, use directionDescription
  if (!text || (street && text.toLowerCase() === street.toLowerCase())) {
    text = directionDescription ? directionDescription.trim() : '';
  }

  // normalize spacing and words: e.g. "500 m" -> "500m", "1,5 km" -> "1,5km", "doprava" -> "vpravo"
  text = text
    .replace(/(\d+)\s+m\b/gi, '$1m')
    .replace(/([\d.,]+)\s+km\b/gi, '$1km')
    .replace(/\bdoprava\b/gi, 'vpravo')
    .replace(/\bdoleva\b/gi, 'vlevo')
    .trim();

  if (distanceMeters != null) {
    const formattedDist = formatDistance(distanceMeters);
    if (!text) {
      text = formattedDist;
    } else if (!/\d+\s*(m|km)\b/i.test(text)) {
      text = `${formattedDist} ${text}`;
    }
  }

  return text;
}

/**
 * Builds the canonical name: P{N} - {Street} - {Distance and Direction}
 */
export function formatNavigationPositionName(options: FormatNavigationOptions): string {
  const posNum = options.positionNumber != null ? options.positionNumber : 1;
  const street = cleanStreetName(options.street, options.address, options.city);
  const distAndDir = cleanDirectionAndDistance(
    options.rawDistanceAndDirection,
    street,
    options.distanceMeters,
    options.direction
  );

  if (distAndDir) {
    return `P${posNum} - ${street} - ${distAndDir}`;
  }
  return `P${posNum} - ${street}`;
}

/**
 * Formats a sanitized file name for a photo linked to a navigation surface.
 * e.g. "P1 - Ostravská - 500m vpravo.jpg"
 */
export function getNavigationPhotoDownloadName(surfaceName: string, extension: string = 'jpg'): string {
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  // Replace characters not allowed in filenames: \ / : * ? " < > |
  const safe = surfaceName.replace(/[/\\?%*:|"<>]/g, '-').trim();
  return `${safe}.${ext}`;
}
