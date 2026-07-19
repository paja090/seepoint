import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import ExcelJS from 'exceljs';
import { cleanText, decimalString, normalizeCode, normalizeText, parseCoordinate, stableHash } from './normalize.ts';
import type { ImportIssue, ParsedWorkbook, SourceCampaign, SourceCarrier, SourcePrice, SourceSurface } from './types.ts';

const MONTHS = new Map([
  ['leden', 1], ['unor', 2], ['brezen', 3], ['duben', 4], ['kveten', 5], ['cerven', 6],
  ['cervenec', 7], ['srpen', 8], ['zari', 9], ['rijen', 10], ['listopad', 11], ['prosinec', 12],
]);
const AUXILIARY_SHEETS = ['OBSAZENOST VSE', 'Alphav CP', 'Alphavl PL', 'Navigace kontrola', 'UGO NABIDKA', 'MAPY 2026', 'sorfest nabídka'];

function cellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
    if ('text' in value) return value.text;
    if ('hyperlink' in value) return value.hyperlink;
  }
  return value;
}

function text(sheet: ExcelJS.Worksheet, row: number, column: number) {
  return cleanText(cellValue(sheet.getCell(row, column)));
}

export function campaignFromValue(value: unknown, year: number, month: number, sourceColumn: number): SourceCampaign | undefined {
  const rawSourceText = cleanText(value);
  if (!rawSourceText || /^(?:0|1|voln[ée]?|x|-|—)$/i.test(rawSourceText)) return undefined;
  const campaignName = rawSourceText;
  const normalizedCampaignName = normalizeText(campaignName);
  if (!normalizedCampaignName) return undefined;
  const orderReference = /\b(?:OBJ|ORD|ZAK)[-_ ]?\d+\b/i.exec(rawSourceText)?.[0];
  return {
    year, month, campaignName, normalizedCampaignName, rawSourceText,
    clientResolution: 'UNRESOLVED', orderReference, status: 'RESERVED', sourceColumn,
  };
}

function singleMonthColumns(sheet: ExcelJS.Worksheet, headerRow: number, startColumn: number, endColumn: number) {
  const result: Array<{ month: number; columns: number[] }> = [];
  for (let column = startColumn; column <= endColumn; column += 1) {
    const month = MONTHS.get(normalizeText(text(sheet, headerRow, column)));
    if (!month) continue;
    result.push({ month, columns: [column] });
  }
  return result;
}

function parseCampaigns(
  sheet: ExcelJS.Worksheet,
  row: number,
  monthColumns: Array<{ month: number; columns: number[] }>,
  issues: ImportIssue[],
  context?: { carrierCode: string; carrierName: string; surfaceLabel: string },
) {
  const campaigns: SourceCampaign[] = [];
  for (const slot of monthColumns) {
    const values = slot.columns.map((column) => text(sheet, row, column)).filter(Boolean);
    const campaignValues = [...new Map(values
      .filter((value) => !/^(?:0|1|voln[ée]?|x|-|—)$/i.test(value))
      .map((value) => [normalizeText(value), value])).values()];
    if (campaignValues.length > 1) {
      issues.push({
        code: 'AMBIGUOUS_CAMPAIGN_DATA', sheetName: sheet.name, sourceRow: row,
        sourceColumn: slot.columns[0], carrierCode: context?.carrierCode, carrierName: context?.carrierName,
        surfaceLabel: context?.surfaceLabel,
        message: `Měsíc ${slot.month}/2026 obsahuje více různých kampaní v paralelních sloupcích.`, rawValue: values,
      });
      issues[issues.length - 1].rawValue = { month: slot.month, columns: slot.columns, values: campaignValues };
      continue;
    }
    const campaign = campaignFromValue(campaignValues[0], 2026, slot.month, slot.columns[0]);
    if (campaign) campaigns.push(campaign);
  }
  return campaigns;
}

