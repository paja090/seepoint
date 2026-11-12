import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { Prisma, WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';

export const DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL =
  process.env.GOOGLE_PLAN_SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1VcssEXqBmRSV0xBkzP23Miadt2zTTR8lHhgHPQlLt6o/export?format=csv&gid=1725001912';

export function toGoogleSheetsXlsxUrl(url: string): string | null {
  if (!/docs\.google\.com\/spreadsheets/i.test(url)) return null;
  if (/format=csv/i.test(url)) return url.replace(/format=csv/gi, 'format=xlsx');
  if (/format=xlsx/i.test(url)) return url;
  return null;
}

/**
 * Checks whether an organization is SeePOINT s.r.o.
 * The default Google Spreadsheet is strictly proprietary to SeePoint s.r.o.
 */
export function isSeePointOrganization(org?: { id: string; name?: string | null; slug?: string | null } | null): boolean {
  if (!org) return false;
  if (org.id === 'org_seepoint_default') return true;
  if (org.slug?.trim().toLowerCase() === 'seepoint') return true;
  if (org.name?.toLowerCase().includes('seepoint')) return true;
  return false;
}

/**
 * Determines whether an ARGB/hex color represents a green highlight fill
 * (e.g. #00FF00 bright green or Google Sheets light green #D4EDBC / #D9EAD3),
 * while rejecting whites, grays, yellows (#FFFF00), reds (#FF0000), and cyans (#00FFFF).
 */
export function isGreenRgbHex(argb?: string | null): boolean {
  if (!argb) return false;
  const hex = argb.trim().toUpperCase().replace(/^#/, '');
  const rgb = hex.length === 8 ? hex.slice(2) : hex;
  if (!/^[0-9A-F]{6}$/.test(rgb)) return false;

  const r = Number.parseInt(rgb.slice(0, 2), 16);
  const g = Number.parseInt(rgb.slice(2, 4), 16);
  const b = Number.parseInt(rgb.slice(4, 6), 16);

  if (g < 80) return false;
  if (g - r < 15) return false;
  if (g - b < 15) return false;
  return true;
}

export function isGreenExcelFill(fill: unknown): boolean {
  if (!fill || typeof fill !== 'object') return false;
  const f = fill as { type?: string; pattern?: string; fgColor?: { argb?: string } };
  if (f.type === 'pattern' && f.pattern === 'none') return false;
  return isGreenRgbHex(f.fgColor?.argb);
}

export function unwrapExcelValueToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    return `${val.getUTCDate()}.${val.getUTCMonth() + 1}.${val.getUTCFullYear()}`;
  }
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) =>
          part && typeof part === 'object'
            ? unwrapExcelValueToString((part as Record<string, unknown>).text)
            : ''
        )
        .join('');
    }
    if ('result' in obj && obj.result !== undefined) {
      return unwrapExcelValueToString(obj.result);
    }
    if ('text' in obj && obj.text !== undefined) {
      return unwrapExcelValueToString(obj.text);
    }
    if ('error' in obj) return '';
  }
  return '';
}

export function extractExcelCellHyperlink(val: unknown): string | null {
  if (!val || typeof val !== 'object') return null;
  const obj = val as Record<string, unknown>;
  if (typeof obj.hyperlink === 'string' && /^https?:\/\//i.test(obj.hyperlink.trim())) {
    return obj.hyperlink.trim();
  }
  return null;
}

export type ParsedGooglePlanTask = {
  sheetRowIndex: number;
  sheetKey: string;
  scheduledAt: Date;
  dateStr: string;
  dayName?: string;
  clientName: string;
  title: string;
  description: string;
  requestedBy?: string | null;
  workers: string[];
  isHandedOver: boolean;
  isFtdSent: boolean;
  isFtdSkipped?: boolean;
  isInvoiced: boolean;
  isInvoiceExempt?: boolean;
  isCompletedByColor?: boolean;
  contactName?: string | null;
  contactPhone?: string | null;
  campaignDateFrom?: Date | null;
  campaignDateTo?: Date | null;
  mediaLabel?: string | null;
  quantity?: number | null;
  workType: WorkType;
  status: WorkOrderStatus;
  priority: WorkPriority;
  referenceUrl?: string | null;
  ftdUrl?: string | null;
};

/**
 * Robust RFC 4180 compliant CSV parser that correctly handles
 * multi-line quoted strings, commas within quotes, and escaped quotes.
 */
export function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i++;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

const MONTH_NAMES: Record<string, number> = {
  leden: 1,
  únor: 2,
  unor: 2,
  březen: 3,
  brezen: 3,
  duben: 4,
  květen: 5,
  kveten: 5,
  červen: 6,
  cerven: 6,
  červenec: 7,
  cervenec: 7,
  srpen: 8,
  září: 9,
  zari: 9,
  říjen: 10,
  rijen: 10,
  listopad: 11,
  prosinec: 12,
};

