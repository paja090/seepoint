import { createSign } from 'node:crypto';
import { Prisma, WorkType } from '@prisma/client';
import { prisma } from '../db';
import { connectedGoogleAccessToken } from '../integrations/google-oauth';
import {
  DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL,
  isSeePointOrganization,
} from './google-sheets-sync';

export const GOOGLE_SPREADSHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Pure bright green (#00FF00) matching the exact worker cell fill in "Plan práce 2026"
export const GOOGLE_SHEET_DONE_GREEN_RGB = {
  red: 0,
  green: 1,
  blue: 0,
};

const CZECH_SHORT_WEEKDAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'] as const;

const WORK_TYPE_CZECH_LABELS: Record<string, string> = {
  INSTALLATION: 'Montáž',
  DEINSTALLATION: 'Demontáž',
  PASTING: 'Výlep',
  STICKERING: 'Polep',
  INSTALL: 'Montáž',
  UNINSTALL: 'Demontáž',
  PASTE: 'Výlep',
  STICKER: 'Polep',
  PRINT: 'Tisk',
  GRAPHICS: 'Grafika',
  SERVICE: 'Servis',
  INSPECTION: 'Kontrola',
  PRODUCTION: 'Výroba',
  REPAIR: 'Oprava',
  OTHER: 'Montáž',
};

export interface SheetColumnMap {
  headerRowNumber: number; // 1-based row number
  ftdOdeslana: number;
  fakt: number;
  datum: number;
  den: number;
  zadal: number;
  pracovnik: number;
  predano: number;
  klient: number;
  zadani: number;
  kontakt: number;
  datumZahajeni: number;
  datumUkonceni: number;
  typNosice: number;
  ks: number;
  prace: number;
  odkaz: number;
  odkazFtd: number;
  maxColIndex: number;
}

export interface GoogleSheetTargetConfig {
  spreadsheetId: string;
  gid: number | null;
  webhookUrl: string | null;
}

export function extractSpreadsheetTargetFromUrl(url: string): {
  spreadsheetId: string | null;
  gid: number | null;
} {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[?&]gid=(\d+)/);
  return {
    spreadsheetId: idMatch ? idMatch[1] : null,
    gid: gidMatch ? Number.parseInt(gidMatch[1], 10) : null,
  };
}

export function columnIndexToLetter(colIdx: number): string {
  let index = colIdx;
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

export function formatCzDateForSheet(date: Date): { dateStr: string; dayName: string } {
  const parts = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);

  const day = parts.find((p) => p.type === 'day')?.value || String(date.getUTCDate());
  const month = parts.find((p) => p.type === 'month')?.value || String(date.getUTCMonth() + 1);
  const year = parts.find((p) => p.type === 'year')?.value || String(date.getUTCFullYear());

  // Determine day of week in Europe/Prague
  const pragueDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [y, m, d] = pragueDateStr.split('-').map((n) => Number.parseInt(n, 10));
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  return {
    dateStr: `${day}.${month}.${year}`,
    dayName: CZECH_SHORT_WEEKDAYS[utcDay] || 'po',
  };
}

export function buildSheetKeyForOrder(params: {
  scheduledAt: Date;
  clientName: string;
  zadaniText: string;
  praceText?: string;
}): string {
  const dateIsoShort = params.scheduledAt.toISOString().slice(0, 10);
  const cleanZadaniSnippet = (params.zadaniText || params.praceText || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 30);
  const cleanClient = (params.clientName || 'Interní / SeePoint')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_');
  return `gsheet_${dateIsoShort}_${cleanClient}_${cleanZadaniSnippet}`;
}