function sourceSurface(carrierCode: string, name: string, mediaType: SourceSurface['mediaType'], sourcePosition: string, campaigns: SourceCampaign[], orientation?: string): SourceSurface {
  return {
    sourceKey: `CARRIERS2026:SURFACE:${normalizeCode(carrierCode)}:${normalizeCode(sourcePosition || name)}`,
    sourcePosition, name, mediaType, orientation, campaigns,
  };
}

function parseBenches(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const carriers: SourceCarrier[] = [];
  const monthColumns = singleMonthColumns(sheet, 2, 15, 26);
  for (let row = 3; row <= sheet.actualRowCount; row += 1) {
    const sourceCode = text(sheet, row, 2);
    const rawType = text(sheet, row, 10);
    if (!sourceCode || normalizeText(rawType) !== 'promolavicka') continue;
    const city = text(sheet, row, 4);
    if (!city) {
      issues.push({ code: 'MISSING_REQUIRED_DATA', sheetName: sheet.name, sourceRow: row, field: 'Město', message: 'Lavička nemá město.' });
      continue;
    }
    const code = `PL-${sourceCode}`;
    const campaigns = parseCampaigns(sheet, row, monthColumns, issues);
    carriers.push({
      sourceKey: `CARRIERS2026:CARRIER:${normalizeCode(code)}`, code, codeAliases: [sourceCode],
      name: text(sheet, row, 3) || sourceCode, type: 'PROMO_BENCH', city,
      locality: text(sheet, row, 5) || undefined, street: text(sheet, row, 6) || undefined,
      address: text(sheet, row, 3) || undefined,
      latitude: parseCoordinate(cellValue(sheet.getCell(row, 7)), 48, 52),
      longitude: parseCoordinate(cellValue(sheet.getCell(row, 8)), 12, 19),
      rawMediaType: rawType, photoUrl: text(sheet, row, 9) || undefined, note: text(sheet, row, 11) || undefined,
      sourceSheet: sheet.name, sourceRow: row,
      surfaces: [sourceSurface(code, 'Celý nosič', 'PROMO_BENCH', sourceCode, campaigns)],
    });
  }
  return carriers;
}

function parseCityPosters(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const rows: Array<{ row: number; code: string }> = [];
  for (let row = 4; row <= sheet.actualRowCount; row += 1) {
    const code = text(sheet, row, 1).toUpperCase();
    if (/^[A-Z]{1,5}\s?\d+[A-Z]?$/.test(code) && text(sheet, row, 2)) rows.push({ row, code });
  }
  const codeSet = new Set(rows.map(({ code }) => normalizeCode(code)));
  const groups = new Map<string, SourceCarrier>();
  const monthColumns = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, columns: [15 + index * 2, 16 + index * 2] }));
  for (const item of rows) {
    const hasBase = item.code.endsWith('B') && codeSet.has(normalizeCode(item.code.slice(0, -1)));
    const base = hasBase ? item.code.slice(0, -1) : item.code;
    const code = `CP-${base}`;
    const side = hasBase ? 'B' : 'A';
    const carrierName = text(sheet, item.row, 2) || base;
    const campaigns = parseCampaigns(sheet, item.row, monthColumns, issues, { carrierCode: code, carrierName, surfaceLabel: `Strana ${side}` });
    const existing = groups.get(normalizeCode(code));
    const surface = { ...sourceSurface(code, `Strana ${side}`, 'CITY_POSTER', item.code, campaigns, side), sourceRow: item.row };
    if (existing) {
      existing.surfaces.push(surface);
      continue;
    }
    groups.set(normalizeCode(code), {
      sourceKey: `CARRIERS2026:CARRIER:${normalizeCode(code)}`, code, codeAliases: [base, item.code],
      name: carrierName, type: 'CITY_POSTER', city: 'Ostrava',
      locality: text(sheet, item.row, 3) || undefined, address: text(sheet, item.row, 2) || undefined,
      latitude: parseCoordinate(cellValue(sheet.getCell(item.row, 6)), 48, 52),
      longitude: parseCoordinate(cellValue(sheet.getCell(item.row, 7)), 12, 19),
      rawMediaType: text(sheet, item.row, 5) || undefined, photoUrl: text(sheet, item.row, 4) || undefined,
      sourceSheet: sheet.name, sourceRow: item.row, surfaces: [surface],
    });
  }
  return [...groups.values()];
}

