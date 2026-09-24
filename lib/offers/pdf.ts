import fs from 'node:fs/promises';
import path from 'node:path';
import pdfMake from 'pdfmake';
import roboto from 'pdfmake/build/fonts/Roboto.js';
import type { ProposalOffer } from './presentation';
import { getSignedStaticMapUrl } from '@/lib/google-maps';
import { prisma } from '@/lib/db';
import { readStoredPhoto } from '@/lib/storage/photo-storage';

const BLUE = '#009EE2';
const NAVY = '#10253F';
const MUTED = '#64748B';
const LIGHT = '#E8F5FB';
let fontsReady = false;

function configurePdfMake() {
  if (fontsReady) return;
  for (const [name, font] of Object.entries(roboto.vfs)) {
    pdfMake.virtualfs.writeFileSync(name, font.data, font.encoding);
  }
  pdfMake.addFonts(roboto.fonts);
  pdfMake.setLocalAccessPolicy(() => false);
  pdfMake.setUrlAccessPolicy(() => false);
  fontsReady = true;
}

const money = (amount: number) => `${Math.round(amount).toLocaleString('cs-CZ')} Kč`;
const safe = (value?: string | null, fallback = '—') => value?.trim() || fallback;

export async function resolveImageToDataUrl(
  urlOrId: string | null | undefined,
  fallbackPhotoId?: string | null
): Promise<string | undefined> {
  const target = (urlOrId || '').trim();
  if (!target && !fallbackPhotoId) return undefined;

  // 1. Already a data URL
  if (target.startsWith('data:image/')) {
    return target;
  }

  // 2. Check if there's a photo ID in the URL, target itself, or fallbackPhotoId
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
        select: { id: true, driveFileId: true, fileName: true, mimeType: true, url: true, content: true, storageKey: true, storageProvider: true },
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
          const arrayBuffer = await new Response(stored.body).arrayBuffer();
          const mime = stored.contentType || photo.mimeType || 'image/jpeg';
          return `data:${mime};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
        }
        if (stored?.redirectUrl) {
          const res = await fetch(stored.redirectUrl, { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const mime = res.headers.get('content-type') || photo.mimeType || 'image/jpeg';
            return `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      }
    } catch {
      // Continue to next resolution strategies
    }
  }

  // 3. Local file in public/ directory (e.g., /offer/..., /images/...)
  if (target.startsWith('/') && !target.startsWith('/api/')) {
    try {
      const cleanPath = target.replace(/^\/+/, '').split('?')[0];
      const localFilePath = path.join(process.cwd(), 'public', cleanPath);
      const fileBuffer = await fs.readFile(localFilePath);
      const ext = path.extname(cleanPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      return `data:${mime};base64,${fileBuffer.toString('base64')}`;
    } catch {
      // Not a local static file
    }
  }

  // 4. Remote HTTP URL
  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') || 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch {
      // Fetch failed
    }
  }

  return undefined;
}

function formatArrowDirectionPdf(arrowEnum?: string | null) {
  switch (arrowEnum) {
    case 'LEFT': return '⬅ Vlevo';
    case 'RIGHT': return '➔ Vpravo';
    case 'SLANTED_LEFT': return '↖ Šikmo vlevo';
    case 'SLANTED_RIGHT': return '↗ Šikmo vpravo';
    case 'U_TURN': return '↩ Otočení do protisměru';
    case 'TWO_WAY': return '↔ Obousměrný';
    case 'ROUNDABOUT_1': return '🔄 Kruhový objezd (1. výjezd)';
    case 'ROUNDABOUT_2': return '🔄 Kruhový objezd (2. výjezd)';
    case 'ROUNDABOUT_3': return '🔄 Kruhový objezd (3. výjezd)';
    case 'ROUNDABOUT_4': return '🔄 Kruhový objezd (4. výjezd)';
    case 'ROUNDABOUT_5': return '🔄 Kruhový objezd (5. výjezd)';
    case 'ROUNDABOUT': return '🔄 Kruhový objezd';
    case 'STRAIGHT':
    default: return '⬆ Rovně';
  }
}

