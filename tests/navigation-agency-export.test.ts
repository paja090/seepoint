import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import {
  buildNavigationAgencyExportZip,
  computeMapViewport,
  decodeEncodedPolyline,
  formatExportPointCode,
  projectLatLngToPixel,
  renderPinTextSvgPaths,
} from '../lib/offers/navigation-agency-export';
import type { OfferView } from '../lib/offers/view-model';

/**
 * Simple reader for STORE-method ZIP archives produced by buildZipArchive.
 */
function parseStoredZipEntries(zipBuffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const compression = zipBuffer.readUInt16LE(offset + 8);
    assert.equal(compression, 0, 'Expected STORE compression');
    const compSize = zipBuffer.readUInt32LE(offset + 18);
    const nameLen = zipBuffer.readUInt16LE(offset + 26);
    const extraLen = zipBuffer.readUInt16LE(offset + 28);
    const name = zipBuffer.subarray(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = zipBuffer.subarray(dataStart, dataStart + compSize);
    entries.set(name, Buffer.from(data));
    offset = dataStart + compSize;
  }
  return entries;
}

function makeSampleNavigationOffer(): OfferView {
  return {
    id: 'offer-nav-agency-1',
    title: 'Navigace Ostrava – Agentura Test',
    campaignName: 'Ostrava – Jaro 2026',
    status: 'SENT',
    pricingTier: 'STANDARD',
    offerType: 'NAVIGATION',
    validUntil: null,
    currency: 'CZK',
    taxRate: '21',
    subtotalBeforeDiscount: '48000',
    subtotal: '48000',
    discountAmount: '0',
    taxAmount: '10080',
    totalWithTax: '58080',
    isNoPriceConcept: false,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    createdBy: { name: 'Pavel Šubert', email: 'pavel@seepoint.cz' },
    client: { name: 'Agentura Media s.r.o.' },
    items: [],
    charges: [],
    navigation: {
      city: 'Ostrava',
      targetName: 'Prodejna Ostrava Centrum',
      targetAddress: '28. října 150, Ostrava',
      targetLatitude: 49.8346,
      targetLongitude: 18.282,
      targetNote: 'Hlavní vstup z ulice',
      targetPhotoUrl: 'mock://target-photo.jpg',
      proposalMode: 'PRICED_QUOTE',
      points: [
        {
          id: 'pt-1',
          label: 'Orlovská',
          latitude: 49.8521,
          longitude: 18.3012,
          address: 'Orlovská, Ostrava',
          navigationType: 'Směrová tabule (VO)',
          variant: '670 × 900 mm',
          quantity: '1',
          unitPrice: '24000',
          subtotal: '24000',
          installationPrice: '2500',
          removalPrice: '0',
          productionPrice: '1800',
          clientNote: 'Výborná viditelnost z příjezdu od Orlové',
          status: 'PROPOSED',
          visualizedPhotoUrl: 'mock://viz-p1.png',
          sitePhotoUrl: 'mock://site-p1.jpg',
          pillarNumber: '4125',
          arrowDirectionEnum: 'STRAIGHT',
          calculatedDistanceMeters: 500,
          isSelectedByClient: true,
        },
        {
          id: 'pt-2',
          label: 'Rudná',
          latitude: 49.8112,
          longitude: 18.2491,
          address: 'Rudná, Ostrava-Zábřeh',
          navigationType: 'Tower / Pylon / Věž',
          variant: '120 × 80 cm',
          quantity: '1',
          unitPrice: '24000',
          subtotal: '24000',
          installationPrice: '2500',
          removalPrice: '0',
          productionPrice: '1800',
          clientNote: 'Odbočení na křižovatce',
          status: 'PROPOSED',
          visualizedPhotoUrl: 'mock://viz-p2.jpg',
          sitePhotoUrl: 'mock://site-p2.jpg',
          pillarNumber: '8820',
          arrowDirectionEnum: 'RIGHT',
          calculatedDistanceMeters: 300,
          isSelectedByClient: false,
        },
      ],
    },
  };
}