function parseTowers(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const carriers: SourceCarrier[] = [];
  const monthColumns = singleMonthColumns(sheet, 3, 7, 18);
  for (let row = 4; row <= sheet.actualRowCount; row += 1) {
    const rawCode = text(sheet, row, 1).toUpperCase();
    if (!/^T\s?-?\d+$/.test(rawCode)) continue;
    const number = rawCode.replace(/\D/g, '');
    const code = `T-${number}`;
    const campaigns = parseCampaigns(sheet, row, monthColumns, issues);
    const surfaces = ['A', 'B', 'C', 'D'].map((side) => sourceSurface(code, `Strana ${side}`, 'PROMO_TOWER', `${rawCode}-${side}`, campaigns, side));
    carriers.push({
      sourceKey: `CARRIERS2026:CARRIER:${normalizeCode(code)}`, code, codeAliases: [rawCode, `T${number}`],
      name: text(sheet, row, 2) || rawCode, type: 'PROMO_TOWER', city: 'Ostrava',
      street: text(sheet, row, 3) || undefined, address: text(sheet, row, 2) || undefined,
      latitude: parseCoordinate(cellValue(sheet.getCell(row, 4)), 48, 52), longitude: parseCoordinate(cellValue(sheet.getCell(row, 5)), 12, 19),
      photoUrl: text(sheet, row, 6) || undefined, sourceSheet: sheet.name, sourceRow: row, surfaces,
    });
  }
  return carriers;
}

function parseHorizons(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const groups = new Map<string, SourceCarrier>();
  const monthColumns = singleMonthColumns(sheet, 2, 9, 20);
  for (let row = 3; row <= sheet.actualRowCount; row += 1) {
    if (!/^\d+$/.test(text(sheet, row, 1))) continue;
    const position = text(sheet, row, 2) || text(sheet, row, 1);
    const latitude = parseCoordinate(cellValue(sheet.getCell(row, 6)), 48, 52);
    const longitude = parseCoordinate(cellValue(sheet.getCell(row, 7)), 12, 19);
    if (latitude === undefined || longitude === undefined) {
      issues.push({ code: 'MISSING_REQUIRED_DATA', sheetName: sheet.name, sourceRow: row, field: 'GPS', message: 'Promohorizont nemá platné GPS pro bezpečné párování.' });
      continue;
    }
    const code = `PH-${latitude.toFixed(7)}-${longitude.toFixed(7)}`;
    const side = /([ab])$/i.exec(position)?.[1]?.toUpperCase();
    const campaigns = parseCampaigns(sheet, row, monthColumns, issues);
    const surface = sourceSurface(code, side ? `Strana ${side}` : `Plocha ${position}`, 'PROMO_HORIZON', position, campaigns, side);
    const existing = groups.get(code);
    if (existing) {
      existing.surfaces.push(surface);
      continue;
    }
    groups.set(code, {
      sourceKey: `CARRIERS2026:CARRIER:${normalizeCode(code)}`, code, codeAliases: [position],
      name: `Promohorizont ${position}`, type: 'PROMO_HORIZON', city: 'Havířov', street: text(sheet, row, 3) || undefined,
      address: text(sheet, row, 5) || text(sheet, row, 3) || undefined, latitude, longitude,
      photoUrl: text(sheet, row, 8) || undefined, sourceSheet: sheet.name, sourceRow: row, surfaces: [surface],
    });
  }
  return [...groups.values()];
}