async function fetchStaticMapDataUrl(params: Parameters<typeof getSignedStaticMapUrl>[0]): Promise<string | undefined> {
  try {
    const signedUrl = getSignedStaticMapUrl(params);
    if (!signedUrl) return undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(signedUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

export async function createOfferPdf(offer: ProposalOffer, clientLogoDataUrl?: string): Promise<Buffer> {
  configurePdfMake();

  const navigationData = offer.rawOffer?.navigation;
  let staticMapDataUrl: string | undefined = undefined;

  if (offer.offerType === 'NAVIGATION' && navigationData) {
    const markers = [
      { lat: navigationData.targetLatitude, lng: navigationData.targetLongitude, color: 'red', label: 'T' },
      ...navigationData.points.map((p, idx) => ({
        lat: p.latitude,
        lng: p.longitude,
        color: 'blue',
        label: String(idx + 1),
      })),
    ];

    staticMapDataUrl = await fetchStaticMapDataUrl({
      size: '600x320',
      markers,
      polyline: (navigationData.points.find((p) => (p as unknown as Record<string, unknown>).routePolyline) as unknown as Record<string, unknown> | undefined)?.routePolyline as string | undefined,
    });
  }

  // Pre-fetch photos for navigation points
  const isNavigation = offer.offerType === 'NAVIGATION' && navigationData;
  const resolvedPointPhotos: Array<{
    pointIndex: number;
    point: NonNullable<typeof navigationData>['points'][number];
    dataUrl: string;
    photoType: 'visualized' | 'site' | 'installed';
  }> = [];

  if (isNavigation && navigationData) {
    for (let idx = 0; idx < navigationData.points.length; idx++) {
      const point = navigationData.points[idx];
      const pAny = point as unknown as Record<string, unknown>;

      let dataUrl: string | undefined = undefined;
      let photoType: 'visualized' | 'site' | 'installed' = 'visualized';

      if (typeof pAny.visualizedPhotoUrl === 'string' && pAny.visualizedPhotoUrl) {
        dataUrl = await resolveImageToDataUrl(pAny.visualizedPhotoUrl);
        photoType = 'visualized';
      }
      if (!dataUrl && typeof pAny.sitePhotoUrl === 'string' && pAny.sitePhotoUrl) {
        dataUrl = await resolveImageToDataUrl(pAny.sitePhotoUrl, pAny.sitePhotoId as string | undefined);
        photoType = 'site';
      }
      if (!dataUrl && typeof pAny.installedPhotoUrl === 'string' && pAny.installedPhotoUrl) {
        dataUrl = await resolveImageToDataUrl(pAny.installedPhotoUrl, pAny.installedPhotoId as string | undefined);
        photoType = 'installed';
      }
      if (!dataUrl && pAny.sitePhotoId) {
        dataUrl = await resolveImageToDataUrl(undefined, pAny.sitePhotoId as string);
        photoType = 'site';
      }

      if (dataUrl) {
        resolvedPointPhotos.push({ pointIndex: idx, point, dataUrl, photoType });
      }
    }
  }

  // Pre-fetch photos for standard media carriers
  const resolvedCarrierPhotos: Array<{
    carrierIndex: number;
    carrier: typeof offer.carriers[0];
    dataUrl: string;
  }> = [];

  if (!isNavigation && offer.carriers.length > 0) {
    for (let idx = 0; idx < Math.min(18, offer.carriers.length); idx++) {
      const carrier = offer.carriers[idx];
      const matchingItem = offer.rawOffer?.items?.find((it) => it.surface.carrier.code === carrier.code);
      const photoCandidate =
        carrier.image ||
        matchingItem?.surface.photos?.[0]?.url ||
        null;
      const fallbackId = matchingItem?.surface.photos?.[0]?.id || null;

      const dataUrl = await resolveImageToDataUrl(photoCandidate, fallbackId);
      if (dataUrl) {
        resolvedCarrierPhotos.push({ carrierIndex: idx, carrier, dataUrl });
      }
    }
  }

  // Pre-fetch graphic artwork proof if enabled
  let graphicProofDataUrl: string | undefined = undefined;
  if (isNavigation && navigationData && (navigationData as unknown as Record<string, unknown>).includeGraphicProof !== false) {
    const rawArtworkUrl = (navigationData as unknown as Record<string, unknown>).graphicArtworkUrl as string | undefined;
    graphicProofDataUrl = await resolveImageToDataUrl(rawArtworkUrl || '/offer/navigation-proof-template.jpg');
  }

  const regularPricing = offer.pricing.filter((row) => row.emphasis !== 'total');
  const total = offer.pricing.find((row) => row.emphasis === 'total')?.amount ?? offer.stats.total;

  const tableHeader = isNavigation
    ? [{ text: '#', style: 'tableHeader' }, { text: 'Navigační bod & Sloup', style: 'tableHeader' }, { text: 'Směr navedení', style: 'tableHeader' }, { text: 'Vzdálenost', style: 'tableHeader' }, { text: 'Cena', style: 'tableHeader' }]
    : [{ text: '#', style: 'tableHeader' }, { text: 'Plocha', style: 'tableHeader' }, { text: 'Lokalita', style: 'tableHeader' }, { text: 'Rozměr', style: 'tableHeader' }];

  const tableWidths = isNavigation ? [18, '*', 110, 80, 70] : [18, '*', 105, 78];

  const formatPointDistancePdf = (pAny: Record<string, unknown>) => {
    const rawManual =
      pAny.manualDistanceValue !== undefined && pAny.manualDistanceValue !== null
        ? String(pAny.manualDistanceValue).trim().replace(',', '.')
        : '';
    if ((pAny.distanceSource === 'MANUAL' || rawManual !== '') && rawManual !== '' && Number(rawManual) > 0) {
      return `${String(pAny.manualDistanceValue).trim()} ${pAny.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm'}`;
    }
    const rawDist = pAny.calculatedDistanceMeters;
    const distMeters = typeof rawDist === 'number' && rawDist > 0 ? Math.max(50, Math.round(rawDist / 50) * 50) : null;
    if (typeof distMeters === 'number') {
      return distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1).replace('.', ',')} km` : `${distMeters} m`;
    }
    return '—';
  };

  const tableRows = isNavigation
    ? navigationData.points.slice(0, 18).map((point, index) => {
        const pAny = point as unknown as Record<string, unknown>;
        const distStr = formatPointDistancePdf(pAny);

        const pillarStr = pAny.pillarNumber ? ` [Sloup ${pAny.pillarNumber}]` : '';
        const streetStr = point.address ? `📍 ${point.address}` : point.navigationType;

        return [
          { text: String(index + 1), color: MUTED, bold: true },
          { stack: [{ text: `${point.label}${pillarStr}`, bold: true }, { text: streetStr, fontSize: 8, color: MUTED }] },
          { text: formatArrowDirectionPdf(typeof pAny.arrowDirectionEnum === 'string' ? pAny.arrowDirectionEnum : null), fontSize: 8.5, bold: true, color: BLUE },
          { text: `${distStr} do cíle`, fontSize: 8.5, bold: true },
          { text: money(Number(point.subtotal)), alignment: 'right', bold: true },
        ];
      })
    : offer.carriers.slice(0, 18).map((carrier, index) => [
        { text: String(index + 1), color: MUTED },
        { stack: [{ text: carrier.code, bold: true }, { text: safe(carrier.description), fontSize: 8, color: MUTED }] },
        { text: `${safe(carrier.city)}\n${safe(carrier.locality)}`, fontSize: 8.5 },
        { text: safe(carrier.dimensions), fontSize: 8.5 },
      ]);

  const pricingRows = regularPricing.map((row) => [
    { stack: [{ text: row.label, bold: row.emphasis === 'subtotal' }, ...(row.note ? [{ text: row.note, fontSize: 7.5, color: MUTED }] : [])] },
    { text: money(row.amount), alignment: 'right', bold: row.emphasis === 'subtotal', color: row.emphasis === 'discount' ? '#059669' : NAVY },
  ]);

  const nextSteps = [
    ['1', 'Schválení nabídky', 'Klient potvrdí nabídku a plochy se převedou do závazné rezervace.'],
    ['2', 'Podklady a grafika', 'Klient nahraje podklady; tým zkontroluje formáty a připraví výrobu.'],
    ['3', 'Realizace kampaně', 'Vznikne plán práce s úkoly pro tisk, instalaci a následnou deinstalaci.'],
    ['4', 'Fotodokumentace a faktura', 'Po realizaci klient obdrží fotografie kampaně a fakturu.'],
  ].map(([number, title, description]) => ({
    columns: [
      { width: 24, text: number, color: '#FFFFFF', bold: true, alignment: 'center', margin: [0, 4, 0, 0], fillColor: BLUE },
      { width: '*', stack: [{ text: title, bold: true, color: NAVY }, { text: description, fontSize: 8.5, color: MUTED, margin: [0, 2, 0, 0] }] },
    ],
    columnGap: 10,
    margin: [0, 0, 0, 10],
  }));

  const clientMark = clientLogoDataUrl && clientLogoDataUrl.startsWith('data:image/')
    ? { image: clientLogoDataUrl, fit: [110, 48], alignment: 'right', margin: [0, 2, 0, 0] }
    : { text: offer.client.logoLabel || offer.client.name, fontSize: 18, bold: true, color: BLUE, alignment: 'right', margin: [0, 6, 0, 0] };

  const orgName = offer.rawOffer?.branding?.name || 'SeePOINT';

  const definition = {
    info: { title: offer.title, author: orgName, subject: 'Nabídka venkovní reklamní kampaně' },
    pageSize: 'A4',
    pageMargins: [38, 48, 38, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: NAVY, lineHeight: 1.15 },
    header: () => ({
      columns: [
        { text: `${orgName}  •  OUTDOOR & NAVIGAČNÍ REKLAMA`, bold: true, color: BLUE, fontSize: 10 },
        { text: `NABÍDKA  •  ${offer.id}`, alignment: 'right', color: MUTED, fontSize: 8 },
      ],
      margin: [38, 20, 38, 0],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${orgName}  •  outdoor reklama`, color: MUTED, fontSize: 7.5 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: MUTED, fontSize: 7.5 },
      ],
      margin: [38, 0, 38, 18],
    }),
    content: [
      {
        table: {
          widths: ['*', 118],
          body: [[
            { stack: [
              { text: isNavigation ? 'NAVIGAČNÍ REKLAMNÍ KAMPAŇ' : 'NABÍDKA REKLAMNÍ KAMPANĚ', color: BLUE, bold: true, fontSize: 9 },
              { text: offer.title, fontSize: 25, bold: true, color: NAVY, margin: [0, 8, 0, 4] },
              { text: offer.subtitle, fontSize: 11, color: MUTED },
            ], margin: [16, 16, 8, 16] },
            { stack: [{ text: 'PŘIPRAVENO PRO', fontSize: 7.5, color: MUTED, alignment: 'right' }, clientMark, { text: offer.client.name, bold: true, alignment: 'right', margin: [0, 4, 0, 0] }], margin: [8, 12, 16, 12] },
          ]],
        },
        layout: { fillColor: LIGHT, hLineColor: () => LIGHT, vLineColor: () => LIGHT },
        margin: [0, 4, 0, 18],
      },
      { text: offer.intro, fontSize: 10, color: MUTED, margin: [4, 0, 4, 16] },
      {
        columns: [
          { stack: [{ text: 'KAMPAŇ', style: 'eyebrow' }, { text: `${offer.campaignFrom} – ${offer.campaignTo}`, bold: true }, { text: `${offer.campaignDays} dní`, color: MUTED, fontSize: 8 }] },
          { stack: [{ text: 'ROZSAH', style: 'eyebrow' }, { text: `${offer.stats.carriers} ${isNavigation ? 'bodů' : 'ploch'}`, bold: true }, { text: `${offer.stats.locations} lokalit`, color: MUTED, fontSize: 8 }] },
          { stack: [{ text: 'PLATNOST', style: 'eyebrow' }, { text: offer.validUntil, bold: true }, { text: 'do tohoto data', color: MUTED, fontSize: 8 }] },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 20],
      },

      ...(isNavigation && navigationData ? [
        { text: `CÍLOVÁ PROVOZOVNA: ${navigationData.targetName}`, style: 'heading' },
        ...(navigationData.targetAddress ? [{ text: `Adresa: ${navigationData.targetAddress}`, color: MUTED, fontSize: 8.5, margin: [0, 0, 0, 8] }] : []),
        ...(staticMapDataUrl && staticMapDataUrl.startsWith('data:image/') ? [{ image: staticMapDataUrl, width: 518, margin: [0, 4, 0, 16] }] : []),
      ] : []),

      { text: isNavigation ? 'Vytipované navigační body na trase' : 'Vybrané reklamní plochy', style: 'heading' },
      {
        table: {
          headerRows: 1,
          widths: tableWidths,
          body: [
            tableHeader,
            ...tableRows,
          ],
        },
        layout: { fillColor: (rowIndex: number) => rowIndex === 0 ? NAVY : rowIndex % 2 === 0 ? '#F8FAFC' : null, hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0', paddingTop: () => 6, paddingBottom: () => 6 },
        margin: [0, 0, 0, 8],
      },
      ...(!isNavigation && offer.carriers.length > 18 ? [{ text: `Dalších ${offer.carriers.length - 18} ploch je uvedeno v interaktivní nabídce.`, fontSize: 8, color: MUTED, margin: [0, 0, 0, 12] }] : []),

      // Visualized photos of navigation points
      ...(isNavigation && resolvedPointPhotos.length > 0 ? [
        { text: 'Fotodokumentace vybraných navigačních lokalit', style: 'heading', pageBreak: 'before' },
        { text: 'Pohledy na osazované sloupy veřejného osvětlení a přesné umístění navigačních médií na trase:', fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 10] },
        ...resolvedPointPhotos.map(({ pointIndex, point, dataUrl }) => {
          const pAny = point as unknown as Record<string, unknown>;
          const distStr = formatPointDistancePdf(pAny);

          const pillarStr = pAny.pillarNumber ? `Sloup VO: ${pAny.pillarNumber}` : '';
          const addressStr = point.address ? `📍 ${point.address}` : point.navigationType;
          const arrowStr = formatArrowDirectionPdf(typeof pAny.arrowDirectionEnum === 'string' ? pAny.arrowDirectionEnum : null);

          return {
            unbreakable: true,
            margin: [0, 0, 0, 14],
            stack: [
              {
                table: {
                  widths: ['*'],
                  body: [[
                    {
                      stack: [
                        {
                          columns: [
                            { text: `Bod #${pointIndex + 1}: ${point.label}`, bold: true, fontSize: 10, color: NAVY },
                            { text: `${distStr} do cíle  •  ${arrowStr}`, bold: true, fontSize: 9, color: BLUE, alignment: 'right' },
                          ],
                        },
                        {
                          columns: [
                            { text: addressStr, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] },
                            ...(pillarStr ? [{ text: pillarStr, fontSize: 8, bold: true, color: MUTED, alignment: 'right', margin: [0, 2, 0, 0] }] : []),
                          ],
                        },
                        { image: dataUrl, width: 494, margin: [0, 6, 0, 0] },
                      ],
                      margin: [10, 8, 10, 10],
                    },
                  ]],
                },
                layout: { fillColor: '#F8FAFC', hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0' },
              },
            ],
          };
        }),
      ] : []),

      // Photos of standard media carriers
      ...(!isNavigation && resolvedCarrierPhotos.length > 0 ? [
        { text: 'Fotodokumentace vybraných reklamních ploch', style: 'heading', pageBreak: 'before' },
        { text: 'Detailní pohledy na vybrané reklamní nosiče:', fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 10] },
        ...resolvedCarrierPhotos.map(({ carrierIndex, carrier, dataUrl }) => {
          return {
            unbreakable: true,
            margin: [0, 0, 0, 14],
            stack: [
              {
                table: {
                  widths: ['*'],
                  body: [[
                    {
                      stack: [
                        {
                          columns: [
                            { text: `#${carrierIndex + 1}: ${carrier.code}`, bold: true, fontSize: 10, color: NAVY },
                            { text: `${safe(carrier.dimensions)}  •  ${safe(carrier.mediaType)}`, bold: true, fontSize: 9, color: BLUE, alignment: 'right' },
                          ],
                        },
                        { text: `📍 ${safe(carrier.city)}, ${safe(carrier.locality)}${carrier.description ? ` — ${carrier.description}` : ''}`, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] },
                        { image: dataUrl, width: 494, margin: [0, 6, 0, 0] },
                      ],
                      margin: [10, 8, 10, 10],
                    },
                  ]],
                },
                layout: { fillColor: '#F8FAFC', hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0' },
              },
            ],
          };
        }),
      ] : []),

      // Graphic Artwork Proof Section in PDF (670 x 900 mm)
      ...(graphicProofDataUrl ? [
        { text: 'Grafický motiv a provedení cedule (670 × 900 mm)', style: 'heading', margin: [0, 14, 0, 8] },
        { text: 'Tiskový motiv oboustranné plástve pro montáž na sloupy veřejného osvětlení:', fontSize: 8.5, color: MUTED, margin: [0, 0, 0, 8] },
        { image: graphicProofDataUrl, width: 240, alignment: 'center', margin: [0, 4, 0, 16] },
      ] : []),
      { text: 'Cenová kalkulace', style: 'heading', pageBreak: 'before' },
      { text: 'Jednotlivé složky ceny jsou načtené z cenového katalogu a v nabídce přehledně oddělené.', color: MUTED, margin: [0, 0, 0, 12] },
      {
        table: { widths: ['*', 120], body: [...pricingRows, [{ text: 'CELKEM VČETNĚ DPH', bold: true, color: '#FFFFFF', fontSize: 11 }, { text: money(total), bold: true, color: '#FFFFFF', alignment: 'right', fontSize: 12 }]] },
        layout: { fillColor: (rowIndex: number, node: { table: { body: unknown[] } }) => rowIndex === node.table.body.length - 1 ? BLUE : rowIndex % 2 === 0 ? '#F8FAFC' : null, hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0', paddingTop: () => 8, paddingBottom: () => 8 },
        margin: [0, 0, 0, 22],
      },
      { text: 'Další krok a realizace kampaně', style: 'heading', margin: [0, 0, 0, 10] },
      ...nextSteps,
      {
        table: { body: [[{ stack: [
          { text: 'Potřebujete poradit nebo vybrat jiné pozice?', bold: true, fontSize: 10 },
          { text: [safe(offer.salesperson.name), safe(offer.salesperson.email), safe(offer.salesperson.phone)].filter((value) => value !== '—').join('  •  ') || 'Kontakt je dostupný v interaktivní nabídce.', color: MUTED, margin: [0, 2, 0, 0] },
        ], margin: [12, 10, 12, 10] }]] },
        layout: { fillColor: '#F8FAFC', hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0' },
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      heading: { fontSize: 15, bold: true, color: NAVY, margin: [0, 0, 0, 10] },
      eyebrow: { fontSize: 7.5, bold: true, color: BLUE, characterSpacing: 0.8, margin: [0, 0, 0, 4] },
      tableHeader: { color: '#FFFFFF', bold: true, fontSize: 8 },
    },
  };
  return pdfMake.createPdf(definition).getBuffer();
}

