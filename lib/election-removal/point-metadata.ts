/**
 * Parsing and presentation utilities for Election Removal points and KML metadata.
 */

export interface ParsedPointMetadata {
  locality: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  fullAddress: string | null;
  photoUrl: string | null;
  otherNotes: string | null;
  relocationDestination: string | null;
  client: string | null;
  campaign: string | null;
  raw: string;
}

/**
 * Checks whether a layer name is a generic placeholder (e.g. from KML/Google My Maps defaults)
 * rather than a meaningful campaign/client name.
 */
export function isGenericLayerName(layerName?: string | null): boolean {
  if (!layerName) return true;
  const normalized = layerName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!normalized) return true;

  const genericPatterns = [
    /^obecna vrstva$/,
    /^vrstva bez nazvu$/,
    /^bez nazvu$/,
    /^bez nazvu vrstvy$/,
    /^rucne pridane body$/,
    /^untitled layer$/,
    /^untitled$/,
    /^default layer$/,
    /^default$/,
    /^layer\s*\d*$/,
    /^vrstva\s*\d*$/,
    /^body$/,
    /^points$/,
    /^placemarks$/,
    /^znacky$/,
    /^import$/,
  ];

  return genericPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Resolves the client or motif name for a point, taking into account:
 * 1. Explicit Client / Zadavatel extracted from point description
 * 2. KML / My Maps Layer Name (if not a generic placeholder like 'Obecná vrstva')
 * 3. Campaign-level client name
 * 4. Fallback to campaign name or null
 */
export function resolvePointClientName(
  point: {
    layerName?: string | null;
    description?: string | null;
    campaignClientName?: string | null;
    campaignName?: string | null;
  },
  fallbackCampaignClientName?: string | null
): string | null {
  // 1. Explicit client in description
  const meta = parsePointMetadata(point.description);
  if (meta.client) {
    return meta.client;
  }
  if (meta.campaign) {
    return meta.campaign;
  }

  // 2. Meaningful layer name (e.g. "BB CALIN", "Komorní scéna aréna", "NEW ÁČKA HUJDUS")
  const cleanedLayer = cleanLayerName(point.layerName);
  if (cleanedLayer && !isGenericLayerName(cleanedLayer)) {
    return cleanedLayer;
  }

  // 3. Campaign client name
  const campaignClient = point.campaignClientName?.trim() || fallbackCampaignClientName?.trim();
  if (campaignClient) {
    return campaignClient;
  }

  // 4. Fallback to campaign name if provided
  if (point.campaignName?.trim()) {
    return point.campaignName.trim();
  }

  return null;
}

/**
 * Cleans noisy layer names (e.g. CSV/KML file names imported from Google My Maps).
 * Strips extensions like .csv, .kml, .xlsx and simplifies redundant file prefixes.
 */
export function cleanLayerName(layerName?: string | null): string | null {
  if (!layerName) return null;
  let cleaned = layerName.trim();

  // Strip common file extensions
  cleaned = cleaned.replace(/\.(csv|kml|kmz|xlsx|xls|txt)$/i, '').trim();

  // If it's a known pattern like "Databaze obsazenost 2026 - VSE - Lavičky volby 26"
  // Keep the most informative part if too long
  if (cleaned.length > 35 && cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ').map((s) => s.trim()).filter(Boolean);
    // Take the last part which is usually the specific category (e.g. "Lavičky volby 26")
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length >= 3) {
      return lastPart;
    }
  }

  return cleaned || null;
}

/**
 * Extracts structured metadata (locality, address parts, photo URL, notes)
 * from point description text (both unstructured concatenated text and multi-line KML descriptions).
 */