test('Navigation Agency Export: builds complete ZIP with aligned P01/P02 visualization photos, map PNG/PDF/KML/KMZ/GeoJSON/HTML, and Excel/CSV/JSON', async () => {
  const pngBytes = await sharp({
    create: { width: 40, height: 30, channels: 4, background: { r: 2, g: 132, b: 199, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const jpgBytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 124, g: 58, b: 237 } },
  })
    .jpeg()
    .toBuffer();
  const targetBytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 190, g: 18, b: 60 } },
  })
    .jpeg()
    .toBuffer();

  const resolvedUrls: string[] = [];
  const offer = makeSampleNavigationOffer();

  const result = await buildNavigationAgencyExportZip(offer, {
    includePrices: false,
    offlineMapFallbackOnly: true,
    imageResolver: async (urlOrId) => {
      if (urlOrId) resolvedUrls.push(urlOrId);
      if (urlOrId === 'mock://viz-p1.png') return { buffer: pngBytes, mime: 'image/png' };
      if (urlOrId === 'mock://viz-p2.jpg') return { buffer: jpgBytes, mime: 'image/jpeg' };
      if (urlOrId === 'mock://target-photo.jpg') return { buffer: targetBytes, mime: 'image/jpeg' };
      return null;
    },
  });

  assert.equal(result.pointCount, 2);
  assert.equal(result.photoCount, 2);
  assert.equal(result.visualizationPhotoCount, 2);
  assert.match(result.fileName, /^Navigace_Agentura_Media_s_r_o_Ostrava_Jaro_2026\.zip$/);

  // Must prioritize visualizedPhotoUrl, never falling back to sitePhotoUrl when visualization exists
  assert.ok(resolvedUrls.includes('mock://viz-p1.png'));
  assert.ok(resolvedUrls.includes('mock://viz-p2.jpg'));
  assert.ok(!resolvedUrls.includes('mock://site-p1.jpg'));
  assert.ok(!resolvedUrls.includes('mock://site-p2.jpg'));

  const entries = parseStoredZipEntries(result.zipBuffer);
  assert.ok(entries.has('00_PREHLED_POZIC.xlsx'));
  assert.ok(entries.has('00_PREHLED_POZIC.csv'));
  assert.ok(entries.has('00_PREHLED_POZIC.json'));
  assert.ok(entries.has('README_PRO_AGENTURU.txt'));
  assert.ok(entries.has('mapa/mapa_pozic.png'));
  assert.ok(entries.has('mapa/mapa_pozic_s_legendou.pdf'));
  assert.ok(entries.has('mapa/interaktivni_mapa.html'));
  assert.ok(entries.has('mapa/mapa_pozic.kml'));
  assert.ok(entries.has('mapa/mapa_pozic.kmz'));
  assert.ok(entries.has('mapa/mapa_pozic.geojson'));

  // Verify JSON manifest and exact alignment between P01/P02 codes, photos, KML, GeoJSON, CSV, Excel, and HTML
  const manifest = JSON.parse(entries.get('00_PREHLED_POZIC.json')!.toString('utf8'));
  assert.equal(manifest.offer.includePrices, false);
  assert.equal(manifest.points.length, 2);
  assert.equal(manifest.points[0].code, 'P01');
  assert.equal(manifest.points[0].photoSource, 'VIZUALIZACE');
  assert.equal(manifest.points[1].code, 'P02');
  assert.equal(manifest.points[1].photoSource, 'VIZUALIZACE');
  assert.equal(manifest.points[0].unitPriceCzk, undefined);

  const p01PhotoPath = manifest.points[0].photoFile as string;
  const p02PhotoPath = manifest.points[1].photoFile as string;
  assert.ok(p01PhotoPath.startsWith('fotky/P01_'));
  assert.ok(p01PhotoPath.endsWith('.png'));
  assert.ok(p02PhotoPath.startsWith('fotky/P02_'));
  assert.ok(p02PhotoPath.endsWith('.jpg'));
  assert.ok(entries.has(p01PhotoPath), `ZIP must contain ${p01PhotoPath}`);
  assert.ok(entries.has(p02PhotoPath), `ZIP must contain ${p02PhotoPath}`);

  // Verify map PNG dimensions (1280x800) and PDF header
  const mapMeta = await sharp(entries.get('mapa/mapa_pozic.png')!).metadata();
  assert.equal(mapMeta.width, 1280);
  assert.equal(mapMeta.height, 800);
  assert.equal(entries.get('mapa/mapa_pozic_s_legendou.pdf')!.subarray(0, 5).toString('ascii'), '%PDF-');

  // Verify KML & KMZ (inner ZIP contains doc.kml + embedded files/)
  const kmlText = entries.get('mapa/mapa_pozic.kml')!.toString('utf8');
  assert.match(kmlText, /P01 – Orlovská/);
  assert.match(kmlText, /P02 – Rudná/);
  assert.ok(kmlText.includes(p01PhotoPath));

  const kmzEntries = parseStoredZipEntries(entries.get('mapa/mapa_pozic.kmz')!);
  assert.ok(kmzEntries.has('doc.kml'));
  assert.ok(kmzEntries.has(`files/${p01PhotoPath.replace('fotky/', '')}`));
  assert.ok(kmzEntries.has(`files/${p02PhotoPath.replace('fotky/', '')}`));

  // Verify GeoJSON
  const geo = JSON.parse(entries.get('mapa/mapa_pozic.geojson')!.toString('utf8'));
  assert.equal(geo.type, 'FeatureCollection');
  const p01Geo = geo.features.find((f: { properties?: { code?: string } }) => f.properties?.code === 'P01');
  assert.equal(p01Geo.properties.photoFile, p01PhotoPath);

  // Verify CSV (UTF-8 BOM + no prices when includePrices=false)
  const csv = entries.get('00_PREHLED_POZIC.csv')!.toString('utf8');
  assert.ok(csv.startsWith('\uFEFFKod_bodu,'));
  assert.ok(csv.includes(p01PhotoPath));
  assert.ok(!csv.includes('Cena_ks_CZK'));

  // Verify Excel workbook parses cleanly with ExcelJS
  const wb = new ExcelJS.Workbook();
  const xlsxBuf = entries.get('00_PREHLED_POZIC.xlsx')!;
  await wb.xlsx.load(xlsxBuf.buffer.slice(xlsxBuf.byteOffset, xlsxBuf.byteOffset + xlsxBuf.byteLength) as ArrayBuffer);
  const ws = wb.getWorksheet('Pozice navigací');
  assert.ok(ws);
  assert.equal(ws.getRow(2).getCell(1).value, 'P01');
  assert.equal(ws.getRow(2).getCell(14).value, p01PhotoPath);

  // Verify interactive HTML map links relative local visualization photos and uses zero-API-key map tiles
  const html = entries.get('mapa/interaktivni_mapa.html')!.toString('utf8');
  assert.ok(html.includes(`../${p01PhotoPath}`));
  assert.ok(html.includes(`../${p02PhotoPath}`));
  assert.ok(!html.includes('cartocdn.com'), 'Must never use Carto basemaps which require an API key');
  assert.ok(html.includes('mt{s}.google.com/vt/lyrs=m&hl=cs'));
  assert.ok(html.includes('server.arcgisonline.com'));
});