export function detectSheetColumns(rows: string[][]): SheetColumnMap | null {
  const headerIdx = rows.findIndex(
    (cells) =>
      cells.some((c) => c.includes('FTD')) ||
      cells.some((c) => c.includes('Klient')) ||
      cells.some((c) => c.includes('Zadání') || c.includes('Zadani'))
  );
  if (headerIdx === -1) return null;

  const header = rows[headerIdx].map((h) => (h || '').trim().toLowerCase());
  const map: SheetColumnMap = {
    headerRowNumber: headerIdx + 1,
    ftdOdeslana: header.findIndex((h) => h.includes('ftd odesl') || h === 'ftd' || h.startsWith('ftd ')),
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
    maxColIndex: Math.max(header.length - 1, 16),
  };
  return map;
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function extractPureZadaniFromWorkOrder(order: {
  title: string;
  description: string | null;
  clientName: string;
}): string {
  const clientPrefix = `${order.clientName.trim()} – `;
  const clientPrefixDash = `${order.clientName.trim()} - `;
  let titlePart = order.title.trim();
  if (titlePart.toLowerCase().startsWith(clientPrefix.toLowerCase())) {
    titlePart = titlePart.slice(clientPrefix.length).trim();
  } else if (titlePart.toLowerCase().startsWith(clientPrefixDash.toLowerCase())) {
    titlePart = titlePart.slice(clientPrefixDash.length).trim();
  }

  const desc = (order.description || '').trim();
  if (!desc) return titlePart;
  if (normalizeForMatch(desc).startsWith(normalizeForMatch(titlePart))) {
    return desc;
  }
  return `${titlePart}\n${desc}`;
}

/**
 * Finds the 1-based row number in the Google Sheet corresponding to a WorkOrder.
 * Verifies `preferredSheetRow` first, and if rows shifted, scans from bottom to top.
 */
export function locateWorkOrderRowInSheet(params: {
  rows: string[][];
  cols: SheetColumnMap;
  preferredSheetRow?: number | null;
  clientName: string;
  title: string;
  description: string | null;
  scheduledAt?: Date | null;
}): number | null {
  const { rows, cols, preferredSheetRow, clientName, title, description } = params;
  const targetClient = normalizeForMatch(clientName);
  const pureZadani = extractPureZadaniFromWorkOrder({ title, description, clientName });
  const targetZadaniSnippet = normalizeForMatch(pureZadani).slice(0, 28);
  const targetTitleSnippet = normalizeForMatch(title).slice(0, 28);

  const rowMatchesOrder = (rowIdx0: number): boolean => {
    const row = rows[rowIdx0];
    if (!row) return false;
    const rowClient = normalizeForMatch(cols.klient !== -1 ? row[cols.klient] : '');
    const rowZadani = normalizeForMatch(cols.zadani !== -1 ? row[cols.zadani] : '');
    if (!rowClient && !rowZadani) return false;

    const clientOk =
      !targetClient ||
      targetClient === normalizeForMatch('Interní / SeePoint') ||
      rowClient === targetClient ||
      rowClient.includes(targetClient) ||
      targetClient.includes(rowClient);

    const zadaniOk =
      (targetZadaniSnippet.length > 0 &&
        (rowZadani === targetZadaniSnippet ||
          rowZadani.includes(targetZadaniSnippet) ||
          targetZadaniSnippet.includes(rowZadani.slice(0, 28)))) ||
      (targetTitleSnippet.length > 0 && rowZadani.includes(targetTitleSnippet));

    return Boolean(clientOk && (zadaniOk || (!rowZadani && rowClient === targetClient)));
  };

  // 1. Check exact preferredSheetRow and nearby rows (+/- 5) in case a few rows were inserted/deleted
  if (typeof preferredSheetRow === 'number' && preferredSheetRow > cols.headerRowNumber) {
    const exactIdx = preferredSheetRow - 1;
    if (rowMatchesOrder(exactIdx)) {
      return preferredSheetRow;
    }
    const exactRow = rows[exactIdx];
    if (exactRow) {
      const exactRowClient = normalizeForMatch(cols.klient !== -1 ? exactRow[cols.klient] : '');
      if (exactRowClient && targetClient && (exactRowClient === targetClient || exactRowClient.includes(targetClient) || targetClient.includes(exactRowClient))) {
        return preferredSheetRow;
      }
    }
    for (let delta = 1; delta <= 5; delta++) {
      if (exactIdx - delta >= cols.headerRowNumber && rowMatchesOrder(exactIdx - delta)) {
        return exactIdx - delta + 1;
      }
      if (exactIdx + delta < rows.length && rowMatchesOrder(exactIdx + delta)) {
        return exactIdx + delta + 1;
      }
    }
  }

  // 2. Scan from bottom to top for best match
  const targetDateStr = params.scheduledAt ? formatCzDateForSheet(params.scheduledAt).dateStr : null;
  let fallbackMatchRow: number | null = null;

  for (let i = rows.length - 1; i >= cols.headerRowNumber; i--) {
    if (!rowMatchesOrder(i)) continue;
    const row = rows[i];
    const rowDatum = (cols.datum !== -1 ? row[cols.datum] || '' : '').replace(/\s+/g, '');
    if (targetDateStr && rowDatum.startsWith(targetDateStr.slice(0, 5))) {
      return i + 1;
    }
    if (fallbackMatchRow === null) {
      fallbackMatchRow = i + 1;
    }
  }

  return fallbackMatchRow;
}

async function getServiceAccountSheetsToken(fetchImpl: typeof fetch): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !rawKey) return null;

  try {
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(
      JSON.stringify({
        iss: email,
        scope: GOOGLE_SPREADSHEETS_SCOPE,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    ).toString('base64url');

    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    signer.end();
    const signature = signer.sign(privateKey, 'base64url');

    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claim}.${signature}`,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function resolveGoogleSheetsAccessToken(
  organizationId: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  try {
    const oauthToken = await connectedGoogleAccessToken('GOOGLE_DRIVE', undefined, organizationId);
    if (oauthToken) return oauthToken;
  } catch (err) {
    console.warn('[google-sheets-writeback] OAuth token resolution failed:', err);
  }
  return getServiceAccountSheetsToken(fetchImpl);
}

export async function getGoogleSheetWritebackStatus(organizationId: string): Promise<{
  enabled: boolean;
  connected: boolean;
  hasSpreadsheetsScope: boolean;
  accountEmail: string | null;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true },
  });
  if (!isSeePointOrganization(org)) {
    return { enabled: false, connected: false, hasSpreadsheetsScope: false, accountEmail: null };
  }

  const connection = await prisma.integrationConnection.findFirst({
    where: { organizationId, provider: 'GOOGLE_DRIVE', status: { not: 'REVOKED' } },
    select: { status: true, accountEmail: true, scopes: true },
  });

  const connected = connection?.status === 'CONNECTED';
  const hasSpreadsheetsScope = Boolean(
    connected && Array.isArray(connection?.scopes) && connection.scopes.includes(GOOGLE_SPREADSHEETS_SCOPE)
  );

  return {
    enabled: true,
    connected,
    hasSpreadsheetsScope,
    accountEmail: connection?.accountEmail ?? null,
  };
}

async function resolveOrganizationSheetTarget(
  organizationId: string
): Promise<GoogleSheetTargetConfig | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, plannerDefaults: true },
  });

  const defaults =
    org?.plannerDefaults &&
    typeof org.plannerDefaults === 'object' &&
    !Array.isArray(org.plannerDefaults)
      ? (org.plannerDefaults as Record<string, unknown>)
      : null;

  const syncMeta =
    defaults?.googleSheetPlanSync &&
    typeof defaults.googleSheetPlanSync === 'object' &&
    !Array.isArray(defaults.googleSheetPlanSync)
      ? (defaults.googleSheetPlanSync as Record<string, unknown>)
      : null;

  const customUrl = typeof syncMeta?.sheetCsvUrl === 'string' ? syncMeta.sheetCsvUrl.trim() : '';
  const webhookUrl =
    (typeof syncMeta?.webhookUrl === 'string' ? syncMeta.webhookUrl.trim() : '') ||
    process.env.GOOGLE_PLAN_WEBHOOK_URL?.trim() ||
    null;

  if (!customUrl && !isSeePointOrganization(org)) {
    return null;
  }

  const targetUrl = customUrl || DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL;
  const { spreadsheetId, gid } = extractSpreadsheetTargetFromUrl(targetUrl);
  if (!spreadsheetId) return null;

  return {
    spreadsheetId,
    gid,
    webhookUrl,
  };
}

interface LoadedSheetContext {
  spreadsheetId: string;
  sheetId: number;
  sheetTitle: string;
  rows: string[][];
  cols: SheetColumnMap;
}

async function loadSheetContext(
  target: GoogleSheetTargetConfig,
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<LoadedSheetContext> {
  const metaRes = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${target.spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text().catch(() => '');
    throw new Error(`Google Sheets metadata HTTP ${metaRes.status}: ${errText.slice(0, 200)}`);
  }

  const meta = (await metaRes.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  const sheets = (meta.sheets || []).map((s) => s.properties).filter(Boolean) as Array<{
    sheetId: number;
    title: string;
  }>;

  if (sheets.length === 0) {
    throw new Error('V Google Tabulce nebyl nalezen žádný list.');
  }

  const matchedSheet =
    (target.gid !== null ? sheets.find((s) => s.sheetId === target.gid) : undefined) ||
    sheets.find((s) => s.title.toLowerCase().includes('plán') || s.title.toLowerCase().includes('plan')) ||
    sheets[0];

  const sheetTitle = matchedSheet.title;
  const sheetId = matchedSheet.sheetId;
  const quotedRange = `'${sheetTitle.replace(/'/g, "''")}'!A1:R3000`;

  const valuesRes = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${target.spreadsheetId}/values/${encodeURIComponent(quotedRange)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );

  if (!valuesRes.ok) {
    const errText = await valuesRes.text().catch(() => '');
    throw new Error(`Google Sheets values HTTP ${valuesRes.status}: ${errText.slice(0, 200)}`);
  }

  const valuesData = (await valuesRes.json()) as { values?: string[][] };
  const rows = valuesData.values || [];
  const cols = detectSheetColumns(rows);
  if (!cols) {
    throw new Error('Hlavička tabulky Plán nebyla nalezena.');
  }

  return {
    spreadsheetId: target.spreadsheetId,
    sheetId,
    sheetTitle,
    rows,
    cols,
  };
}

