import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { CrmOrderStatus, CrmProjectType, Prisma } from '@prisma/client';
import { normalizeClientName, nextCrmOrderNumber } from '@/lib/crm/domain';
import { isSeePointOrganization, parseCsvRows, unwrapExcelValueToString } from '@/lib/work/google-sheets-sync';

export const DEFAULT_GOOGLE_SALES_SHEET_URL =
  process.env.GOOGLE_SALES_SHEET_URL ||
  'https://docs.google.com/spreadsheets/d/1AdXE894895FfDlkhvp_HMs31x1Te2ZAeZbjZZW9DEKo/edit?gid=311603038#gid=311603038';

export const DEFAULT_GOOGLE_SALES_SHEET_CSV_URL =
  process.env.GOOGLE_SALES_SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1AdXE894895FfDlkhvp_HMs31x1Te2ZAeZbjZZW9DEKo/export?format=csv&gid=311603038';

export function toGoogleSalesSheetsXlsxUrl(url: string): string | null {
  if (!/docs\.google\.com\/spreadsheets/i.test(url)) return null;
  if (/format=csv/i.test(url)) return url.replace(/format=csv/gi, 'format=xlsx');
  if (/format=xlsx/i.test(url)) return url;
  if (/\/edit/i.test(url)) {
    return url.replace(/\/edit.*$/i, '/export?format=xlsx');
  }
  return null;
}

/**
 * Canonical salesperson codes and aliases as configured by SeePoint management:
 * MM: Miroslav Mec
 * M / MK: Marek Konečný (canonical code: M, display: M / MK)
 * V / VK: Vladimíra Konečná (canonical code: V, display: V / VK)
 * Z / ZV: Zuzana Vavrečková (canonical code: Z, display: Z / ZV)
 * S: Silva (Silvie)
 */
export type CanonicalSalesperson = {
  code: string;
  displayCode: string;
  name: string;
  email?: string;
  aliases: string[];
};

export const CANONICAL_SALESPEOPLE: CanonicalSalesperson[] = [
  {
    code: 'MM',
    displayCode: 'MM',
    name: 'Miroslav Mec',
    email: 'mirek.mec@seepoint.cz',
    aliases: ['mm', 'mec', 'miroslav'],
  },
  {
    code: 'M',
    displayCode: 'M / MK',
    name: 'Marek Konečný',
    email: 'marek.konecny@seepoint.cz',
    aliases: ['m', 'mk', 'konecny', 'konečný', 'marek'],
  },
  {
    code: 'V',
    displayCode: 'V / VK',
    name: 'Vladimíra Konečná',
    email: 'vladka.konecna@seepoint.cz',
    aliases: ['v', 'vk', 'vladka', 'vlaďka', 'vladimira', 'vladimíra'],
  },
  {
    code: 'Z',
    displayCode: 'Z / ZV',
    name: 'Zuzana Vavrečková',
    email: 'zuzana.vavreckova@seepoint.cz',
    aliases: ['z', 'zv', 'vavreckova', 'vavrečková', 'zuzana'],
  },
  {
    code: 'S',
    displayCode: 'S',
    name: 'Silva',
    email: 'silva@seepoint.cz',
    aliases: ['s', 'silva', 'silvie'],
  },
];

export const KNOWN_SALESPEOPLE: Record<string, { code: string; displayCode: string; name: string; email?: string }> = {
  mm: { code: 'MM', displayCode: 'MM', name: 'Miroslav Mec', email: 'mirek.mec@seepoint.cz' },
  m: { code: 'M', displayCode: 'M / MK', name: 'Marek Konečný', email: 'marek.konecny@seepoint.cz' },
  mk: { code: 'M', displayCode: 'M / MK', name: 'Marek Konečný', email: 'marek.konecny@seepoint.cz' },
  v: { code: 'V', displayCode: 'V / VK', name: 'Vladimíra Konečná', email: 'vladka.konecna@seepoint.cz' },
  vk: { code: 'V', displayCode: 'V / VK', name: 'Vladimíra Konečná', email: 'vladka.konecna@seepoint.cz' },
  z: { code: 'Z', displayCode: 'Z / ZV', name: 'Zuzana Vavrečková', email: 'zuzana.vavreckova@seepoint.cz' },
  zv: { code: 'Z', displayCode: 'Z / ZV', name: 'Zuzana Vavrečková', email: 'zuzana.vavreckova@seepoint.cz' },
  s: { code: 'S', displayCode: 'S', name: 'Silva', email: 'silva@seepoint.cz' },
  silva: { code: 'S', displayCode: 'S', name: 'Silva', email: 'silva@seepoint.cz' },
  silvie: { code: 'S', displayCode: 'S', name: 'Silva', email: 'silva@seepoint.cz' },
  lv: { code: 'LV', displayCode: 'LV', name: 'Lenka Valíčková', email: 'lenka.valickova@seepoint.cz' },
};