test('Navigation Agency Export: supports pointIds subset filtering and includePrices=true', async () => {
  const offer = makeSampleNavigationOffer();
  const result = await buildNavigationAgencyExportZip(offer, {
    includePrices: true,
    pointIds: ['pt-2'],
    offlineMapFallbackOnly: true,
    imageResolver: async () => null,
  });

  assert.equal(result.pointCount, 1);
  const entries = parseStoredZipEntries(result.zipBuffer);
  const manifest = JSON.parse(entries.get('00_PREHLED_POZIC.json')!.toString('utf8'));
  assert.equal(manifest.offer.includePrices, true);
  assert.equal(manifest.points.length, 1);
  assert.equal(manifest.points[0].code, 'P01');
  assert.equal(manifest.points[0].street, 'Rudná');
  assert.equal(manifest.points[0].unitPriceCzk, 24000);
});

test('Navigation Agency Export: geometry helpers (Mercator viewport, polyline decode, vector pin paths)', () => {
  assert.equal(formatExportPointCode(1), 'P01');
  assert.equal(formatExportPointCode(12), 'P12');

  const viewport = computeMapViewport([
    { lat: 49.8346, lng: 18.282 },
    { lat: 49.8521, lng: 18.3012 },
  ]);
  assert.ok(viewport.zoom >= 10 && viewport.zoom <= 17);
  const px = projectLatLngToPixel(49.8346, 18.282, viewport, 640, 400, 2);
  assert.ok(px.x > 0 && px.x < 1280);
  assert.ok(px.y > 0 && px.y < 800);

  const decoded = decodeEncodedPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.equal(decoded.length, 3);
  assert.ok(Math.abs(decoded[0].lat - 38.5) < 0.01);

  const svgPaths = renderPinTextSvgPaths('P12', 100, 100, 14, '#ffffff');
  assert.ok(svgPaths.includes('<path d='));
});