export function parseDateString(dateStr: string, fallbackYear = 2026): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const clean = dateStr.trim().replace(/\s+/g, '');

  // Formats: d.m.yyyy, dd.mm.yyyy
  const fullMatch = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (fullMatch) {
    const day = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10);
    const year = parseInt(fullMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(year, month - 1, day, 7, 0, 0));
    }
  }

  // Formats: d.m. or dd.mm.
  const shortMatch = clean.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (shortMatch) {
    const day = parseInt(shortMatch[1], 10);
    const month = parseInt(shortMatch[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(Date.UTC(fallbackYear, month - 1, day, 7, 0, 0));
    }
  }

  return null;
}

export function parseQuantity(raw?: string | null): number | null {
  if (!raw) return null;
  const str = raw.trim();
  if (!str) return null;

  // Handle "12+12"
  if (str.includes('+')) {
    const parts = str.split('+').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
    if (parts.length) return parts.reduce((a, b) => a + b, 0);
  }

  // Handle "2/2"
  if (str.includes('/')) {
    const first = parseInt(str.split('/')[0].trim(), 10);
    if (!isNaN(first)) return first;
  }

  // Handle "5 plachet" or plain number
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

export function parseWorkType(prace?: string | null, zadani?: string | null): WorkType {
  const text = `${prace || ''} ${zadani || ''}`.toLowerCase();
  if (text.includes('deinstal') || text.includes('sundat') || text.includes('odvoz')) {
    return 'DEINSTALLATION';
  }
  if (
    text.includes('reinstal') ||
    text.includes('výměn') ||
    text.includes('vymen') ||
    text.includes('prelep') ||
    text.includes('přelep')
  ) {
    return 'REINSTALLATION';
  }
  if (text.includes('oprav') || text.includes('posun') || text.includes('srovnat')) {
    return 'REPAIR';
  }
  if (text.includes('převoz') || text.includes('prevoz')) {
    return 'TRANSPORT';
  }
  if (text.includes('kontrol')) {
    return 'CHECK';
  }
  if (
    text.includes('instal') ||
    text.includes('výlep') ||
    text.includes('vylep') ||
    text.includes('polep') ||
    text.includes('montáž') ||
    text.includes('montaz')
  ) {
    return 'INSTALLATION';
  }
  return 'OTHER';
}

export function parsePriority(zadani?: string | null): WorkPriority {
  if (!zadani) return 'NORMAL';
  const upper = zadani.toUpperCase();
  if (
    upper.includes('!!!') ||
    upper.includes('POZOR') ||
    upper.includes('RÁNO') ||
    upper.includes('URGENT') ||
    upper.includes('NUTNÉ') ||
    upper.includes('BRZO')
  ) {
    return 'HIGH';
  }
  return 'NORMAL';
}

export function parseMediaLabel(carrier?: string | null): string | null {
  if (!carrier || !carrier.trim()) return null;
  const c = carrier.trim();
  const map: Record<string, string> = {
    MT: 'MiniTower (MT)',
    Nav: 'Navigace & Směrovky (Nav)',
    PL: 'Promo Lavička (PL)',
    CP: 'City Poster (CP)',
    CG: 'City Gallery (CG)',
    BLB: 'Billboard (BLB)',
    PH: 'Promohorizont (PH)',
    T: 'Tower (T)',
    Polep: 'Polep',
    Plachta: 'Plachta',
    BB: 'Billboard (BB)',
    Áčko: 'Áčko',
    Trojnožka: 'Trojnožka',
  };
  return map[c] || c;
}

export function parseContactDetails(raw?: string | null): { name: string | null; phone: string | null } {
  if (!raw || !raw.trim()) return { name: null, phone: null };
  const str = raw.trim();

  // Extract phone number pattern (Czech phone numbers like 777 123 456, +420 ..., 608123456)
  const phoneMatch = str.match(/(?:\+?[0-9]{1,4}[\s-]*)?(?:[0-9]{3}[\s-]*[0-9]{3}[\s-]*[0-9]{3})/);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  let name: string | null = str;
  if (phone) {
    name = str.replace(phone, '').replace(/[T:]/g, '').replace(/[\s,/-]+$/, '').trim();
    if (!name || name.length < 2) name = null;
  }
  return { name, phone };
}

export function parseZadavatel(code?: string | null): string | null {
  if (!code || !code.trim()) return null;
  const c = code.trim().toUpperCase();
  if (c === 'V') return 'Vlaďka';
  if (c === 'Z') return 'Zuzka';
  if (c === 'M' || c === 'MM') return 'Marek';
  return code.trim();
}

export function parseWorkersList(workerCell?: string | null): string[] {
  if (!workerCell || !workerCell.trim()) return [];
  const parts = workerCell
    .split(/[,+/]|\ba\b/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w !== '.' && w !== '1 Někdo' && w !== 'FALSE' && w !== 'TRUE');

  const normalized: string[] = [];
  for (const part of parts) {
    const clean = part.replace(/^[-+.\s]+/, '').replace(/[-+.\s]+$/, '');
    if (!clean) continue;
    // Map known aliases
    if (clean.toLowerCase() === 'sonik') {
      normalized.push('Sonik');
    } else if (clean.toLowerCase().includes('krašik') || clean.toLowerCase().includes('krasik')) {
      normalized.push('Ondra Krašik');
    } else if (clean.toLowerCase().includes('kanaloš') || clean.toLowerCase().includes('kanalos')) {
      normalized.push('Petr Kanaloš');
    } else if (clean.toLowerCase() === 'tomaš' || clean.toLowerCase() === 'tomáš') {
      normalized.push('Tomáš');
    } else {
      normalized.push(clean);
    }
  }
  return [...new Set(normalized)];
}

type RawPlanRow = {
  rowNumber: number;
  cells: string[];
  hyperlinks?: Array<string | null>;
  isWorkerCellGreen?: (workerColIdx: number) => boolean;
};

function parseGooglePlanRows(
  rawRows: RawPlanRow[],
  defaultYear = 2026,
  referenceDate: Date = new Date()
): ParsedGooglePlanTask[] {
  if (!rawRows.length) return [];

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();
  const refDate = referenceDate.getUTCDate();
  const todayStart = new Date(Date.UTC(refYear, refMonth, refDate, 0, 0, 0));

  const headerIdx = rawRows.findIndex(
    (r) =>
      r.cells.some((cell) => cell.includes('FTD')) ||
      r.cells.some((cell) => cell.includes('Klient')) ||
      r.cells.some((cell) => cell.includes('Zadání'))
  );

  if (headerIdx === -1) {
    throw new Error('Hlavička tabulky plánu práce nebyla nalezena (očekávány sloupce Klient / Zadání / FTD).');
  }

  const header = rawRows[headerIdx].cells.map((h) => h.toLowerCase());
  const colIdx = {
    ftdOdeslana: header.findIndex((h) => h.includes('ftd odesl') || h.includes('ftd')),
    fakt: header.findIndex((h) => h.includes('fakt')),
    datum: header.findIndex((h) => h === 'datum'),
    den: header.findIndex((h) => h === 'den'),
    zadal: header.findIndex((h) => h.includes('zadal')),
    pracovnik: header.findIndex((h) => h.includes('pracovník') || h.includes('pracovnik')),
    predano: header.findIndex((h) => h.includes('předáno') || h.includes('predano')),
    klient: header.findIndex((h) => h === 'klient'),
    zadani: header.findIndex((h) => h.includes('zadání') || h.includes('zadani')),
    kontakt: header.findIndex((h) => h.includes('kontakt')),
    datumZahajeni: header.findIndex((h) => h.includes('zahájení') || h.includes('zahajeni')),
    datumUkonceni: header.findIndex((h) => h.includes('ukončení') || h.includes('ukonceni')),
    typNosice: header.findIndex((h) => h.includes('typ nosiče') || h.includes('typ nosice')),
    ks: header.findIndex((h) => h === 'ks'),
    prace: header.findIndex((h) => h === 'práce' || h === 'prace'),
    odkaz: header.findIndex((h) => h === 'odkaz'),
    odkazFtd: header.findIndex((h) => h.includes('odkaz na ftd')),
  };

  const tasks: ParsedGooglePlanTask[] = [];

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const row = rawRow.cells;
    const hyperlinks = rawRow.hyperlinks;
    const rawDatum = (colIdx.datum !== -1 ? row[colIdx.datum] : '') || '';
    const rawZadani = (colIdx.zadani !== -1 ? row[colIdx.zadani] : '') || '';
    const rawKlient = (colIdx.klient !== -1 ? row[colIdx.klient] : '') || '';

    const isMonthHeader =
      !rawKlient &&
      rawZadani &&
      Object.keys(MONTH_NAMES).some((m) => rawZadani.toLowerCase().replace(/\s+/g, '') === m);
    if (isMonthHeader) continue;

    if (!rawZadani && (!rawKlient || !rawDatum)) {
      continue;
    }

    const rawZahajeni = (colIdx.datumZahajeni !== -1 ? row[colIdx.datumZahajeni] : '') || '';
    const rawUkonceni = (colIdx.datumUkonceni !== -1 ? row[colIdx.datumUkonceni] : '') || '';

    let taskYear = defaultYear;
    const zahajeniDate = parseDateString(rawZahajeni, defaultYear);
    if (zahajeniDate) {
      taskYear = zahajeniDate.getUTCFullYear();
    }

    const scheduledDate = parseDateString(rawDatum, taskYear) || zahajeniDate || new Date();
    const campaignDateFrom = zahajeniDate;
    const campaignDateTo = parseDateString(rawUkonceni, taskYear);

    const ftdRaw = ((colIdx.ftdOdeslana !== -1 ? row[colIdx.ftdOdeslana] : '') || '').toUpperCase().trim();
    const isFtdSent = ftdRaw === 'ANO';
    const isFtdSkipped = ftdRaw === 'BEZ';

    const predanoRaw = ((colIdx.predano !== -1 ? row[colIdx.predano] : '') || '').toUpperCase().trim();
    const isHandedOver = predanoRaw === 'TRUE' || predanoRaw === 'ANO';

    const faktRaw = ((colIdx.fakt !== -1 ? row[colIdx.fakt] : '') || '').toUpperCase().trim();
    const isInvoiced = faktRaw === 'ANO';
    const isInvoiceExempt = faktRaw === 'BEZ';

    const isCompletedByColor =
      colIdx.pracovnik !== -1 && rawRow.isWorkerCellGreen
        ? rawRow.isWorkerCellGreen(colIdx.pracovnik)
        : false;

    const rawPrace = (colIdx.prace !== -1 ? row[colIdx.prace] : '') || '';
    const rawCarrier = (colIdx.typNosice !== -1 ? row[colIdx.typNosice] : '') || '';
    const rawWorker = (colIdx.pracovnik !== -1 ? row[colIdx.pracovnik] : '') || '';
    const rawZadal = (colIdx.zadal !== -1 ? row[colIdx.zadal] : '') || '';
    const rawKontakt = (colIdx.kontakt !== -1 ? row[colIdx.kontakt] : '') || '';
    const rawOdkaz = (colIdx.odkaz !== -1 ? row[colIdx.odkaz] : '') || '';
    const rawOdkazFtd = (colIdx.odkazFtd !== -1 ? row[colIdx.odkazFtd] : '') || '';
    const rawKs = (colIdx.ks !== -1 ? row[colIdx.ks] : '') || '';

    const odkazHyperlink = colIdx.odkaz !== -1 ? hyperlinks?.[colIdx.odkaz] || null : null;
    const ftdHyperlink = colIdx.odkazFtd !== -1 ? hyperlinks?.[colIdx.odkazFtd] || null : null;

    const clientName = rawKlient.trim() || 'Interní / SeePoint';
    const workType = parseWorkType(rawPrace, rawZadani);
    const priority = parsePriority(rawZadani);
    const mediaLabel = parseMediaLabel(rawCarrier);
    const quantity = parseQuantity(rawKs);
    const contact = parseContactDetails(rawKontakt);
    const workers = parseWorkersList(rawWorker);
    const requestedBy = parseZadavatel(rawZadal);

    let status: WorkOrderStatus;
    if (isFtdSent || isInvoiced || isCompletedByColor) {
      status = 'DONE';
    } else if (scheduledDate.getTime() < todayStart.getTime()) {
      status = 'DONE';
    } else if (isHandedOver) {
      status = 'HANDED_OVER';
    } else {
      status = 'PLANNED';
    }

    const zadaniFirstLine = rawZadani ? rawZadani.split('\n')[0].trim() : '';
    const title = zadaniFirstLine
      ? rawKlient
        ? `${rawKlient} – ${zadaniFirstLine}`
        : zadaniFirstLine
      : `${clientName} – ${rawPrace || 'Montáž'}${mediaLabel ? ` (${mediaLabel})` : ''}`;

    const dateIsoShort = scheduledDate.toISOString().slice(0, 10);
    const cleanZadaniSnippet = (rawZadani || rawPrace || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 30);
    const sheetKey = `gsheet_${dateIsoShort}_${clientName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${cleanZadaniSnippet}`;

    tasks.push({
      sheetRowIndex: rawRow.rowNumber,
      sheetKey,
      scheduledAt: scheduledDate,
      dateStr: rawDatum,
      dayName: (colIdx.den !== -1 ? row[colIdx.den] : '') || undefined,
      clientName,
      title: title.slice(0, 190),
      description: rawZadani || `${rawPrace || 'Práce'} pro ${clientName}`,
      requestedBy,
      workers,
      isHandedOver,
      isFtdSent,
      isFtdSkipped,
      isInvoiced,
      isInvoiceExempt,
      isCompletedByColor,
      contactName: contact.name,
      contactPhone: contact.phone,
      campaignDateFrom,
      campaignDateTo,
      mediaLabel,
      quantity,
      workType,
      status,
      priority,
      referenceUrl: odkazHyperlink || (rawOdkaz.startsWith('http') ? rawOdkaz : null),
      ftdUrl: ftdHyperlink || rawOdkazFtd || null,
    });
  }

  return tasks;
}