export function resolveCanonicalSalesperson(raw?: string | null): {
  code: string;
  displayCode: string;
  name: string;
  email?: string;
} {
  if (!raw || !raw.trim()) {
    return { code: 'OBCHOD', displayCode: 'OBCHOD', name: 'Obchodní tým' };
  }
  const clean = raw.trim().toLowerCase();
  if (KNOWN_SALESPEOPLE[clean]) {
    const k = KNOWN_SALESPEOPLE[clean];
    return { code: k.code, displayCode: k.displayCode, name: k.name, email: k.email };
  }
  for (const sp of CANONICAL_SALESPEOPLE) {
    if (sp.code.toLowerCase() === clean || sp.aliases.includes(clean)) {
      return { code: sp.code, displayCode: sp.displayCode, name: sp.name, email: sp.email };
    }
  }
  return { code: raw.trim().toUpperCase(), displayCode: raw.trim().toUpperCase(), name: raw.trim() };
}

/**
 * Maps shorthand carrier / campaign types to Prisma CrmProjectType and descriptive labels:
 * CP: City Poster (Cittyposter)
 * PL: Promo Lavička (promolavička)
 * T: Tower
 * MT: MiniTower (minitower)
 * PH: Promohorizont (horizont)
 * CLV: City Light (city light)
 */
export function resolveSalesProjectType(raw?: string | null): { projectType: CrmProjectType; label: string } {
  if (!raw || !raw.trim()) {
    return { projectType: 'OTHER', label: 'Ostatní media' };
  }
  const clean = raw.trim().toUpperCase();
  if (clean === 'CP' || clean.includes('POSTER') || clean.includes('CITTY')) {
    return { projectType: 'CITY_POSTER', label: 'City Poster (CP)' };
  }
  if (clean === 'PL' || clean.includes('LAVIČ') || clean.includes('LAVIC') || clean.includes('BENCH')) {
    return { projectType: 'BENCH', label: 'Promo Lavička (PL)' };
  }
  if (clean === 'T' || clean === 'TOWER') {
    return { projectType: 'TOWER', label: 'Tower (T)' };
  }
  if (clean === 'MT' || clean.includes('MINITOWER')) {
    return { projectType: 'TOWER', label: 'MiniTower (MT)' };
  }
  if (clean === 'PH' || clean.includes('HORIZONT')) {
    return { projectType: 'HORIZON', label: 'Promohorizont (PH)' };
  }
  if (clean === 'CLV' || clean.includes('LIGHT') || clean.includes('VITR')) {
    return { projectType: 'CLV', label: 'Citylight (CLV)' };
  }
  if (clean === 'NAV' || clean.includes('NAVIGAC')) {
    return { projectType: 'NAVIGATION', label: 'Navigace (Nav)' };
  }
  if (clean === 'CG' || clean.includes('GALLERY') || clean.includes('GALERIE')) {
    return { projectType: 'CITY_GALLERY', label: 'Výstavní projekt (CG)' };
  }
  return { projectType: 'OTHER', label: raw.trim() };
}

export function parseBooleanCell(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const s = String(val).trim().toUpperCase();
  return s === 'TRUE' || s === 'ANO' || s === '1' || s === 'YES';
}

