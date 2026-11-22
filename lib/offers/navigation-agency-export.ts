import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake';
import roboto from 'pdfmake/build/fonts/Roboto.js';
import sharp from 'sharp';
import { prisma } from '../db';
import { getSignedStaticMapUrl } from '../google-maps';
import { readStoredPhoto } from '../storage/photo-storage';
import { buildZipArchive, type ZipArchiveEntry } from '../zip-builder';
import {
  formatNavigationPointDesignation,
  getPointPinVisual,
} from './navigation-carrier-types';
import type { OfferView } from './view-model';

export type NavigationPhotoSource = 'VIZUALIZACE' | 'FOTO_MISTA' | 'REALIZACE' | 'BEZ_FOTKY';

export interface ExportNavigationTarget {
  index: number; // 1-based
  code: string; // C1, C2...
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  note: string;
  color: string;
  photoFileName: string | null; // relative path in zip: fotky/CIL_01_...jpg
  photoBuffer: Buffer | null;
  photoMime: string | null;
}

export interface ExportNavigationPoint {
  index: number; // 1-based
  code: string; // P01, P02...
  shortCode: string; // P1, P2...
  id: string;
  title: string; // e.g. P1 – Orlovská – 500 m rovně
  street: string;
  address: string;
  city: string;
  pillarNumber: string;
  pillarType: string;
  carrierType: string;
  carrierCategoryId: string;
  variant: string;
  orientation: string;
  direction: string;
  arrowDirectionEnum: string;
  distance: string;
  distanceMeters: number | null;
  targetCode: string;
  targetName: string;
  latitude: number;
  longitude: number;
  pinColor: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  installationPrice: number;
  productionPrice: number;
  clientNote: string;
  googleMapsUrl: string;
  routeCoords: Array<{ lat: number; lng: number }>;
  photoSource: NavigationPhotoSource;
  photoFileName: string | null; // e.g. "fotky/P01_Orlovska_500m_rovne.jpg"
  photoBaseName: string | null; // e.g. "P01_Orlovska_500m_rovne.jpg"
  photoBuffer: Buffer | null;
  photoMime: string | null;
}

export interface NavigationAgencyExportOptions {
  /** Include price columns in XLSX / CSV / JSON. Defaults to false for concepts/phase 1, true for priced quotes. */
  includePrices?: boolean;
  /** Optional subset of NavigationPoint IDs to export. If omitted, exports all points (or selectedOnly if set). */
  pointIds?: string[] | null;
  /** If true and pointIds is omitted, export only points where isSelectedByClient !== false. */
  selectedOnly?: boolean;
  /** Optional custom image resolver for testing. */
  imageResolver?: (
    urlOrId: string | null | undefined,
    fallbackPhotoId?: string | null
  ) => Promise<{ buffer: Buffer; mime: string } | null>;
  /** Optional skip network map tiles (used in unit tests). */
  offlineMapFallbackOnly?: boolean;
}

export interface NavigationAgencyExportResult {
  zipBuffer: Buffer;
  fileName: string;
  pointCount: number;
  photoCount: number;
  visualizationPhotoCount: number;
}

let pdfFontsConfigured = false;

function ensurePdfFonts() {
  if (pdfFontsConfigured) return;
  for (const [name, font] of Object.entries(roboto.vfs)) {
    pdfMake.virtualfs.writeFileSync(name, font.data, font.encoding);
  }
  pdfMake.addFonts(roboto.fonts);
  pdfMake.setLocalAccessPolicy(() => false);
  pdfMake.setUrlAccessPolicy(() => false);
  pdfFontsConfigured = true;
}

export function formatExportPointCode(index1Based: number): string {
  return `P${String(index1Based).padStart(2, '0')}`;
}

export function formatExportTargetCode(index1Based: number): string {
  return `C${index1Based}`;
}

export function sanitizeExportSlug(value: string | null | undefined, maxLen = 48): string {
  const cleaned = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return cleaned.slice(0, maxLen) || 'pozice';
}

export function detectImageExtension(buffer: Buffer, mime?: string | null): { ext: string; mime: string } {
  if (buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { ext: 'png', mime: 'image/png' };
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    // WEBP: RIFF....WEBP
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { ext: 'webp', mime: 'image/webp' };
    }
  }
  const m = (mime || '').toLowerCase();
  if (m.includes('png')) return { ext: 'png', mime: 'image/png' };
  if (m.includes('webp')) return { ext: 'webp', mime: 'image/webp' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}

/**
 * Decodes a Google Encoded Polyline string into lat/lng coordinates.
 */
export function decodeEncodedPolyline(encoded?: string | null): Array<{ lat: number; lng: number }> {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;
    do {
      if (index >= encoded.length) return points;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;
    do {
      if (index >= encoded.length) return points;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/**
 * Resolves a photo URL, data URI, photo ID, or public file path into raw binary Buffer + MIME type.
 */
export async function resolveImageToBuffer(
  urlOrId: string | null | undefined,
  fallbackPhotoId?: string | null
): Promise<{ buffer: Buffer; mime: string } | null> {
  const target = (urlOrId || '').trim();
  if (!target && !fallbackPhotoId) return null;

  // 1. Base64 data URL
  if (target.startsWith('data:image/')) {
    const match = target.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (match) {
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 0) {
        const info = detectImageExtension(buffer, match[1]);
        return { buffer, mime: info.mime };
      }
    }
    return null;
  }

  // 2. Prisma Photo record (always resolves FULL resolution, never thumbnail!)
  let photoId = fallbackPhotoId || null;
  const matchPhotoUrl = target.match(/\/photos\/([A-Za-z0-9_-]{10,64})/);
  if (matchPhotoUrl) {
    photoId = matchPhotoUrl[1];
  } else if (!target.startsWith('/') && !target.startsWith('http') && /^[A-Za-z0-9_-]{10,64}$/.test(target)) {
    photoId = target;
  }

  if (photoId) {
    try {
      const photo = await prisma.photo.findFirst({
        where: { id: photoId },
        select: {
          id: true,
          driveFileId: true,
          fileName: true,
          mimeType: true,
          url: true,
          content: true,
          storageKey: true,
          storageProvider: true,
        },
      });
      if (photo) {
        const stored = await readStoredPhoto({
          id: photo.id,
          url: photo.url || '',
          content: photo.content,
          driveFileId: photo.driveFileId,
          mimeType: photo.mimeType,
          storageKey: photo.storageKey,
          storageProvider: photo.storageProvider,
        });
        if (stored?.body) {
          const ab = await new Response(stored.body as BodyInit).arrayBuffer();
          const buffer = Buffer.from(ab);
          if (buffer.length > 0) {
            const info = detectImageExtension(buffer, stored.contentType || photo.mimeType);
            return { buffer, mime: info.mime };
          }
        }
        if (stored?.redirectUrl) {
          const res = await fetch(stored.redirectUrl, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > 0) {
              const info = detectImageExtension(buffer, res.headers.get('content-type') || photo.mimeType);
              return { buffer, mime: info.mime };
            }
          }
        }
      }
    } catch {
      // Fall through to local/remote fetch
    }
  }

  // 3. Local static asset under public/
  if (target.startsWith('/') && !target.startsWith('/api/')) {
    try {
      const cleanPath = target.replace(/^\/+/, '').split('?')[0];
      const localFilePath = path.join(process.cwd(), 'public', cleanPath);
      const buffer = await fs.readFile(localFilePath);
      if (buffer.length > 0) {
        const info = detectImageExtension(buffer);
        return { buffer, mime: info.mime };
      }
    } catch {
      // Not a local file
    }
  }

  // 4. Remote HTTP(S) image
  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 0) {
          const info = detectImageExtension(buffer, res.headers.get('content-type'));
          return { buffer, mime: info.mime };
        }
      }
    } catch {
      // Fetch failed
    }
  }

  return null;
}

// ============================================================
// WEB MERCATOR PROJECTION & FONT-INDEPENDENT VECTOR MAP PINS
// ============================================================

