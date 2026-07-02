export type NavigationImportIssueCode =
  | 'MISSING_GPS'
  | 'MISSING_STREET'
  | 'MISSING_STRUCTURE'
  | 'MISSING_PHOTO'
  | 'STATUS_REVIEW';

export type NavigationImportIssue = {
  code: NavigationImportIssueCode;
  message: string;
};

export type NavigationImportRow = {
  sourceRow: number;
  sheetName: string;
  sourcePosition?: string;
  structureCode?: string;
  street?: string;
  directionDescription?: string;
  rawMediaType?: string;
  mediaType: 'NAVIGATION_SIGN';
  clientName: string;
  dateFrom?: string;
  dateTo?: string;
  cadastralArea?: string;
  latitude?: number;
  longitude?: number;
  gpsStatus: 'MISSING' | 'UNVERIFIED';
  mapUrl?: string;
  photoReferences: string[];
  note?: string;
  issues: NavigationImportIssue[];
};

export type NavigationImportReport = {
  sheetName: string;
  totalRows: number;
  records: NavigationImportRow[];
  helperRows: number;
  validGps: number;
  missingGps: number;
  rowsWithPhotos: number;
  rowsWithDates: number;
  reviewRows: number;
  exactGpsDuplicateGroups: number;
};

const HEADER_ALIASES = {
  position: ['pozice'],
  structure: ['cislo stozaru sloupek', 'cislo stozaru / sloupek'],
  street: ['ulice'],
  description: ['popis'],
  mediaType: ['typ reklamy'],
  customer: ['konecny zakaznik'],
  dateFrom: ['podnajem od'],
  dateTo: ['podnajem do'],
  cadastralArea: ['katastr'],
  latitude: ['lot', 'latitude'],
  longitude: ['lan', 'longitude'],
  map: ['mapa'],
  photo: ['foto'],
  currentPhoto: ['aktualni foto'],
  newPhoto: ['nove fotky po vraceni navigaci', 'ftd 3/2026'],
  roadNote: ['poznamky navigace zmena k 1.10.2025 rsd'],
  note: ['poznamka'],
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9/]+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('cs');
}

function parseCoordinate(value: string, min: number, max: number) {
  const parsed = Number(value.trim().replace(',', '.').replace(/[NSEW°]/gi, '').trim());
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const candidates = ['\t', ';', ','];
  return candidates.sort((left, right) => firstLine.split(right).length - firstLine.split(left).length)[0];
}

function findColumn(headers: string[], key: HeaderKey) {
  const aliases: readonly string[] = HEADER_ALIASES[key];
  return headers.findIndex((header) => aliases.includes(normalize(header)));
}

function valueAt(row: string[], index: number) {
  return index >= 0 ? row[index]?.trim() ?? '' : '';
}

