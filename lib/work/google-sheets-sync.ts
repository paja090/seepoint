import { prisma } from '@/lib/db';
import { Prisma, WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';

export const DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL =
  process.env.GOOGLE_PLAN_SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1VcssEXqBmRSV0xBkzP23Miadt2zTTR8lHhgHPQlLt6o/export?format=csv&gid=1725001912';

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
  isInvoiced: boolean;
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

/**
 * Parses raw Google Sheet CSV and returns an array of structured ParsedGooglePlanTask items.
 */
export function parseGooglePlanCsv(csvContent: string, defaultYear = 2026): ParsedGooglePlanTask[] {
  const rows = parseCsvRows(csvContent);
  if (!rows.length) return [];

  // Find header row
  const headerIdx = rows.findIndex(
    (r) =>
      r.some((cell) => cell.includes('FTD')) ||
      r.some((cell) => cell.includes('Klient')) ||
      r.some((cell) => cell.includes('Zadání'))
  );

  if (headerIdx === -1) {
    throw new Error('Hlavička tabulky plánu práce nebyla nalezena (očekávány sloupce Klient / Zadání / FTD).');
  }

  const header = rows[headerIdx].map((h) => h.toLowerCase());
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

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const rawDatum = (colIdx.datum !== -1 ? row[colIdx.datum] : '') || '';
    const rawZadani = (colIdx.zadani !== -1 ? row[colIdx.zadani] : '') || '';
    const rawKlient = (colIdx.klient !== -1 ? row[colIdx.klient] : '') || '';

    // Ignore month headers (e.g. "L E D E N", "Ú N O R" or empty rows)
    const isMonthHeader =
      !rawKlient &&
      rawZadani &&
      Object.keys(MONTH_NAMES).some((m) => rawZadani.toLowerCase().replace(/\s+/g, '') === m);
    if (isMonthHeader) continue;

    // Filter out rows without task info
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

    const ftdRaw = ((colIdx.ftdOdeslana !== -1 ? row[colIdx.ftdOdeslana] : '') || '').toUpperCase();
    const isFtdSent = ftdRaw === 'ANO';

    const predanoRaw = ((colIdx.predano !== -1 ? row[colIdx.predano] : '') || '').toUpperCase();
    const isHandedOver = predanoRaw === 'TRUE' || predanoRaw === 'ANO';

    const faktRaw = ((colIdx.fakt !== -1 ? row[colIdx.fakt] : '') || '').toUpperCase();
    const isInvoiced = faktRaw === 'ANO';

    const rawPrace = (colIdx.prace !== -1 ? row[colIdx.prace] : '') || '';
    const rawCarrier = (colIdx.typNosice !== -1 ? row[colIdx.typNosice] : '') || '';
    const rawWorker = (colIdx.pracovnik !== -1 ? row[colIdx.pracovnik] : '') || '';
    const rawZadal = (colIdx.zadal !== -1 ? row[colIdx.zadal] : '') || '';
    const rawKontakt = (colIdx.kontakt !== -1 ? row[colIdx.kontakt] : '') || '';
    const rawOdkaz = (colIdx.odkaz !== -1 ? row[colIdx.odkaz] : '') || '';
    const rawOdkazFtd = (colIdx.odkazFtd !== -1 ? row[colIdx.odkazFtd] : '') || '';
    const rawKs = (colIdx.ks !== -1 ? row[colIdx.ks] : '') || '';

    const clientName = rawKlient.trim() || 'Interní / SeePoint';
    const workType = parseWorkType(rawPrace, rawZadani);
    const priority = parsePriority(rawZadani);
    const mediaLabel = parseMediaLabel(rawCarrier);
    const quantity = parseQuantity(rawKs);
    const contact = parseContactDetails(rawKontakt);
    const workers = parseWorkersList(rawWorker);
    const requestedBy = parseZadavatel(rawZadal);

    const status: WorkOrderStatus = isFtdSent
      ? 'DONE'
      : isHandedOver
        ? 'HANDED_OVER'
        : 'PLANNED';

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
      sheetRowIndex: i + 1,
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
      isInvoiced,
      contactName: contact.name,
      contactPhone: contact.phone,
      campaignDateFrom,
      campaignDateTo,
      mediaLabel,
      quantity,
      workType,
      status,
      priority,
      referenceUrl: rawOdkaz.startsWith('http') ? rawOdkaz : null,
      ftdUrl: rawOdkazFtd || null,
    });
  }

  return tasks;
}

