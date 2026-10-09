import type { ElectionRemovalMediaType } from '@prisma/client';
import {
  DEFAULT_MEDIA_SERVICE_MINUTES,
  calculateServiceMinutes,
  calculateMediaLoadSlots,
  type ElectionRemovalOperationType,
} from './constants';

export interface ParsedKmlLayer {
  id: string;
  name: string;
  detectedMediaType: ElectionRemovalMediaType;
  pointCount: number;
  defaultServiceMinutes: number;
}

export interface ParsedKmlPoint {
  id: string;
  name: string;
  description?: string;
  layerId: string;
  layerName: string;
  mediaType: ElectionRemovalMediaType;
  operationType?: ElectionRemovalOperationType;
  loadSlots?: number;
  latitude: number;
  longitude: number;
  quantity: number;
  serviceMinutes: number;
  isValid: boolean;
  validationError?: string;
  isOutsideCzechBounds: boolean;
}

export interface KmlParseResult {
  suggestedCampaignName: string;
  layers: ParsedKmlLayer[];
  points: ParsedKmlPoint[];
  summary: {
    totalPoints: number;
    validPoints: number;
    invalidPoints: number;
    outsideCzechBoundsCount: number;
    totalEstimatedMinutes: number;
  };
}

/**
 * Bounds of the Czech Republic for soft warnings.
 * Coordinates outside this box trigger a warning badge, NOT a hard validation error.
 */
export const CZECH_BOUNDS = {
  minLat: 48.55,
  maxLat: 51.15,
  minLng: 12.09,
  maxLng: 18.86,
};

/**
 * Normalizes text for keyword matching by lowercasing and stripping diacritics.
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Suggests an ElectionRemovalMediaType based on Czech terminology.
 * Strict matching: if ambiguous or unknown, returns null.
 */
export function detectMediaTypeFromText(text?: string | null): ElectionRemovalMediaType | null {
  if (!text) return null;
  const normalized = normalizeForMatching(text);

  // Check composite / specific phrases first before general words
  if (
    normalized.includes('mini tower') ||
    normalized.includes('minitower') ||
    normalized.includes('mini vez')
  ) {
    return 'MINI_TOWER';
  }

  if (
    normalized.includes('tower') ||
    normalized.includes('vez') ||
    normalized.includes('trojbok')
  ) {
    return 'TOWER';
  }

  if (
    normalized.includes('city poster') ||
    normalized.includes('cityposter') ||
    normalized.includes('city-poster') ||
    normalized.includes('poster')
  ) {
    return 'CITY_POSTER';
  }

  if (
    normalized.includes('acko') ||
    normalized.includes('acka') ||
    normalized.includes('a-cko') ||
    normalized.includes('a-cka') ||
    normalized.includes('a-stojan') ||
    normalized.includes('a stojan') ||
    normalized.includes('stojan a') ||
    normalized.includes('stojany')
  ) {
    return 'ACKO';
  }

  if (
    normalized.includes('lavick') ||
    normalized.includes('bench')
  ) {
    return 'BENCH';
  }

  if (
    normalized.includes('banner') ||
    normalized.includes('placht')
  ) {
    return 'BANNER';
  }

  if (
    normalized.includes('plot') ||
    normalized.includes('plotovk')
  ) {
    return 'PLOT';
  }

  return null;
}

/**
 * Resolves a suggested media type for a KML layer.
 * Rule: Primary source is Folder.name. If unknown, strictly fallback to 'OTHER'.
 */
export function resolveLayerMediaType(layerName: string): ElectionRemovalMediaType {
  return detectMediaTypeFromText(layerName) ?? 'OTHER';
}

/**
 * Detects whether an election removal placemark/layer is a full removal, banner change, or direct relocation.
 * Explicit tags (e.g. [Operace: Odvoz na sklad] / [Operace: Převoz] / [Operace: Výměna plachty]) take absolute precedence.
 */
