import type { NavigationImportReport, NavigationImportRow } from './navigation-import';

export type PlannedNavigation = {
  sourceKey: string;
  row: NavigationImportRow;
};

export type PlannedCarrier = {
  groupKey: string;
  sourceKey: string;
  code: string;
  name: string;
  city: string;
  address?: string;
  cadastralArea?: string;
  structureCode?: string;
  latitude?: number;
  longitude?: number;
  gpsStatus: 'MISSING' | 'UNVERIFIED';
  navigations: PlannedNavigation[];
  clients: string[];
  warnings: string[];
};

export type NavigationImportPlan = {
  planHash: string;
  carriers: PlannedCarrier[];
  stats: {
    sourceRows: number;
    carriers: number;
    navigations: number;
    clients: number;
    carriersWithoutGps: number;
    multiNavigationCarriers: number;
    reviewRows: number;
  };
};

function normalize(value: string | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function normalizeClientName(value: string) {
  return normalize(value).replace(/-/g, ' ');
}

function hash(value: string) {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return (current >>> 0).toString(16).padStart(8, '0');
}

function cityFromSheet(sheetName: string) {
  const value = normalize(sheetName);
  if (value.includes('ostrava')) return 'Ostrava';
  if (value.includes('orlova')) return 'Orlová';
  if (value.includes('havirov')) return 'Havířov';
  if (value.includes('frydek') || value.includes('mistek')) return 'Frýdek-Místek';
  return sheetName.replace(/\b20\d{2}\b/g, '').trim() || 'Neurčené město';
}

function carrierGroupKey(row: NavigationImportRow) {
  const sheet = normalize(row.sheetName);
  const structure = normalize(row.structureCode);
  const street = normalize(row.street);
  if (structure) return `${sheet}|structure:${structure}|street:${street || 'unknown'}`;
  if (row.latitude !== undefined && row.longitude !== undefined) {
    return `${sheet}|gps:${row.latitude.toFixed(6)},${row.longitude.toFixed(6)}`;
  }
  return `${sheet}|row:${row.sourceRow}`;
}

function surfaceBaseKey(row: NavigationImportRow) {
  return [
    normalize(row.sheetName),
    normalize(row.sourcePosition),
    normalize(row.structureCode),
    normalize(row.street),
    normalize(row.directionDescription),
    normalize(row.clientName),
  ].join('|');
}

function coordinateSpread(rows: NavigationImportRow[]) {
  const coordinates = rows.filter(
    (row): row is NavigationImportRow & { latitude: number; longitude: number } =>
      row.latitude !== undefined && row.longitude !== undefined,
  );
  if (coordinates.length < 2) return 0;
  const latitudes = coordinates.map((row) => row.latitude);
  const longitudes = coordinates.map((row) => row.longitude);
  const latitudeMeters = (Math.max(...latitudes) - Math.min(...latitudes)) * 111_000;
  const longitudeMeters = (Math.max(...longitudes) - Math.min(...longitudes)) * 72_000;
  return Math.hypot(latitudeMeters, longitudeMeters);
}

export function buildNavigationImportPlan(reports: NavigationImportReport[]): NavigationImportPlan {
  const rows = reports.flatMap((report) => report.records);
  const grouped = new Map<string, NavigationImportRow[]>();

  rows.forEach((row) => {
    const key = carrierGroupKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  const carriers = [...grouped.entries()].map(([groupKey, groupRows]) => {
    const first = groupRows[0];
    const city = cityFromSheet(first.sheetName);
    const coordinateRow = groupRows.find(
      (row) => row.latitude !== undefined && row.longitude !== undefined,
    );
    const occurrence = new Map<string, number>();
    const navigations = groupRows.map((row) => {
      const baseKey = surfaceBaseKey(row);
      const duplicateNumber = (occurrence.get(baseKey) ?? 0) + 1;
      occurrence.set(baseKey, duplicateNumber);
      const stableKey = `${baseKey}|duplicate:${duplicateNumber}`;
      return { sourceKey: `navigation-surface:${hash(stableKey)}`, row };
    });
    const clients = [...new Set(groupRows.map((row) => row.clientName).filter(Boolean))].sort();
    const spread = coordinateSpread(groupRows);
    const warnings: string[] = [];
    if (spread > 25) warnings.push(`GPS záznamů na sloupu se liší přibližně o ${Math.round(spread)} m.`);
    if (!first.structureCode && !coordinateRow) warnings.push('Sloup nemá číslo ani GPS a nebude sloučen s jiným řádkem.');

    const groupHash = hash(groupKey);
    const cityCode = normalize(city).replace(/-/g, '').slice(0, 3).toUpperCase() || 'NAV';
    const structureLabel = first.structureCode ? `sloup ${first.structureCode}` : `bod ${groupHash.slice(0, 5)}`;
    const locationLabel = first.street || first.cadastralArea || city;

    return {
      groupKey,
      sourceKey: `navigation-carrier:${groupHash}`,
      code: `NAV-${cityCode}-${groupHash.toUpperCase()}`,
      name: `Navigační ${structureLabel} – ${locationLabel}`,
      city,
      address: first.street,
      cadastralArea: first.cadastralArea,
      structureCode: first.structureCode,
      latitude: coordinateRow?.latitude,
      longitude: coordinateRow?.longitude,
      gpsStatus: coordinateRow ? 'UNVERIFIED' as const : 'MISSING' as const,
      navigations,
      clients,
      warnings,
    };
  }).sort((left, right) => left.code.localeCompare(right.code, 'cs'));

  const clients = new Set(rows.map((row) => normalizeClientName(row.clientName)).filter(Boolean));
  const planHash = hash(carriers.flatMap((carrier) => [
    carrier.sourceKey,
    ...carrier.navigations.map((navigation) => navigation.sourceKey),
  ]).sort().join('|'));

  return {
    planHash,
    carriers,
    stats: {
      sourceRows: reports.reduce((sum, report) => sum + report.totalRows, 0),
      carriers: carriers.length,
      navigations: rows.length,
      clients: clients.size,
      carriersWithoutGps: carriers.filter((carrier) => carrier.gpsStatus === 'MISSING').length,
      multiNavigationCarriers: carriers.filter((carrier) => carrier.navigations.length > 1).length,
      reviewRows: rows.filter((row) => row.issues.length > 0).length,
    },
  };
}
