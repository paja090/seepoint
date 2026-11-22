import type { CrmOrderStatus, CrmProjectType, RealizationStatus } from '@prisma/client';

export class CrmOrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrmOrderValidationError';
  }
}

const ORDER_STATUSES = new Set<CrmOrderStatus>([
  'DRAFT',
  'CONFIRMED',
  'WAITING_FOR_MATERIALS',
  'READY_FOR_PRODUCTION',
  'IN_REALIZATION',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

const PROJECT_TYPES = new Set<CrmProjectType>([
  'NAVIGATION',
  'CITY_GALLERY',
  'BENCH',
  'CITY_POSTER',
  'CLV',
  'TOWER',
  'HORIZON',
  'COMBINED',
  'OTHER',
]);

const REALIZATION_STATUSES = new Set<RealizationStatus>([
  'WAITING_FOR_MATERIALS',
  'MATERIALS_APPROVED',
  'WAITING_FOR_PRODUCTION',
  'PRODUCED',
  'SCHEDULED',
  'INSTALLATION_IN_PROGRESS',
  'INSTALLED',
  'PHOTOGRAPHED',
  'DELIVERED_TO_CLIENT',
  'CLAIM',
  'COMPLETED',
]);

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CrmOrderValidationError('Neplatný formát požadavku.');
  }
  return input as Record<string, unknown>;
}

function optionalText(value: unknown, fieldLabel: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CrmOrderValidationError(`${fieldLabel} musí být text.`);
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new CrmOrderValidationError(`${fieldLabel} může mít maximálně ${maxLength} znaků.`);
  }
  return normalized;
}

function optionalMultilineText(value: unknown, fieldLabel: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CrmOrderValidationError(`${fieldLabel} musí být text.`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new CrmOrderValidationError(`${fieldLabel} může mít maximálně ${maxLength} znaků.`);
  }
  return normalized;
}

function optionalId(value: unknown, fieldLabel: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CrmOrderValidationError(`${fieldLabel} musí být textové ID.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 64) {
    throw new CrmOrderValidationError(`${fieldLabel} má neplatnou délku.`);
  }
  return trimmed;
}

function optionalDate(value: unknown, fieldLabel: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new CrmOrderValidationError(`${fieldLabel} má neplatný formát data.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new CrmOrderValidationError(`${fieldLabel} není platné datum.`);
  }
  return parsed;
}

function optionalPrice(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(String(value).replace(/\s+/g, '').replace(',', '.'));
  if (!Number.isFinite(num) || num < 0) {
    throw new CrmOrderValidationError('Cena zakázky musí být nezáporné číslo.');
  }
  return Math.round(num * 100) / 100;
}

function optionalEnum<T extends string>(value: unknown, allowed: Set<T>, fieldLabel: string): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new CrmOrderValidationError(`Neplatná hodnota pole ${fieldLabel}.`);
  }
  return value as T;
}

export type ParsedCreateCrmOrderInput = {
  clientId: string;
  title: string;
  clientOrderCode: string | null;
  agencyClientId: string | null;
  agencyName: string | null;
  contactId: string | null;
  branchId: string | null;
  assignedUserId: string | null;
  projectType: CrmProjectType;
  status: CrmOrderStatus;
  dateFrom: Date | null;
  dateTo: Date | null;
  totalPrice: number | null;
  billingMethod: string | null;
  note: string | null;
  internalNote: string | null;
};

export function parseCreateCrmOrderInput(raw: unknown): ParsedCreateCrmOrderInput {
  const body = asRecord(raw);
  const clientId = optionalId(body.clientId, 'Klient');
  if (!clientId) {
    throw new CrmOrderValidationError('Vyberte koncového klienta zakázky.');
  }
  const title = optionalText(body.title, 'Název zakázky', 200);
  if (!title || title.length < 2) {
    throw new CrmOrderValidationError('Název zakázky musí mít alespoň 2 znaky.');
  }

  const dateFrom = optionalDate(body.dateFrom, 'Datum od') ?? null;
  const dateTo = optionalDate(body.dateTo, 'Datum do') ?? null;
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new CrmOrderValidationError('Datum začátku nemůže být po datu konce zakázky.');
  }

  const agencyClientId = optionalId(body.agencyClientId, 'Agentura') ?? null;
  const agencyName = optionalText(body.agencyName, 'Název agentury', 160) ?? null;

  return {
    clientId,
    title,
    clientOrderCode: optionalText(body.clientOrderCode, 'Číslo objednávky klienta', 80) ?? null,
    agencyClientId,
    agencyName,
    contactId: optionalId(body.contactId, 'Kontaktní osoba') ?? null,
    branchId: optionalId(body.branchId, 'Pobočka') ?? null,
    assignedUserId: optionalId(body.assignedUserId, 'Obchodník') ?? null,
    projectType: optionalEnum(body.projectType, PROJECT_TYPES, 'typ projektu') ?? 'OTHER',
    status: optionalEnum(body.status, ORDER_STATUSES, 'stav zakázky') ?? 'DRAFT',
    dateFrom,
    dateTo,
    totalPrice: optionalPrice(body.totalPrice) ?? null,
    billingMethod: optionalText(body.billingMethod, 'Způsob fakturace', 120) ?? null,
    note: optionalMultilineText(body.note, 'Poznámka', 4000) ?? null,
    internalNote: optionalMultilineText(body.internalNote, 'Interní poznámka', 4000) ?? null,
  };
}

export type ParsedUpdateCrmOrderInput = {
  title?: string;
  clientOrderCode?: string | null;
  agencyClientId?: string | null;
  agencyName?: string | null;
  contactId?: string | null;
  branchId?: string | null;
  assignedUserId?: string | null;
  projectType?: CrmProjectType;
  status?: CrmOrderStatus;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  totalPrice?: number | null;
  billingMethod?: string | null;
  note?: string | null;
  internalNote?: string | null;
};