export interface MapViewport {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

function latToWorldY(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 256 * n;
}

function lngToWorldX(lng: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  return ((lng + 180) / 360) * 256 * n;
}

function worldYToLat(y: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  const mercN = Math.PI * (1 - (2 * y) / (256 * n));
  return (Math.atan(Math.sinh(mercN)) * 180) / Math.PI;
}

function worldXToLng(x: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  return (x / (256 * n)) * 360 - 180;
}

export function computeMapViewport(
  coords: Array<{ lat: number; lng: number }>,
  logicalWidth = 640,
  logicalHeight = 400,
  paddingLogicalPx = 64
): MapViewport {
  const valid = coords.filter(
    (c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && (Math.abs(c.lat) > 0.001 || Math.abs(c.lng) > 0.001)
  );
  if (valid.length === 0) {
    return { centerLat: 49.8209, centerLng: 18.2625, zoom: 13 }; // Ostrava default
  }

  if (valid.length === 1) {
    return { centerLat: valid[0].lat, centerLng: valid[0].lng, zoom: 15 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of valid) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  const usableW = Math.max(120, logicalWidth - paddingLogicalPx * 2);
  const usableH = Math.max(120, logicalHeight - paddingLogicalPx * 2);

  let bestZoom = 16;
  for (let z = 17; z >= 5; z--) {
    const xMin = lngToWorldX(minLng, z);
    const xMax = lngToWorldX(maxLng, z);
    const yMin = latToWorldY(maxLat, z); // North is smaller Y
    const yMax = latToWorldY(minLat, z);
    if (xMax - xMin <= usableW && yMax - yMin <= usableH) {
      bestZoom = z;
      break;
    }
  }

  // Center in Web Mercator pixel space so pins are visually balanced
  const centerX = (lngToWorldX(minLng, bestZoom) + lngToWorldX(maxLng, bestZoom)) / 2;
  const centerY = (latToWorldY(maxLat, bestZoom) + latToWorldY(minLat, bestZoom)) / 2;

  return {
    centerLat: worldYToLat(centerY, bestZoom),
    centerLng: worldXToLng(centerX, bestZoom),
    zoom: bestZoom,
  };
}

export function projectLatLngToPixel(
  lat: number,
  lng: number,
  viewport: MapViewport,
  logicalWidth = 640,
  logicalHeight = 400,
  scale = 2
): { x: number; y: number } {
  const cx = lngToWorldX(viewport.centerLng, viewport.zoom);
  const cy = latToWorldY(viewport.centerLat, viewport.zoom);
  const px = lngToWorldX(lng, viewport.zoom);
  const py = latToWorldY(lat, viewport.zoom);
  return {
    x: (logicalWidth / 2 + (px - cx)) * scale,
    y: (logicalHeight / 2 + (py - cy)) * scale,
  };
}

/**
 * Pure geometric stroke-path glyphs defined in a 10x14 coordinate box.
 * Guarantees crisp pin numbers (P01, P02, ..., C1) on Linux/Vercel serverless even with zero system fonts.
 */
const VECTOR_GLYPHS: Record<string, string> = {
  '0': 'M 2 3 C 2 1 8 1 8 3 L 8 11 C 8 13 2 13 2 11 Z',
  '1': 'M 3 4 L 5.5 1.5 L 5.5 12.5 M 3 12.5 L 8 12.5',
  '2': 'M 2 4 C 2 1.2 8 1.2 8 4.2 C 8 6.8 2 9.5 2 12.5 L 8.2 12.5',
  '3': 'M 2 3.2 C 2 1.2 8 1.2 8 4 C 8 5.8 6.4 6.8 4.5 6.8 C 6.8 6.8 8.2 8 8.2 10 C 8.2 12.8 2 12.8 2 10.6',
  '4': 'M 7 12.5 L 7 1.5 L 1.8 9 L 8.6 9',
  '5': 'M 8 1.5 L 2.4 1.5 L 2.2 6.4 C 3.2 5.4 8.2 5.4 8.2 9.2 C 8.2 12.8 2.2 12.8 2 10.6',
  '6': 'M 7.8 3.2 C 7.2 1.2 2 1.4 2 7 C 2 12.6 8.2 12.6 8.2 9.2 C 8.2 6.2 2.4 6.2 2.1 8.5',
  '7': 'M 1.8 1.5 L 8.4 1.5 L 4 12.5',
  '8': 'M 5 6.8 C 2.2 6.8 2.2 1.5 5 1.5 C 7.8 1.5 7.8 6.8 5 6.8 Z M 5 6.8 C 1.8 6.8 1.8 12.5 5 12.5 C 8.2 12.5 8.2 6.8 5 6.8 Z',
  '9': 'M 2.2 10.8 C 2.8 12.8 8 12.6 8 7 C 8 1.4 1.8 1.4 1.8 4.8 C 1.8 7.8 7.6 7.8 7.9 5.5',
  'P': 'M 2.2 12.5 L 2.2 1.5 L 6.2 1.5 C 8.6 1.5 8.6 7.4 6.2 7.4 L 2.2 7.4',
  'C': 'M 8.2 3.5 C 7.2 1.2 2 1.2 2 7 C 2 12.8 7.2 12.8 8.2 10.5',
};

export function renderPinTextSvgPaths(
  text: string,
  centerX: number,
  centerY: number,
  glyphHeight = 14,
  strokeColor = '#ffffff'
): string {
  const chars = text.toUpperCase().split('').filter((ch) => Boolean(VECTOR_GLYPHS[ch]));
  if (chars.length === 0) return '';

  const scale = glyphHeight / 14;
  const charAdvance = 10.2 * scale;
  const totalWidth = chars.length * charAdvance - 1.2 * scale;
  const startX = centerX - totalWidth / 2;
  const startY = centerY - glyphHeight / 2;
  const strokeWidth = Math.max(1.8, 2.25 * scale);

  return chars
    .map((ch, idx) => {
      const d = VECTOR_GLYPHS[ch];
      const tx = startX + idx * charAdvance;
      return `<g transform="translate(${tx.toFixed(1)},${startY.toFixed(1)}) scale(${scale.toFixed(3)})"><path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${(strokeWidth / scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    })
    .join('');
}

async function fetchBackgroundMapBuffer(
  viewport: MapViewport,
  logicalWidth: number,
  logicalHeight: number,
  scale: 1 | 2,
  offlineOnly: boolean
): Promise<Buffer> {
  const pixelWidth = logicalWidth * scale;
  const pixelHeight = logicalHeight * scale;

  if (!offlineOnly) {
    // 1. Try Google Static Maps API (clean roadmap without pins)
    try {
      const signedUrl = getSignedStaticMapUrl({
        centerLat: viewport.centerLat,
        centerLng: viewport.centerLng,
        zoom: viewport.zoom,
        size: `${logicalWidth}x${logicalHeight}`,
        scale,
      });
      if (signedUrl) {
        const res = await fetch(signedUrl, { signal: AbortSignal.timeout(7000), cache: 'no-store' });
        if (res.ok) {
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (ct.startsWith('image/')) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > 2000) {
              return await sharp(buf).resize(pixelWidth, pixelHeight, { fit: 'cover' }).png().toBuffer();
            }
          }
        }
      }
    } catch {
      // Fall through to Carto Voyager / OSM tile stitch
    }

    // 2. Fallback: Stitch Carto Voyager @2x tiles (512x512) covering the exact Mercator viewport
    try {
      const z = viewport.zoom;
      const cx = lngToWorldX(viewport.centerLng, z);
      const cy = latToWorldY(viewport.centerLat, z);
      const x0 = cx - logicalWidth / 2;
      const y0 = cy - logicalHeight / 2;
      const tileMinX = Math.floor(x0 / 256);
      const tileMaxX = Math.floor((x0 + logicalWidth - 1) / 256);
      const tileMinY = Math.floor(y0 / 256);
      const tileMaxY = Math.floor((y0 + logicalHeight - 1) / 256);
      const maxTile = Math.pow(2, z);

      const tileJobs: Array<{ tx: number; ty: number; left: number; top: number }> = [];
      for (let tx = tileMinX; tx <= tileMaxX; tx++) {
        for (let ty = tileMinY; ty <= tileMaxY; ty++) {
          if (ty < 0 || ty >= maxTile) continue;
          const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
          const left = Math.round((tx * 256 - x0) * scale);
          const top = Math.round((ty * 256 - y0) * scale);
          tileJobs.push({ tx: wrappedTx, ty, left, top });
        }
      }

      if (tileJobs.length > 0 && tileJobs.length <= 24) {
        const tileSizePx = 256 * scale;
        const fetched = await Promise.all(
          tileJobs.map(async (job, idx) => {
            const mtIdx = idx % 4;
            const tileUrls = [
              scale === 2
                ? `https://mt${mtIdx}.google.com/vt/lyrs=m&hl=cs&scale=2&x=${job.tx}&y=${job.ty}&z=${z}`
                : `https://mt${mtIdx}.google.com/vt/lyrs=m&hl=cs&x=${job.tx}&y=${job.ty}&z=${z}`,
              `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${job.ty}/${job.tx}`,
            ];
            let raw: Buffer | null = null;
            for (const url of tileUrls) {
              try {
                const res = await fetch(url, {
                  headers: { 'User-Agent': 'Mozilla/5.0' },
                  signal: AbortSignal.timeout(5000),
                  cache: 'no-store',
                });
                if (res.ok) {
                  const candidate = Buffer.from(await res.arrayBuffer());
                  if (candidate.length > 500) {
                    raw = candidate;
                    break;
                  }
                }
              } catch {
                // Try next tile provider
              }
            }
            if (!raw) return null;
            try {
              // Crop tile to canvas bounds so sharp composite never overflows
              const cropLeft = Math.max(0, -job.left);
              const cropTop = Math.max(0, -job.top);
              const pasteLeft = Math.max(0, job.left);
              const pasteTop = Math.max(0, job.top);
              const visibleW = Math.min(tileSizePx - cropLeft, pixelWidth - pasteLeft);
              const visibleH = Math.min(tileSizePx - cropTop, pixelHeight - pasteTop);
              if (visibleW <= 0 || visibleH <= 0) return null;

              const resizedTile = await sharp(raw)
                .resize(tileSizePx, tileSizePx)
                .extract({ left: cropLeft, top: cropTop, width: visibleW, height: visibleH })
                .png()
                .toBuffer();

              return { input: resizedTile, left: pasteLeft, top: pasteTop };
            } catch {
              return null;
            }
          })
        );

        const validTiles = fetched.filter(
          (item): item is NonNullable<typeof item> => item !== null
        );
        if (validTiles.length > 0) {
          return await sharp({
            create: {
              width: pixelWidth,
              height: pixelHeight,
              channels: 4,
              background: { r: 226, g: 232, b: 240, alpha: 1 },
            },
          })
            .composite(validTiles)
            .png()
            .toBuffer();
        }
      }
    } catch {
      // Fall through to clean cartographic vector grid
    }
  }

  // 3. Offline clean cartographic canvas fallback
  const gridLines: string[] = [];
  for (let x = 0; x <= pixelWidth; x += 80) {
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${pixelHeight}" stroke="#cbd5e1" stroke-width="1"/>`);
  }
  for (let y = 0; y <= pixelHeight; y += 80) {
    gridLines.push(`<line x1="0" y1="${y}" x2="${pixelWidth}" y2="${y}" stroke="#cbd5e1" stroke-width="1"/>`);
  }
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}"><rect width="100%" height="100%" fill="#f1f5f9"/>${gridLines.join('')}</svg>`;
  return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
}