export function detectOperationTypeFromText(text?: string | null): ElectionRemovalOperationType {
  if (!text) return 'FULL_REMOVAL';
  const normalized = normalizeForMatching(text);

  // 1. Explicit tags take absolute precedence over underlying/imported text
  if (
    normalized.includes('operace: odvoz na sklad') ||
    normalized.includes('operace: sklad') ||
    normalized.includes('operace: demontaz') ||
    normalized.includes('[full_removal]')
  ) {
    return 'FULL_REMOVAL';
  }
  if (
    normalized.includes('operace: prevoz na jine misto') ||
    normalized.includes('operace: prevoz') ||
    normalized.includes('operace: premisteni') ||
    normalized.includes('operace: relokace') ||
    normalized.includes('[relocation]')
  ) {
    return 'RELOCATION';
  }
  if (
    normalized.includes('operace: vymena plachty') ||
    normalized.includes('operace: jen plachta') ||
    normalized.includes('operace: plachta') ||
    normalized.includes('[banner_change]')
  ) {
    return 'BANNER_CHANGE';
  }

  // 2. Heuristic detection from imported placemark/layer text
  if (
    normalized.includes('vymena placht') ||
    normalized.includes('vymeny placht') ||
    normalized.includes('vymena plach') ||
    normalized.includes('jenom placht') ||
    normalized.includes('jen placht') ||
    normalized.includes('prevleceni') ||
    normalized.includes('reskin') ||
    normalized.includes('prelep') ||
    normalized.includes('plachty') ||
    normalized.includes('plachet')
  ) {
    return 'BANNER_CHANGE';
  }
  if (
    normalized.includes('prevoz') ||
    normalized.includes('premiste') ||
    normalized.includes('stehovan') ||
    normalized.includes('relokac')
  ) {
    return 'RELOCATION';
  }
  return 'FULL_REMOVAL';
}

/**
 * Updates a point description by setting an explicit [Operace: ...] tag and optional relocation destination.
 */
export function setPointOperationTypeInDescription(
  currentDescription: string | null | undefined,
  operationType: ElectionRemovalOperationType,
  relocationDestination?: string | null
): string {
  // Strip any existing [Operace: ...] and [Cíl převozu: ...] tags
  const desc = (currentDescription || '')
    .replace(/\[Operace:\s*[^\]]+\]\s*/gi, '')
    .replace(/\[C[ií]l\s*p[rř]evozu:\s*[^\]]+\]\s*/gi, '')
    .trim();

  let tag = '[Operace: Odvoz na sklad]';
  if (operationType === 'BANNER_CHANGE') {
    tag = '[Operace: Výměna plachty]';
  } else if (operationType === 'RELOCATION') {
    const destPart = relocationDestination?.trim()
      ? ` [Cíl převozu: ${relocationDestination.trim()}]`
      : '';
    tag = `[Operace: Převoz na jiné místo]${destPart}`;
  }

  return desc ? `${tag}\n${desc}` : tag;
}

/**
 * Strips XML tags and unescapes XML/HTML entities and CDATA.
 */
function cleanXmlContent(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Extracts inner content of the first matching XML tag.
 */
function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Parses GPS coordinates strictly as longitude,latitude,altitude.
 * Google My Maps coordinates are formatted as: "lng,lat,alt" or "lng,lat"
 */
function parseCoordinates(rawCoordinates: string): {
  latitude: number;
  longitude: number;
  isValid: boolean;
  error?: string;
  isOutsideCzechBounds: boolean;
} {
  const normalized = rawCoordinates.replace(/\s*,\s*/g, ',').trim();
  const cleaned = normalized.split(/\s+/)[0];
  if (!cleaned) {
    return {
      latitude: 0,
      longitude: 0,
      isValid: false,
      error: 'Prázdný element souřadnic',
      isOutsideCzechBounds: false,
    };
  }

  const parts = cleaned.split(',');
  if (parts.length < 2) {
    return {
      latitude: 0,
      longitude: 0,
      isValid: false,
      error: `Neplatný formát souřadnic: "${cleaned}"`,
      isOutsideCzechBounds: false,
    };
  }

  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return {
      latitude: 0,
      longitude: 0,
      isValid: false,
      error: `Nečíselné souřadnice: "${cleaned}"`,
      isOutsideCzechBounds: false,
    };
  }

  // Hard validation: Global latitude/longitude ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return {
      latitude: lat,
      longitude: lng,
      isValid: false,
      error: `Souřadnice mimo globální rozsah: lat=${lat}, lng=${lng}`,
      isOutsideCzechBounds: false,
    };
  }

  // Soft warning: Czech Republic bounding box
  const isOutsideCzechBounds =
    lat < CZECH_BOUNDS.minLat ||
    lat > CZECH_BOUNDS.maxLat ||
    lng < CZECH_BOUNDS.minLng ||
    lng > CZECH_BOUNDS.maxLng;

  return {
    latitude: lat,
    longitude: lng,
    isValid: true,
    isOutsideCzechBounds,
  };
}