export function parseCzechDateShortOrFull(str: string, defaultYear = 2026): Date | null {
  if (!str || !str.trim()) return null;
  const clean = str.trim().replace(/\s+/g, '');

  // ISO string check
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const d = new Date(clean);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Format: d.m.yyyy e.g. 1.12.2026 or 17.11.2026
  const fullMatch = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (fullMatch) {
    const day = Number.parseInt(fullMatch[1], 10);
    const month = Number.parseInt(fullMatch[2], 10) - 1;
    const year = Number.parseInt(fullMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Format: d.m. e.g. 28.2. or 27.11.
  const shortMatch = clean.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (shortMatch) {
    const day = Number.parseInt(shortMatch[1], 10);
    const month = Number.parseInt(shortMatch[2], 10) - 1;
    const d = new Date(Date.UTC(defaultYear, month, day, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function parseCampaignDates(
  rawFrom: unknown,
  rawTo: unknown,
  defaultYear = 2026
): { dateFrom: Date | null; dateTo: Date | null } {
  let dFrom: Date | null = null;
  let dTo: Date | null = null;

  if (rawFrom instanceof Date && !Number.isNaN(rawFrom.getTime())) {
    dFrom = rawFrom;
  } else if (typeof rawFrom === 'string' && rawFrom.trim()) {
    dFrom = parseCzechDateShortOrFull(rawFrom, defaultYear);
  }

  const baseYear = dFrom ? dFrom.getUTCFullYear() : defaultYear;

  if (rawTo instanceof Date && !Number.isNaN(rawTo.getTime())) {
    dTo = rawTo;
  } else if (typeof rawTo === 'string' && rawTo.trim()) {
    dTo = parseCzechDateShortOrFull(rawTo, baseYear);
  }

  // If dateTo month is earlier than dateFrom month (e.g. 1.12. to 28.2.), wrap year to next year
  if (dFrom && dTo && dTo.getTime() < dFrom.getTime()) {
    const toYear = dTo.getUTCFullYear();
    const fromYear = dFrom.getUTCFullYear();
    if (toYear <= fromYear) {
      dTo = new Date(Date.UTC(fromYear + 1, dTo.getUTCMonth(), dTo.getUTCDate(), 0, 0, 0));
    }
  }

  return { dateFrom: dFrom, dateTo: dTo };
}

export function parseContactDetails(rawContactPerson?: string | null, rawContactDetail?: string | null): {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
} {
  const personStr = (rawContactPerson || '').trim();
  const detailStr = (rawContactDetail || '').trim();

  let email: string | null = null;
  let phone: string | null = null;

  const combined = `${personStr} ${detailStr}`.trim();
  const emailMatch = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0].trim().toLowerCase();
  }

  const phoneMatch = combined.match(/(?:\+?[0-9]{1,4}[\s-]*)?(?:[0-9]{3}[\s-]*[0-9]{3}[\s-]*[0-9]{3})/);
  if (phoneMatch) {
    phone = phoneMatch[0].trim();
  }

  // Split personStr into first and last name
  let cleanName = personStr
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/(?:\+?[0-9]{1,4}[\s-]*)?(?:[0-9]{3}[\s-]*[0-9]{3}[\s-]*[0-9]{3})/g, '')
    .trim();

  if (!cleanName && detailStr) {
    cleanName = detailStr
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
      .replace(/(?:\+?[0-9]{1,4}[\s-]*)?(?:[0-9]{3}[\s-]*[0-9]{3}[\s-]*[0-9]{3})/g, '')
      .trim();
  }

  const tokens = cleanName.split(/\s+/).filter(Boolean);
  const firstName = tokens[0] || 'Obchodní';
  const lastName = tokens.slice(1).join(' ') || tokens[0] || 'Kontakt';

  return { firstName, lastName, email, phone };
}

export type ParsedGoogleSalesRow = {
  sheetRowIndex: number;
  period: string;
  salespersonCode: string;
  salespersonName: string;
  clientName: string;
  contactPerson: string | null;
  contactDetail: string | null;
  carrierTypeRaw: string;
  carrierTypeLabel: string;
  projectType: CrmProjectType;
  isCampaignConfirmed: boolean;
  orderCode: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  checklist: {
    planPrace: boolean;
    slozkaFtd: boolean;
    grafikaOdKlienta: boolean;
    grafikaDoTisku: boolean;
    vytisteno: boolean;
    instalace: boolean;
    nahranaFtd: boolean;
    fakturace: boolean;
    odeslFtd: boolean;
    odeslFakt: boolean;
  };
  computedStatus: CrmOrderStatus;
  sheetKey: string;
};

export function parseGoogleSalesSheetRows(
  rows: Array<{ rowNumber: number; cells: string[] }>,
  defaultYear = 2026
): ParsedGoogleSalesRow[] {
  if (!rows.length) return [];

  const headerIdx = rows.findIndex(
    (r) =>
      r.cells.some((c) => /klient/i.test(c)) &&
      r.cells.some((c) => /obchodn/i.test(c))
  );

  if (headerIdx === -1) {
    throw new Error('Hlavička tabulky zakázek obchodníků nebyla nalezena (očekávány sloupce OBCHODNÍK / KLIENT / TYP ZAKÁZKY).');
  }

  const header = rows[headerIdx].cells.map((c) => c.toLowerCase().trim());
  const colIdx = {
    obdobi: header.findIndex((h) => h.includes('obdob')),
    obchodnik: header.findIndex((h) => h.includes('obchodn')),
    klient: header.findIndex((h) => h === 'klient' || h.includes('klient')),
    kontaktOsoba: header.findIndex((h) => h.includes('kontaktní osoba') || h.includes('kontaktni osoba')),
    kontaktDetail: header.findIndex((h) => h.includes('kontakt na osobu')),
    typZakazky: header.findIndex((h) => h.includes('typ zakázky') || h.includes('typ zakazky')),
    potvrzena: header.findIndex((h) => h.includes('potvrzená kampaň') || h.includes('potvrzena kampan') || h.includes('potvrzen')),
    objednavka: header.findIndex((h) => h.includes('objednávk') || h.includes('objednavk')),
    terminOd: header.findIndex((h) => h.includes('termín kampaně od') || h.includes('termin kampane od') || h.includes('termín od')),
    terminDo: header.findIndex((h) => h.includes('termín kampaně do') || h.includes('termin kampane do') || h.includes('termín do')),
    planPrace: header.findIndex((h) => h.includes('plán práce') || h.includes('plan prace')),
    slozkaFtd: header.findIndex((h) => h.includes('složka ftd') || h.includes('slozka ftd')),
    grafikaKlient: header.findIndex((h) => h.includes('grafika od klienta')),
    grafikaTisk: header.findIndex((h) => h.includes('grafika do tisku')),
    vytisteno: header.findIndex((h) => h.includes('vytištěno') || h.includes('vytisteno')),
    instalace: header.findIndex((h) => h.includes('instalace')),
    nahranaFtd: header.findIndex((h) => h.includes('nahraná ftd') || h.includes('nahrana ftd')),
    fakturace: header.findIndex((h) => h.includes('fakturace')),
    odeslFtd: header.findIndex((h) => h.includes('odesl. ftd') || h.includes('odesl ftd')),
    odeslFakt: header.findIndex((h) => h.includes('odesl fakt') || h.includes('odesl. fakt')),
  };

  const tasks: ParsedGoogleSalesRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const rawRow = rows[i];
    const cells = rawRow.cells;

    const rawKlient = (colIdx.klient !== -1 ? cells[colIdx.klient] : '') || '';
    if (!rawKlient.trim()) {
      // Skip empty template rows
      continue;
    }

    const clientName = rawKlient.trim();
    const rawPeriod = (colIdx.obdobi !== -1 ? cells[colIdx.obdobi] : '') || '';
    const rawObchodnik = (colIdx.obchodnik !== -1 ? cells[colIdx.obchodnik] : '') || '';
    const rawContactPerson = (colIdx.kontaktOsoba !== -1 ? cells[colIdx.kontaktOsoba] : '') || '';
    const rawContactDetail = (colIdx.kontaktDetail !== -1 ? cells[colIdx.kontaktDetail] : '') || '';
    const rawTypZakazky = (colIdx.typZakazky !== -1 ? cells[colIdx.typZakazky] : '') || '';
    const rawPotvrzena = (colIdx.potvrzena !== -1 ? cells[colIdx.potvrzena] : '') || '';
    const rawObjednavka = (colIdx.objednavka !== -1 ? cells[colIdx.objednavka] : '') || '';
    const rawTerminOd = (colIdx.terminOd !== -1 ? cells[colIdx.terminOd] : '') || '';
    const rawTerminDo = (colIdx.terminDo !== -1 ? cells[colIdx.terminDo] : '') || '';

    const isCampaignConfirmed = parseBooleanCell(rawPotvrzena);
    const orderCode = rawObjednavka.trim() || null;
    const { dateFrom, dateTo } = parseCampaignDates(rawTerminOd, rawTerminDo, defaultYear);
    const { projectType, label: carrierTypeLabel } = resolveSalesProjectType(rawTypZakazky);

    const checklist = {
      planPrace: colIdx.planPrace !== -1 ? parseBooleanCell(cells[colIdx.planPrace]) : false,
      slozkaFtd: colIdx.slozkaFtd !== -1 ? parseBooleanCell(cells[colIdx.slozkaFtd]) : false,
      grafikaOdKlienta: colIdx.grafikaKlient !== -1 ? parseBooleanCell(cells[colIdx.grafikaKlient]) : false,
      grafikaDoTisku: colIdx.grafikaTisk !== -1 ? parseBooleanCell(cells[colIdx.grafikaTisk]) : false,
      vytisteno: colIdx.vytisteno !== -1 ? parseBooleanCell(cells[colIdx.vytisteno]) : false,
      instalace: colIdx.instalace !== -1 ? parseBooleanCell(cells[colIdx.instalace]) : false,
      nahranaFtd: colIdx.nahranaFtd !== -1 ? parseBooleanCell(cells[colIdx.nahranaFtd]) : false,
      fakturace: colIdx.fakturace !== -1 ? parseBooleanCell(cells[colIdx.fakturace]) : false,
      odeslFtd: colIdx.odeslFtd !== -1 ? parseBooleanCell(cells[colIdx.odeslFtd]) : false,
      odeslFakt: colIdx.odeslFakt !== -1 ? parseBooleanCell(cells[colIdx.odeslFakt]) : false,
    };

    // Canonical salesperson naming
    const spInfo = resolveCanonicalSalesperson(rawObchodnik);
    const cleanSpCode = spInfo.code;
    const salespersonName = spInfo.name;

    // Status progression logic
    let computedStatus: CrmOrderStatus = 'DRAFT';
    if (checklist.odeslFakt) {
      computedStatus = 'COMPLETED';
    } else if (checklist.fakturace || checklist.odeslFtd || checklist.nahranaFtd) {
      computedStatus = 'COMPLETED';
    } else if (checklist.instalace) {
      computedStatus = 'IN_REALIZATION';
    } else if (checklist.vytisteno || checklist.grafikaDoTisku) {
      computedStatus = 'READY_FOR_PRODUCTION';
    } else if (isCampaignConfirmed || orderCode?.toUpperCase() === 'PŘIJATÁ' || orderCode?.toUpperCase() === 'PRIJATA') {
      computedStatus = 'CONFIRMED';
    } else {
      computedStatus = 'DRAFT';
    }

    const cleanClientSnippet = clientName.toLowerCase().replace(/[^a-z0-9]/gi, '_').slice(0, 30);
    const cleanCarrierSnippet = (rawTypZakazky || 'cp').toLowerCase().replace(/[^a-z0-9]/gi, '');
    const cleanPeriodSnippet = (rawPeriod || 'kampan').toLowerCase().replace(/[^a-z0-9]/gi, '');
    const sheetKey = `gsheet_sales_${cleanPeriodSnippet}_${cleanClientSnippet}_${cleanCarrierSnippet}_r${rawRow.rowNumber}`;

    tasks.push({
      sheetRowIndex: rawRow.rowNumber,
      period: rawPeriod.trim(),
      salespersonCode: cleanSpCode,
      salespersonName,
      clientName,
      contactPerson: rawContactPerson.trim() || null,
      contactDetail: rawContactDetail.trim() || null,
      carrierTypeRaw: rawTypZakazky.trim(),
      carrierTypeLabel,
      projectType,
      isCampaignConfirmed,
      orderCode,
      dateFrom,
      dateTo,
      checklist,
      computedStatus,
      sheetKey,
    });
  }

  return tasks;
}

export function parseGoogleSalesSheetCsv(csvContent: string, defaultYear = 2026): ParsedGoogleSalesRow[] {
  const rows = parseCsvRows(csvContent);
  return parseGoogleSalesSheetRows(
    rows.map((cells, idx) => ({ rowNumber: idx + 1, cells })),
    defaultYear
  );
}

export async function parseGoogleSalesSheetXlsx(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  defaultYear = 2026
): Promise<ParsedGoogleSalesRow[]> {
  const wb = new ExcelJS.Workbook();
  const nodeBuf = Buffer.isBuffer(buffer)
    ? buffer
    : buffer instanceof Uint8Array
    ? Buffer.from(buffer)
    : Buffer.from(new Uint8Array(buffer));

  await wb.xlsx.load(nodeBuf as unknown as ArrayBuffer);

  const ws =
    wb.worksheets.find((s) => /zakázk|zakazk|obchod/i.test(s.name)) ||
    wb.worksheets[0];
  if (!ws) return [];

  const maxCol = Math.max(ws.columnCount || 0, 22);
  const rawRows: Array<{ rowNumber: number; cells: string[] }> = [];

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= maxCol; c++) {
      const val = row.getCell(c).value;
      cells.push(unwrapExcelValueToString(val));
    }
    rawRows.push({ rowNumber, cells });
  });

  return parseGoogleSalesSheetRows(rawRows, defaultYear);
}

