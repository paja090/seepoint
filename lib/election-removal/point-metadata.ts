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
  raw: string;
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
    raw,
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