function parseClv(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const code = 'CLV-OSTRAVA-01';
  const monthColumns = singleMonthColumns(sheet, 2, 3, 14);
  const surfaces: SourceSurface[] = [];
  for (let row = 3; row <= 6; row += 1) {
    const name = text(sheet, row, 2);
    if (!name) continue;
    surfaces.push(sourceSurface(code, name, 'CITYLIGHT', name, parseCampaigns(sheet, row, monthColumns, issues)));
  }
  return surfaces.length ? [{
    sourceKey: `CARRIERS2026:CARRIER:${normalizeCode(code)}`, code, codeAliases: ['CLV', 'CLV-1'],
    name: 'CLV Ostrava', type: 'CITYLIGHT' as const, city: 'Ostrava', sourceSheet: sheet.name, sourceRow: 3, surfaces,
  }] : [];
}

function priceType(name: string): Pick<SourcePrice, 'carrierType' | 'mediaType'> {
  const normalized = normalizeText(name);
  if (normalized.includes('horizont')) return { carrierType: 'PROMO_HORIZON', mediaType: 'PROMO_HORIZON' };
  if (normalized.includes('lavick')) return { carrierType: 'PROMO_BENCH', mediaType: 'PROMO_BENCH' };
  if (normalized.includes('clv') || normalized.includes('city gallery')) return { carrierType: 'CITYLIGHT', mediaType: 'CITYLIGHT' };
  if (normalized.includes('city poster')) return { carrierType: 'CITY_POSTER', mediaType: 'CITY_POSTER' };
  if (normalized.includes('tower')) return { carrierType: 'PROMO_TOWER', mediaType: 'PROMO_TOWER' };
  return {};
}

function parsePrices(sheet: ExcelJS.Worksheet, issues: ImportIssue[]) {
  const prices: SourcePrice[] = [];
  for (let row = 5; row <= sheet.actualRowCount; row += 1) {
    const name = text(sheet, row, 2);
    if (!name) {
      if (prices.length) break;
      continue;
    }
    const rentalPrice = decimalString(cellValue(sheet.getCell(row, 5)));
    const productionPrice = decimalString(cellValue(sheet.getCell(row, 6)));
    const totalPrice = decimalString(cellValue(sheet.getCell(row, 7)));
    if (!rentalPrice || !productionPrice || !totalPrice) {
      if (prices.length) break;
      continue;
    }
    const rentalMonths = Number(cellValue(sheet.getCell(row, 3))) || 1;
    const minQuantity = Number(cellValue(sheet.getCell(row, 4))) || 1;
    const identityKey = `PRICE:${normalizeText(name)}:${rentalMonths}:${minQuantity}`;
    prices.push({ identityKey, name, ...priceType(name), rentalMonths, minQuantity, rentalPrice, productionPrice, totalPrice, currency: 'CZK', sourceSheet: sheet.name, sourceRow: row });
  }
  if (!prices.length) issues.push({ code: 'INVALID_ROW', sheetName: sheet.name, message: 'V ceníku nebyly nalezeny importovatelné ceny.' });
  return prices;
}

export async function parseCarriers2026Workbook(filePath: string): Promise<ParsedWorkbook> {
  const bytes = await readFile(filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const issues: ImportIssue[] = [];
  const carriers: SourceCarrier[] = [];
  const processedSheets: string[] = [];
  const process = (name: string, parser: (sheet: ExcelJS.Worksheet, issues: ImportIssue[]) => SourceCarrier[]) => {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) return;
    processedSheets.push(name);
    carriers.push(...parser(sheet, issues));
  };
  process('PL26', parseBenches);
  process('CP26', parseCityPosters);
  process('T26', parseTowers);
  process('PH26', parseHorizons);
  process('CLV26', parseClv);
  const priceSheet = workbook.getWorksheet('CENÍK 2026');
  const prices = priceSheet ? (processedSheets.push(priceSheet.name), parsePrices(priceSheet, issues)) : [];
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  return {
    fileName: basename(filePath), fileHash: stableHash(bytes), sheetNames, processedSheets,
    auxiliarySheets: sheetNames.filter((name) => AUXILIARY_SHEETS.includes(name)),
    processedRows: carriers.reduce((sum, carrier) => sum + carrier.surfaces.length, 0) + prices.length,
    carriers, prices, issues,
  };
}