export type SyncGoogleSalesResult = {
  success: boolean;
  totalParsed: number;
  createdOrdersCount: number;
  updatedOrdersCount: number;
  skippedOrdersCount: number;
  createdClientsCount: number;
  lastSyncAt: string;
  orders: Array<{
    id: string;
    orderNumber: string;
    clientName: string;
    salesperson: string;
    carrierTypeLabel: string;
    status: CrmOrderStatus;
    isConfirmed: boolean;
    dateFrom: string | null;
    dateTo: string | null;
  }>;
};

export type SyncGoogleSalesOptions = {
  organizationId: string;
  sheetUrl?: string;
  csvContent?: string;
  defaultYear?: number;
};

export async function syncGoogleSalesToCrm(
  options: SyncGoogleSalesOptions,
  dependencies?: {
    tx?: Prisma.TransactionClient;
    fetchCsvFn?: (url: string) => Promise<string>;
    fetchXlsxFn?: (url: string) => Promise<ArrayBuffer>;
  }
): Promise<SyncGoogleSalesResult> {
  const { organizationId, sheetUrl = DEFAULT_GOOGLE_SALES_SHEET_CSV_URL, csvContent, defaultYear = 2026 } = options;
  const client = dependencies?.tx || prisma;

  const isDefaultSheet = !options.sheetUrl || options.sheetUrl === DEFAULT_GOOGLE_SALES_SHEET_CSV_URL;
  if (isDefaultSheet && 'organization' in client && client.organization) {
    const org = await client.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!org || !isSeePointOrganization(org)) {
      throw new Error(
        'Tato centrální Google Tabulka zakázek obchodníků je určena výhradně pro agenturu SeePOINT s.r.o.'
      );
    }
  }

  let tasks: ParsedGoogleSalesRow[] | null = null;

  if (csvContent || dependencies?.fetchCsvFn) {
    let content = csvContent;
    if (!content && dependencies?.fetchCsvFn) {
      content = await dependencies.fetchCsvFn(sheetUrl);
    }
    tasks = content ? parseGoogleSalesSheetCsv(content, defaultYear) : [];
  } else {
    const xlsxUrl = toGoogleSalesSheetsXlsxUrl(sheetUrl);
    if (dependencies?.fetchXlsxFn || xlsxUrl) {
      try {
        const fetchXlsx =
          dependencies?.fetchXlsxFn ||
          (async (url: string) => {
            const res = await fetch(url, { headers: { 'User-Agent': 'SeePoint-OS-Sales-Sync/1.0' } });
            if (!res.ok) throw new Error(`XLSX fetch failed: ${res.status}`);
            return await res.arrayBuffer();
          });
        const buffer = await fetchXlsx(xlsxUrl || sheetUrl);
        tasks = await parseGoogleSalesSheetXlsx(buffer, defaultYear);
      } catch (xlsxErr) {
        console.warn('[google-sales-sync] XLSX parse fallback to CSV:', xlsxErr);
      }
    }

    if (!tasks) {
      const res = await fetch(sheetUrl, { headers: { 'User-Agent': 'SeePoint-OS-Sales-Sync/1.0' } });
      if (!res.ok) {
        throw new Error(`Stažení Google tabulky obchodníků selhalo (kód ${res.status}).`);
      }
      const content = await res.text();
      tasks = parseGoogleSalesSheetCsv(content, defaultYear);
    }
  }

  if (!tasks.length) {
    return {
      success: true,
      totalParsed: 0,
      createdOrdersCount: 0,
      updatedOrdersCount: 0,
      skippedOrdersCount: 0,
      createdClientsCount: 0,
      lastSyncAt: new Date().toISOString(),
      orders: [],
    };
  }

  // Load active users in organization for salesperson assignment
  const users = await client.user.findMany({
    where: {
      organizationMemberships: { some: { organizationId, isActive: true } },
    },
    select: { id: true, name: true, email: true },
  });

  const resolveUserId = (spCode: string, spName: string): string | null => {
    const known = KNOWN_SALESPEOPLE[spCode.toLowerCase()];
    const targetEmail = known?.email?.toLowerCase();
    const targetName = (known?.name || spName).toLowerCase();

    // 1. Direct email match
    if (targetEmail) {
      const byEmail = users.find((u) => u.email.toLowerCase() === targetEmail);
      if (byEmail) return byEmail.id;
    }

    // 2. Exact or partial full name match
    const byName = users.find((u) => {
      const uNorm = u.name.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      const tNorm = targetName.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      return uNorm === tNorm || uNorm.includes(tNorm) || tNorm.includes(uNorm);
    });
    if (byName) return byName.id;

    return null;
  };

  let createdOrdersCount = 0;
  let updatedOrdersCount = 0;
  let skippedOrdersCount = 0;
  let createdClientsCount = 0;
  const syncedOrders: SyncGoogleSalesResult['orders'] = [];

  for (const task of tasks) {
    const assignedUserId = resolveUserId(task.salespersonCode, task.salespersonName);
    const normClient = normalizeClientName(task.clientName);

    // 1. Find or create Client
    let clientRow = await client.client.findFirst({
      where: {
        organizationId,
        normalizedName: normClient,
      },
    });

    const contactDetails = parseContactDetails(task.contactPerson, task.contactDetail);

    if (!clientRow) {
      clientRow = await client.client.create({
        data: {
          organizationId,
          name: task.clientName,
          normalizedName: normClient,
          contactPerson: task.contactPerson || `${contactDetails.firstName} ${contactDetails.lastName}`,
          email: contactDetails.email || null,
          phone: contactDetails.phone || null,
          assignedUserId: assignedUserId || undefined,
          source: 'WEBSITE',
          status: 'ACTIVE',
          clientType: 'DIRECT_CLIENT',
          pricingSegment: 'COMMERCIAL',
        },
      });
      createdClientsCount++;
    }

    // 2. Find or create ClientContact
    let contactRow = null;
    if (task.contactPerson || contactDetails.email || contactDetails.phone) {
      contactRow = await client.clientContact.findFirst({
        where: {
          organizationId,
          clientId: clientRow.id,
          OR: [
            ...(contactDetails.email ? [{ email: contactDetails.email }] : []),
            { firstName: contactDetails.firstName, lastName: contactDetails.lastName },
          ],
        },
      });

      if (!contactRow) {
        contactRow = await client.clientContact.create({
          data: {
            organizationId,
            clientId: clientRow.id,
            firstName: contactDetails.firstName,
            lastName: contactDetails.lastName,
            email: contactDetails.email || null,
            phone: contactDetails.phone || null,
            isPrimary: true,
            isCommercial: true,
          },
        });
      }
    }

    // 3. Find or create CrmOrder
    const orderTitle = `Kampaň: ${task.clientName} – ${task.carrierTypeLabel}${task.period ? ` (${task.period})` : ''}`;
    const orderNote = [
      `Období: ${task.period || 'neuvedeno'}`,
      `Obchodník: ${task.salespersonName} (${task.salespersonCode})`,
      task.orderCode ? `Objednávka: ${task.orderCode}` : undefined,
      task.contactPerson ? `Kontakt: ${task.contactPerson}` : undefined,
      task.contactDetail ? `Spojení: ${task.contactDetail}` : undefined,
    ].filter(Boolean).join(' · ');

    const metadata = {
      source: 'GOOGLE_SHEETS_SALES',
      sheetRow: task.sheetRowIndex,
      period: task.period,
      salespersonCode: task.salespersonCode,
      salespersonName: task.salespersonName,
      rawCarrier: task.carrierTypeRaw,
      carrierTypeLabel: task.carrierTypeLabel,
      campaignConfirmed: task.isCampaignConfirmed,
      orderCode: task.orderCode,
      contactRaw: task.contactPerson,
      checklist: task.checklist,
      lastSyncedAt: new Date().toISOString(),
    };

    let existingOrder = await client.crmOrder.findFirst({
      where: {
        organizationId,
        clientOrderCode: task.sheetKey,
      },
    });

    if (!existingOrder) {
      // Fallback: check matching client + title if row moved
      existingOrder = await client.crmOrder.findFirst({
        where: {
          organizationId,
          clientId: clientRow.id,
          title: orderTitle,
        },
      });
    }

    if (existingOrder) {
      let prevMeta: Record<string, unknown> = {};
      try {
        prevMeta = existingOrder.internalNote ? JSON.parse(existingOrder.internalNote) : {};
      } catch {
        prevMeta = {};
      }

      const isUnchanged =
        existingOrder.status === task.computedStatus &&
        existingOrder.projectType === task.projectType &&
        existingOrder.title === orderTitle &&
        existingOrder.assignedUserId === (assignedUserId || existingOrder.assignedUserId) &&
        JSON.stringify(prevMeta.checklist) === JSON.stringify(metadata.checklist) &&
        prevMeta.campaignConfirmed === metadata.campaignConfirmed &&
        prevMeta.orderCode === metadata.orderCode;

      if (isUnchanged) {
        skippedOrdersCount++;
        syncedOrders.push({
          id: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          clientName: task.clientName,
          salesperson: task.salespersonName,
          carrierTypeLabel: task.carrierTypeLabel,
          status: existingOrder.status,
          isConfirmed: task.isCampaignConfirmed,
          dateFrom: existingOrder.dateFrom?.toISOString() || null,
          dateTo: existingOrder.dateTo?.toISOString() || null,
        });
        continue;
      }

      const updated = await client.crmOrder.update({
        where: { id: existingOrder.id },
        data: {
          clientOrderCode: task.sheetKey,
          title: orderTitle,
          projectType: task.projectType,
          status: task.computedStatus,
          dateFrom: task.dateFrom || undefined,
          dateTo: task.dateTo || undefined,
          assignedUserId: assignedUserId || existingOrder.assignedUserId || undefined,
          contactId: contactRow?.id || existingOrder.contactId || undefined,
          note: orderNote,
          internalNote: JSON.stringify(metadata),
        },
      });

      updatedOrdersCount++;
      syncedOrders.push({
        id: updated.id,
        orderNumber: updated.orderNumber,
        clientName: task.clientName,
        salesperson: task.salespersonName,
        carrierTypeLabel: task.carrierTypeLabel,
        status: updated.status,
        isConfirmed: task.isCampaignConfirmed,
        dateFrom: updated.dateFrom?.toISOString() || null,
        dateTo: updated.dateTo?.toISOString() || null,
      });
    } else {
      const year = task.dateFrom ? task.dateFrom.getUTCFullYear() : new Date().getUTCFullYear();
      const latestOrder = await client.crmOrder.findFirst({
        where: { organizationId, orderNumber: { startsWith: `ZAK-${year}-` } },
        select: { orderNumber: true },
        orderBy: { orderNumber: 'desc' },
      });
      const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

      const created = await client.crmOrder.create({
        data: {
          organizationId,
          orderNumber,
          clientOrderCode: task.sheetKey,
          clientId: clientRow.id,
          contactId: contactRow?.id || null,
          assignedUserId: assignedUserId || null,
          title: orderTitle,
          projectType: task.projectType,
          status: task.computedStatus,
          dateFrom: task.dateFrom || null,
          dateTo: task.dateTo || null,
          note: orderNote,
          internalNote: JSON.stringify(metadata),
        },
      });

      createdOrdersCount++;
      syncedOrders.push({
        id: created.id,
        orderNumber: created.orderNumber,
        clientName: task.clientName,
        salesperson: task.salespersonName,
        carrierTypeLabel: task.carrierTypeLabel,
        status: created.status,
        isConfirmed: task.isCampaignConfirmed,
        dateFrom: created.dateFrom?.toISOString() || null,
        dateTo: created.dateTo?.toISOString() || null,
      });
    }
  }

  const lastSyncAt = new Date().toISOString();

  // Persist sync metadata in organization defaults
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
            googleSalesSheetSync: {
              lastSyncAt,
              totalParsed: tasks.length,
              createdOrdersCount,
              updatedOrdersCount,
              skippedOrdersCount,
              createdClientsCount,
            },
          } as Prisma.InputJsonValue,
        },
      });
    } catch (metaErr) {
      console.warn('[google-sales-sync] Could not persist sync metadata in plannerDefaults:', metaErr);
    }
  }

  return {
    success: true,
    totalParsed: tasks.length,
    createdOrdersCount,
    updatedOrdersCount,
    skippedOrdersCount,
    createdClientsCount,
    lastSyncAt,
    orders: syncedOrders,
  };
}