/**
 * Generates a high-resolution 1280x800 PNG overview map with crisp font-independent vector pins (P01, P02..., C1).
 */
export async function generateNavigationOverviewMapPng(params: {
  targets: ExportNavigationTarget[];
  points: ExportNavigationPoint[];
  offlineMapFallbackOnly?: boolean;
}): Promise<Buffer> {
  const logicalWidth = 640;
  const logicalHeight = 400;
  const scale = 2 as const;
  const pixelWidth = logicalWidth * scale; // 1280
  const pixelHeight = logicalHeight * scale; // 800

  const allCoords: Array<{ lat: number; lng: number }> = [
    ...params.targets.map((t) => ({ lat: t.latitude, lng: t.longitude })),
    ...params.points.map((p) => ({ lat: p.latitude, lng: p.longitude })),
  ];

  const viewport = computeMapViewport(allCoords, logicalWidth, logicalHeight, 68);
  const backgroundBuf = await fetchBackgroundMapBuffer(
    viewport,
    logicalWidth,
    logicalHeight,
    scale,
    Boolean(params.offlineMapFallbackOnly)
  );

  // Build vector SVG overlay: routes -> targets -> numbered navigation point badges
  const routeSvgs: string[] = [];
  for (const pt of params.points) {
    if (pt.routeCoords.length >= 2) {
      const polyPts = pt.routeCoords
        .map((c) => {
          const p = projectLatLngToPixel(c.lat, c.lng, viewport, logicalWidth, logicalHeight, scale);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ');
      routeSvgs.push(
        `<polyline points="${polyPts}" fill="none" stroke="${pt.pinColor}" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
  }

  // Subtle collision nudge if two pins are extremely close in pixels
  const placedPositions: Array<{ x: number; y: number }> = [];
  const nudgeIfClose = (rawX: number, rawY: number): { x: number; y: number } => {
    let x = Math.max(38, Math.min(pixelWidth - 38, rawX));
    let y = Math.max(38, Math.min(pixelHeight - 38, rawY));
    for (let tries = 0; tries < 8; tries++) {
      const clash = placedPositions.find((p) => Math.hypot(p.x - x, p.y - y) < 34);
      if (!clash) break;
      const angle = (tries * Math.PI) / 4;
      x = Math.max(38, Math.min(pixelWidth - 38, rawX + Math.cos(angle) * 28));
      y = Math.max(38, Math.min(pixelHeight - 38, rawY + Math.sin(angle) * 28));
    }
    placedPositions.push({ x, y });
    return { x, y };
  };

  const targetSvgs: string[] = [];
  for (const target of params.targets) {
    const raw = projectLatLngToPixel(target.latitude, target.longitude, viewport, logicalWidth, logicalHeight, scale);
    const x = Math.max(36, Math.min(pixelWidth - 36, raw.x));
    const y = Math.max(46, Math.min(pixelHeight - 24, raw.y));
    placedPositions.push({ x, y: y - 16 });
    const color = target.color || '#be123c';
    const badgeW = 54;
    const badgeH = 32;
    const bx = x - badgeW / 2;
    const by = y - badgeH - 12;
    const textPaths = renderPinTextSvgPaths(target.code, x, by + badgeH / 2, 15, '#ffffff');
    targetSvgs.push(
      `<g>
        <ellipse cx="${x.toFixed(1)}" cy="${(y + 2).toFixed(1)}" rx="11" ry="4.5" fill="rgba(15,23,42,0.32)"/>
        <path d="M ${(x - 9).toFixed(1)} ${(by + badgeH - 2).toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + 9).toFixed(1)} ${(by + badgeH - 2).toFixed(1)} Z" fill="${color}"/>
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${badgeW}" height="${badgeH}" rx="10" fill="${color}" stroke="#ffffff" stroke-width="3.5"/>
        ${textPaths}
      </g>`
    );
  }

  const pointSvgs: string[] = [];
  for (const pt of params.points) {
    const raw = projectLatLngToPixel(pt.latitude, pt.longitude, viewport, logicalWidth, logicalHeight, scale);
    const pos = nudgeIfClose(raw.x, raw.y);
    const badgeW = pt.code.length >= 4 ? 64 : 56;
    const badgeH = 30;
    const bx = pos.x - badgeW / 2;
    const by = pos.y - badgeH - 10;
    const leaderLine =
      Math.hypot(pos.x - raw.x, pos.y - raw.y) > 4
        ? `<line x1="${raw.x.toFixed(1)}" y1="${raw.y.toFixed(1)}" x2="${pos.x.toFixed(1)}" y2="${pos.y.toFixed(1)}" stroke="#0f172a" stroke-width="2" stroke-dasharray="4 3"/>`
        : '';
    const textPaths = renderPinTextSvgPaths(pt.code, pos.x, by + badgeH / 2, 13.5, '#ffffff');
    pointSvgs.push(
      `<g>
        ${leaderLine}
        <circle cx="${raw.x.toFixed(1)}" cy="${raw.y.toFixed(1)}" r="5" fill="${pt.pinColor}" stroke="#ffffff" stroke-width="2"/>
        <path d="M ${(pos.x - 7).toFixed(1)} ${(by + badgeH - 2).toFixed(1)} L ${pos.x.toFixed(1)} ${pos.y.toFixed(1)} L ${(pos.x + 7).toFixed(1)} ${(by + badgeH - 2).toFixed(1)} Z" fill="${pt.pinColor}"/>
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${badgeW}" height="${badgeH}" rx="9" fill="${pt.pinColor}" stroke="#ffffff" stroke-width="3"/>
        ${textPaths}
      </g>`
    );
  }

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${pixelWidth} ${pixelHeight}">
    ${routeSvgs.join('\n')}
    ${pointSvgs.join('\n')}
    ${targetSvgs.join('\n')}
    <rect x="0" y="0" width="${pixelWidth}" height="${pixelHeight}" fill="none" stroke="#0f172a" stroke-opacity="0.18" stroke-width="4"/>
  </svg>`;

  return sharp(backgroundBuf)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ============================================================
// PRINTABLE LANDSCAPE PDF MAP + LEGEND
// ============================================================

export async function generateNavigationMapLegendPdf(params: {
  clientName: string;
  campaignName: string;
  city: string;
  mapPngBuffer: Buffer;
  targets: ExportNavigationTarget[];
  points: ExportNavigationPoint[];
}): Promise<Buffer> {
  ensurePdfFonts();
  const mapDataUrl = `data:image/png;base64,${params.mapPngBuffer.toString('base64')}`;

  const tableBody: unknown[][] = [
    [
      { text: 'Kód na mapě', bold: true, color: '#ffffff', fillColor: '#0f172a', fontSize: 8.5 },
      { text: 'Ulice / Lokalita', bold: true, color: '#ffffff', fillColor: '#0f172a', fontSize: 8.5 },
      { text: 'Směr a vzdálenost', bold: true, color: '#ffffff', fillColor: '#0f172a', fontSize: 8.5 },
      { text: 'Nosič / Sloup VO', bold: true, color: '#ffffff', fillColor: '#0f172a', fontSize: 8.5 },
      { text: 'GPS souřadnice', bold: true, color: '#ffffff', fillColor: '#0f172a', fontSize: 8.5 },
      { text: 'Soubor fotografie (ve složce fotky/)', bold: true, color: '#ffffff', fillColor: '#0f172a', fontSize: 8.5 },
    ],
  ];

  for (const pt of params.points) {
    tableBody.push([
      { text: pt.code, bold: true, color: '#0284c7', fontSize: 9 },
      { text: pt.address || pt.street || pt.title, fontSize: 8.5 },
      { text: [pt.distance, pt.direction].filter(Boolean).join(' · ') || '—', fontSize: 8.5 },
      { text: [pt.carrierType, pt.pillarNumber ? `VO ${pt.pillarNumber}` : null].filter(Boolean).join(' · '), fontSize: 8.5 },
      { text: `${pt.latitude.toFixed(6)}, ${pt.longitude.toFixed(6)}`, fontSize: 8, color: '#475569' },
      { text: pt.photoBaseName || '(bez fotografie)', fontSize: 8, bold: Boolean(pt.photoBaseName), color: pt.photoBaseName ? '#0f172a' : '#94a3b8' },
    ]);
  }

  const targetSummary = params.targets
    .map((t) => `${t.code}: ${t.name}${t.address ? ` (${t.address})` : ''}`)
    .join('   |   ');

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [28, 28, 28, 28],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#0f172a' },
    content: [
      {
        columns: [
          {
            stack: [
              { text: 'MAPA NAVIGAČNÍCH POZIC & PÁROVÁNÍ FOTOGRAFIÍ', fontSize: 8, bold: true, color: '#0284c7' },
              { text: `${params.clientName} – ${params.campaignName}`, fontSize: 15, bold: true, margin: [0, 2, 0, 2] },
              { text: `Cíl(e): ${targetSummary || '—'}`, fontSize: 8.5, color: '#475569' },
            ],
            width: '*',
          },
          {
            stack: [
              { text: `Počet pozic: ${params.points.length}`, fontSize: 10, bold: true, alignment: 'right' },
              { text: `Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')}`, fontSize: 8, color: '#64748b', alignment: 'right' },
            ],
            width: 150,
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        image: mapDataUrl,
        width: 785,
        alignment: 'center',
        margin: [0, 0, 0, 12],
      },
      {
        text: 'Legenda pozic (kód na mapě P01, P02... odpovídá začátku názvu každé fotografie ve složce fotky/)',
        fontSize: 9.5,
        bold: true,
        color: '#0f172a',
        margin: [0, 2, 0, 6],
        pageBreak: 'before',
      },
      {
        table: {
          headerRows: 1,
          widths: [58, '*', 105, 115, 105, 175],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0 ? '#f8fafc' : null),
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
    ],
  };

  const pdfDoc = pdfMake.createPdf(docDefinition as Parameters<typeof pdfMake.createPdf>[0]);
  const buffer = await pdfDoc.getBuffer();
  return Buffer.from(buffer);
}

// ============================================================
// KML / KMZ / GEOJSON / EXCEL / CSV / INTERACTIVE HTML
// ============================================================

function escapeXml(value: string | null | undefined): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value: string | null | undefined): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToKmlColor(hex: string, alpha = 'ff'): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `${alpha}c78402`;
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  // KML color format is aabbggrr
  return `${alpha}${b}${g}${r}`.toLowerCase();
}

export function generateNavigationKml(params: {
  documentName: string;
  targets: ExportNavigationTarget[];
  points: ExportNavigationPoint[];
  embedKmzImages?: boolean;
}): string {
  const targetPlacemarks = params.targets
    .map((t) => {
      const imgHtml =
        params.embedKmzImages && t.photoFileName
          ? `<p><img src="files/${escapeHtml(path.posix.basename(t.photoFileName))}" width="380" /></p>`
          : '';
      const descHtml = `${imgHtml}<div><b>Cíl / Provozovna:</b> ${escapeHtml(t.name)}<br/><b>Adresa:</b> ${escapeHtml(t.address || '—')}<br/><b>GPS:</b> ${t.latitude.toFixed(6)}, ${t.longitude.toFixed(6)}${t.note ? `<br/><b>Poznámka:</b> ${escapeHtml(t.note)}` : ''}</div>`;
      return `      <Placemark>
        <name>${escapeXml(`${t.code} – ${t.name}`)}</name>
        <styleUrl>#targetStyle</styleUrl>
        <description><![CDATA[${descHtml}]]></description>
        <Point>
          <coordinates>${t.longitude},${t.latitude},0</coordinates>
        </Point>
      </Placemark>`;
    })
    .join('\n');

  const pointPlacemarks = params.points
    .map((pt) => {
      const imgHtml =
        params.embedKmzImages && pt.photoBaseName
          ? `<p><img src="files/${escapeHtml(pt.photoBaseName)}" width="420" /></p>`
          : '';
      const descHtml = `${imgHtml}<div><b>Kód pozice:</b> ${escapeHtml(pt.code)}<br/><b>Lokalita:</b> ${escapeHtml(pt.address || pt.street)}<br/><b>Směr šipky:</b> ${escapeHtml(pt.direction || '—')}<br/><b>Vzdálenost k cíli:</b> ${escapeHtml(pt.distance || '—')}<br/><b>Typ nosiče:</b> ${escapeHtml(pt.carrierType)} (${escapeHtml(pt.variant)})<br/>${pt.pillarNumber ? `<b>Číslo sloupu VO:</b> ${escapeHtml(pt.pillarNumber)}<br/>` : ''}<b>GPS:</b> ${pt.latitude.toFixed(6)}, ${pt.longitude.toFixed(6)}<br/><b>Soubor fotky:</b> ${escapeHtml(pt.photoFileName || '—')}${pt.clientNote ? `<br/><b>Poznámka:</b> ${escapeHtml(pt.clientNote)}` : ''}</div>`;
      return `      <Placemark>
        <name>${escapeXml(`${pt.code} – ${pt.street}${pt.distance ? ` (${pt.distance} ${pt.direction})` : ''}`)}</name>
        <styleUrl>#pointStyle_${escapeXml(pt.carrierCategoryId)}</styleUrl>
        <ExtendedData>
          <Data name="kod_bodu"><value>${escapeXml(pt.code)}</value></Data>
          <Data name="cislo_bodu"><value>${pt.index}</value></Data>
          <Data name="soubor_fotky"><value>${escapeXml(pt.photoFileName || '')}</value></Data>
          <Data name="typ_fotky"><value>${escapeXml(pt.photoSource)}</value></Data>
          <Data name="smer"><value>${escapeXml(pt.direction)}</value></Data>
          <Data name="vzdalenost"><value>${escapeXml(pt.distance)}</value></Data>
          <Data name="sloup_vo"><value>${escapeXml(pt.pillarNumber)}</value></Data>
        </ExtendedData>
        <description><![CDATA[${descHtml}]]></description>
        <Point>
          <coordinates>${pt.longitude},${pt.latitude},0</coordinates>
        </Point>
      </Placemark>`;
    })
    .join('\n');

  const routePlacemarks = params.points
    .filter((pt) => pt.routeCoords.length >= 2)
    .map((pt) => {
      const coordsText = pt.routeCoords.map((c) => `${c.lng},${c.lat},0`).join(' ');
      return `      <Placemark>
        <name>${escapeXml(`Trasa ${pt.code} → ${pt.targetName}`)}</name>
        <styleUrl>#routeStyle</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coordsText}</coordinates>
        </LineString>
      </Placemark>`;
    })
    .join('\n');

  const categoryStyles = Array.from(
    new Map(params.points.map((p) => [p.carrierCategoryId, p.pinColor])).entries()
  )
    .map(
      ([catId, color]) => `    <Style id="pointStyle_${escapeXml(catId)}">
      <IconStyle>
        <color>${hexToKmlColor(color)}</color>
        <scale>1.15</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-blank.png</href></Icon>
      </IconStyle>
    </Style>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(params.documentName)}</name>
    <description>Export navigačních pozic, tras a vizualizací – SeePOINT</description>
    <Style id="targetStyle">
      <IconStyle>
        <color>ff3c12be</color>
        <scale>1.3</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-stars.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="routeStyle">
      <LineStyle>
        <color>99c78402</color>
        <width>3</width>
      </LineStyle>
    </Style>
${categoryStyles}
    <Folder>
      <name>Cíle / Provozovny</name>
${targetPlacemarks}
    </Folder>
    <Folder>
      <name>Navigační pozice (P01–P${String(params.points.length).padStart(2, '0')})</name>
${pointPlacemarks}
    </Folder>
    <Folder>
      <name>Příjezdové trasy</name>
${routePlacemarks}
    </Folder>
  </Document>
</kml>`;
}

export function generateNavigationGeoJson(params: {
  name: string;
  clientName: string;
  campaignName: string;
  targets: ExportNavigationTarget[];
  points: ExportNavigationPoint[];
  includePrices: boolean;
}): string {
  const features: Array<Record<string, unknown>> = [];

  for (const t of params.targets) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.longitude, t.latitude] },
      properties: {
        featureType: 'target',
        code: t.code,
        name: t.name,
        address: t.address,
        note: t.note || null,
        color: t.color,
        photoFile: t.photoFileName,
      },
    });
  }

  for (const pt of params.points) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pt.longitude, pt.latitude] },
      properties: {
        featureType: 'navigation_point',
        code: pt.code,
        shortCode: pt.shortCode,
        pinNumber: pt.index,
        title: pt.title,
        street: pt.street,
        address: pt.address,
        city: pt.city,
        pillarNumber: pt.pillarNumber || null,
        carrierType: pt.carrierType,
        variant: pt.variant,
        direction: pt.direction,
        arrowDirectionEnum: pt.arrowDirectionEnum,
        distance: pt.distance || null,
        distanceMeters: pt.distanceMeters,
        targetCode: pt.targetCode,
        targetName: pt.targetName,
        pinColor: pt.pinColor,
        photoFile: pt.photoFileName,
        photoBaseName: pt.photoBaseName,
        photoSource: pt.photoSource,
        googleMapsUrl: pt.googleMapsUrl,
        note: pt.clientNote || null,
        ...(params.includePrices
          ? {
              quantity: pt.quantity,
              unitPriceCzk: pt.unitPrice,
              subtotalCzk: pt.subtotal,
            }
          : {}),
      },
    });

    if (pt.routeCoords.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: pt.routeCoords.map((c) => [c.lng, c.lat]),
        },
        properties: {
          featureType: 'route',
          pointCode: pt.code,
          targetCode: pt.targetCode,
          color: pt.pinColor,
        },
      });
    }
  }

  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: params.name,
      metadata: {
        clientName: params.clientName,
        campaignName: params.campaignName,
        generatedAt: new Date().toISOString(),
        pointCount: params.points.length,
        targetCount: params.targets.length,
      },
      features,
    },
    null,
    2
  );
}