async function colorWorkerCellInSheet(params: {
  ctx: LoadedSheetContext;
  rowNumber: number; // 1-based
  isGreen: boolean;
  accessToken: string;
  fetchImpl: typeof fetch;
}) {
  const { ctx, rowNumber, isGreen, accessToken, fetchImpl } = params;
  if (ctx.cols.pracovnik === -1) return;

  const backgroundColor = isGreen
    ? GOOGLE_SHEET_DONE_GREEN_RGB
    : { red: 1, green: 1, blue: 1 };

  const res = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${ctx.spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: ctx.sheetId,
                startRowIndex: rowNumber - 1,
                endRowIndex: rowNumber,
                startColumnIndex: ctx.cols.pracovnik,
                endColumnIndex: ctx.cols.pracovnik + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor,
                },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      }),
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Sheets repeatCell HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
}

async function updateCellsOnRow(params: {
  ctx: LoadedSheetContext;
  rowNumber: number;
  updates: Array<{ colIndex: number; value: string }>;
  accessToken: string;
  fetchImpl: typeof fetch;
}) {
  const { ctx, rowNumber, updates, accessToken, fetchImpl } = params;
  const validUpdates = updates.filter((u) => u.colIndex >= 0);
  if (validUpdates.length === 0) return;

  const escapedTitle = `'${ctx.sheetTitle.replace(/'/g, "''")}'`;
  const data = validUpdates.map((u) => ({
    range: `${escapedTitle}!${columnIndexToLetter(u.colIndex)}${rowNumber}`,
    values: [[u.value]],
  }));

  const res = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${ctx.spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data,
      }),
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Sheets values:batchUpdate HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
}

