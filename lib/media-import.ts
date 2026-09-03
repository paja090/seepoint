export type MediaImportKind = 'CITY_POSTER' | 'PROMO_BENCH' | 'PROMO_HORIZON' | 'TOWER';

export type MediaImportIssue = {
  code: string;
  message: string;
};

export type MediaImportRow = {
  kind: MediaImportKind;
  sourceRow: number;
  sourceCode: string;
  carrierCode: string;
  name: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  surfaceName: string;
  issues: MediaImportIssue[];
};

export type MediaImportReport = {
  kind: MediaImportKind;
  rows: MediaImportRow[];
  stats: {
    sourceRows: number;
    carriers: number;
    surfaces: number;
    validGps: number;
    missingGps: number;
    withPhotos: number;
    reviewRows: number;
  };
};

function tableRows(text: string) {
  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.split('\t'));
}

function numberValue(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value.trim().replace(/^"|"$/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function photoValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed?.startsWith('http') ? trimmed : undefined;
}

function gpsIssues(latitude?: number, longitude?: number): MediaImportIssue[] {
  if (latitude === undefined || longitude === undefined) {
    return [{ code: 'MISSING_GPS', message: 'Chybí nebo je neplatná GPS poloha.' }];
  }
  if (latitude < 48 || latitude > 52 || longitude < 12 || longitude > 19) {
    return [{ code: 'GPS_OUTSIDE_CZ', message: 'Souřadnice je mimo očekávané území ČR.' }];
  }
  return [];
}

function report(kind: MediaImportKind, rows: MediaImportRow[], carrierKeys: string[], surfaces: number): MediaImportReport {
  return {
    kind,
    rows,
    stats: {
      sourceRows: rows.length,
      carriers: new Set(carrierKeys).size,
      surfaces,
      validGps: rows.filter((row) => row.latitude !== undefined && row.longitude !== undefined).length,
      missingGps: rows.filter((row) => row.latitude === undefined || row.longitude === undefined).length,
      withPhotos: rows.filter((row) => row.photoUrl).length,
      reviewRows: rows.filter((row) => row.issues.length).length,
    },
  };
}

function parseCityPosters(text: string) {
  const rows = tableRows(text);
  const header = rows.findIndex((row) => row[0]?.trim().toLocaleLowerCase('cs-CZ') === 'kód');
  if (header < 0) throw new Error('V listu CP nebyla nalezena hlavička „kód“.');
  const parsed = rows.slice(header + 1).flatMap((row, index): MediaImportRow[] => {
    const code = row[0]?.trim();
    if (!/^OC\d+[A-Z]?$/.test(code || '')) return [];
    const baseCode = code.replace(/B$/, '');
    const latitude = numberValue(row[5]);
    const longitude = numberValue(row[6]);
    const side = code.endsWith('B') ? 'B' : 'A';
    return [{
      kind: 'CITY_POSTER',
      sourceRow: header + index + 2,
      sourceCode: code,
      carrierCode: `CP-${baseCode}`,
      name: row[1]?.trim() || code,
      city: 'Ostrava',
      address: row[1]?.trim() || '',
      latitude,
      longitude,
      photoUrl: photoValue(row[4]),
      surfaceName: `Strana ${side}`,
      issues: [
        ...gpsIssues(latitude, longitude),
        ...(!photoValue(row[4]) ? [{ code: 'MISSING_PHOTO', message: 'Chybí odkaz na fotografii.' }] : []),
      ],
    }];
  });
  return report('CITY_POSTER', parsed, parsed.map((row) => row.carrierCode), parsed.length);
}

function parsePromoBenches(text: string) {
  const rows = tableRows(text);
  const header = rows.findIndex((row) => row.some((cell) => cell.trim().toLocaleUpperCase('cs-CZ') === 'KÓD'));
  if (header < 0) throw new Error('V listu PL nebyla nalezena hlavička „KÓD“.');
  const parsed = rows.slice(header + 1).flatMap((row, index): MediaImportRow[] => {
    if (!/^\d+$/.test(row[0]?.trim() || '') || !row[1]?.trim()) return [];
    const latitude = numberValue(row[6]);
    const longitude = numberValue(row[7]);
    const rawCity = row[3]?.trim() || '';
    const city = rawCity.toLocaleLowerCase('cs-CZ') === 'ostrava' ? 'Ostrava' : rawCity;
    const issues = gpsIssues(latitude, longitude);
    if (!city || city === '1') issues.push({ code: 'INVALID_CITY', message: 'Město chybí nebo má neplatnou hodnotu.' });
    if (!photoValue(row[8])) issues.push({ code: 'MISSING_PHOTO', message: 'Chybí odkaz na fotografii.' });
    if (!row[9]?.trim()) issues.push({ code: 'MISSING_MEDIA_TYPE', message: 'Chybí typ nosiče.' });
    return [{
      kind: 'PROMO_BENCH',
      sourceRow: header + index + 2,
      sourceCode: row[1].trim(),
      carrierCode: `PL-${row[1].trim()}`,
      name: row[2]?.trim() || row[1].trim(),
      city: city === '1' ? '' : city,
      address: [row[5]?.trim(), row[2]?.trim()].filter(Boolean).join(' – '),
      latitude,
      longitude,
      photoUrl: photoValue(row[8]),
      surfaceName: 'Celý nosič',
      issues,
    }];
  });
  return report('PROMO_BENCH', parsed, parsed.map((row) => row.carrierCode), parsed.length);
}

function parsePromoHorizons(text: string) {
  const rows = tableRows(text);
  const header = rows.findIndex((row) => row[0]?.trim().toLocaleUpperCase('cs-CZ') === 'ČÍSLO');
  if (header < 0) throw new Error('V listu PH nebyla nalezena hlavička „ČÍSLO“.');
  const parsed = rows.slice(header + 1).flatMap((row, index): MediaImportRow[] => {
    if (!/^\d+$/.test(row[0]?.trim() || '')) return [];
    const latitude = numberValue(row[5]);
    const longitude = numberValue(row[6]);
    const position = row[1]?.trim() || row[0].trim();
    const gpsKey = latitude !== undefined && longitude !== undefined ? `${latitude.toFixed(7)}-${longitude.toFixed(7)}` : `ROW-${header + index + 2}`;
    const sideMatch = /([ab])$/i.exec(position);
    const issues = gpsIssues(latitude, longitude);
    if (!photoValue(row[7])) issues.push({ code: 'MISSING_PHOTO', message: 'Chybí odkaz na fotografii.' });
    return [{
      kind: 'PROMO_HORIZON',
      sourceRow: header + index + 2,
      sourceCode: position,
      carrierCode: `PH-${gpsKey}`,
      name: `Promohorizont ${position}`,
      city: 'Havířov',
      address: row[2]?.trim() || '',
      latitude,
      longitude,
      photoUrl: photoValue(row[7]),
      surfaceName: sideMatch ? `Strana ${sideMatch[1].toUpperCase()}` : `Plocha ${position}`,
      issues,
    }];
  });
  return report('PROMO_HORIZON', parsed, parsed.map((row) => row.carrierCode), parsed.length);
}

function parseTowers(text: string) {
  const rows = tableRows(text);
  const header = rows.findIndex((row) => row.some((cell) => cell.toLocaleUpperCase('cs-CZ').includes('TOWER 2024')));
  if (header < 0) throw new Error('V listu T25 nebyla nalezena hlavička Tower.');
  const parsed = rows.slice(header + 1).flatMap((row, index): MediaImportRow[] => {
    if (!/^\d+$/.test(row[0]?.trim() || '') || !row[1]?.trim()) return [];
    const code = `T-${row[0].trim()}`;
    const issues: MediaImportIssue[] = [{ code: 'MISSING_GPS', message: 'Tower nemá v listu uloženou GPS polohu.' }];
    if (/\bMT\b/i.test(row[1])) issues.push({ code: 'TYPE_REVIEW', message: 'Název naznačuje Minitower; typ je potřeba potvrdit.' });
    return [{
      kind: 'TOWER',
      sourceRow: header + index + 2,
      sourceCode: row[0].trim(),
      carrierCode: code,
      name: row[1].trim(),
      city: 'Ostrava',
      address: row[1].trim(),
      surfaceName: 'Strany A–D',
      issues,
    }];
  });
  return report('TOWER', parsed, parsed.map((row) => row.carrierCode), parsed.length * 4);
}

export function parseMediaImport(kind: MediaImportKind, text: string): MediaImportReport {
  if (!text.trim()) throw new Error('Vložte data včetně hlavičky.');
  const parsed = kind === 'CITY_POSTER'
    ? parseCityPosters(text)
    : kind === 'PROMO_BENCH'
      ? parsePromoBenches(text)
      : kind === 'PROMO_HORIZON'
        ? parsePromoHorizons(text)
        : parseTowers(text);
  if (!parsed.rows.length) {
    throw new Error('Nebyl nalezen žádný podporovaný datový řádek. Mediální list musí být vložen jako TSV se sloupci oddělenými tabulátorem.');
  }
  return parsed;
}