export function parsePointMetadata(description?: string | null): ParsedPointMetadata {
  if (!description || typeof description !== 'string') {
    return {
      locality: null,
      city: null,
      district: null,
      street: null,
      fullAddress: null,
      photoUrl: null,
      otherNotes: null,
      relocationDestination: null,
      client: null,
      campaign: null,
      raw: '',
    };
  }

  const raw = description.trim();

  // 1. Extract Photo URL (e.g. Google Drive, Google Photos, or any web link)
  let photoUrl: string | null = null;
  const photoUrlMatch = raw.match(
    /(?:URL\s*fotodokumentace|Fotodokumentace|Foto|Foto\s*URL|URL|Odkaz)\s*[:=]\s*(https?:\/\/[^\s]+)/i
  );
  if (photoUrlMatch) {
    photoUrl = photoUrlMatch[1];
  } else {
    // Fallback: search for any Google Drive / Photos URL directly
    const directDriveMatch = raw.match(/(https?:\/\/(?:drive|photos)\.google\.com\/[^\s]+)/i);
    if (directDriveMatch) {
      photoUrl = directDriveMatch[1];
    }
  }

  // Helper to extract a named field value
  // Matches "Key: Value" until the next known key or end of string
  const knownKeys = [
    'Klient',
    'Zadavatel',
    'Kampa[nň]',
    'Motiv',
    'Lokalita',
    'M[eě]sto',
    'Obec',
    '[CČ][aá]st',
    'M[eě]stsk[aá]\\s+[cč][aá]st',
    'Ulice',
    'lat',
    'latitude',
    'lon',
    'lng',
    'longitude',
    'URL\\s*fotodokumentace',
    'Fotodokumentace',
    'Foto',
    'URL',
    'Odkaz',
    'Pozn[aá]mka',
  ];
  const nextKeyPattern = `(?:\\s*(?:${knownKeys.join('|')})\\s*[:=]|$)`;

  function extractField(keys: string[]): string | null {
    for (const key of keys) {
      const regex = new RegExp(`(?:^|[\\n\\r;,]|\\s)${key}\\s*[:=]\\s*([^\\n\\r]+?)(?=${nextKeyPattern})`, 'i');
      const match = raw.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
          return val;
        }
      }
    }
    return null;
  }

  const client = extractField(['Klient', 'Zadavatel']);
  const campaign = extractField(['Kampa[nň]', 'Motiv']);
  const locality = extractField(['Lokalita']);
  const city = extractField(['M[eě]sto', 'Obec']);
  const district = extractField(['[CČ][aá]st', 'M[eě]stsk[aá]\\s+[cč][aá]st']);
  const street = extractField(['Ulice']);
  const explicitNote = extractField(['Pozn[aá]mka']);

  // Compose clean full address
  const addressParts: string[] = [];
  if (street) addressParts.push(street);
  if (district && district !== city) addressParts.push(district);
  if (city) addressParts.push(city);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

  // Compute other notes: strip extracted fields and coordinate markers
  let notesCleaned = raw;

  // Remove photo URL string
  if (photoUrl) {
    notesCleaned = notesCleaned
      .replace(/(?:URL\s*fotodokumentace|Fotodokumentace|Foto|Foto\s*URL|URL|Odkaz)\s*[:=]\s*https?:\/\/[^\s]+/gi, '')
      .replace(photoUrl, '');
  }

  // Remove lat/lon patterns
  notesCleaned = notesCleaned
    .replace(/(?:lat|latitude)\s*[:=]\s*[-+]?[0-9]*\.?[0-9]+/gi, '')
    .replace(/(?:lon|lng|longitude)\s*[:=]\s*[-+]?[0-9]*\.?[0-9]+/gi, '');

  // Remove recognized structured key-values
  if (client) {
    notesCleaned = notesCleaned.replace(new RegExp(`(?:Klient|Zadavatel)\\s*[:=]\\s*${escapeRegex(client)}`, 'gi'), '');
  }
  if (campaign) {
    notesCleaned = notesCleaned.replace(new RegExp(`(?:Kampa[nň]|Motiv)\\s*[:=]\\s*${escapeRegex(campaign)}`, 'gi'), '');
  }
  if (locality) {
    notesCleaned = notesCleaned.replace(new RegExp(`Lokalita\\s*[:=]\\s*${escapeRegex(locality)}`, 'gi'), '');
  }
  if (city) {
    notesCleaned = notesCleaned.replace(new RegExp(`M[eě]sto\\s*[:=]\\s*${escapeRegex(city)}`, 'gi'), '');
    notesCleaned = notesCleaned.replace(new RegExp(`Obec\\s*[:=]\\s*${escapeRegex(city)}`, 'gi'), '');
  }
  if (district) {
    notesCleaned = notesCleaned.replace(new RegExp(`(?:[CČ][aá]st|M[eě]stsk[aá]\\s+[cč][aá]st)\\s*[:=]\\s*${escapeRegex(district)}`, 'gi'), '');
  }
  if (street) {
    notesCleaned = notesCleaned.replace(new RegExp(`Ulice\\s*[:=]\\s*${escapeRegex(street)}`, 'gi'), '');
  }
  if (explicitNote) {
    notesCleaned = notesCleaned.replace(new RegExp(`Pozn[aá]mka\\s*[:=]\\s*${escapeRegex(explicitNote)}`, 'gi'), '');
  }

  // Extract explicit relocation destination if present
  let relocationDestination: string | null = null;
  const relocationMatch = raw.match(
    /(?:\[C[ií]l\s*p[rř]evozu:\s*([^\]]+)\]|C[ií]l\s*p[rř]evozu\s*[:=]\s*([^\n\r;,]+))/i
  );
  if (relocationMatch) {
    relocationDestination = (relocationMatch[1] || relocationMatch[2] || '').trim() || null;
  }

  // Strip operational tags and relocation destinations from general notes
  notesCleaned = notesCleaned
    .replace(/\[Operace:\s*[^\]]+\]/gi, '')
    .replace(/\[C[ií]l\s*p[rř]evozu:\s*[^\]]+\]/gi, '')
    .replace(/C[ií]l\s*p[rř]evozu\s*[:=]\s*[^\n\r;,]+/gi, '');

  // Clean remaining whitespace and punctuation
  notesCleaned = notesCleaned
    .replace(/^[,\s;:-]+|[,\s;:-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const otherNotes = explicitNote || (notesCleaned.length > 0 ? notesCleaned : null);

  return {
    locality,
    city,
    district,
    street,
    fullAddress,
    photoUrl,
    otherNotes,
    relocationDestination,
    client,
    campaign,
    raw,
  };
}

/**
 * Builds a direct Google Maps Directions URL for a sequence of points.
 * Single point: https://www.google.com/maps/dir/?api=1&destination=lat,lng
 * Multiple points: https://www.google.com/maps/dir/?api=1&origin=lat1,lng1&destination=latN,lngN&waypoints=lat2,lng2|...
 */
export function buildGoogleMapsRouteUrl(
  points: Array<{ latitude: number; longitude: number }>
): string {
  if (!points || points.length === 0) return 'https://www.google.com/maps';

  const valid = points.filter(
    (p) =>
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number' &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180
  );

  if (valid.length === 0) return 'https://www.google.com/maps';

  if (valid.length === 1) {
    const params = new URLSearchParams({
      api: '1',
      destination: `${valid[0].latitude},${valid[0].longitude}`,
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const origin = `${valid[0].latitude},${valid[0].longitude}`;
  const destination = `${valid[valid.length - 1].latitude},${valid[valid.length - 1].longitude}`;

  if (valid.length > 5) throw new Error('Delší navigaci rozdělte pomocí buildGoogleMapsRouteSegments; žádná zastávka se nesmí vynechat.');
  const intermediate = valid.slice(1, -1);
  const waypoints = intermediate.map((p) => `${p.latitude},${p.longitude}`).join('|');

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  });

  if (waypoints) {
    params.set('waypoints', waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Mobile Maps supports three intermediate waypoints. Adjacent segments share their boundary. */
export function buildGoogleMapsRouteSegments(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length <= 5) return [{ from: 1, to: points.length, url: buildGoogleMapsRouteUrl(points) }];
  const result = [];
  for (let i = 0; i < points.length - 1; i += 4) {
    const part = points.slice(i, i + 5);
    result.push({ from: i + 1, to: i + part.length, url: buildGoogleMapsRouteUrl(part) });
  }
  return result;
}