function buildRowValuesForOrder(
  cols: SheetColumnMap,
  order: {
    title: string;
    description: string | null;
    clientName: string;
    requestedBy: string | null;
    scheduledAt: Date;
    campaignDateFrom: Date | null;
    campaignDateTo: Date | null;
    workType: WorkType;
    status: string;
    ftdSent: boolean;
    invoiced: boolean;
    contactName: string | null;
    contactPhone: string | null;
    mediaLabel: string | null;
    quantity: number | null;
    referenceUrl: string | null;
    ftdUrl: string | null;
    planningConstraints: Prisma.JsonValue;
    assignments: Array<{ workerName: string }>;
    items?: Array<{ carrier?: { code: string } | null }>;
  }
): { rowValues: string[]; pureZadani: string; praceLabel: string } {
  const rowValues = new Array(cols.maxColIndex + 1).fill('');
  const pc =
    order.planningConstraints &&
    typeof order.planningConstraints === 'object' &&
    !Array.isArray(order.planningConstraints)
      ? (order.planningConstraints as Record<string, unknown>)
      : {};

  const { dateStr, dayName } = formatCzDateForSheet(order.scheduledAt);
  const pureZadani = extractPureZadaniFromWorkOrder(order);
  const praceLabel = WORK_TYPE_CZECH_LABELS[order.workType] || 'Montáž';
  const workersStr = order.assignments.map((a) => a.workerName.trim()).filter(Boolean).join(' + ');
  const contactStr = [order.contactName, order.contactPhone].filter(Boolean).join(' ').trim();
  const carrierLabel =
    order.mediaLabel ||
    order.items?.find((i) => i.carrier?.code)?.carrier?.code ||
    '';

  const setCol = (idx: number, val: string) => {
    if (idx >= 0 && idx < rowValues.length) {
      rowValues[idx] = val;
    }
  };

  setCol(cols.ftdOdeslana, order.ftdSent ? 'ANO' : pc.ftdSkipped ? 'BEZ' : '');
  setCol(cols.fakt, order.invoiced ? 'ANO' : pc.invoiceExempt ? 'BEZ' : '');
  setCol(cols.datum, dateStr);
  setCol(cols.den, dayName);
  setCol(cols.zadal, order.requestedBy || '');
  setCol(cols.pracovnik, workersStr);
  setCol(
    cols.predano,
    ['HANDED_OVER', 'IN_PROGRESS', 'DONE'].includes(order.status) ? 'ANO' : ''
  );
  setCol(cols.klient, order.clientName || '');
  setCol(cols.zadani, pureZadani);
  setCol(cols.kontakt, contactStr);
  setCol(
    cols.datumZahajeni,
    order.campaignDateFrom ? formatCzDateForSheet(order.campaignDateFrom).dateStr : ''
  );
  setCol(
    cols.datumUkonceni,
    order.campaignDateTo ? formatCzDateForSheet(order.campaignDateTo).dateStr : ''
  );
  setCol(cols.typNosice, carrierLabel);
  setCol(cols.ks, order.quantity != null ? String(order.quantity) : '');
  setCol(cols.prace, praceLabel);
  setCol(cols.odkaz, order.referenceUrl || '');
  setCol(cols.odkazFtd, order.ftdUrl || '');

  return { rowValues, pureZadani, praceLabel };
}

