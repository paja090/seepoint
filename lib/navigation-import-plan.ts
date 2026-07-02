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

type CoordinateRow = NavigationImportRow & { latitude: number; longitude: number };

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

function hasCoordinates(row: NavigationImportRow): row is CoordinateRow {
  return row.latitude !== undefined && row.longitude !== undefined;
}

function isSpecificStructure(value: string | undefined) {
  return /\d/.test(value ?? '');
}

function distanceMeters(left: CoordinateRow, right: CoordinateRow) {
  const latitude = ((left.latitude + right.latitude) / 2) * Math.PI / 180;
  const latitudeMeters = (left.latitude - right.latitude) * 111_320;
  const longitudeMeters = (left.longitude - right.longitude) * 111_320 * Math.cos(latitude);
  return Math.hypot(latitudeMeters, longitudeMeters);
}

function structuresCompatible(left: CoordinateRow, right: CoordinateRow) {
  const distance = distanceMeters(left, right);
  if (distance <= 1) return true;
  if (!isSpecificStructure(left.structureCode) || !isSpecificStructure(right.structureCode)) return true;
  return normalize(left.structureCode) === normalize(right.structureCode);
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

function groupImportRows(rows: NavigationImportRow[]) {
  const groups = new Map<string, NavigationImportRow[]>();
  const sheets = new Map<string, NavigationImportRow[]>();
  rows.forEach((row) => {
    const key = normalize(row.sheetName);
    sheets.set(key, [...(sheets.get(key) ?? []), row]);
  });

  sheets.forEach((sheetRows, sheetKey) => {
    const coordinateGroups: CoordinateRow[][] = [];
    const coordinateRows = sheetRows.filter(hasCoordinates).sort((left, right) =>
      surfaceBaseKey(left).localeCompare(surfaceBaseKey(right), 'cs'),
    );

    coordinateRows.forEach((row) => {
      const candidates = coordinateGroups
        .map((group, index) => ({
          group,
          index,
          nearestDistance: Math.min(...group.map((candidate) => distanceMeters(row, candidate))),
        }))
        .filter(({ group }) => group.every((candidate) =>
          distanceMeters(row, candidate) <= 10 && structuresCompatible(row, candidate),
        ))
        .sort((left, right) => left.nearestDistance - right.nearestDistance);

      if (candidates[0]) candidates[0].group.push(row);
      else coordinateGroups.push([row]);
    });

    coordinateGroups.forEach((group) => {
      const anchor = [...group].sort((left, right) =>
        surfaceBaseKey(left).localeCompare(surfaceBaseKey(right), 'cs'),
      )[0];
      const anchorKey = [
        surfaceBaseKey(anchor),
        anchor.latitude.toFixed(6),
        anchor.longitude.toFixed(6),
        `row:${anchor.sourceRow}`,
      ].join('|');
      groups.set(`${sheetKey}|gps-cluster:${hash(anchorKey)}`, group);
    });

    sheetRows.filter((row) => !hasCoordinates(row)).forEach((row) => {
      const structure = normalize(row.structureCode);
      const street = normalize(row.street);
      const key = isSpecificStructure(row.structureCode)
        ? `${sheetKey}|structure:${structure}|street:${street || 'unknown'}`
        : `${sheetKey}|row:${row.sourceRow}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
  });

  return groups;
}

function coordinateSpread(rows: NavigationImportRow[]) {
  const coordinates = rows.filter(hasCoordinates);
  if (coordinates.length < 2) return 0;
  return Math.max(...coordinates.flatMap((left) => coordinates.map((right) => distanceMeters(left, right))));
}

export function buildNavigationImportPlan(reports: NavigationImportReport[]): NavigationImportPlan {
  const rows = reports.flatMap((report) => report.records);
  const grouped = groupImportRows(rows);

  const carriers = [...grouped.entries()].map(([groupKey, groupRows]) => {
    const first = groupRows[0];
    const city = cityFromSheet(first.sheetName);
    const coordinateRows = groupRows.filter(hasCoordinates);
    const latitude = coordinateRows.length
      ? coordinateRows.reduce((sum, row) => sum + row.latitude, 0) / coordinateRows.length
      : undefined;
    const longitude = coordinateRows.length
      ? coordinateRows.reduce((sum, row) => sum + row.longitude, 0) / coordinateRows.length
      : undefined;
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
    const specificStructures = [...new Set(groupRows
      .map((row) => row.structureCode)
      .filter(isSpecificStructure)
      .map((value) => normalize(value)))];
    const warnings: string[] = [];
    if (spread > 10) warnings.push(`GPS záznamů na sloupu se liší přibližně o ${Math.round(spread)} m.`);
    if (specificStructures.length > 1) warnings.push('Stejný GPS bod obsahuje více čísel sloupu; vyžaduje ruční kontrolu.');
    if (!coordinateRows.length && !isSpecificStructure(first.structureCode)) {
      warnings.push('Řádek nemá GPS ani konkrétní číslo sloupu a nebude sloučen s jiným řádkem.');
    }

    const preferredStructure = groupRows.find((row) => isSpecificStructure(row.structureCode))?.structureCode
      ?? first.structureCode;
    const groupHash = hash(groupKey);
    const cityCode = normalize(city).replace(/-/g, '').slice(0, 3).toUpperCase() || 'NAV';
    const structureLabel = preferredStructure ? `sloup ${preferredStructure}` : `bod ${groupHash.slice(0, 5)}`;
    const locationLabel = first.street || first.cadastralArea || city;

    return {
      groupKey,
      sourceKey: `navigation-carrier:${groupHash}`,
      code: `NAV-${cityCode}-${groupHash.toUpperCase()}`,
      name: `Navigační ${structureLabel} – ${locationLabel}`,
      city,
      address: first.street,
      cadastralArea: first.cadastralArea,
      structureCode: preferredStructure,
      latitude,
      longitude,
      gpsStatus: coordinateRows.length ? 'UNVERIFIED' as const : 'MISSING' as const,
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
