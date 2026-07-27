import pdfMake from 'pdfmake';
import roboto from 'pdfmake/build/fonts/Roboto.js';
import type { ProposalOffer } from './presentation';
import { getSignedStaticMapUrl } from '@/lib/google-maps';

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

function formatArrowDirectionPdf(arrowEnum?: string | null) {
  switch (arrowEnum) {
    case 'LEFT': return '⬅ Vlevo';
    case 'RIGHT': return '➔ Vpravo';
    case 'SLANTED_LEFT': return '↖ Šikmo vlevo';
    case 'SLANTED_RIGHT': return '↗ Šikmo vpravo';
    case 'U_TURN': return '↩ Otočení do protisměru';
    case 'TWO_WAY': return '↔ Obousměrný';
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

  const regularPricing = offer.pricing.filter((row) => row.emphasis !== 'total');
  const total = offer.pricing.find((row) => row.emphasis === 'total')?.amount ?? offer.stats.total;

  // Build table rows depending on offer type
  const isNavigation = offer.offerType === 'NAVIGATION' && navigationData;

  const tableHeader = isNavigation
    ? [{ text: '#', style: 'tableHeader' }, { text: 'Navigační bod & Sloup', style: 'tableHeader' }, { text: 'Směr navedení', style: 'tableHeader' }, { text: 'Vzdálenost', style: 'tableHeader' }, { text: 'Cena', style: 'tableHeader' }]
    : [{ text: '#', style: 'tableHeader' }, { text: 'Plocha', style: 'tableHeader' }, { text: 'Lokalita', style: 'tableHeader' }, { text: 'Rozměr', style: 'tableHeader' }];

  const tableWidths = isNavigation ? [18, '*', 110, 80, 70] : [18, '*', 105, 78];

  const tableRows = isNavigation
    ? navigationData.points.slice(0, 18).map((point, index) => {
        const pAny = point as unknown as Record<string, unknown>;
        const distStr = pAny.distanceSource === 'MANUAL' && pAny.manualDistanceValue
          ? `${pAny.manualDistanceValue} ${pAny.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm'}`
          : typeof pAny.calculatedDistanceMeters === 'number'
            ? (pAny.calculatedDistanceMeters >= 1000 ? `${(pAny.calculatedDistanceMeters / 1000).toFixed(1)} km` : `${pAny.calculatedDistanceMeters} m`)
            : '—';

        const pillarStr = pAny.pillarNumber ? ` [Sloup ${pAny.pillarNumber}]` : '';

        return [
          { text: String(index + 1), color: MUTED, bold: true },
          { stack: [{ text: `${point.label}${pillarStr}`, bold: true }, { text: safe(point.address || point.navigationType), fontSize: 8, color: MUTED }] },
          { text: formatArrowDirectionPdf(typeof pAny.arrowDirectionEnum === 'string' ? pAny.arrowDirectionEnum : null), fontSize: 8.5, bold: true, color: BLUE },
          { text: distStr, fontSize: 8.5, bold: true },
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

  const clientMark = clientLogoDataUrl
    ? { image: clientLogoDataUrl, fit: [95, 44], alignment: 'right', margin: [0, 2, 0, 0] }
    : { text: offer.client.logoLabel, fontSize: 22, bold: true, color: BLUE, alignment: 'right', margin: [0, 9, 0, 0] };

  const definition = {
    info: { title: offer.title, author: 'SeePOINT', subject: 'Nabídka venkovní reklamní kampaně' },
    pageSize: 'A4',
    pageMargins: [38, 48, 38, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: NAVY, lineHeight: 1.15 },
    header: () => ({
      columns: [
        { text: 'SeePOINT', bold: true, color: BLUE, fontSize: 12 },
        { text: `NABÍDKA  •  ${offer.id}`, alignment: 'right', color: MUTED, fontSize: 8 },
      ],
      margin: [38, 20, 38, 0],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: 'SeePOINT  •  outdoor reklama', color: MUTED, fontSize: 7.5 },
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
        ...(staticMapDataUrl ? [{ image: staticMapDataUrl, width: 518, margin: [0, 4, 0, 16] }] : []),
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
      { text: 'Cenová kalkulace', style: 'heading', pageBreak: 'before' },
      { text: 'Jednotlivé složky ceny jsou načtené z cenového katalogu a v nabídce přehledně oddělené.', color: MUTED, margin: [0, 0, 0, 12] },
      {
        table: { widths: ['*', 120], body: [...pricingRows, [{ text: 'CELKEM VČETNĚ DPH', bold: true, color: '#FFFFFF', fontSize: 11 }, { text: money(total), bold: true, color: '#FFFFFF', alignment: 'right', fontSize: 12 }]] },
        layout: { fillColor: (rowIndex: number, node: { table: { body: unknown[] } }) => rowIndex === node.table.body.length - 1 ? BLUE : rowIndex % 2 === 0 ? '#F8FAFC' : null, hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0', paddingTop: () => 8, paddingBottom: () => 8 },
        margin: [0, 0, 0, 22],
      },
      { text: 'Co bude následovat po schválení', style: 'heading' },
      ...nextSteps,
      { text: 'Obchodní podmínky', style: 'heading', margin: [0, 14, 0, 8] },
      { ul: offer.conditions.map((condition) => condition.text), color: MUTED, fontSize: 8.5, margin: [4, 0, 0, 18] },
      {
        table: { widths: ['*'], body: [[{ stack: [
          { text: 'Váš kontakt v SeePOINT', style: 'eyebrow' },
          { text: offer.salesperson.name, bold: true, fontSize: 12, margin: [0, 4, 0, 2] },
          { text: [safe(offer.salesperson.email), safe(offer.salesperson.phone)].filter((value) => value !== '—').join('  •  ') || 'Kontakt je dostupný v interaktivní nabídce.', color: MUTED },
        ], margin: [14, 12, 14, 12] }]] },
        layout: { fillColor: '#F8FAFC', hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0' },
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
