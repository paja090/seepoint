import { OpportunityEventType, OpportunityStatus } from '@prisma/client';
import type { CreateOpportunityInput, OpportunityFilterParams } from './types';

export class OpportunityValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'OpportunityValidationError';
  }
}

const mediaTypes = new Set([
  'CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION_SIGN', 'CITYLIGHT', 'BILLBOARD',
  'BIGBOARD', 'LED_SCREEN', 'BANNER',
]);

const clean = (value: unknown, label: string, max: number, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new OpportunityValidationError(`${label} je povinné.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new OpportunityValidationError(`${label} musí být text.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (required && !normalized) throw new OpportunityValidationError(`${label} je povinné.`);
  if (normalized.length > max) throw new OpportunityValidationError(`${label} je příliš dlouhé.`);
  return normalized || undefined;
};

const httpUrl = (value: unknown, label: string, required = false) => {
  const raw = clean(value, label, 2_000, required);
  if (!raw) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new OpportunityValidationError(`${label} není platná URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new OpportunityValidationError(`${label} musí být veřejná HTTP(S) adresa bez přihlašovacích údajů.`);
  }
  return parsed.toString();
};

const strictDate = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' && !(value instanceof Date)) throw new OpportunityValidationError(`${label} není platné datum.`);
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new OpportunityValidationError(`${label} musí být ve formátu YYYY-MM-DD.`);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new OpportunityValidationError(`${label} není platné kalendářní datum.`);
  }
  return raw;
};

export function parseOpportunityCreateInput(raw: unknown): CreateOpportunityInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new OpportunityValidationError('Neplatné tělo požadavku.');
  const body = raw as Record<string, unknown>;
  const eventType = body.eventType === undefined ? OpportunityEventType.NEW_BRANCH : body.eventType;
  if (typeof eventType !== 'string' || !Object.values(OpportunityEventType).includes(eventType as OpportunityEventType)) {
    throw new OpportunityValidationError('Neplatný typ události.');
  }
  const companyId = clean(body.companyId, 'IČO', 20);
  if (companyId && !/^\d{8}$/.test(companyId.replace(/\s/g, ''))) throw new OpportunityValidationError('IČO musí mít 8 číslic.');
  const latitude = body.latitude === undefined || body.latitude === null ? undefined : Number(body.latitude);
  const longitude = body.longitude === undefined || body.longitude === null ? undefined : Number(body.longitude);
  if ((latitude === undefined) !== (longitude === undefined)) throw new OpportunityValidationError('GPS musí obsahovat šířku i délku.');
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw new OpportunityValidationError('Neplatná zeměpisná šířka.');
  if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new OpportunityValidationError('Neplatná zeměpisná délka.');
  const suggestedMediaTypes = body.suggestedMediaTypes === undefined
    ? undefined
    : Array.isArray(body.suggestedMediaTypes)
      ? [...new Set(body.suggestedMediaTypes.filter((item): item is string => typeof item === 'string' && mediaTypes.has(item)))].slice(0, 8)
      : (() => { throw new OpportunityValidationError('Doporučená média musí být seznam.'); })();

  const eventDate = strictDate(body.eventDate, 'Datum události');
  if (eventDate && eventDate < new Date().toISOString().slice(0, 10)) throw new OpportunityValidationError('Obchodní radar nepřijímá události v minulosti.');
  return {
    companyName: clean(body.companyName, 'Název firmy', 200, true)!,
    companyId: companyId?.replace(/\s/g, ''),
    website: httpUrl(body.website, 'Web'),
    eventType: eventType as OpportunityEventType,
    title: clean(body.title, 'Titulek', 240, true)!,
    summary: clean(body.summary, 'Shrnutí', 4_000, true)!,
    city: clean(body.city, 'Město', 120) || null,
    region: clean(body.region, 'Kraj', 120) || null,
    address: clean(body.address, 'Adresa', 300),
    latitude,
    longitude,
    eventDate,
    sourceUrl: httpUrl(body.sourceUrl, 'Zdrojová URL') || 'https://radar.internal/',
    sourceTitle: clean(body.sourceTitle, 'Název zdroje', 500) || 'Interní zadání obchodníka',
    sourcePublishedAt: strictDate(body.sourcePublishedAt, 'Datum zdroje'),
    suggestedMediaTypes,
    clientId: clean(body.clientId, 'Klient', 80),
    assignedToUserId: clean(body.assignedToUserId, 'Obchodník', 80),
    radarSignalId: clean(body.radarSignalId, 'Signál', 80) || null,
    scoreTrigger: typeof body.scoreTrigger === 'number' ? body.scoreTrigger : null,
    scoreCustomerFit: typeof body.scoreCustomerFit === 'number' ? body.scoreCustomerFit : null,
    scoreTiming: typeof body.scoreTiming === 'number' ? body.scoreTiming : null,
    scoreGeo: typeof body.scoreGeo === 'number' ? body.scoreGeo : null,
    scoreMediaFit: typeof body.scoreMediaFit === 'number' ? body.scoreMediaFit : null,
    scoreEvidence: typeof body.scoreEvidence === 'number' ? body.scoreEvidence : null,
  };
}

export function parseOpportunityFilters(params: URLSearchParams): OpportunityFilterParams {
  const eventType = params.get('eventType') || undefined;
  const status = params.get('status') || undefined;
  if (eventType && !Object.values(OpportunityEventType).includes(eventType as OpportunityEventType)) throw new OpportunityValidationError('Neplatný typ události.');
  if (status && !Object.values(OpportunityStatus).includes(status as OpportunityStatus)) throw new OpportunityValidationError('Neplatný stav příležitosti.');
  const numberParam = (name: string, fallback: number, min: number, max: number) => {
    const raw = params.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw new OpportunityValidationError(`Neplatný parametr ${name}.`);
    return value;
  };
  const minScore = params.has('minScore') ? numberParam('minScore', 0, 0, 100) : undefined;
  const maxScore = params.has('maxScore') ? numberParam('maxScore', 100, 0, 100) : undefined;
  if (minScore !== undefined && maxScore !== undefined && minScore > maxScore) throw new OpportunityValidationError('Minimální skóre nesmí být vyšší než maximální.');
  return {
    search: clean(params.get('search'), 'Hledání', 200),
    city: clean(params.get('city'), 'Město', 120),
    region: clean(params.get('region'), 'Kraj', 120),
    eventType: eventType as OpportunityEventType | undefined,
    status: status as OpportunityStatus | undefined,
    minScore,
    maxScore,
    assignedToUserId: clean(params.get('assignedToUserId'), 'Obchodník', 80),
    take: numberParam('take', 50, 1, 100),
    skip: numberParam('skip', 0, 0, 10_000),
  };
}

const transitions: Record<OpportunityStatus, OpportunityStatus[]> = {
  NEW: ['REVIEWED', 'CONTACT_PLANNED', 'CONTACTED', 'DISMISSED'],
  REVIEWED: ['CONTACT_PLANNED', 'CONTACTED', 'DISMISSED'],
  CONTACT_PLANNED: ['CONTACTED', 'DISMISSED'],
  CONTACTED: ['PROPOSAL_CREATED', 'DISMISSED'],
  PROPOSAL_CREATED: ['CONVERTED', 'DISMISSED'],
  CONVERTED: [],
  DISMISSED: ['REVIEWED'],
};

export function assertOpportunityTransition(current: OpportunityStatus, next: OpportunityStatus) {
  if (current === next) return;
  if (!transitions[current].includes(next)) throw new OpportunityValidationError(`Přechod ze stavu ${current} do ${next} není povolen.`, 409);
}

export function parseOpportunityStatusInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new OpportunityValidationError('Neplatné tělo požadavku.');
  const body = raw as Record<string, unknown>;
  if (typeof body.status !== 'string' || !Object.values(OpportunityStatus).includes(body.status as OpportunityStatus)) {
    throw new OpportunityValidationError('Chybí nebo není platný nový stav příležitosti.');
  }
  const dismissedReason = clean(body.dismissedReason, 'Důvod ignorování', 500);
  if (body.status === OpportunityStatus.DISMISSED && !dismissedReason) throw new OpportunityValidationError('Při ignorování uveďte důvod.');
  return {
    status: body.status as OpportunityStatus,
    dismissedReason,
    assignedToUserId: clean(body.assignedToUserId, 'Obchodník', 80),
  };
}