/**
 * Parses raw Google Sheet CSV and returns an array of structured ParsedGooglePlanTask items.
 */
export function parseGooglePlanCsv(
  csvContent: string,
  defaultYear = 2026,
  referenceDate: Date = new Date()
): ParsedGooglePlanTask[] {
  const rows = parseCsvRows(csvContent);
  return parseGooglePlanRows(
    rows.map((cells, idx) => ({ rowNumber: idx + 1, cells })),
    defaultYear,
    referenceDate
  );
}

/**
 * Parses Google Sheet XLSX export, preserving green cell fills on worker column
 * (marking tasks DONE) as well as embedded Drive folder hyperlinks.
 */
export async function parseGooglePlanXlsx(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  defaultYear = 2026,
  referenceDate: Date = new Date()
): Promise<ParsedGooglePlanTask[]> {
  const wb = new ExcelJS.Workbook();
  const nodeBuf = Buffer.isBuffer(buffer)
    ? buffer
    : buffer instanceof Uint8Array
    ? Buffer.from(buffer)
    : Buffer.from(new Uint8Array(buffer));

  await wb.xlsx.load(nodeBuf as unknown as ArrayBuffer);

  const ws =
    wb.worksheets.find((sheet) => sheet.name.toLowerCase().includes('plan')) ||
    wb.worksheets[0];
  if (!ws) return [];

  const maxCol = Math.max(ws.columnCount || 0, 20);
  const rawRows: RawPlanRow[] = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    const hyperlinks: Array<string | null> = [];
    for (let c = 1; c <= maxCol; c++) {
      const val = row.getCell(c).value;
      cells.push(unwrapExcelValueToString(val));
      hyperlinks.push(extractExcelCellHyperlink(val));
    }

    rawRows.push({
      rowNumber,
      cells,
      hyperlinks,
      isWorkerCellGreen: (workerColIdx: number) =>
        isGreenExcelFill(row.getCell(workerColIdx + 1).fill),
    });
  });

  return parseGooglePlanRows(rawRows, defaultYear, referenceDate);
}

