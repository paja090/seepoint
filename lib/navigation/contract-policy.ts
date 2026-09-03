export class NavigationContractValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'NavigationContractValidationError';
  }
}

export const navigationContractTypes = ['RENTAL', 'PRODUCTION', 'SERVICE', 'MASTER'] as const;
export const navigationContractStatuses = ['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED'] as const;
export const navigationContactTypes = ['CLIENT', 'AGENCY', 'RESPONSIBLE_PERSON'] as const;

export type NavigationContractType = typeof navigationContractTypes[number];
export type NavigationContractStatus = typeof navigationContractStatuses[number];
export type NavigationContactType = typeof navigationContactTypes[number];

const text = (value: unknown, label: string, max: number, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new NavigationContractValidationError(`${label} je povinné.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new NavigationContractValidationError(`${label} musí být text.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (required && !normalized) throw new NavigationContractValidationError(`${label} je povinné.`);
  if (normalized.length > max) throw new NavigationContractValidationError(`${label} je příliš dlouhé.`);
  return normalized || undefined;
};

const nullableText = (value: unknown, label: string, max: number) => text(value, label, max) || null;

const id = (value: unknown, label: string, required = false) => text(value, label, 80, required);

const strictDate = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new NavigationContractValidationError(`${label} musí být ve formátu YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new NavigationContractValidationError(`${label} není platné kalendářní datum.`);
  }
  return value;
};

const money = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
    throw new NavigationContractValidationError(`${label} musí být částka od 0 do 100 000 000 Kč.`);
  }
  return Math.round(parsed * 100) / 100;
};

const email = (value: unknown) => {
  const normalized = text(value, 'E-mail', 254)?.toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new NavigationContractValidationError('E-mail nemá platný formát.');
  return normalized;
};

const phone = (value: unknown) => {
  const normalized = text(value, 'Telefon', 40);
  if (!normalized) return null;
  if (!/^\+?[0-9 ()/.-]{6,40}$/.test(normalized)) throw new NavigationContractValidationError('Telefon nemá platný formát.');
  return normalized;
};

export type NavigationContractFormInput = ReturnType<typeof parseNavigationContractInput>;

export function parseNavigationContractInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new NavigationContractValidationError('Neplatné tělo požadavku.');
  const body = raw as Record<string, unknown>;
  const contractType = body.contractType === undefined ? 'RENTAL' : body.contractType;
  const status = body.status === undefined ? 'ACTIVE' : body.status;
  if (typeof contractType !== 'string' || !navigationContractTypes.includes(contractType as NavigationContractType)) {
    throw new NavigationContractValidationError('Neplatný typ smlouvy.');
  }
  if (typeof status !== 'string' || !navigationContractStatuses.includes(status as NavigationContractStatus)) {
    throw new NavigationContractValidationError('Neplatný stav smlouvy.');
  }
  const startDate = strictDate(body.startDate, 'Datum začátku');
  const endDate = strictDate(body.endDate, 'Datum konce');
  if (endDate < startDate) throw new NavigationContractValidationError('Datum konce nesmí být před datem začátku.');
  const alertDaysBefore = body.alertDaysBefore === undefined || body.alertDaysBefore === '' ? 30 : Number(body.alertDaysBefore);
  if (!Number.isInteger(alertDaysBefore) || alertDaysBefore < 0 || alertDaysBefore > 3650) {
    throw new NavigationContractValidationError('Počet dní upozornění musí být celé číslo od 0 do 3650.');
  }
  if (body.autoRenews !== undefined && typeof body.autoRenews !== 'boolean') {
    throw new NavigationContractValidationError('Automatické prodloužení musí být ano/ne.');
  }
  return {
    contractNumber: text(body.contractNumber, 'Číslo smlouvy', 80, true)!,
    contractType: contractType as NavigationContractType,
    clientId: id(body.clientId, 'Klient', true)!,
    agencyName: nullableText(body.agencyName, 'Agentura', 200),
    responsiblePerson: nullableText(body.responsiblePerson, 'Odpovědná osoba', 160),
    phone: phone(body.phone),
    email: email(body.email),
    offerId: id(body.offerId, 'Nabídka') || null,
    navigationOrderId: id(body.navigationOrderId, 'Navigační zakázka') || null,
    startDate,
    endDate,
    monthlyPrice: money(body.monthlyPrice, 'Měsíční cena'),
    totalPrice: money(body.totalPrice, 'Celková cena'),
    status: status as NavigationContractStatus,
    autoRenews: body.autoRenews === true,
    alertDaysBefore,
    note: nullableText(body.note, 'Poznámka', 4_000),
  };
}

export type NavigationContactFormInput = ReturnType<typeof parseNavigationContactInput>;

export function parseNavigationContactInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new NavigationContractValidationError('Neplatné tělo požadavku.');
  const body = raw as Record<string, unknown>;
  const contactType = body.contactType === undefined ? 'CLIENT' : body.contactType;
  if (typeof contactType !== 'string' || !navigationContactTypes.includes(contactType as NavigationContactType)) {
    throw new NavigationContractValidationError('Neplatný typ kontaktu.');
  }
  if (body.isPrimary !== undefined && typeof body.isPrimary !== 'boolean') {
    throw new NavigationContractValidationError('Hlavní kontakt musí být ano/ne.');
  }
  return {
    clientId: id(body.clientId, 'Klient', true)!,
    contactType: contactType as NavigationContactType,
    name: text(body.name, 'Jméno', 160, true)!,
    agencyName: nullableText(body.agencyName, 'Agentura', 200),
    role: nullableText(body.role, 'Role', 160),
    phone: phone(body.phone),
    email: email(body.email),
    isPrimary: body.isPrimary === true,
    note: nullableText(body.note, 'Poznámka', 2_000),
  };
}

const boundedInteger = (params: URLSearchParams, name: string, fallback: number, min: number, max: number) => {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new NavigationContractValidationError(`Neplatný parametr ${name}.`);
  return value;
};

export function parseNavigationContractFilters(params: URLSearchParams) {
  const status = params.get('status') || undefined;
  if (status && !navigationContractStatuses.includes(status as NavigationContractStatus)) throw new NavigationContractValidationError('Neplatný stav smlouvy.');
  return {
    clientId: id(params.get('clientId'), 'Klient'),
    status: status as NavigationContractStatus | undefined,
    query: text(params.get('query'), 'Hledání', 200),
    take: boundedInteger(params, 'take', 100, 1, 200),
    skip: boundedInteger(params, 'skip', 0, 0, 10_000),
  };
}

export function parseNavigationContactFilters(params: URLSearchParams) {
  return {
    clientId: id(params.get('clientId'), 'Klient'),
    query: text(params.get('query'), 'Hledání', 200),
    take: boundedInteger(params, 'take', 100, 1, 200),
    skip: boundedInteger(params, 'skip', 0, 0, 10_000),
  };
}

export function deriveNavigationContractDisplay(status: string, startDate: string | Date, endDate: string | Date, alertDaysBefore: number, now: Date) {
  if (status === 'TERMINATED') return { code: 'TERMINATED', label: 'Ukončená', tone: 'slate' } as const;
  if (status === 'DRAFT') return { code: 'DRAFT', label: 'Návrh', tone: 'sky' } as const;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayMs = 24 * 60 * 60_000;
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / dayMs);
  if (status === 'EXPIRED' || daysLeft < 0) return { code: 'EXPIRED', label: 'Vypršela', tone: 'rose', daysLeft } as const;
  if (start.getTime() > now.getTime()) return { code: 'UPCOMING', label: 'Budoucí', tone: 'violet', daysLeft } as const;
  if (status === 'EXPIRING' || daysLeft <= alertDaysBefore) return { code: 'EXPIRING', label: `Končí za ${daysLeft} dní`, tone: 'amber', daysLeft } as const;
  return { code: 'ACTIVE', label: 'Aktivní', tone: 'emerald', daysLeft } as const;
}