function uniqueReferences(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseNavigationImport(text: string, sheetName: string): NavigationImportReport {
  const delimiter = detectDelimiter(text);
  const rawRows = parseDelimited(text.replace(/^\uFEFF/, ''), delimiter);
  if (!rawRows.length) throw new Error('Soubor neobsahuje žádná data.');

  const headerIndex = rawRows.findIndex((row) => row.some((cell) => normalize(cell) === 'ulice'));
  if (headerIndex < 0) throw new Error('Nebyl nalezen hlavičkový řádek se sloupcem Ulice.');

  const headers = rawRows[headerIndex];
  const columns = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as HeaderKey[]).map((key) => [key, findColumn(headers, key)]),
  ) as Record<HeaderKey, number>;

  if (columns.description < 0 || columns.customer < 0) {
    throw new Error('Chybí sloupec Popis nebo Konečný zákazník.');
  }

  const records: NavigationImportRow[] = [];
  let helperRows = 0;
  let currentClient = '';

  rawRows.slice(headerIndex + 1).forEach((rawRow, offset) => {
    const sourceRow = headerIndex + offset + 2;
    const sourcePosition = valueAt(rawRow, columns.position);
    const structureCode = valueAt(rawRow, columns.structure);
    const street = valueAt(rawRow, columns.street);
    const directionDescription = valueAt(rawRow, columns.description);
    const rawMediaType = valueAt(rawRow, columns.mediaType);
    const rawClient = valueAt(rawRow, columns.customer);
    const latitude = parseCoordinate(valueAt(rawRow, columns.latitude), 48, 52);
    const longitude = parseCoordinate(valueAt(rawRow, columns.longitude), 12, 19);
    const hasGps = latitude !== undefined && longitude !== undefined;
    const mapUrl = valueAt(rawRow, columns.map);
    const photoReferences = uniqueReferences([
      valueAt(rawRow, columns.photo),
      valueAt(rawRow, columns.currentPhoto),
      valueAt(rawRow, columns.newPhoto),
    ]);
    const note = uniqueReferences([
      valueAt(rawRow, columns.roadNote),
      valueAt(rawRow, columns.note),
    ]).join(' | ');

    const groupRow =
      !sourcePosition &&
      !directionDescription &&
      !rawClient &&
      !hasGps &&
      Boolean(street) &&
      rawRow.some((value) => /^\d+$/.test(value.trim()));

    if (groupRow) {
      currentClient = street;
      helperRows += 1;
      return;
    }

    const clientName = rawClient || currentClient;
    const looksLikeRecord =
      Boolean(sourcePosition && (street || directionDescription || clientName || hasGps)) ||
      Boolean(street && directionDescription && clientName) ||
      Boolean(hasGps && (street || directionDescription || clientName));

    if (!looksLikeRecord) {
      helperRows += 1;
      return;
    }

    const issues: NavigationImportIssue[] = [];
    if (!hasGps) issues.push({ code: 'MISSING_GPS', message: 'Navigace nemá platné GPS.' });
    if (!street) issues.push({ code: 'MISSING_STREET', message: 'Chybí ulice.' });
    if (!structureCode) issues.push({ code: 'MISSING_STRUCTURE', message: 'Chybí číslo nebo typ sloupu.' });
    if (!photoReferences.length) issues.push({ code: 'MISSING_PHOTO', message: 'Chybí odkaz nebo název fotografie.' });
    if (/deinstal|demont|odstran|není|chybi|chybí/i.test(note)) {
      issues.push({ code: 'STATUS_REVIEW', message: 'Provozní stav vyžaduje kontrolu.' });
    }

    records.push({
      sourceRow,
      sheetName,
      sourcePosition: sourcePosition || undefined,
      structureCode: structureCode || undefined,
      street: street || undefined,
      directionDescription: directionDescription || undefined,
      rawMediaType: rawMediaType || undefined,
      mediaType: 'NAVIGATION_SIGN',
      clientName: clientName || 'NEURČENÝ KLIENT',
      dateFrom: valueAt(rawRow, columns.dateFrom) || undefined,
      dateTo: valueAt(rawRow, columns.dateTo) || undefined,
      cadastralArea: valueAt(rawRow, columns.cadastralArea) || undefined,
      latitude,
      longitude,
      gpsStatus: hasGps ? 'UNVERIFIED' : 'MISSING',
      mapUrl: mapUrl || undefined,
      photoReferences,
      note: note || undefined,
      issues,
    });
  });

  const gpsGroups = new Map<string, number>();
  records.forEach((record) => {
    if (record.latitude === undefined || record.longitude === undefined) return;
    const key = `${record.latitude.toFixed(7)},${record.longitude.toFixed(7)}`;
    gpsGroups.set(key, (gpsGroups.get(key) ?? 0) + 1);
  });

  return {
    sheetName,
    totalRows: Math.max(rawRows.length - headerIndex - 1, 0),
    records,
    helperRows,
    validGps: records.filter((record) => record.gpsStatus !== 'MISSING').length,
    missingGps: records.filter((record) => record.gpsStatus === 'MISSING').length,
    rowsWithPhotos: records.filter((record) => record.photoReferences.length > 0).length,
    rowsWithDates: records.filter((record) => record.dateFrom || record.dateTo).length,
    reviewRows: records.filter((record) => record.issues.length > 0).length,
    exactGpsDuplicateGroups: [...gpsGroups.values()].filter((count) => count > 1).length,
  };
}