export function parseUpdateCrmOrderInput(raw: unknown): ParsedUpdateCrmOrderInput {
  const body = asRecord(raw);
  const out: ParsedUpdateCrmOrderInput = {};

  if (body.title !== undefined) {
    const title = optionalText(body.title, 'Název zakázky', 200);
    if (!title || title.length < 2) {
      throw new CrmOrderValidationError('Název zakázky musí mít alespoň 2 znaky.');
    }
    out.title = title;
  }
  if (body.clientOrderCode !== undefined) out.clientOrderCode = optionalText(body.clientOrderCode, 'Číslo objednávky klienta', 80) ?? null;
  if (body.agencyClientId !== undefined) out.agencyClientId = optionalId(body.agencyClientId, 'Agentura') ?? null;
  if (body.agencyName !== undefined) out.agencyName = optionalText(body.agencyName, 'Název agentury', 160) ?? null;
  if (body.contactId !== undefined) out.contactId = optionalId(body.contactId, 'Kontaktní osoba') ?? null;
  if (body.branchId !== undefined) out.branchId = optionalId(body.branchId, 'Pobočka') ?? null;
  if (body.assignedUserId !== undefined) out.assignedUserId = optionalId(body.assignedUserId, 'Obchodník') ?? null;
  if (body.projectType !== undefined) {
    const pt = optionalEnum(body.projectType, PROJECT_TYPES, 'typ projektu');
    if (pt) out.projectType = pt;
  }
  if (body.status !== undefined) {
    const st = optionalEnum(body.status, ORDER_STATUSES, 'stav zakázky');
    if (st) out.status = st;
  }
  if (body.dateFrom !== undefined) out.dateFrom = optionalDate(body.dateFrom, 'Datum od') ?? null;
  if (body.dateTo !== undefined) out.dateTo = optionalDate(body.dateTo, 'Datum do') ?? null;
  if (out.dateFrom && out.dateTo && out.dateFrom > out.dateTo) {
    throw new CrmOrderValidationError('Datum začátku nemůže být po datu konce zakázky.');
  }
  if (body.totalPrice !== undefined) out.totalPrice = optionalPrice(body.totalPrice) ?? null;
  if (body.billingMethod !== undefined) out.billingMethod = optionalText(body.billingMethod, 'Způsob fakturace', 120) ?? null;
  if (body.note !== undefined) out.note = optionalMultilineText(body.note, 'Poznámka', 4000) ?? null;
  if (body.internalNote !== undefined) out.internalNote = optionalMultilineText(body.internalNote, 'Interní poznámka', 4000) ?? null;

  return out;
}

export type ParsedUpdateRealizationInput = {
  branchId?: string | null;
  status?: RealizationStatus;
  plannedDate?: Date | null;
  actualDate?: Date | null;
  note?: string | null;
  claimNote?: string | null;
  propagateToPhotos: boolean;
};

export function parseUpdateRealizationInput(raw: unknown): ParsedUpdateRealizationInput {
  const body = asRecord(raw);
  const out: ParsedUpdateRealizationInput = {
    propagateToPhotos: body.propagateToPhotos !== false,
  };

  if (body.branchId !== undefined) out.branchId = optionalId(body.branchId, 'Pobočka') ?? null;
  if (body.status !== undefined) {
    const st = optionalEnum(body.status, REALIZATION_STATUSES, 'stav realizace');
    if (st) out.status = st;
  }
  if (body.plannedDate !== undefined) out.plannedDate = optionalDate(body.plannedDate, 'Plánovaný termín') ?? null;
  if (body.actualDate !== undefined) out.actualDate = optionalDate(body.actualDate, 'Skutečný termín') ?? null;
  if (body.note !== undefined) out.note = optionalMultilineText(body.note, 'Poznámka', 2000) ?? null;
  if (body.claimNote !== undefined) out.claimNote = optionalMultilineText(body.claimNote, 'Reklamace', 2000) ?? null;

  return out;
}

export type ParsedCrmOrderListQuery = {
  q?: string;
  clientId?: string;
  agencyClientId?: string;
  branchId?: string;
  status?: CrmOrderStatus;
  missingAgency: boolean;
  page: number;
  pageSize: number;
};

export function parseCrmOrderListQuery(searchParams: URLSearchParams): ParsedCrmOrderListQuery {
  const q = searchParams.get('q')?.trim() || undefined;
  const clientId = searchParams.get('clientId')?.trim() || undefined;
  const agencyClientId = searchParams.get('agencyClientId')?.trim() || undefined;
  const branchId = searchParams.get('branchId')?.trim() || undefined;
  const statusRaw = searchParams.get('status')?.trim() || undefined;
  const status = statusRaw ? optionalEnum(statusRaw, ORDER_STATUSES, 'stav zakázky') : undefined;
  const missingAgencyRaw = searchParams.get('missingAgency')?.trim().toLowerCase();
  const missingAgency = missingAgencyRaw === 'true' || missingAgencyRaw === '1';

  const pageRaw = searchParams.get('page');
  const pageSizeRaw = searchParams.get('pageSize');
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 100;

  if (!Number.isInteger(page) || page < 1 || page > 1000) {
    throw new CrmOrderValidationError('Parametr page musí být celé číslo 1 až 1000.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new CrmOrderValidationError('Parametr pageSize musí být celé číslo 1 až 200.');
  }

  return {
    q,
    clientId,
    agencyClientId,
    branchId,
    status,
    missingAgency,
    page,
    pageSize,
  };
}