export async function createInstallationSheetPdf(offer: ProposalOffer): Promise<Buffer> {
  configurePdfMake();

  const navigationData = offer.rawOffer?.navigation;
  let staticMapDataUrl: string | undefined = undefined;

  if (navigationData) {
    const markers = [
      { lat: navigationData.targetLatitude, lng: navigationData.targetLongitude, color: 'red', label: 'T' },
      ...navigationData.points.map((p, idx) => ({
        lat: p.latitude,
        lng: p.longitude,
        color: 'blue',
        label: String(idx + 1),
      })),
    ];

    staticMapDataUrl = await fetchStaticMapDataUrl({
      size: '600x320',
      markers,
      polyline: (navigationData.points.find((p) => (p as unknown as Record<string, unknown>).routePolyline) as unknown as Record<string, unknown> | undefined)?.routePolyline as string | undefined,
    });
  }

  const resolvedInstallPhotos: Array<{
    pointIndex: number;
    point: NonNullable<typeof navigationData>['points'][number];
    dataUrl: string;
  }> = [];

  if (navigationData) {
    for (let idx = 0; idx < navigationData.points.length; idx++) {
      const point = navigationData.points[idx];
      const pAny = point as unknown as Record<string, unknown>;

      let dataUrl: string | undefined = undefined;
      if (typeof pAny.visualizedPhotoUrl === 'string' && pAny.visualizedPhotoUrl) {
        dataUrl = await resolveImageToDataUrl(pAny.visualizedPhotoUrl);
      }
      if (!dataUrl && typeof pAny.sitePhotoUrl === 'string' && pAny.sitePhotoUrl) {
        dataUrl = await resolveImageToDataUrl(pAny.sitePhotoUrl, pAny.sitePhotoId as string | undefined);
      }
      if (!dataUrl && typeof pAny.installedPhotoUrl === 'string' && pAny.installedPhotoUrl) {
        dataUrl = await resolveImageToDataUrl(pAny.installedPhotoUrl, pAny.installedPhotoId as string | undefined);
      }
      if (!dataUrl && pAny.sitePhotoId) {
        dataUrl = await resolveImageToDataUrl(undefined, pAny.sitePhotoId as string);
      }

      if (dataUrl) {
        resolvedInstallPhotos.push({ pointIndex: idx, point, dataUrl });
      }
    }
  }

  const pointRows = navigationData ? navigationData.points.map((point, index) => {
    const pAny = point as unknown as Record<string, unknown>;
    const rawDist = pAny.calculatedDistanceMeters;
    const distMeters = typeof rawDist === 'number' && rawDist > 0
      ? Math.max(50, Math.round(rawDist / 50) * 50)
      : null;
    const distStr = pAny.distanceSource === 'MANUAL' && pAny.manualDistanceValue
      ? `${pAny.manualDistanceValue} ${pAny.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm'}`
      : typeof distMeters === 'number'
        ? (distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1).replace('.', ',')} km` : `${distMeters} m`)
        : '—';

    const pillarStr = pAny.pillarNumber ? `Sloup ${pAny.pillarNumber}` : '—';

    return [
      { text: String(index + 1), alignment: 'center', bold: true },
      { stack: [{ text: point.label, bold: true }, { text: safe(point.address), fontSize: 8, color: MUTED }] },
      { text: pillarStr, alignment: 'center', bold: true, color: BLUE },
      { text: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`, fontSize: 8 },
      { text: formatArrowDirectionPdf(typeof pAny.arrowDirectionEnum === 'string' ? pAny.arrowDirectionEnum : null), fontSize: 8.5, bold: true },
      { text: distStr, alignment: 'center', fontSize: 8.5 },
      { text: '[  ] Osazeno', alignment: 'center', fontSize: 8, color: MUTED },
    ];
  }) : [];

  const orgName = offer.rawOffer?.branding?.name || 'SeePOINT';

  const definition = {
    info: { title: `Montážní list – ${offer.title}`, author: orgName, subject: 'Protokol instalace navigačních cedulí' },
    pageSize: 'A4',
    pageMargins: [38, 38, 38, 38],
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: NAVY, lineHeight: 1.15 },
    header: () => ({
      columns: [
        { text: `${orgName}  •  MONTÁŽNÍ & INSTALAČNÍ PROTOKOL`, bold: true, color: BLUE, fontSize: 9 },
        { text: `DOKUMENT  •  ${offer.id}`, alignment: 'right', color: MUTED, fontSize: 8 },
      ],
      margin: [38, 16, 38, 0],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${orgName}  •  montážní dokumentace pro techniky VO`, color: MUTED, fontSize: 7.5 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: MUTED, fontSize: 7.5 },
      ],
      margin: [38, 0, 38, 14],
    }),
    content: [
      {
        table: {
          widths: ['*', 160],
          body: [[
            { stack: [
              { text: 'MONTÁŽNÍ LIST NAVIGAČNÍ SÍTĚ', color: BLUE, bold: true, fontSize: 9 },
              { text: offer.title, fontSize: 20, bold: true, color: NAVY, margin: [0, 4, 0, 2] },
              { text: `Cíl: ${navigationData?.targetName || offer.client.name}`, fontSize: 10, bold: true, color: MUTED },
              ...(navigationData?.targetAddress ? [{ text: `📍 ${navigationData.targetAddress}`, fontSize: 8.5, color: MUTED }] : []),
            ], margin: [12, 10, 8, 10] },
            { stack: [
              { text: 'KLIENT / ZÁKAZNÍK', fontSize: 7.5, color: MUTED },
              { text: offer.client.name, bold: true, fontSize: 10, margin: [0, 2, 0, 4] },
              { text: `Počet cedulí k montáži: ${navigationData?.points.length || 0} ks`, bold: true, color: BLUE },
              { text: `Termín instalace: dle dohody`, fontSize: 8, color: MUTED },
            ], margin: [8, 10, 12, 10] },
          ]],
        },
        layout: { fillColor: LIGHT, hLineColor: () => LIGHT, vLineColor: () => LIGHT },
        margin: [0, 0, 0, 14],
      },

      ...(staticMapDataUrl && staticMapDataUrl.startsWith('data:image/') ? [{ image: staticMapDataUrl, width: 518, margin: [0, 0, 0, 14] }] : []),

      { text: 'Seznam navigačních bodů pro montáž na sloupy VO', style: 'heading' },
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 45, 90, 75, 45, 60],
          body: [
            [
              { text: 'Bod', style: 'tableHeader', alignment: 'center' },
              { text: 'Název a adresa pozice', style: 'tableHeader' },
              { text: 'Sloup VO', style: 'tableHeader', alignment: 'center' },
              { text: 'GPS Souřadnice', style: 'tableHeader' },
              { text: 'Směr šipky', style: 'tableHeader' },
              { text: 'Do cíle', style: 'tableHeader', alignment: 'center' },
              { text: 'Stav', style: 'tableHeader', alignment: 'center' },
            ],
            ...pointRows,
          ],
        },
        layout: { fillColor: (rowIndex: number) => rowIndex === 0 ? NAVY : rowIndex % 2 === 0 ? '#F8FAFC' : null, hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0', paddingTop: () => 5, paddingBottom: () => 5 },
        margin: [0, 0, 0, 14],
      },

      // Visualized photos of points for installers
      ...(resolvedInstallPhotos.length > 0 ? [
        { text: 'Fotodokumentace a přesný zákres umístění cedulí', style: 'heading', pageBreak: 'before' },
        ...resolvedInstallPhotos.map(({ pointIndex, point, dataUrl }) => {
          const pAny = point as unknown as Record<string, unknown>;
          return {
            unbreakable: true,
            margin: [0, 0, 0, 14],
            stack: [
              { text: `Bod #${pointIndex + 1}: ${point.label} (Sloup VO č. ${safe(String(pAny.pillarNumber || '—'))})`, bold: true, fontSize: 10, color: NAVY, margin: [0, 8, 0, 4] },
              { text: `GPS: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}  •  Směr šipky: ${formatArrowDirectionPdf(String(pAny.arrowDirectionEnum || 'STRAIGHT'))}`, fontSize: 8, color: MUTED, margin: [0, 0, 0, 6] },
              { image: dataUrl, width: 518, margin: [0, 0, 0, 14] },
            ],
          };
        }),
      ] : []),

      // Protocol Confirmation Box
      {
        table: {
          widths: ['*'],
          body: [[
            { stack: [
              { text: 'PŘEDÁVACÍ PROTOKOL O DOKONČENÍ MONTÁŽE', bold: true, fontSize: 10, color: NAVY, margin: [0, 0, 0, 6] },
              { text: `Tento protokol stvrzuje řádnou instalaci navigačních prvků ${orgName} v souladu s vyhláškou a specifikací.`, fontSize: 8, color: MUTED, margin: [0, 0, 0, 10] },
              {
                columns: [
                  { stack: [{ text: 'Montážní četa / Technik:', fontSize: 8, color: MUTED }, { text: '_______________________________', margin: [0, 4, 0, 0] }] },
                  { stack: [{ text: 'Datum dokončení:', fontSize: 8, color: MUTED }, { text: '____. ____. 2026', margin: [0, 4, 0, 0] }] },
                  { stack: [{ text: 'Podpis technika:', fontSize: 8, color: MUTED }, { text: '_______________________________', margin: [0, 4, 0, 0] }] },
                ],
              },
            ], margin: [12, 10, 12, 10] },
          ]],
        },
        layout: { fillColor: '#F8FAFC', hLineColor: () => '#CBD5E1', vLineColor: () => '#CBD5E1' },
        margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      heading: { fontSize: 13, bold: true, color: NAVY, margin: [0, 0, 0, 8] },
      tableHeader: { color: '#FFFFFF', bold: true, fontSize: 8 },
    },
  };

  return pdfMake.createPdf(definition).getBuffer();
}