interface RawPlacemark {
  name: string;
  description?: string;
  rawCoordinates?: string;
  layerName: string;
}

/**
 * Parses a Google My Maps KML string into layers and points.
 *
 * Binding business rules:
 * 1. Each Placemark is 1 physical removal item (default quantity = 1).
 * 2. Two Placemarks at identical GPS remain two distinct independent points. Never merge them.
 * 3. Media type is suggested primarily from Folder (layer) name. Fallback to Placemark signals, then OTHER.
 * 4. Coordinate parsing: tokens[0] = lng, tokens[1] = lat. Hard error only if NaN or out of -90..90/-180..180.
 * 5. Czech boundaries are a soft warning badge only.
 */
export function parseGoogleMyMapsKml(kmlContent: string): KmlParseResult {
  if (!kmlContent || typeof kmlContent !== 'string') {
    throw new Error('KML soubor je prázdný nebo neplatný.');
  }

  // Extract Document name if present
  let suggestedCampaignName = 'Volební kampaň';
  const docMatch = kmlContent.match(/<Document(?:[\s\S]*?)>([\s\S]*?)<\/Document>/i);
  const docScope = docMatch ? docMatch[1] : kmlContent;
  const docNameRaw = extractTagContent(docScope, 'name');
  if (docNameRaw) {
    const cleanedDocName = cleanXmlContent(docNameRaw);
    if (cleanedDocName) {
      suggestedCampaignName = cleanedDocName;
    }
  }

  // Match all <Folder> blocks
  const folderRegex = /<Folder(?:[\s\S]*?)>([\s\S]*?)<\/Folder>/gi;
  const rawPlacemarks: RawPlacemark[] = [];
  const layerNamesSet = new Set<string>();

  let folderMatch: RegExpExecArray | null;
  let remainingKml = kmlContent;

  while ((folderMatch = folderRegex.exec(kmlContent)) !== null) {
    const folderBlock = folderMatch[1];
    const folderNameRaw = extractTagContent(folderBlock, 'name');
    const folderName = folderNameRaw ? cleanXmlContent(folderNameRaw) : 'Bez názvu vrstvy';
    layerNamesSet.add(folderName);

    // Extract Placemarks in this Folder
    const placemarkRegex = /<Placemark(?:[\s\S]*?)>([\s\S]*?)<\/Placemark>/gi;
    let pmMatch: RegExpExecArray | null;
    while ((pmMatch = placemarkRegex.exec(folderBlock)) !== null) {
      const pmBlock = pmMatch[1];
      const nameRaw = extractTagContent(pmBlock, 'name');
      const descRaw = extractTagContent(pmBlock, 'description');
      const coordRaw = extractTagContent(pmBlock, 'coordinates');

      rawPlacemarks.push({
        name: nameRaw ? cleanXmlContent(nameRaw) : 'Bod bez názvu',
        description: descRaw ? cleanXmlContent(descRaw) : undefined,
        rawCoordinates: coordRaw ? coordRaw.trim() : undefined,
        layerName: folderName,
      });
    }

    // Cut out folder from remainingKml so we can detect top-level placemarks
    remainingKml = remainingKml.replace(folderMatch[0], '');
  }

  // Check for any top-level Placemarks not wrapped in a <Folder>
  const topPlacemarkRegex = /<Placemark(?:[\s\S]*?)>([\s\S]*?)<\/Placemark>/gi;
  let topPmMatch: RegExpExecArray | null;
  while ((topPmMatch = topPlacemarkRegex.exec(remainingKml)) !== null) {
    const pmBlock = topPmMatch[1];
    const nameRaw = extractTagContent(pmBlock, 'name');
    const descRaw = extractTagContent(pmBlock, 'description');
    const coordRaw = extractTagContent(pmBlock, 'coordinates');
    const defaultLayerName = 'Obecná vrstva';
    layerNamesSet.add(defaultLayerName);

    rawPlacemarks.push({
      name: nameRaw ? cleanXmlContent(nameRaw) : 'Bod bez názvu',
      description: descRaw ? cleanXmlContent(descRaw) : undefined,
      rawCoordinates: coordRaw ? coordRaw.trim() : undefined,
      layerName: defaultLayerName,
    });
  }

  // Build Layer metadata
  const layerMap = new Map<string, ParsedKmlLayer>();
  let layerIndex = 0;
  for (const layerName of layerNamesSet) {
    const detectedType = resolveLayerMediaType(layerName);
    const layerId = `layer_${layerIndex++}`;
    layerMap.set(layerName, {
      id: layerId,
      name: layerName,
      detectedMediaType: detectedType,
      pointCount: 0,
      defaultServiceMinutes: DEFAULT_MEDIA_SERVICE_MINUTES[detectedType] ?? 10,
    });
  }

  // Parse points
  const points: ParsedKmlPoint[] = [];
  let validPointsCount = 0;
  let invalidPointsCount = 0;
  let outsideCzechCount = 0;
  let totalEstimatedMinutes = 0;

  for (let i = 0; i < rawPlacemarks.length; i++) {
    const raw = rawPlacemarks[i];
    const layer = layerMap.get(raw.layerName);
    const layerId = layer ? layer.id : 'layer_default';
    const layerMediaType = layer ? layer.detectedMediaType : 'OTHER';

    // Primary media type signal is Layer. If Layer is OTHER, check Placemark name/desc as secondary signal.
    let resolvedMediaType: ElectionRemovalMediaType = layerMediaType;
    if (resolvedMediaType === 'OTHER') {
      const secondarySignal =
        detectMediaTypeFromText(raw.name) ??
        detectMediaTypeFromText(raw.description);
      if (secondarySignal) {
        resolvedMediaType = secondarySignal;
      }
    }

    if (layer) {
      layer.pointCount++;
    }

    const pointId = `point_${i + 1}`;

    if (!raw.rawCoordinates) {
      invalidPointsCount++;
      points.push({
        id: pointId,
        name: raw.name,
        description: raw.description,
        layerId,
        layerName: raw.layerName,
        mediaType: resolvedMediaType,
        latitude: 0,
        longitude: 0,
        quantity: 1,
        serviceMinutes: DEFAULT_MEDIA_SERVICE_MINUTES[resolvedMediaType] ?? 10,
        isValid: false,
        validationError: 'V Placemarku chybí element <coordinates>',
        isOutsideCzechBounds: false,
      });
      continue;
    }

    const coordResult = parseCoordinates(raw.rawCoordinates);
    if (!coordResult.isValid) {
      invalidPointsCount++;
      points.push({
        id: pointId,
        name: raw.name,
        description: raw.description,
        layerId,
        layerName: raw.layerName,
        mediaType: resolvedMediaType,
        latitude: coordResult.latitude,
        longitude: coordResult.longitude,
        quantity: 1,
        serviceMinutes: DEFAULT_MEDIA_SERVICE_MINUTES[resolvedMediaType] ?? 10,
        isValid: false,
        validationError: coordResult.error ?? 'Neplatné souřadnice',
        isOutsideCzechBounds: coordResult.isOutsideCzechBounds,
      });
      continue;
    }

    // Valid point: default quantity strictly 1
    const operationType = detectOperationTypeFromText(`${raw.layerName} ${raw.name} ${raw.description || ''}`);
    const { totalMinutes } = calculateServiceMinutes(resolvedMediaType, 1, null, operationType);
    const loadSlots = calculateMediaLoadSlots(resolvedMediaType, operationType, 1);
    validPointsCount++;
    totalEstimatedMinutes += totalMinutes;

    if (coordResult.isOutsideCzechBounds) {
      outsideCzechCount++;
    }

    points.push({
      id: pointId,
      name: raw.name,
      description: raw.description,
      layerId,
      layerName: raw.layerName,
      mediaType: resolvedMediaType,
      operationType,
      loadSlots,
      latitude: coordResult.latitude,
      longitude: coordResult.longitude,
      quantity: 1,
      serviceMinutes: totalMinutes,
      isValid: true,
      isOutsideCzechBounds: coordResult.isOutsideCzechBounds,
    });
  }

  return {
    suggestedCampaignName,
    layers: Array.from(layerMap.values()),
    points,
    summary: {
      totalPoints: rawPlacemarks.length,
      validPoints: validPointsCount,
      invalidPoints: invalidPointsCount,
      outsideCzechBoundsCount: outsideCzechCount,
      totalEstimatedMinutes,
    },
  };
}
