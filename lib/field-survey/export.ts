import 'server-only';
import ExcelJS from 'exceljs';
import type { FieldSurveyPoint, FieldSurveyPhoto, FieldSurveyParcel, FieldSurveyOwner, FieldSurveyContact, FieldSurveyAiAnalysis } from '@prisma/client';

// ==========================================
// EXPORT VRSTVA PRO TERÉNNÍ PRŮZKUM
// Podporuje: CSV/XLSX, GeoJSON, KML
// Export respektuje aktivní filtry (předávaná data jsou již filtrovaná)
// ==========================================

export type PointForExport = {
  id: string;
  surfaceType: string;
  status: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number | null;
  address?: string | null;
  note?: string | null;
  createdAt: Date;
  createdBy: { name: string };
  photos: Array<{ url: string }>;
  parcelData?: {
    parcelNumber?: string | null;
    cadastralArea?: string | null;
    municipality?: string | null;
  } | null;
  ownerData?: {
    ownerName?: string | null;
    ownerType?: string | null;
  } | null;
  contactData?: {
    company?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  aiAnalysis?: {
    status?: string | null;
    suggestedType?: string | null;
    isUsable?: boolean | null;
  } | null;
};

const SURFACE_TYPE_LABELS: Record<string, string> = {
  ACKO: 'Ačko',
  TOWER: 'Tower',
  BANNER: 'Banner',
  PLOT: 'Plot',
  OTHER: 'Ostatní',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nový',
  REVIEWED: 'Zkontrolováno',
  PARCEL_FOUND: 'Parcela nalezena',
  OWNER_FOUND: 'Vlastník nalezen',
  CONTACT_FOUND: 'Kontakt nalezen',
  INTERESTING: 'Zajímavý',
  REJECTED: 'Zamítnutý',
  CONVERTED: 'Převedeno na nosič',
};

/** Exportuje body jako XLSX (Excel) */
export async function exportFieldSurveyXlsx(points: PointForExport[], surveyName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SeePoint OS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Průzkum ploch', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Typ plochy', key: 'surfaceType', width: 14 },
    { header: 'Stav', key: 'status', width: 20 },
    { header: 'Latitude', key: 'lat', width: 14 },
    { header: 'Longitude', key: 'lng', width: 14 },
    { header: 'GPS přesnost (m)', key: 'accuracy', width: 18 },
    { header: 'Adresa', key: 'address', width: 40 },
    { header: 'Parcela', key: 'parcel', width: 18 },
    { header: 'Katastrální území', key: 'cadastral', width: 24 },
    { header: 'Obec', key: 'municipality', width: 20 },
    { header: 'Vlastník / správce', key: 'owner', width: 30 },
    { header: 'Typ vlastníka', key: 'ownerType', width: 18 },
    { header: 'Firma (kontakt)', key: 'contactCompany', width: 24 },
    { header: 'Kontaktní osoba', key: 'contactPerson', width: 24 },
    { header: 'Telefon', key: 'contactPhone', width: 18 },
    { header: 'E-mail', key: 'contactEmail', width: 28 },
    { header: 'AI typ návrh', key: 'aiType', width: 16 },
    { header: 'AI využitelná', key: 'aiUsable', width: 14 },
    { header: 'Poznámka', key: 'note', width: 50 },
    { header: 'Datum', key: 'createdAt', width: 20 },
    { header: 'Autor', key: 'author', width: 24 },
  ];

  // Header row styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const p of points) {
    sheet.addRow({
      id: p.id,
      surfaceType: SURFACE_TYPE_LABELS[p.surfaceType] ?? p.surfaceType,
      status: STATUS_LABELS[p.status] ?? p.status,
      lat: p.latitude,
      lng: p.longitude,
      accuracy: p.gpsAccuracyMeters ?? '',
      address: p.address ?? '',
      parcel: p.parcelData?.parcelNumber ?? '',
      cadastral: p.parcelData?.cadastralArea ?? '',
      municipality: p.parcelData?.municipality ?? '',
      owner: p.ownerData?.ownerName ?? '',
      ownerType: p.ownerData?.ownerType ?? '',
      contactCompany: p.contactData?.company ?? '',
      contactPerson: p.contactData?.contactPerson ?? '',
      contactPhone: p.contactData?.phone ?? '',
      contactEmail: p.contactData?.email ?? '',
      aiType: p.aiAnalysis?.suggestedType ?? '',
      aiUsable: p.aiAnalysis?.isUsable === true ? 'Ano' : p.aiAnalysis?.isUsable === false ? 'Ne' : '',
      note: p.note ?? '',
      createdAt: p.createdAt.toLocaleDateString('cs-CZ'),
      author: p.createdBy.name,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Exportuje body jako GeoJSON (RFC 7946) */
export function exportFieldSurveyGeoJson(points: PointForExport[], surveyName: string): string {
  const geojson = {
    type: 'FeatureCollection',
    name: surveyName,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features: points.map((p) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        id: p.id,
        surfaceType: p.surfaceType,
        surfaceTypeLabel: SURFACE_TYPE_LABELS[p.surfaceType] ?? p.surfaceType,
        status: p.status,
        statusLabel: STATUS_LABELS[p.status] ?? p.status,
        gpsAccuracyMeters: p.gpsAccuracyMeters,
        address: p.address,
        note: p.note,
        createdAt: p.createdAt.toISOString(),
        author: p.createdBy.name,
        parcelNumber: p.parcelData?.parcelNumber,
        cadastralArea: p.parcelData?.cadastralArea,
        municipality: p.parcelData?.municipality,
        ownerName: p.ownerData?.ownerName,
        ownerType: p.ownerData?.ownerType,
        contactCompany: p.contactData?.company,
        contactPhone: p.contactData?.phone,
        contactEmail: p.contactData?.email,
        aiSuggestedType: p.aiAnalysis?.suggestedType,
        aiIsUsable: p.aiAnalysis?.isUsable,
        photoUrl: p.photos[0]?.url ?? null,
      },
    })),
  };
  return JSON.stringify(geojson, null, 2);
}

/** Exportuje body jako KML (pro Google Maps / Google Earth) */
export function exportFieldSurveyKml(points: PointForExport[], surveyName: string): string {
  const escapeXml = (s: string | null | undefined) =>
    (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const placemarks = points.map((p) => {
    const name = `${SURFACE_TYPE_LABELS[p.surfaceType] ?? p.surfaceType} – ${p.address ?? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}`;
    const description = [
      `Stav: ${STATUS_LABELS[p.status] ?? p.status}`,
      p.gpsAccuracyMeters ? `GPS přesnost: ±${p.gpsAccuracyMeters} m` : null,
      p.parcelData?.parcelNumber ? `Parcela: ${p.parcelData.parcelNumber}` : null,
      p.parcelData?.cadastralArea ? `K.ú.: ${p.parcelData.cadastralArea}` : null,
      p.ownerData?.ownerName ? `Vlastník: ${p.ownerData.ownerName}` : null,
      p.note ? `Poznámka: ${p.note}` : null,
      `Datum: ${p.createdAt.toLocaleDateString('cs-CZ')}`,
      `Autor: ${p.createdBy.name}`,
    ].filter(Boolean).join('\n');

    return `  <Placemark>
    <name>${escapeXml(name)}</name>
    <description><![CDATA[${description}]]></description>
    <Point>
      <coordinates>${p.longitude},${p.latitude},0</coordinates>
    </Point>
  </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(surveyName)}</name>
    <description>Export terénního průzkumu SeePoint OS</description>
${placemarks}
  </Document>
</kml>`;
}
