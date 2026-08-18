import { parseDistanceMeters } from './navigation-import';

export type ExtractedNavigationPhotoData = {
  destinationName?: string;
  directionDescription?: string;
  directionArrow?: '➔' | '⬅' | '⬆' | '🧭';
  distanceMeters?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceText?: string;
};

const KNOWN_BRANDS = [
  'Albert',
  'Kaufland',
  'Billa',
  'Lidl',
  'Penny',
  'Tesco',
  'Globus',
  'Norma',
  'Shell',
  'OMV',
  'Benzina',
  'Orlen',
  'MOL',
  'Mountfield',
  'Hornbach',
  'Bauhaus',
  'OBI',
  'Decathlon',
  'Autoservis',
  'Pneuservis',
  'Lékárna',
  'Restaurace',
  'Hotel',
];

export function extractNavigationFromPhotoText(text: string | undefined | null): ExtractedNavigationPhotoData | null {
  if (!text || typeof text !== 'string') return null;
  const rawText = text.trim();
  if (!rawText) return null;

  let destinationName: string | undefined;
  let directionDescription: string | undefined;
  let directionArrow: '➔' | '⬅' | '⬆' | '🧭' = '🧭';
  let distanceMeters: number | undefined;
  let confidenceScore = 0;

  // 1. Detect Brand / Destination
  for (const brand of KNOWN_BRANDS) {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(rawText)) {
      destinationName = brand;
      confidenceScore += 40;
      break;
    }
  }

  // 2. Detect Distance (e.g. 350m, 500 m, 1.2 km, 2,5 km, 350 metrů, 500m po silnici)
  const distMatch = /(\b\d+(?:[,.]\d+)?\s*(?:km|kilo|m|metrů|metru|metry|metr)?\b)/i.exec(rawText);
  if (distMatch) {
    distanceMeters = parseDistanceMeters(distMatch[1]);
    if (distanceMeters !== undefined && distanceMeters > 0) {
      confidenceScore += 35;
    }
  }

  // 3. Detect Direction & Arrow
  const normText = rawText.toLowerCase();
  if (normText.includes('vpravo') || normText.includes('doprava') || rawText.includes('➔') || rawText.includes('->')) {
    directionDescription = 'vpravo';
    directionArrow = '➔';
    confidenceScore += 25;
  } else if (normText.includes('vlevo') || normText.includes('doleva') || rawText.includes('⬅') || rawText.includes('<-')) {
    directionDescription = 'vlevo';
    directionArrow = '⬅';
    confidenceScore += 25;
  } else if (normText.includes('rovne') || normText.includes('rovně') || normText.includes('primo') || normText.includes('přímo') || rawText.includes('⬆')) {
    directionDescription = 'rovně';
    directionArrow = '⬆';
    confidenceScore += 25;
  }

  // Fallback for street direction if present
  if (!directionDescription) {
    const streetMatch = /(?:ul\.|ulice|směr)\s+([a-žA-Ž0-9\s-]+)/i.exec(rawText);
    if (streetMatch) {
      directionDescription = `směr ${streetMatch[1].trim()}`;
      confidenceScore += 15;
    }
  }

  if (confidenceScore === 0) return null;

  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
    confidenceScore >= 60 ? 'HIGH' : confidenceScore >= 30 ? 'MEDIUM' : 'LOW';

  return {
    destinationName,
    directionDescription,
    directionArrow,
    distanceMeters,
    confidence,
    sourceText: rawText,
  };
}

export function extractFromPhotoList(
  photos: Array<{ url?: string; note?: string; filename?: string }>,
  extraTextSources: string[] = [],
): ExtractedNavigationPhotoData | null {
  const allPhotos = [...photos];
  if (extraTextSources.length > 0) {
    allPhotos.push(...extraTextSources.map((t) => ({ note: t })));
  }

  for (const photo of allPhotos) {
    const textSources = [photo.note, photo.filename, photo.url].filter(Boolean) as string[];
    for (const src of textSources) {
      const extracted = extractNavigationFromPhotoText(src);
      if (extracted && extracted.confidence !== 'LOW') {
        return extracted;
      }
    }
  }

  // Secondary pass for LOW confidence
  for (const photo of allPhotos) {
    const textSources = [photo.note, photo.filename, photo.url].filter(Boolean) as string[];
    for (const src of textSources) {
      const extracted = extractNavigationFromPhotoText(src);
      if (extracted) return extracted;
    }
  }

  return null;
}