export async function generateNavigationExcelBuffer(params: {
  clientName: string;
  campaignName: string;
  targets: ExportNavigationTarget[];
  points: ExportNavigationPoint[];
  includePrices: boolean;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SeePOINT OS';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Pozice navigací', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Kód bodu (mapa)', key: 'code', width: 15 },
    { header: 'Číslo', key: 'index', width: 8 },
    { header: 'Název pozice', key: 'title', width: 34 },
    { header: 'Město', key: 'city', width: 16 },
    { header: 'Ulice / Adresa', key: 'address', width: 34 },
    { header: 'Sloup VO', key: 'pillarNumber', width: 13 },
    { header: 'Typ nosiče', key: 'carrierType', width: 22 },
    { header: 'Rozměr / Varianta', key: 'variant', width: 22 },
    { header: 'Směr šipky', key: 'direction', width: 18 },
    { header: 'Vzdálenost k cíli', key: 'distance', width: 16 },
    { header: 'Cíl / Pobočka', key: 'targetName', width: 26 },
    { header: 'GPS Lat', key: 'latitude', width: 13 },
    { header: 'GPS Lng', key: 'longitude', width: 13 },
    { header: 'Soubor fotografie', key: 'photoFileName', width: 38 },
    { header: 'Typ fotografie', key: 'photoSource', width: 15 },
    { header: 'Odkaz Google Maps', key: 'googleMapsUrl', width: 42 },
    { header: 'Poznámka', key: 'clientNote', width: 36 },
  ];

  if (params.includePrices) {
    columns.push(
      { header: 'Počet ks', key: 'quantity', width: 10 },
      { header: 'Cena / ks (Kč bez DPH)', key: 'unitPrice', width: 20 },
      { header: 'Celkem (Kč bez DPH)', key: 'subtotal', width: 20 }
    );
  }

  sheet.columns = columns;

  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const photoSourceLabel: Record<NavigationPhotoSource, string> = {
    VIZUALIZACE: 'Vizualizace',
    FOTO_MISTA: 'Foto místa',
    REALIZACE: 'Foto realizace',
    BEZ_FOTKY: 'Bez fotky',
  };

  for (const pt of params.points) {
    const row = sheet.addRow({
      code: pt.code,
      index: pt.index,
      title: pt.title,
      city: pt.city,
      address: pt.address || pt.street,
      pillarNumber: pt.pillarNumber,
      carrierType: pt.carrierType,
      variant: pt.variant,
      direction: pt.direction,
      distance: pt.distance,
      targetName: `${pt.targetCode} – ${pt.targetName}`,
      latitude: Number(pt.latitude.toFixed(6)),
      longitude: Number(pt.longitude.toFixed(6)),
      photoFileName: pt.photoFileName || '',
      photoSource: photoSourceLabel[pt.photoSource],
      googleMapsUrl: { text: 'Otevřít na Google Maps', hyperlink: pt.googleMapsUrl },
      clientNote: pt.clientNote,
      ...(params.includePrices
        ? {
            quantity: pt.quantity,
            unitPrice: pt.unitPrice,
            subtotal: pt.subtotal,
          }
        : {}),
    });

    row.getCell('code').font = { bold: true, color: { argb: 'FF0284C7' } };
    row.getCell('googleMapsUrl').font = { color: { argb: 'FF0284C7' }, underline: true };
  }

  // Sheet 2: Targets / Branches
  const targetSheet = wb.addWorksheet('Cíle a pobočky', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  targetSheet.columns = [
    { header: 'Kód cíle (mapa)', key: 'code', width: 15 },
    { header: 'Název provozovny / cíle', key: 'name', width: 34 },
    { header: 'Adresa', key: 'address', width: 38 },
    { header: 'GPS Lat', key: 'latitude', width: 14 },
    { header: 'GPS Lng', key: 'longitude', width: 14 },
    { header: 'Soubor fotografie', key: 'photoFileName', width: 36 },
    { header: 'Poznámka', key: 'note', width: 36 },
  ];
  const tHeader = targetSheet.getRow(1);
  tHeader.height = 24;
  tHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } };
  });
  for (const t of params.targets) {
    targetSheet.addRow({
      code: t.code,
      name: t.name,
      address: t.address,
      latitude: Number(t.latitude.toFixed(6)),
      longitude: Number(t.longitude.toFixed(6)),
      photoFileName: t.photoFileName || '',
      note: t.note,
    });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function generateNavigationCsv(params: {
  points: ExportNavigationPoint[];
  includePrices: boolean;
}): string {
  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '');
    if (/[",\r\n;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Kod_bodu',
    'Cislo_na_mape',
    'Nazev_pozice',
    'Mesto',
    'Adresa_ulice',
    'Sloup_VO',
    'Typ_nosice',
    'Rozmer_varianta',
    'Smer_sipky',
    'Vzdalenost_k_cili',
    'Cil_kod',
    'Cil_nazev',
    'GPS_Lat',
    'GPS_Lng',
    'Soubor_fotky',
    'Typ_fotky',
    'Odkaz_Google_Maps',
    'Poznamka',
    ...(params.includePrices ? ['Pocet_ks', 'Cena_ks_CZK', 'Celkem_CZK'] : []),
  ];

  const lines = [headers.map(escapeCsv).join(',')];
  for (const pt of params.points) {
    const row = [
      pt.code,
      pt.index,
      pt.title,
      pt.city,
      pt.address || pt.street,
      pt.pillarNumber,
      pt.carrierType,
      pt.variant,
      pt.direction,
      pt.distance,
      pt.targetCode,
      pt.targetName,
      pt.latitude.toFixed(6),
      pt.longitude.toFixed(6),
      pt.photoFileName || '',
      pt.photoSource,
      pt.googleMapsUrl,
      pt.clientNote,
      ...(params.includePrices ? [pt.quantity, pt.unitPrice, pt.subtotal] : []),
    ];
    lines.push(row.map(escapeCsv).join(','));
  }

  // UTF-8 BOM so Czech diacritics open cleanly in Excel on Windows
  return `\uFEFF${lines.join('\r\n')}`;
}

export function generateNavigationInteractiveMapHtml(params: {
  clientName: string;
  campaignName: string;
  targets: ExportNavigationTarget[];
  points: ExportNavigationPoint[];
}): string {
  const safeJson = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c');

  const payload = {
    targets: params.targets.map((t) => ({
      code: t.code,
      name: t.name,
      address: t.address,
      lat: t.latitude,
      lng: t.longitude,
      color: t.color || '#be123c',
      photoRel: t.photoFileName ? `../${t.photoFileName}` : null,
    })),
    points: params.points.map((pt) => ({
      code: pt.code,
      index: pt.index,
      title: pt.title,
      street: pt.street,
      address: pt.address || pt.street,
      city: pt.city,
      direction: pt.direction,
      distance: pt.distance,
      carrierType: pt.carrierType,
      variant: pt.variant,
      pillarNumber: pt.pillarNumber,
      lat: pt.latitude,
      lng: pt.longitude,
      pinColor: pt.pinColor,
      photoRel: pt.photoFileName ? `../${pt.photoFileName}` : null,
      photoBaseName: pt.photoBaseName,
      photoSource: pt.photoSource,
      googleMapsUrl: pt.googleMapsUrl,
      routeCoords: pt.routeCoords,
      note: pt.clientNote,
    })),
  };

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mapa navigačních pozic – ${escapeHtml(params.clientName)} (${escapeHtml(params.campaignName)})</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #0f172a; height: 100vh; display: flex; flex-direction: column; }
    header { background: #020617; color: #fff; padding: 14px 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #1e293b; }
    header h1 { margin: 0; font-size: 17px; font-weight: 800; }
    header .sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .badge { background: #0284c7; color: #fff; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 999px; }
    .layout { flex: 1; display: grid; grid-template-columns: 380px 1fr; min-height: 0; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; grid-template-rows: 45vh 1fr; } }
    .sidebar { background: #f8fafc; overflow-y: auto; border-right: 1px solid #cbd5e1; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px; cursor: pointer; transition: all 0.15s ease; display: flex; gap: 10px; align-items: flex-start; }
    .card:hover, .card.active { border-color: #0284c7; box-shadow: 0 4px 14px rgba(2,132,199,0.16); background: #f0f9ff; }
    .thumb { width: 82px; height: 62px; border-radius: 9px; object-fit: cover; background: #e2e8f0; flex-shrink: 0; border: 1px solid #cbd5e1; }
    .pin-chip { display: inline-block; padding: 2px 7px; border-radius: 6px; color: #fff; font-weight: 800; font-size: 11px; margin-right: 6px; }
    .title { font-weight: 700; font-size: 13px; color: #0f172a; line-height: 1.3; }
    .meta { font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4; }
    .filename { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 10.5px; color: #0369a1; margin-top: 4px; word-break: break-all; }
    #map { width: 100%; height: 100%; }
    .pin-marker { color: #fff; font-weight: 900; font-size: 12px; padding: 4px 8px; border-radius: 9px; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(15,23,42,0.38); white-space: nowrap; text-align: center; }
    .popup-box { width: 300px; }
    .popup-box img { width: 100%; max-height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 8px; border: 1px solid #cbd5e1; cursor: zoom-in; }
    .popup-box h3 { margin: 0 0 4px; font-size: 14px; font-weight: 800; color: #0f172a; }
    .popup-box p { margin: 2px 0; font-size: 12px; color: #334155; }
    .popup-box a { display: inline-block; margin-top: 6px; color: #0284c7; font-weight: 700; font-size: 12px; text-decoration: none; }
    .lightbox { position: fixed; inset: 0; background: rgba(2,6,23,0.9); display: none; align-items: center; justify-content: center; z-index: 9999; padding: 24px; cursor: zoom-out; }
    .lightbox.open { display: flex; }
    .lightbox img { max-width: 95vw; max-height: 92vh; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(params.clientName)} – ${escapeHtml(params.campaignName)}</h1>
      <div class="sub">Interaktivní mapa navigačních pozic · Kliknutím na pin P01–P${String(params.points.length).padStart(2, '0')} zobrazíte vizualizaci pozice</div>
    </div>
    <span class="badge">${params.points.length} pozic · ${params.targets.length} cíl(ů)</span>
  </header>
  <div class="layout">
    <aside class="sidebar" id="sidebar"></aside>
    <div id="map"></div>
  </div>
  <div class="lightbox" id="lightbox" onclick="this.classList.remove('open')">
    <img id="lightboxImg" src="" alt="Vizualizace pozice" />
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const DATA = ${safeJson(payload)};
    const map = L.map('map');
    const googleStreets = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=cs&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
      maxZoom: 20
    });
    const googleHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=cs&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
      maxZoom: 20
    });
    const esriStreets = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    });
    googleStreets.addTo(map);
    L.control.layers({
      'Mapa (Google)': googleStreets,
      'Satelitní + ulice': googleHybrid,
      'Základní mapa (Esri)': esriStreets
    }, null, { position: 'topright' }).addTo(map);

    const bounds = [];
    const markerByCode = {};
    const cardByCode = {};

    function openLightbox(src) {
      const lb = document.getElementById('lightbox');
      document.getElementById('lightboxImg').src = src;
      lb.classList.add('open');
    }

    DATA.targets.forEach((t) => {
      bounds.push([t.lat, t.lng]);
      const icon = L.divIcon({
        className: '',
        html: '<div class="pin-marker" style="background:' + t.color + '">★ ' + t.code + '</div>',
        iconSize: [54, 28],
        iconAnchor: [27, 14]
      });
      const photoHtml = t.photoRel ? '<img src="' + t.photoRel + '" onclick="openLightbox(this.src)" />' : '';
      L.marker([t.lat, t.lng], { icon }).addTo(map).bindPopup(
        '<div class="popup-box">' + photoHtml + '<h3>' + t.code + ' – ' + t.name + '</h3><p>📍 ' + (t.address || '') + '</p><p>GPS: ' + t.lat.toFixed(6) + ', ' + t.lng.toFixed(6) + '</p></div>'
      );
    });

    const sidebar = document.getElementById('sidebar');
    DATA.points.forEach((pt) => {
      bounds.push([pt.lat, pt.lng]);
      if (pt.routeCoords && pt.routeCoords.length >= 2) {
        L.polyline(pt.routeCoords.map((c) => [c.lat, c.lng]), { color: pt.pinColor, weight: 3, opacity: 0.45 }).addTo(map);
      }
      const icon = L.divIcon({
        className: '',
        html: '<div class="pin-marker" style="background:' + pt.pinColor + '">' + pt.code + '</div>',
        iconSize: [46, 26],
        iconAnchor: [23, 13]
      });
      const photoHtml = pt.photoRel ? '<img src="' + pt.photoRel + '" onclick="openLightbox(this.src)" title="Kliknutím zvětšíte" />' : '';
      const popupHtml = '<div class="popup-box">'
        + photoHtml
        + '<h3>' + pt.code + ' – ' + pt.street + '</h3>'
        + '<p>🧭 ' + (pt.distance ? pt.distance + ' · ' : '') + (pt.direction || '') + '</p>'
        + '<p>📍 ' + pt.address + '</p>'
        + (pt.pillarNumber ? '<p>💡 Sloup VO: ' + pt.pillarNumber + '</p>' : '')
        + '<p>🖼️ Soubor: <code>' + (pt.photoBaseName || 'bez fotky') + '</code></p>'
        + '<p>GPS: ' + pt.lat.toFixed(6) + ', ' + pt.lng.toFixed(6) + '</p>'
        + '<a href="' + pt.googleMapsUrl + '" target="_blank" rel="noopener">Otevřít v Google Maps ↗</a>'
        + '</div>';
      const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(map).bindPopup(popupHtml, { maxWidth: 330 });
      markerByCode[pt.code] = marker;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = (pt.photoRel ? '<img class="thumb" src="' + pt.photoRel + '" alt="' + pt.code + '" />' : '<div class="thumb"></div>')
        + '<div>'
        + '<div class="title"><span class="pin-chip" style="background:' + pt.pinColor + '">' + pt.code + '</span>' + pt.street + '</div>'
        + '<div class="meta">' + [pt.distance, pt.direction, pt.carrierType].filter(Boolean).join(' · ') + '</div>'
        + '<div class="filename">' + (pt.photoBaseName || 'Bez fotografie') + '</div>'
        + '</div>';
      card.addEventListener('click', () => {
        Object.values(cardByCode).forEach((el) => el.classList.remove('active'));
        card.classList.add('active');
        map.setView([pt.lat, pt.lng], Math.max(map.getZoom(), 15), { animate: true });
        marker.openPopup();
      });
      marker.on('click', () => {
        Object.values(cardByCode).forEach((el) => el.classList.remove('active'));
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      cardByCode[pt.code] = card;
      sidebar.appendChild(card);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else {
      map.setView([49.8209, 18.2625], 13);
    }
  </script>
</body>
</html>`;
}

// ============================================================
// MAIN ORCHESTRATOR: BUILD COMPLETE AGENCY ZIP PACKAGE
// ============================================================

export async function buildNavigationAgencyExportZip(
  offer: OfferView,
  options: NavigationAgencyExportOptions = {}
): Promise<NavigationAgencyExportResult> {
  const nav = offer.navigation;
  if (!nav || !Array.isArray(nav.points) || nav.points.length === 0) {
    throw new Error('Nabídka neobsahuje žádné navigační pozice pro export.');
  }

  const resolveImg = options.imageResolver ?? resolveImageToBuffer;
  const isConceptOrSelection =
    Boolean(offer.isNoPriceConcept) || nav.proposalMode !== 'PRICED_QUOTE';
  const includePrices =
    typeof options.includePrices === 'boolean' ? options.includePrices : !isConceptOrSelection;

  // Filter points if requested
  let sourcePoints = nav.points;
  if (Array.isArray(options.pointIds) && options.pointIds.length > 0) {
    const idSet = new Set(options.pointIds);
    const filtered = nav.points.filter((p) => idSet.has(p.id));
    if (filtered.length > 0) sourcePoints = filtered;
  } else if (options.selectedOnly) {
    const filtered = nav.points.filter((p) => p.isSelectedByClient !== false);
    if (filtered.length > 0) sourcePoints = filtered;
  }

  // 1. Resolve targets (single or multi-branch)
  const rawTargets =
    Array.isArray(nav.targets) && nav.targets.length > 0
      ? nav.targets
      : [
          {
            id: 'primary-target',
            name: nav.targetName || offer.client.name || 'Cíl navigace',
            address: nav.targetAddress || '',
            latitude: nav.targetLatitude,
            longitude: nav.targetLongitude,
            note: nav.targetNote || '',
            photoUrl: nav.targetPhotoUrl || null,
            color: '#be123c',
          },
        ];

  const targets: ExportNavigationTarget[] = [];
  for (let i = 0; i < rawTargets.length; i++) {
    const t = rawTargets[i];
    const code = formatExportTargetCode(i + 1);
    const resolved = t.photoUrl ? await resolveImg(t.photoUrl) : null;
    let photoFileName: string | null = null;
    if (resolved) {
      const { ext } = detectImageExtension(resolved.buffer, resolved.mime);
      photoFileName = `fotky/CIL_${String(i + 1).padStart(2, '0')}_${sanitizeExportSlug(t.name, 36)}.${ext}`;
    }
    targets.push({
      index: i + 1,
      code,
      id: t.id,
      name: t.name || `Cíl ${i + 1}`,
      address: t.address || '',
      latitude: t.latitude,
      longitude: t.longitude,
      note: t.note || '',
      color: t.color || (i === 0 ? '#be123c' : '#2563eb'),
      photoFileName,
      photoBuffer: resolved?.buffer ?? null,
      photoMime: resolved?.mime ?? null,
    });
  }

  // 2. Resolve each navigation point + its visualization photo
  const points: ExportNavigationPoint[] = [];
  let photoCount = 0;
  let visualizationPhotoCount = 0;

  for (let i = 0; i < sourcePoints.length; i++) {
    const pt = sourcePoints[i];
    const index1 = i + 1;
    const code = formatExportPointCode(index1);
    const designation = formatNavigationPointDesignation(pt, i, { audience: 'CLIENT' });
    const pinVisual = getPointPinVisual(pt);

    const matchedTarget =
      targets.find((t) => t.id === (pt.targetId || pt.navigationTargetId)) || targets[0];

    // Strict priority: 1) Visualization from offer, 2) Site photo, 3) Installed photo
    let resolvedPhoto: { buffer: Buffer; mime: string } | null = null;
    let photoSource: NavigationPhotoSource = 'BEZ_FOTKY';

    if (pt.visualizedPhotoUrl) {
      resolvedPhoto = await resolveImg(pt.visualizedPhotoUrl);
      if (resolvedPhoto) {
        photoSource = 'VIZUALIZACE';
        visualizationPhotoCount++;
      }
    }
    if (!resolvedPhoto && (pt.sitePhotoUrl || pt.sitePhotoId)) {
      resolvedPhoto = await resolveImg(pt.sitePhotoUrl, pt.sitePhotoId);
      if (resolvedPhoto) {
        photoSource = 'FOTO_MISTA';
      }
    }
    if (!resolvedPhoto && (pt.installedPhotoUrl || pt.installedPhotoId)) {
      resolvedPhoto = await resolveImg(pt.installedPhotoUrl, pt.installedPhotoId);
      if (resolvedPhoto) {
        photoSource = 'REALIZACE';
      }
    }

    let photoBaseName: string | null = null;
    let photoFileName: string | null = null;
    if (resolvedPhoto) {
      photoCount++;
      const { ext } = detectImageExtension(resolvedPhoto.buffer, resolvedPhoto.mime);
      const streetPart = sanitizeExportSlug(designation.street || pt.label, 34);
      const distPart = designation.distance ? `_${sanitizeExportSlug(designation.distance, 12)}` : '';
      const dirPart = designation.direction ? `_${sanitizeExportSlug(designation.direction, 16)}` : '';
      photoBaseName = `${code}_${streetPart}${distPart}${dirPart}.${ext}`;
      photoFileName = `fotky/${photoBaseName}`;
    }

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${pt.latitude},${pt.longitude}`;

    points.push({
      index: index1,
      code,
      shortCode: designation.code,
      id: pt.id,
      title: designation.fullTitle,
      street: designation.street,
      address: pt.address || designation.street,
      city: nav.city || '',
      pillarNumber: pt.pillarNumber || '',
      pillarType: pt.pillarType || '',
      carrierType: pinVisual.label,
      carrierCategoryId: pinVisual.category.id,
      variant: pt.variant || '',
      orientation: pt.orientation || '',
      direction: designation.direction,
      arrowDirectionEnum: pt.arrowDirectionEnum || 'STRAIGHT',
      distance: designation.distance,
      distanceMeters: pt.calculatedDistanceMeters ?? null,
      targetCode: matchedTarget?.code || 'C1',
      targetName: matchedTarget?.name || nav.targetName || '',
      latitude: pt.latitude,
      longitude: pt.longitude,
      pinColor: pinVisual.color,
      quantity: Number(pt.quantity || 1) || 1,
      unitPrice: Number(pt.unitPrice || 0) || 0,
      subtotal: Number(pt.subtotal || 0) || 0,
      installationPrice: Number(pt.installationPrice || 0) || 0,
      productionPrice: Number(pt.productionPrice || 0) || 0,
      clientNote: pt.clientNote || '',
      googleMapsUrl,
      routeCoords: decodeEncodedPolyline(pt.routePolyline),
      photoSource,
      photoFileName,
      photoBaseName,
      photoBuffer: resolvedPhoto?.buffer ?? null,
      photoMime: resolvedPhoto?.mime ?? null,
    });
  }

  const clientName = offer.client.name || 'Klient';
  const campaignName = offer.campaignName || offer.title || 'Navigace';
  const documentTitle = `${clientName} – ${campaignName}`;

  // 3. Generate Map PNG, Map+Legend PDF, KML, KMZ (with embedded images), GeoJSON, HTML Map, Excel, CSV, JSON
  const mapPngBuffer = await generateNavigationOverviewMapPng({
    targets,
    points,
    offlineMapFallbackOnly: options.offlineMapFallbackOnly,
  });

  const [mapLegendPdfBuffer, excelBuffer] = await Promise.all([
    generateNavigationMapLegendPdf({
      clientName,
      campaignName,
      city: nav.city || '',
      mapPngBuffer,
      targets,
      points,
    }),
    generateNavigationExcelBuffer({
      clientName,
      campaignName,
      targets,
      points,
      includePrices,
    }),
  ]);

  const plainKml = generateNavigationKml({
    documentName: documentTitle,
    targets,
    points,
    embedKmzImages: false,
  });

  const kmzDocKml = generateNavigationKml({
    documentName: documentTitle,
    targets,
    points,
    embedKmzImages: true,
  });

  const kmzEntries: ZipArchiveEntry[] = [{ name: 'doc.kml', data: kmzDocKml }];
  for (const pt of points) {
    if (pt.photoBuffer && pt.photoBaseName) {
      kmzEntries.push({ name: `files/${pt.photoBaseName}`, data: pt.photoBuffer });
    }
  }
  for (const t of targets) {
    if (t.photoBuffer && t.photoFileName) {
      kmzEntries.push({
        name: `files/${path.posix.basename(t.photoFileName)}`,
        data: t.photoBuffer,
      });
    }
  }
  const kmzBuffer = buildZipArchive(kmzEntries);

  const geoJson = generateNavigationGeoJson({
    name: documentTitle,
    clientName,
    campaignName,
    targets,
    points,
    includePrices,
  });

  const csvContent = generateNavigationCsv({ points, includePrices });
  const interactiveMapHtml = generateNavigationInteractiveMapHtml({
    clientName,
    campaignName,
    targets,
    points,
  });

  const jsonManifest = JSON.stringify(
    {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      offer: {
        id: offer.id || null,
        title: offer.title,
        campaignName,
        clientName,
        city: nav.city || null,
        includePrices,
      },
      targets: targets.map((t) => ({
        code: t.code,
        name: t.name,
        address: t.address,
        latitude: t.latitude,
        longitude: t.longitude,
        photoFile: t.photoFileName,
        note: t.note || null,
      })),
      points: points.map((pt) => ({
        code: pt.code,
        pinNumber: pt.index,
        title: pt.title,
        street: pt.street,
        address: pt.address,
        city: pt.city || null,
        pillarNumber: pt.pillarNumber || null,
        carrierType: pt.carrierType,
        variant: pt.variant || null,
        direction: pt.direction,
        arrowDirectionEnum: pt.arrowDirectionEnum,
        distance: pt.distance || null,
        distanceMeters: pt.distanceMeters,
        targetCode: pt.targetCode,
        targetName: pt.targetName,
        latitude: pt.latitude,
        longitude: pt.longitude,
        photoFile: pt.photoFileName,
        photoSource: pt.photoSource,
        googleMapsUrl: pt.googleMapsUrl,
        note: pt.clientNote || null,
        ...(includePrices
          ? {
              quantity: pt.quantity,
              unitPriceCzk: pt.unitPrice,
              subtotalCzk: pt.subtotal,
            }
          : {}),
      })),
    },
    null,
    2
  );

  const readmeTxt = [
    `EXPORT NAVIGAČNÍCH POZIC PRO AGENTURU / KLIENTA`,
    `================================================`,
    `Klient: ${clientName}`,
    `Kampaň: ${campaignName}`,
    `Počet pozic: ${points.length} (fotografií: ${photoCount}, z toho vizualizací: ${visualizationPhotoCount})`,
    `Vygenerováno: ${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}`,
    ``,
    `JAK JSOU POJMENOVÁNY FOTKY A BODY NA MAPĚ`,
    `-----------------------------------------`,
    `Každá pozice má jednotný kód P01, P02, P03... (cílové provozovny C1, C2...).`,
    `- Na mapě (mapa_pozic.png, mapa_pozic_s_legendou.pdf, interaktivni_mapa.html, KML/KMZ/GeoJSON)`,
    `  jsou body označeny přesně jako P01, P02, ...`,
    `- Ve složce fotky/ začíná název každé vizualizace shodným kódem (např. P01_Orlovska_500m_rovne.jpg).`,
    `- V tabulkách 00_PREHLED_POZIC.xlsx / .csv / .json je u každého řádku uveden přesný název souboru fotky i GPS.`,
    ``,
    `OBSAH BALÍČKU`,
    `-------------`,
    `- 00_PREHLED_POZIC.xlsx           : Přehledná Excel tabulka pro agenturní zpracování`,
    `- 00_PREHLED_POZIC.csv            : CSV tabulka (UTF-8) pro přímý import do jiného systému`,
    `- 00_PREHLED_POZIC.json           : Strukturovaná data (JSON) pro automatický import`,
    `- fotky/                          : Fotografie z vizualizací pojmenované P01_..., P02_...`,
    `- mapa/mapa_pozic.png             : Přehledová mapa ve vysokém rozlišení s piny P01, P02...`,
    `- mapa/mapa_pozic_s_legendou.pdf  : Tiskové PDF s mapou a párovací legendou bodů a fotek`,
    `- mapa/interaktivni_mapa.html     : Interaktivní mapa (otevřete v prohlížeči po rozbalení ZIPu)`,
    `- mapa/mapa_pozic.kmz             : Balíček pro Google Earth včetně vložených vizualizací`,
    `- mapa/mapa_pozic.kml             : Mapová vrstva pro Google My Maps / GIS`,
    `- mapa/mapa_pozic.geojson         : GeoJSON (RFC 7946) pro webové mapy a GIS systémy`,
  ].join('\r\n');

  // 4. Assemble outer ZIP archive
  const zipEntries: ZipArchiveEntry[] = [
    { name: '00_PREHLED_POZIC.xlsx', data: excelBuffer },
    { name: '00_PREHLED_POZIC.csv', data: csvContent },
    { name: '00_PREHLED_POZIC.json', data: jsonManifest },
    { name: 'README_PRO_AGENTURU.txt', data: readmeTxt },
    { name: 'mapa/mapa_pozic.png', data: mapPngBuffer },
    { name: 'mapa/mapa_pozic_s_legendou.pdf', data: mapLegendPdfBuffer },
    { name: 'mapa/interaktivni_mapa.html', data: interactiveMapHtml },
    { name: 'mapa/mapa_pozic.kmz', data: kmzBuffer },
    { name: 'mapa/mapa_pozic.kml', data: plainKml },
    { name: 'mapa/mapa_pozic.geojson', data: geoJson },
  ];

  for (const pt of points) {
    if (pt.photoBuffer && pt.photoFileName) {
      zipEntries.push({ name: pt.photoFileName, data: pt.photoBuffer });
    }
  }
  for (const t of targets) {
    if (t.photoBuffer && t.photoFileName) {
      zipEntries.push({ name: t.photoFileName, data: t.photoBuffer });
    }
  }

  const zipBuffer = buildZipArchive(zipEntries);
  const clientSlug = sanitizeExportSlug(clientName, 32);
  const campaignSlug = sanitizeExportSlug(campaignName, 36);
  const fileName = `Navigace_${clientSlug}_${campaignSlug}.zip`;

  return {
    zipBuffer,
    fileName,
    pointCount: points.length,
    photoCount,
    visualizationPhotoCount,
  };
}