function sameWorkersList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = a.map((w) => w.trim()).sort();
  const setB = b.map((w) => w.trim()).sort();
  return setA.every((val, idx) => val === setB[idx]);
}

export type SyncGooglePlanResult = {
  success: boolean;
  totalParsed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  cleanedCount?: number;
  lastSyncAt?: string;
  orders: { id: string; title: string; clientName: string; scheduledAt: string; status: string }[];
};

export type SyncGooglePlanOptions = {
  organizationId: string;
  csvUrl?: string;
  csvContent?: string;
  defaultYear?: number;
  referenceDate?: Date;
  reconcileRemovedRows?: boolean;
};

/**
 * Resolves whether Google Sheets sync should keep a manually/email-rescheduled
 * date or apply the sheet's scheduledAt (e.g. when dispatcher edits the sheet date).
 */
export function resolveSyncedScheduledAt(
  existingScheduledAt: Date,
  existingConstraints: unknown,
  sheetScheduledAt: Date
): { scheduledAt: Date; preservedManualReschedule: boolean } {
  const prevPc =
    existingConstraints &&
    typeof existingConstraints === 'object' &&
    !Array.isArray(existingConstraints)
      ? (existingConstraints as Record<string, unknown>)
      : {};
  const sheetDateIso = sheetScheduledAt.toISOString().slice(0, 10);
  const manualLocked =
    typeof prevPc.manualScheduledDateIso === 'string' &&
    prevPc.manualScheduledDateIso.length >= 10 &&
    typeof prevPc.sheetScheduledDateAtReschedule === 'string' &&
    prevPc.sheetScheduledDateAtReschedule === sheetDateIso;

  if (manualLocked) {
    return { scheduledAt: existingScheduledAt, preservedManualReschedule: true };
  }
  return { scheduledAt: sheetScheduledAt, preservedManualReschedule: false };
}