export function parseAppendedRowNumber(updatedRange: string | undefined | null): number | null {
  if (!updatedRange) return null;
  // Matches e.g. "'Plán'!A945:Q945" or "Plán!A945"
  const match = updatedRange.match(/![A-Z]+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Appends a new WorkOrder row to the Google Sheet `Plán` if it does not already exist in the sheet.
 */
export async function writeBackNewWorkOrderToGoogleSheet(params: {
  organizationId: string;
  workOrderId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; sheetRow?: number; reason?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const target = await resolveOrganizationSheetTarget(params.organizationId);
    if (!target) return { ok: false, reason: 'NOT_ENABLED' };

    const order = await prisma.workOrder.findFirst({
      where: { id: params.workOrderId, organizationId: params.organizationId },
      include: {
        assignments: true,
        items: { include: { carrier: { select: { code: true } } } },
      },
    });
    if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };

    const prevPc =
      order.planningConstraints &&
      typeof order.planningConstraints === 'object' &&
      !Array.isArray(order.planningConstraints)
        ? (order.planningConstraints as Record<string, unknown>)
        : {};

    if (prevPc.source === 'GOOGLE_SHEETS_PLAN' && typeof prevPc.sheetRow === 'number') {
      return { ok: true, sheetRow: prevPc.sheetRow, reason: 'ALREADY_LINKED' };
    }

    const accessToken = await resolveGoogleSheetsAccessToken(params.organizationId, fetchImpl);
    if (!accessToken) {
      return { ok: false, reason: 'MISSING_GOOGLE_TOKEN' };
    }

    const ctx = await loadSheetContext(target, accessToken, fetchImpl);

    // Check if an identical row is already present to avoid duplicates
    const existingRow = locateWorkOrderRowInSheet({
      rows: ctx.rows,
      cols: ctx.cols,
      clientName: order.clientName,
      title: order.title,
      description: order.description,
      scheduledAt: order.scheduledAt,
    });

    const { rowValues, pureZadani, praceLabel } = buildRowValuesForOrder(ctx.cols, order);
    const sheetKey = buildSheetKeyForOrder({
      scheduledAt: order.scheduledAt,
      clientName: order.clientName,
      zadaniText: pureZadani,
      praceText: praceLabel,
    });

    let finalRowNumber = existingRow;

    if (!finalRowNumber) {
      const escapedTitle = `'${ctx.sheetTitle.replace(/'/g, "''")}'`;
      const appendRange = `${escapedTitle}!A${ctx.cols.headerRowNumber}:${columnIndexToLetter(ctx.cols.maxColIndex)}`;
      const appendRes = await fetchImpl(
        `https://sheets.googleapis.com/v4/spreadsheets/${ctx.spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowValues],
          }),
          cache: 'no-store',
        }
      );

      if (!appendRes.ok) {
        const errText = await appendRes.text().catch(() => '');
        throw new Error(`Google Sheets append HTTP ${appendRes.status}: ${errText.slice(0, 200)}`);
      }

      const appendData = (await appendRes.json()) as {
        updates?: { updatedRange?: string };
      };
      finalRowNumber =
        parseAppendedRowNumber(appendData.updates?.updatedRange) ?? ctx.rows.length + 1;
    }

    if (order.status === 'DONE' && finalRowNumber) {
      await colorWorkerCellInSheet({
        ctx,
        rowNumber: finalRowNumber,
        isGreen: true,
        accessToken,
        fetchImpl,
      });
    }

    await prisma.workOrder.update({
      where: { id: order.id },
      data: {
        planningConstraints: {
          ...prevPc,
          source: 'GOOGLE_SHEETS_PLAN',
          sheetRow: finalRowNumber,
          sheetKey,
          ...(order.status === 'DONE' ? { completedBySheetColor: true } : {}),
          sheetWritebackAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, sheetRow: finalRowNumber };
  } catch (error) {
    console.warn('[google-sheets-writeback] writeBackNewWorkOrderToGoogleSheet failed:', error);
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Marks a WorkOrder as DONE in the Google Sheet `Plán` by coloring its Pracovník cell green (#B6D7A8).
 * If the WorkOrder was created in SeePoint OS and is not yet in the Google Sheet, appends it first.
 */
export async function writeBackWorkOrderCompletedToGoogleSheet(params: {
  organizationId: string;
  workOrderId: string;
  isCompleted?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; sheetRow?: number; reason?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const isCompleted = params.isCompleted ?? true;
  try {
    const target = await resolveOrganizationSheetTarget(params.organizationId);
    if (!target) return { ok: false, reason: 'NOT_ENABLED' };

    const order = await prisma.workOrder.findFirst({
      where: { id: params.workOrderId, organizationId: params.organizationId },
      include: {
        assignments: true,
        items: { include: { carrier: { select: { code: true } } } },
      },
    });
    if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };

    const accessToken = await resolveGoogleSheetsAccessToken(params.organizationId, fetchImpl);
    if (!accessToken) {
      return { ok: false, reason: 'MISSING_GOOGLE_TOKEN' };
    }

    const prevPc =
      order.planningConstraints &&
      typeof order.planningConstraints === 'object' &&
      !Array.isArray(order.planningConstraints)
        ? (order.planningConstraints as Record<string, unknown>)
        : {};

    const ctx = await loadSheetContext(target, accessToken, fetchImpl);
    const preferredSheetRow = typeof prevPc.sheetRow === 'number' ? prevPc.sheetRow : null;

    const rowNumber = locateWorkOrderRowInSheet({
      rows: ctx.rows,
      cols: ctx.cols,
      preferredSheetRow,
      clientName: order.clientName,
      title: order.title,
      description: order.description,
      scheduledAt: order.scheduledAt,
    });

    if (!rowNumber) {
      // Task was created in SeePoint OS and isn't in the sheet yet — append it and color it
      const appended = await writeBackNewWorkOrderToGoogleSheet({
        organizationId: params.organizationId,
        workOrderId: params.workOrderId,
        fetchImpl,
      });
      return appended;
    }

    // Also ensure worker cell has worker name if empty in sheet
    const currentRow = ctx.rows[rowNumber - 1] || [];
    const currentWorkerCell =
      ctx.cols.pracovnik !== -1 ? (currentRow[ctx.cols.pracovnik] || '').trim() : '';
    const assignedWorkers = order.assignments
      .map((a) => a.workerName.trim())
      .filter(Boolean)
      .join(' + ');

    const cellUpdates: Array<{ colIndex: number; value: string }> = [];
    if (!currentWorkerCell && assignedWorkers && ctx.cols.pracovnik !== -1) {
      cellUpdates.push({ colIndex: ctx.cols.pracovnik, value: assignedWorkers });
    }
    if (cellUpdates.length > 0) {
      await updateCellsOnRow({
        ctx,
        rowNumber,
        updates: cellUpdates,
        accessToken,
        fetchImpl,
      });
    }

    await colorWorkerCellInSheet({
      ctx,
      rowNumber,
      isGreen: isCompleted,
      accessToken,
      fetchImpl,
    });

    await prisma.workOrder.update({
      where: { id: order.id },
      data: {
        ...(isCompleted && order.status !== 'DONE' ? { status: 'DONE' } : {}),
        planningConstraints: {
          ...prevPc,
          source: 'GOOGLE_SHEETS_PLAN',
          sheetRow: rowNumber,
          manualCompleted: isCompleted,
          completedBySheetColor: isCompleted,
          sheetColoredByWriteback: isCompleted,
          sheetWritebackAt: new Date().toISOString(),
          sheetWritebackError: null,
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, sheetRow: rowNumber };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.warn('[google-sheets-writeback] writeBackWorkOrderCompletedToGoogleSheet failed:', errMsg);
    await prisma.workOrder
      .findFirst({
        where: { id: params.workOrderId, organizationId: params.organizationId },
        select: { id: true, planningConstraints: true },
      })
      .then((ord) => {
        if (!ord) return;
        const pc =
          ord.planningConstraints &&
          typeof ord.planningConstraints === 'object' &&
          !Array.isArray(ord.planningConstraints)
            ? (ord.planningConstraints as Record<string, unknown>)
            : {};
        return prisma.workOrder.update({
          where: { id: ord.id },
          data: {
            planningConstraints: {
              ...pc,
              sheetWritebackError: errMsg,
              sheetWritebackAttemptAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
      })
      .catch(() => undefined);
    return {
      ok: false,
      reason: errMsg,
    };
  }
}

/**
 * Updates Datum and Den (and optionally FTD / Fakt / Pracovník / Zadání) in the Google Sheet `Plán`
 * when a WorkOrder is rescheduled or edited in SeePoint OS.
 */
export async function writeBackWorkOrderRescheduledToGoogleSheet(params: {
  organizationId: string;
  workOrderId: string;
  previousScheduledAt?: Date | null;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; sheetRow?: number; reason?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const target = await resolveOrganizationSheetTarget(params.organizationId);
    if (!target) return { ok: false, reason: 'NOT_ENABLED' };

    const order = await prisma.workOrder.findFirst({
      where: { id: params.workOrderId, organizationId: params.organizationId },
      include: {
        assignments: true,
        items: { include: { carrier: { select: { code: true } } } },
      },
    });
    if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };

    const accessToken = await resolveGoogleSheetsAccessToken(params.organizationId, fetchImpl);
    if (!accessToken) {
      return { ok: false, reason: 'MISSING_GOOGLE_TOKEN' };
    }

    const prevPc =
      order.planningConstraints &&
      typeof order.planningConstraints === 'object' &&
      !Array.isArray(order.planningConstraints)
        ? (order.planningConstraints as Record<string, unknown>)
        : {};

    const ctx = await loadSheetContext(target, accessToken, fetchImpl);
    const preferredSheetRow = typeof prevPc.sheetRow === 'number' ? prevPc.sheetRow : null;

    const rowNumber = locateWorkOrderRowInSheet({
      rows: ctx.rows,
      cols: ctx.cols,
      preferredSheetRow,
      clientName: order.clientName,
      title: order.title,
      description: order.description,
      scheduledAt: params.previousScheduledAt ?? order.scheduledAt,
    });

    if (!rowNumber) {
      return writeBackNewWorkOrderToGoogleSheet({
        organizationId: params.organizationId,
        workOrderId: params.workOrderId,
        fetchImpl,
      });
    }

    const { dateStr, dayName } = formatCzDateForSheet(order.scheduledAt);
    const pureZadani = extractPureZadaniFromWorkOrder(order);
    const praceLabel = WORK_TYPE_CZECH_LABELS[order.workType] || 'Montáž';
    const nextSheetKey = buildSheetKeyForOrder({
      scheduledAt: order.scheduledAt,
      clientName: order.clientName,
      zadaniText: pureZadani,
      praceText: praceLabel,
    });

    const updates: Array<{ colIndex: number; value: string }> = [
      { colIndex: ctx.cols.datum, value: dateStr },
      { colIndex: ctx.cols.den, value: dayName },
    ];

    if (ctx.cols.ftdOdeslana !== -1 && (order.ftdSent || prevPc.ftdSkipped)) {
      updates.push({
        colIndex: ctx.cols.ftdOdeslana,
        value: order.ftdSent ? 'ANO' : 'BEZ',
      });
    }
    if (ctx.cols.fakt !== -1 && (order.invoiced || prevPc.invoiceExempt)) {
      updates.push({
        colIndex: ctx.cols.fakt,
        value: order.invoiced ? 'ANO' : 'BEZ',
      });
    }

    await updateCellsOnRow({
      ctx,
      rowNumber,
      updates,
      accessToken,
      fetchImpl,
    });

    const newDateIso = order.scheduledAt.toISOString().slice(0, 10);
    await prisma.workOrder.update({
      where: { id: order.id },
      data: {
        planningConstraints: {
          ...prevPc,
          source: 'GOOGLE_SHEETS_PLAN',
          sheetRow: rowNumber,
          sheetKey: nextSheetKey,
          sheetScheduledDateAtReschedule: newDateIso,
          sheetWritebackAt: new Date().toISOString(),
          sheetWritebackError: null,
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, sheetRow: rowNumber };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.warn('[google-sheets-writeback] writeBackWorkOrderRescheduledToGoogleSheet failed:', errMsg);
    return {
      ok: false,
      reason: errMsg,
    };
  }
}

/**
 * Flushes any recently completed or rescheduled WorkOrders in SeePoint OS that have not yet been
 * colored green or updated in the Google Sheet `Plán` (e.g. tasks completed before OAuth was connected).
 */
export async function flushPendingGoogleSheetWritebacks(params: {
  organizationId: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  flushedCompletedCount: number;
  flushedRescheduledCount: number;
  errors: string[];
}> {
  const fetchImpl = params.fetchImpl ?? fetch;
  let flushedCompletedCount = 0;
  let flushedRescheduledCount = 0;
  const errors: string[] = [];

  try {
    const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const scheduledCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const recentOrders = await prisma.workOrder.findMany({
      where: {
        organizationId: params.organizationId,
        updatedAt: { gte: cutoff },
        scheduledAt: { gte: scheduledCutoff },
      },
      orderBy: [{ scheduledAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        planningConstraints: true,
      },
    });

    for (const ord of recentOrders) {
      const pc =
        ord.planningConstraints &&
        typeof ord.planningConstraints === 'object' &&
        !Array.isArray(ord.planningConstraints)
          ? (ord.planningConstraints as Record<string, unknown>)
          : {};

      if (pc.source !== 'GOOGLE_SHEETS_PLAN') continue;

      const wasCompletedInSystem =
        ord.status === 'DONE' ||
        pc.manualCompleted === true ||
        pc.manualFtdSent === true ||
        pc.lastEmailAction === 'COMPLETED';

      const needsCompletionColor =
        wasCompletedInSystem &&
        (pc.completedBySheetColor !== true || Boolean(pc.sheetWritebackError)) &&
        (pc.manualCompleted === true ||
          pc.manualFtdSent === true ||
          pc.lastEmailAction === 'COMPLETED' ||
          Boolean(pc.sheetWritebackError));

      if (needsCompletionColor) {
        const res = await writeBackWorkOrderCompletedToGoogleSheet({
          organizationId: params.organizationId,
          workOrderId: ord.id,
          isCompleted: true,
          fetchImpl,
        });
        if (res.ok) {
          flushedCompletedCount++;
        } else if (res.reason && !errors.includes(res.reason)) {
          errors.push(res.reason);
        }
      }

      const needsRescheduleWriteback =
        typeof pc.manualScheduledDateIso === 'string' &&
        pc.manualScheduledDateIso.length > 0 &&
        pc.sheetScheduledDateAtReschedule !== pc.manualScheduledDateIso;

      if (needsRescheduleWriteback) {
        const res = await writeBackWorkOrderRescheduledToGoogleSheet({
          organizationId: params.organizationId,
          workOrderId: ord.id,
          fetchImpl,
        });
        if (res.ok) {
          flushedRescheduledCount++;
        } else if (res.reason && !errors.includes(res.reason)) {
          errors.push(res.reason);
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'FLUSH_FAILED');
  }

  return { flushedCompletedCount, flushedRescheduledCount, errors };
}

/**
 * Updates `Odkaz FTD` and/or `FTD odeslána` on the matching row in the Google Sheet `Plán`
 * after photos are exported to Google Drive from SeePoint OS.
 */
export async function writeBackWorkOrderFtdToGoogleSheet(params: {
  organizationId: string;
  workOrderId: string;
  ftdUrl?: string | null;
  ftdSent?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; sheetRow?: number; reason?: string }> {
  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const target = await resolveOrganizationSheetTarget(params.organizationId);
    if (!target) return { ok: false, reason: 'NOT_ENABLED' };

    const order = await prisma.workOrder.findFirst({
      where: { id: params.workOrderId, organizationId: params.organizationId },
      select: {
        id: true,
        title: true,
        description: true,
        clientName: true,
        scheduledAt: true,
        ftdUrl: true,
        ftdSent: true,
        planningConstraints: true,
      },
    });
    if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };

    const accessToken = await resolveGoogleSheetsAccessToken(params.organizationId, fetchImpl);
    if (!accessToken) {
      return { ok: false, reason: 'MISSING_GOOGLE_TOKEN' };
    }

    const prevPc =
      order.planningConstraints &&
      typeof order.planningConstraints === 'object' &&
      !Array.isArray(order.planningConstraints)
        ? (order.planningConstraints as Record<string, unknown>)
        : {};

    const ctx = await loadSheetContext(target, accessToken, fetchImpl);
    const preferredSheetRow = typeof prevPc.sheetRow === 'number' ? prevPc.sheetRow : null;

    const rowNumber = locateWorkOrderRowInSheet({
      rows: ctx.rows,
      cols: ctx.cols,
      preferredSheetRow,
      clientName: order.clientName,
      title: order.title,
      description: order.description,
      scheduledAt: order.scheduledAt,
    });

    if (!rowNumber) {
      return { ok: false, reason: 'ROW_NOT_FOUND' };
    }

    const updates: Array<{ colIndex: number; value: string }> = [];
    const nextUrl = typeof params.ftdUrl === 'string' && params.ftdUrl.trim() ? params.ftdUrl.trim() : null;
    if (nextUrl && ctx.cols.odkazFtd !== -1) {
      updates.push({ colIndex: ctx.cols.odkazFtd, value: nextUrl });
    }
    if (params.ftdSent === true && ctx.cols.ftdOdeslana !== -1) {
      updates.push({ colIndex: ctx.cols.ftdOdeslana, value: 'ANO' });
    }

    if (updates.length === 0) {
      return { ok: true, sheetRow: rowNumber };
    }

    await updateCellsOnRow({
      ctx,
      rowNumber,
      updates,
      accessToken,
      fetchImpl,
    });

    return { ok: true, sheetRow: rowNumber };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.warn('[google-sheets-writeback] writeBackWorkOrderFtdToGoogleSheet failed:', errMsg);
    return { ok: false, reason: errMsg };
  }
}