export type SyncGooglePlanResult = {
  success: boolean;
  totalParsed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  orders: { id: string; title: string; clientName: string; scheduledAt: string; status: string }[];
};

export type SyncGooglePlanOptions = {
  organizationId: string;
  csvUrl?: string;
  csvContent?: string;
  defaultYear?: number;
};

/**
 * Fetches the Google Sheet CSV and synchronizes tasks into SeePoint OS WorkOrders and WorkTasks.
 * Idempotent: Can be run repeatedly without duplicating existing orders.
 */
export async function syncGooglePlanToWorkOrders(
  options: SyncGooglePlanOptions,
  dependencies?: {
    tx?: Prisma.TransactionClient;
    fetchCsvFn?: (url: string) => Promise<string>;
  }
): Promise<SyncGooglePlanResult> {
  const { organizationId, csvUrl = DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL, csvContent, defaultYear = 2026 } = options;
  const client = dependencies?.tx || prisma;

  let content = csvContent;
  if (!content) {
    const fetcher =
      dependencies?.fetchCsvFn ||
      (async (url: string) => {
        const res = await fetch(url, { headers: { 'User-Agent': 'SeePoint-OS-Sync/1.0' } });
        if (!res.ok) {
          throw new Error(`Stažení Google tabulky selhalo se stavovým kódem ${res.status}. Ověřte přístup.`);
        }
        return await res.text();
      });

    content = await fetcher(csvUrl);
  }

  const tasks = parseGooglePlanCsv(content, defaultYear);
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

  // Load existing orders in this organization to prevent duplicate creation
  const existingOrders = await client.workOrder.findMany({
    where: { organizationId },
    select: {
      id: true,
      title: true,
      clientName: true,
      scheduledAt: true,
      status: true,
      ftdSent: true,
      invoiced: true,
      planningConstraints: true,
    },
  });

  const existingBySheetKey = new Map<string, (typeof existingOrders)[0]>();
  const existingBySignature = new Map<string, (typeof existingOrders)[0]>();

  for (const eo of existingOrders) {
    const pc = eo.planningConstraints as Record<string, unknown> | null;
    if (pc && typeof pc.sheetKey === 'string') {
      existingBySheetKey.set(pc.sheetKey, eo);
    }
    const sig = `${eo.scheduledAt.toISOString().slice(0, 10)}::${eo.clientName.trim().toLowerCase()}::${eo.title.trim().toLowerCase()}`;
    existingBySignature.set(sig, eo);
  }

  let createdCount = 0;
  let updatedCount = 0;
  const syncedOrders: SyncGooglePlanResult['orders'] = [];

  for (const task of tasks) {
    const signature = `${task.scheduledAt.toISOString().slice(0, 10)}::${task.clientName.trim().toLowerCase()}::${task.title.trim().toLowerCase()}`;
    const existing = existingBySheetKey.get(task.sheetKey) || existingBySignature.get(signature);

    if (existing) {
      // Update existing work order if status, FTD or invoice flag changed
      const updated = await client.workOrder.update({
        where: { id: existing.id },
        data: {
          ftdSent: task.isFtdSent,
          invoiced: task.isInvoiced,
          ftdUrl: task.ftdUrl || undefined,
          referenceUrl: task.referenceUrl || undefined,
          status: task.status,
          contactName: task.contactName,
          contactPhone: task.contactPhone,
          requestedBy: task.requestedBy,
          quantity: task.quantity,
          mediaLabel: task.mediaLabel,
          workType: task.workType,
          planningConstraints: {
            source: 'GOOGLE_SHEETS_PLAN',
            sheetKey: task.sheetKey,
            sheetRow: task.sheetRowIndex,
          },
        },
      });

      // Update worker assignments
      if (task.workers.length) {
        await client.workAssignment.deleteMany({
          where: { workOrderId: existing.id },
        });
        await client.workAssignment.createMany({
          data: task.workers.map((workerName) => ({
            organizationId,
            workOrderId: existing.id,
            workerName,
          })),
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
          },
          assignments: {
            create: task.workers.map((workerName) => ({
              organizationId,
              workerName,
            })),
          },
        },
      });

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

  return {
    success: true,
    totalParsed: tasks.length,
    createdCount,
    updatedCount,
    skippedCount: 0,
    orders: syncedOrders.slice(0, 50),
  };
}