/**
 * Fetches the Google Sheet (preferring XLSX export for cell colors and hyperlinks,
 * with fallback to CSV) and synchronizes tasks into SeePoint OS WorkOrders and WorkTasks.
 * Idempotent: Skips unchanged existing orders cleanly.
 */
export async function syncGooglePlanToWorkOrders(
  options: SyncGooglePlanOptions,
  dependencies?: {
    tx?: Prisma.TransactionClient;
    fetchCsvFn?: (url: string) => Promise<string>;
    fetchXlsxFn?: (url: string) => Promise<ArrayBuffer>;
  }
): Promise<SyncGooglePlanResult> {
  const { organizationId, csvUrl = DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL, csvContent, defaultYear = 2026, referenceDate } = options;
  const client = dependencies?.tx || prisma;

  const isDefaultSheet = !options.csvUrl || options.csvUrl === DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL;
  if (isDefaultSheet && 'organization' in client && client.organization) {
    const org = await client.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!org || !isSeePointOrganization(org)) {
      throw new Error(
        'Tato centrální Google Tabulka plánu práce je určena výhradně pro agenturu SeePOINT s.r.o. a nelze ji importovat do jiné agentury.'
      );
    }
  }

  let tasks: ParsedGooglePlanTask[] | null = null;

  if (csvContent || dependencies?.fetchCsvFn) {
    let content = csvContent;
    if (!content && dependencies?.fetchCsvFn) {
      content = await dependencies.fetchCsvFn(csvUrl);
    }
    tasks = content ? parseGooglePlanCsv(content, defaultYear, referenceDate) : [];
  } else {
    const xlsxUrl = toGoogleSheetsXlsxUrl(csvUrl);
    if (dependencies?.fetchXlsxFn || xlsxUrl) {
      try {
        const fetchXlsx =
          dependencies?.fetchXlsxFn ||
          (async (url: string) => {
            const res = await fetch(url, { headers: { 'User-Agent': 'SeePoint-OS-Sync/1.0' } });
            if (!res.ok) {
              throw new Error(`XLSX fetch failed: ${res.status}`);
            }
            return await res.arrayBuffer();
          });
        const buffer = await fetchXlsx(xlsxUrl || csvUrl);
        tasks = await parseGooglePlanXlsx(buffer, defaultYear, referenceDate);
      } catch (xlsxErr) {
        console.warn('[google-sheets-sync] XLSX parse fallback to CSV:', xlsxErr);
      }
    }

    if (!tasks) {
      const res = await fetch(csvUrl, { headers: { 'User-Agent': 'SeePoint-OS-Sync/1.0' } });
      if (!res.ok) {
        throw new Error(`Stažení Google tabulky selhalo se stavovým kódem ${res.status}. Ověřte přístup.`);
      }
      const content = await res.text();
      tasks = parseGooglePlanCsv(content, defaultYear, referenceDate);
    }
  }

  if (!tasks.length) {
    return {
      success: true,
      totalParsed: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      orders: [],
    };
  }

  // Load existing orders in this organization to prevent duplicate creation and skip unchanged rows
  const existingOrders = await client.workOrder.findMany({
    where: { organizationId },
    select: {
      id: true,
      title: true,
      description: true,
      clientName: true,
      scheduledAt: true,
      status: true,
      priority: true,
      ftdSent: true,
      invoiced: true,
      ftdUrl: true,
      referenceUrl: true,
      crmOrderId: true,
      navigationOrderId: true,
      planningConstraints: true,
      assignments: { select: { workerName: true, acknowledgedAt: true } },
      _count: { select: { workEntries: true, warehouseMovements: true } },
    },
  });

  type ExistingOrderRow = (typeof existingOrders)[0];
  const pushToList = (map: Map<string, ExistingOrderRow[]>, key: string, item: ExistingOrderRow) => {
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  };
  const pickUnmatched = (
    candidates: ExistingOrderRow[] | undefined,
    matchedIds: Set<string>
  ): ExistingOrderRow | undefined => {
    if (!candidates?.length) return undefined;
    return (
      candidates.find((c) => !matchedIds.has(c.id) && c.status !== 'CANCELLED') ||
      candidates.find((c) => !matchedIds.has(c.id))
    );
  };

  const existingBySheetKeyRow = new Map<string, ExistingOrderRow[]>();
  const existingBySheetKey = new Map<string, ExistingOrderRow[]>();
  const existingBySignature = new Map<string, ExistingOrderRow[]>();
  const existingByRowDateClient = new Map<string, ExistingOrderRow[]>();

  for (const eo of existingOrders) {
    const pc = eo.planningConstraints as Record<string, unknown> | null;
    const eoDateIso = eo.scheduledAt.toISOString().slice(0, 10);
    const eoClientNorm = eo.clientName.trim().toLowerCase();
    if (pc && typeof pc.sheetKey === 'string') {
      pushToList(existingBySheetKey, pc.sheetKey, eo);
      if (typeof pc.sheetRow === 'number') {
        pushToList(existingBySheetKeyRow, `${pc.sheetKey}_r${pc.sheetRow}`, eo);
      }
    }
    if (pc?.source === 'GOOGLE_SHEETS_PLAN' && typeof pc.sheetRow === 'number') {
      pushToList(existingByRowDateClient, `${eoDateIso}::${pc.sheetRow}::${eoClientNorm}`, eo);
    }
    const sig = `${eoDateIso}::${eoClientNorm}::${eo.title.trim().toLowerCase()}`;
    pushToList(existingBySignature, sig, eo);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let cleanedCount = 0;
  const matchedOrderIds = new Set<string>();
  const syncedOrders: SyncGooglePlanResult['orders'] = [];

  for (const task of tasks) {
    const taskDateIso = task.scheduledAt.toISOString().slice(0, 10);
    const taskClientNorm = task.clientName.trim().toLowerCase();
    const signature = `${taskDateIso}::${taskClientNorm}::${task.title.trim().toLowerCase()}`;
    const existing =
      pickUnmatched(existingBySheetKeyRow.get(`${task.sheetKey}_r${task.sheetRowIndex}`), matchedOrderIds) ||
      pickUnmatched(existingBySheetKey.get(task.sheetKey), matchedOrderIds) ||
      pickUnmatched(existingBySignature.get(signature), matchedOrderIds) ||
      pickUnmatched(existingByRowDateClient.get(`${taskDateIso}::${task.sheetRowIndex}::${taskClientNorm}`), matchedOrderIds);

    if (existing) {
      matchedOrderIds.add(existing.id);
      const prevPc = (existing.planningConstraints as Record<string, unknown> | null) || {};
      const { scheduledAt: nextScheduledAt, preservedManualReschedule } = resolveSyncedScheduledAt(
        existing.scheduledAt,
        prevPc,
        task.scheduledAt
      );
      const nextDateIso = nextScheduledAt.toISOString().slice(0, 10);
      const nextStatus: WorkOrderStatus =
        existing.status === 'CANCELLED'
          ? 'CANCELLED'
          : existing.status === 'DONE' && !prevPc.completedBySheetColor
          ? 'DONE'
          : task.status;

      const nextFtdSent =
        Boolean(task.isFtdSent) || (Boolean(prevPc.manualFtdSent) && !task.isFtdSkipped);
      const nextInvoiced =
        Boolean(task.isInvoiced) || (Boolean(prevPc.manualInvoiced) && !task.isInvoiceExempt);
      const nextInvoiceExempt =
        !nextInvoiced && (Boolean(task.isInvoiceExempt) || Boolean(prevPc.manualInvoiceExempt));
      const nextFtdSkipped = Boolean(task.isFtdSkipped) && !nextFtdSent;

      const existingAssignments = (
        existing as { assignments?: Array<{ workerName: string }> }
      ).assignments;

      const isUnchanged =
        existing.status === nextStatus &&
        existing.priority === task.priority &&
        existing.scheduledAt.toISOString().slice(0, 10) === nextDateIso &&
        Boolean(existing.ftdSent) === nextFtdSent &&
        Boolean(existing.invoiced) === nextInvoiced &&
        Boolean(prevPc.invoiceExempt) === nextInvoiceExempt &&
        Boolean(prevPc.ftdSkipped) === nextFtdSkipped &&
        (existing.title ?? '') === task.title &&
        (existing.description ?? '') === task.description &&
        (existing.ftdUrl ?? null) === (task.ftdUrl ?? null) &&
        (existing.referenceUrl ?? null) === (task.referenceUrl ?? null) &&
        prevPc.sheetKey === task.sheetKey &&
        prevPc.sheetRow === task.sheetRowIndex &&
        Boolean(prevPc.completedBySheetColor) === Boolean(task.isCompletedByColor) &&
        Array.isArray(existingAssignments) &&
        sameWorkersList(
          existingAssignments.map((a) => a.workerName),
          task.workers
        );

      if (isUnchanged) {
        skippedCount++;
        continue;
      }

      const updated = await client.workOrder.update({
        where: { id: existing.id },
        data: {
          title: task.title,
          description: task.description,
          clientName: task.clientName,
          scheduledAt: nextScheduledAt,
          ftdSent: nextFtdSent,
          invoiced: nextInvoiced,
          ftdUrl: task.ftdUrl || undefined,
          referenceUrl: task.referenceUrl || undefined,
          status: nextStatus,
          priority: task.priority,
          contactName: task.contactName,
          contactPhone: task.contactPhone,
          requestedBy: task.requestedBy,
          quantity: task.quantity,
          mediaLabel: task.mediaLabel,
          workType: task.workType,
          planningConstraints: {
            ...prevPc,
            source: 'GOOGLE_SHEETS_PLAN',
            sheetKey: task.sheetKey,
            sheetRow: task.sheetRowIndex,
            completedBySheetColor: Boolean(task.isCompletedByColor),
            invoiceExempt: nextInvoiceExempt,
            ftdSkipped: nextFtdSkipped,
            ...(!preservedManualReschedule
              ? { manualScheduledDateIso: null, sheetScheduledDateAtReschedule: null }
              : {}),
            ...(task.isFtdSent || task.isFtdSkipped ? { manualFtdSent: false } : {}),
            ...(task.isInvoiced || task.isInvoiceExempt ? { manualInvoiced: false } : {}),
            ...(task.isInvoiced || task.isInvoiceExempt ? { manualInvoiceExempt: false } : {}),
          },
        },
      });

      // Update worker assignments (preserving acknowledgments and linked users)
      if (task.workers.length) {
        const prevByNorm = new Map<
          string,
          { workerName: string; userId: string | null; acknowledgedAt: Date | null; note: string | null }
        >();
        if (typeof client.workAssignment.findMany === 'function') {
          const previousAssignments = await client.workAssignment.findMany({
            where: { workOrderId: existing.id },
            select: { workerName: true, userId: true, acknowledgedAt: true, note: true },
          });
          for (const pa of previousAssignments) {
            prevByNorm.set(pa.workerName.trim().toLowerCase(), pa);
          }
        }
        await client.workAssignment.deleteMany({
          where: { workOrderId: existing.id },
        });
        await client.workAssignment.createMany({
          data: task.workers.map((workerName) => {
            const prev = prevByNorm.get(workerName.trim().toLowerCase());
            return {
              organizationId,
              workOrderId: existing.id,
              workerName,
              ...(prev?.userId ? { userId: prev.userId } : {}),
              ...(prev?.acknowledgedAt ? { acknowledgedAt: prev.acknowledgedAt } : {}),
              ...(prev?.note ? { note: prev.note } : {}),
            };
          }),
        });
      }

      // Propagate to WorkTask items
      await syncWorkOrderTasks(existing.id, client, { preserveLoggedTasks: true });

      updatedCount++;
      syncedOrders.push({
        id: updated.id,
        title: updated.title,
        clientName: updated.clientName,
        scheduledAt: updated.scheduledAt.toISOString(),
        status: updated.status,
      });
    } else {
      // Create new work order
      const created = await client.workOrder.create({
        data: {
          organizationId,
          title: task.title,
          description: task.description,
          clientName: task.clientName,
          scheduledAt: task.scheduledAt,
          campaignDateFrom: task.campaignDateFrom,
          campaignDateTo: task.campaignDateTo,
          contactName: task.contactName,
          contactPhone: task.contactPhone,
          requestedBy: task.requestedBy,
          mediaLabel: task.mediaLabel,
          quantity: task.quantity,
          workType: task.workType,
          status: task.status,
          priority: task.priority,
          ftdSent: task.isFtdSent,
          invoiced: task.isInvoiced,
          ftdUrl: task.ftdUrl,
          referenceUrl: task.referenceUrl,
          planningConstraints: {
            source: 'GOOGLE_SHEETS_PLAN',
            sheetKey: task.sheetKey,
            sheetRow: task.sheetRowIndex,
            completedBySheetColor: Boolean(task.isCompletedByColor),
            invoiceExempt: Boolean(task.isInvoiceExempt),
            ftdSkipped: Boolean(task.isFtdSkipped),
          },
          assignments: {
            create: task.workers.map((workerName) => ({
              organizationId,
              workerName,
            })),
          },
        },
      });
      matchedOrderIds.add(created.id);

      // Propagate to WorkTask items
      await syncWorkOrderTasks(created.id, client, { preserveLoggedTasks: true });

      createdCount++;
      syncedOrders.push({
        id: created.id,
        title: created.title,
        clientName: created.clientName,
        scheduledAt: created.scheduledAt.toISOString(),
        status: created.status,
      });
    }
  }

  // Remove or archive stale open GOOGLE_SHEETS_PLAN orders (duplicates or rows deleted/moved in the sheet)
  const shouldReconcileRemoved = options.reconcileRemovedRows ?? tasks.length >= 20;
  if (shouldReconcileRemoved) {
    for (const eo of existingOrders) {
      if (matchedOrderIds.has(eo.id)) continue;
      const pc = (eo.planningConstraints as Record<string, unknown> | null) || {};
      if (pc.source !== 'GOOGLE_SHEETS_PLAN') continue;
      if (['DONE', 'CANCELLED'].includes(eo.status)) continue;
      if (eo.invoiced || eo.ftdSent) continue;
      if (eo.crmOrderId || eo.navigationOrderId) continue;

      const assignments = (eo as { assignments?: Array<{ acknowledgedAt?: Date | null }> }).assignments || [];
      const hasAck = assignments.some((a) => Boolean(a.acknowledgedAt));
      const counts = (eo as { _count?: { workEntries?: number; warehouseMovements?: number } })._count;
      const hasChildActivity = (counts?.workEntries ?? 0) > 0 || (counts?.warehouseMovements ?? 0) > 0;

      const canDelete =
        !hasAck &&
        !hasChildActivity &&
        typeof (client.workOrder as { delete?: unknown }).delete === 'function';

      if (canDelete) {
        try {
          await client.workAssignment.deleteMany({ where: { workOrderId: eo.id } });
          if (typeof (client.workTask as { deleteMany?: unknown })?.deleteMany === 'function') {
            await client.workTask.deleteMany({ where: { workOrderId: eo.id } });
          }
          if (typeof (client.workOrderItem as { deleteMany?: unknown })?.deleteMany === 'function') {
            await client.workOrderItem.deleteMany({ where: { workOrderId: eo.id } });
          }
          if (typeof (client.workOrderRate as { deleteMany?: unknown })?.deleteMany === 'function') {
            await client.workOrderRate.deleteMany({ where: { workOrderId: eo.id } });
          }
          await client.workOrder.delete({ where: { id: eo.id } });
          cleanedCount++;
          continue;
        } catch {
          // Fall through to non-destructive CANCELLED archival if foreign keys exist
        }
      }

      await client.workOrder.update({
        where: { id: eo.id },
        data: {
          status: 'CANCELLED',
          planningConstraints: {
            ...pc,
            staleSheetArchived: true,
          },
        },
      });
      cleanedCount++;
    }
  }

  const lastSyncAt = new Date().toISOString();
  if (
    'organization' in client &&
    client.organization &&
    typeof client.organization.findUnique === 'function' &&
    typeof client.organization.update === 'function'
  ) {
    try {
      const orgRow = await client.organization.findUnique({
        where: { id: organizationId },
        select: { plannerDefaults: true },
      });
      const existingDefaults = (orgRow?.plannerDefaults as Record<string, unknown> | null) || {};
      await client.organization.update({
        where: { id: organizationId },
        data: {
          plannerDefaults: {
            ...existingDefaults,
            googleSheetPlanSync: {
              lastSyncAt,
              totalParsed: tasks.length,
              createdCount,
              updatedCount,
              skippedCount,
              cleanedCount,
            },
          } as Prisma.InputJsonValue,
        },
      });
    } catch (metaErr) {
      console.warn('[google-sheets-sync] Could not persist lastSyncAt metadata:', metaErr);
    }
  }

  return {
    success: true,
    totalParsed: tasks.length,
    createdCount,
    updatedCount,
    skippedCount,
    cleanedCount,
    lastSyncAt,
    orders: syncedOrders.slice(0, 50),
  };
}