export type SalespersonCrmSummary = {
  code: string;
  displayCode: string;
  name: string;
  userId: string | null;
  totalOrdersCount: number;
  confirmedCampaignsCount: number;
  inRealizationCount: number;
  completedCount: number;
  pipelineCount: number;
  activeOrders: Array<{
    id: string;
    orderNumber: string;
    title: string;
    clientName: string;
    carrierTypeLabel: string;
    period: string;
    isConfirmed: boolean;
    dateFromStr: string | null;
    dateToStr: string | null;
    status: CrmOrderStatus;
    checklistProgress: string;
  }>;
};

export type GoogleSalesSheetSummary = {
  lastSyncAt: string | null;
  totalOrders: number;
  confirmedCampaigns: number;
  inRealizationCampaigns: number;
  completedCampaigns: number;
  bySalesperson: Record<string, SalespersonCrmSummary>;
};

export async function getGoogleSalesSheetSummary(
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<GoogleSalesSheetSummary> {
  const client = tx || prisma;

  const orders = await client.crmOrder.findMany({
    where: {
      organizationId,
      clientOrderCode: { startsWith: 'gsheet_sales_' },
    },
    include: {
      client: { select: { name: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });

  const bySalesperson: Record<string, SalespersonCrmSummary> = {};

  // Initialize canonical salespeople so each real person has exactly ONE card
  for (const sp of CANONICAL_SALESPEOPLE) {
    bySalesperson[sp.code] = {
      code: sp.code,
      displayCode: sp.displayCode,
      name: sp.name,
      userId: null,
      totalOrdersCount: 0,
      confirmedCampaignsCount: 0,
      inRealizationCount: 0,
      completedCount: 0,
      pipelineCount: 0,
      activeOrders: [],
    };
  }

  let totalOrders = 0;
  let confirmedCampaigns = 0;
  let inRealizationCampaigns = 0;
  let completedCampaigns = 0;

  for (const o of orders) {
    let meta: Record<string, unknown> = {};
    try {
      meta = o.internalNote ? JSON.parse(o.internalNote) : {};
    } catch {
      meta = {};
    }

    const rawSpKey =
      (typeof meta.salespersonCode === 'string' && meta.salespersonCode) ||
      (typeof meta.rawSalesperson === 'string' && meta.rawSalesperson) ||
      (typeof meta.salespersonName === 'string' && meta.salespersonName) ||
      o.assignedUser?.name ||
      'OBCHOD';

    const spInfo = resolveCanonicalSalesperson(rawSpKey);
    const spCode = spInfo.code;
    const spDisplayCode = spInfo.displayCode;
    const spName = spInfo.name;
    const isConfirmed = Boolean(meta.campaignConfirmed) || o.status === 'CONFIRMED' || o.status === 'IN_REALIZATION' || o.status === 'COMPLETED';
    const period = typeof meta.period === 'string' ? meta.period : '';
    const carrierTypeLabel = typeof meta.carrierTypeLabel === 'string' ? meta.carrierTypeLabel : 'Media';

    if (!bySalesperson[spCode]) {
      bySalesperson[spCode] = {
        code: spCode,
        displayCode: spDisplayCode,
        name: spName,
        userId: o.assignedUserId,
        totalOrdersCount: 0,
        confirmedCampaignsCount: 0,
        inRealizationCount: 0,
        completedCount: 0,
        pipelineCount: 0,
        activeOrders: [],
      };
    }

    if (o.assignedUserId) {
      bySalesperson[spCode].userId = o.assignedUserId;
    }

    totalOrders++;
    bySalesperson[spCode].totalOrdersCount++;

    if (isConfirmed) {
      confirmedCampaigns++;
      bySalesperson[spCode].confirmedCampaignsCount++;
    } else {
      bySalesperson[spCode].pipelineCount++;
    }

    if (o.status === 'IN_REALIZATION') {
      inRealizationCampaigns++;
      bySalesperson[spCode].inRealizationCount++;
    } else if (o.status === 'COMPLETED') {
      completedCampaigns++;
      bySalesperson[spCode].completedCount++;
    }

    // Build checklist progress snippet e.g. "Plán ✓ | Tisk ✓ | Instalace"
    const chk = (meta.checklist && typeof meta.checklist === 'object' ? meta.checklist : {}) as Record<string, boolean>;
    const progressPills: string[] = [];
    if (chk.grafikaDoTisku) progressPills.push('Grafika');
    if (chk.vytisteno) progressPills.push('Tisk');
    if (chk.instalace) progressPills.push('Instalace');
    if (chk.nahranaFtd) progressPills.push('FTD');
    if (chk.odeslFakt) progressPills.push('Faktura');
    const checklistProgress = progressPills.length ? progressPills.join(' · ') : 'Zadání';

    bySalesperson[spCode].activeOrders.push({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      clientName: o.client?.name || 'Klient',
      carrierTypeLabel,
      period,
      isConfirmed,
      dateFromStr: o.dateFrom ? o.dateFrom.toISOString().slice(0, 10) : null,
      dateToStr: o.dateTo ? o.dateTo.toISOString().slice(0, 10) : null,
      status: o.status,
      checklistProgress,
    });
  }

  // Get lastSyncAt from plannerDefaults
  let lastSyncAt: string | null = null;
  if ('organization' in client && client.organization) {
    try {
      const orgRow = await client.organization.findUnique({
        where: { id: organizationId },
        select: { plannerDefaults: true },
      });
      const defs = (orgRow?.plannerDefaults as Record<string, unknown> | null) || {};
      const syncMeta = defs.googleSalesSheetSync as Record<string, unknown> | undefined;
      if (typeof syncMeta?.lastSyncAt === 'string') {
        lastSyncAt = syncMeta.lastSyncAt;
      }
    } catch {
      // Ignore
    }
  }

  return {
    lastSyncAt,
    totalOrders,
    confirmedCampaigns,
    inRealizationCampaigns,
    completedCampaigns,
    bySalesperson,
  };
}
