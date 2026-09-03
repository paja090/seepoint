import {
  ClientPricingSegment,
  ClientSource,
  ClientStatus,
  ClientType,
  PreferredContactMethod,
  CommunicationType,
} from '@prisma/client';

export class CrmClientValidationError extends Error {}

type InputRecord = Record<string, unknown>;

function record(input: unknown): InputRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new CrmClientValidationError('Požadavek neobsahuje platná data.');
  }
  return input as InputRecord;
}

function text(value: unknown, label: string, maxLength: number, required = false): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new CrmClientValidationError(`${label} je povinné.`);
    return null;
  }
  if (typeof value !== 'string') throw new CrmClientValidationError(`${label} nemá platný formát.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized && required) throw new CrmClientValidationError(`${label} je povinné.`);
  if (normalized.length > maxLength) throw new CrmClientValidationError(`${label} je příliš dlouhé.`);
  return normalized || null;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new CrmClientValidationError(`${label} není platné.`);
  }
  return value as T;
}

function email(value: unknown, label: string): string | null {
  const normalized = text(value, label, 254);
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new CrmClientValidationError(`${label} není platný.`);
  }
  return normalized?.toLowerCase() || null;
}

function website(value: unknown): string | null {
  const normalized = text(value, 'Web', 500);
  if (!normalized) return null;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new CrmClientValidationError('Web musí být úplná HTTP nebo HTTPS adresa.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new CrmClientValidationError('Web musí používat HTTP nebo HTTPS.');
  }
  return parsed.toString();
}

function country(value: unknown, label: string): string | null {
  const normalized = text(value, label, 2);
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) throw new CrmClientValidationError(`${label} musí být dvoupísmenný kód země.`);
  return upper;
}

function booleanValue(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new CrmClientValidationError(`${label} musí být ano/ne.`);
  return value;
}

export function parseClientInput(input: unknown) {
  const body = record(input);
  return {
    name: text(body.name, 'Název společnosti', 200, true)!,
    tradingName: text(body.tradingName, 'Obchodní název', 200),
    companyId: text(body.companyId, 'IČO', 32),
    dic: text(body.dic, 'DIČ', 32),
    billingStreet: text(body.billingStreet, 'Fakturační ulice', 200),
    billingCity: text(body.billingCity, 'Fakturační město', 120),
    billingZip: text(body.billingZip, 'Fakturační PSČ', 20),
    billingCountry: country(body.billingCountry, 'Fakturační země') || 'CZ',
    shippingStreet: text(body.shippingStreet, 'Dodací ulice', 200),
    shippingCity: text(body.shippingCity, 'Dodací město', 120),
    shippingZip: text(body.shippingZip, 'Dodací PSČ', 20),
    shippingCountry: country(body.shippingCountry, 'Dodací země') || 'CZ',
    website: website(body.website),
    contactPerson: text(body.contactPerson, 'Kontaktní osoba', 200),
    email: email(body.email, 'E-mail klienta'),
    phone: text(body.phone, 'Telefon klienta', 50),
    status: enumValue(body.status, Object.values(ClientStatus), 'Stav klienta') || ClientStatus.ACTIVE,
    clientType: enumValue(body.clientType, Object.values(ClientType), 'Typ klienta') || ClientType.DIRECT_CLIENT,
    pricingSegment: enumValue(body.pricingSegment, Object.values(ClientPricingSegment), 'Cenový segment') || ClientPricingSegment.COMMERCIAL,
    source: enumValue(body.source, Object.values(ClientSource), 'Zdroj klienta') || ClientSource.WEBSITE,
    assignedUserId: text(body.assignedUserId, 'Přiřazený uživatel', 64),
    rating: text(body.rating, 'Hodnocení', 50),
    note: text(body.note, 'Poznámka', 10_000),
  };
}

export function parseClientUpdateInput(input: unknown) {
  const body = record(input);
  const data: Record<string, unknown> = {
    name: text(body.name, 'Název společnosti', 200, true)!,
  };
  if ('tradingName' in body) data.tradingName = text(body.tradingName, 'Obchodní název', 200);
  if ('companyId' in body) data.companyId = text(body.companyId, 'IČO', 32);
  if ('dic' in body) data.dic = text(body.dic, 'DIČ', 32);
  if ('billingStreet' in body) data.billingStreet = text(body.billingStreet, 'Fakturační ulice', 200);
  if ('billingCity' in body) data.billingCity = text(body.billingCity, 'Fakturační město', 120);
  if ('billingZip' in body) data.billingZip = text(body.billingZip, 'Fakturační PSČ', 20);
  if ('billingCountry' in body) data.billingCountry = country(body.billingCountry, 'Fakturační země') || 'CZ';
  if ('shippingStreet' in body) data.shippingStreet = text(body.shippingStreet, 'Dodací ulice', 200);
  if ('shippingCity' in body) data.shippingCity = text(body.shippingCity, 'Dodací město', 120);
  if ('shippingZip' in body) data.shippingZip = text(body.shippingZip, 'Dodací PSČ', 20);
  if ('shippingCountry' in body) data.shippingCountry = country(body.shippingCountry, 'Dodací země') || 'CZ';
  if ('website' in body) data.website = website(body.website);
  if ('contactPerson' in body) data.contactPerson = text(body.contactPerson, 'Kontaktní osoba', 200);
  if ('email' in body) data.email = email(body.email, 'E-mail klienta');
  if ('phone' in body) data.phone = text(body.phone, 'Telefon klienta', 50);
  if ('status' in body) data.status = enumValue(body.status, Object.values(ClientStatus), 'Stav klienta');
  if ('clientType' in body) data.clientType = enumValue(body.clientType, Object.values(ClientType), 'Typ klienta');
  if ('pricingSegment' in body) data.pricingSegment = enumValue(body.pricingSegment, Object.values(ClientPricingSegment), 'Cenový segment');
  if ('source' in body) data.source = enumValue(body.source, Object.values(ClientSource), 'Zdroj klienta');
  if ('assignedUserId' in body) data.assignedUserId = text(body.assignedUserId, 'Přiřazený uživatel', 64);
  if ('rating' in body) data.rating = text(body.rating, 'Hodnocení', 50);
  if ('note' in body) data.note = text(body.note, 'Poznámka', 10_000);
  return data;
}

export function parseContactInput(input: unknown) {
  const body = record(input);
  return {
    firstName: text(body.firstName, 'Jméno', 100, true)!,
    lastName: text(body.lastName, 'Příjmení', 100, true)!,
    title: text(body.title, 'Pozice', 120),
    department: text(body.department, 'Oddělení', 120),
    email: email(body.email, 'E-mail kontaktu'),
    phone: text(body.phone, 'Telefon kontaktu', 50),
    note: text(body.note, 'Poznámka kontaktu', 5_000),
    preferredCommunication: enumValue(body.preferredCommunication, Object.values(PreferredContactMethod), 'Preferovaná komunikace') || PreferredContactMethod.EMAIL,
    isPrimary: booleanValue(body.isPrimary, 'Primární kontakt', false),
    isCommercial: booleanValue(body.isCommercial, 'Obchodní kontakt', true),
    isRealization: booleanValue(body.isRealization, 'Realizační kontakt', false),
    isBilling: booleanValue(body.isBilling, 'Fakturační kontakt', false),
  };
}

export function parseBranchInput(input: unknown) {
  const body = record(input);
  const latitudeRaw = body.latitude === undefined || body.latitude === null || body.latitude === '' ? null : Number(body.latitude);
  const longitudeRaw = body.longitude === undefined || body.longitude === null || body.longitude === '' ? null : Number(body.longitude);
  if ((latitudeRaw === null) !== (longitudeRaw === null)) {
    throw new CrmClientValidationError('Souřadnice pobočky musí obsahovat zeměpisnou šířku i délku.');
  }
  if (latitudeRaw !== null && (!Number.isFinite(latitudeRaw) || latitudeRaw < -90 || latitudeRaw > 90)) {
    throw new CrmClientValidationError('Zeměpisná šířka pobočky není platná.');
  }
  if (longitudeRaw !== null && (!Number.isFinite(longitudeRaw) || longitudeRaw < -180 || longitudeRaw > 180)) {
    throw new CrmClientValidationError('Zeměpisná délka pobočky není platná.');
  }
  return {
    name: text(body.name, 'Název pobočky', 200, true)!,
    code: text(body.code, 'Kód pobočky', 60),
    street: text(body.street, 'Ulice pobočky', 200),
    city: text(body.city, 'Město pobočky', 120),
    zip: text(body.zip, 'PSČ pobočky', 20),
    country: country(body.country, 'Země pobočky') || 'CZ',
    latitude: latitudeRaw,
    longitude: longitudeRaw,
    contactPersonId: text(body.contactPersonId, 'Kontaktní osoba pobočky', 64),
    openingHoursNote: text(body.openingHoursNote, 'Otevírací doba', 1_000),
    note: text(body.note, 'Poznámka pobočky', 5_000),
  };
}

export function parseClientListQuery(searchParams: URLSearchParams) {
  const q = text(searchParams.get('q'), 'Hledaný text', 120);
  const status = enumValue(searchParams.get('status'), Object.values(ClientStatus), 'Stav klienta');
  const clientType = enumValue(searchParams.get('clientType'), Object.values(ClientType), 'Typ klienta');
  const assignedUserId = text(searchParams.get('assignedUserId'), 'Přiřazený uživatel', 64);
  const pageRaw = searchParams.get('page') || '1';
  const pageSizeRaw = searchParams.get('pageSize') || '100';
  if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(pageSizeRaw)) throw new CrmClientValidationError('Stránkování není platné.');
  const page = Number(pageRaw);
  const pageSize = Number(pageSizeRaw);
  if (page < 1 || pageSize < 1 || pageSize > 100) throw new CrmClientValidationError('Stránkování není platné.');
  return { q, status, clientType, assignedUserId, page, pageSize };
}

export function parseCommunicationInput(input: unknown) {
  const body = record(input);
  const nextContactDateText = text(body.nextContactDate, 'Datum dalšího kontaktu', 40);
  const nextContactDate = nextContactDateText ? new Date(nextContactDateText) : null;
  if (nextContactDate && Number.isNaN(nextContactDate.getTime())) {
    throw new CrmClientValidationError('Datum dalšího kontaktu není platné.');
  }
  return {
    contactId: text(body.contactId, 'Kontakt', 64),
    crmOrderId: text(body.crmOrderId, 'Zakázka', 64),
    type: enumValue(body.type, Object.values(CommunicationType), 'Typ komunikace') || CommunicationType.PHONE_CALL,
    subject: text(body.subject, 'Předmět', 200, true)!,
    content: text(body.content, 'Obsah', 20_000, true)!,
    result: text(body.result, 'Výsledek', 5_000),
    nextStep: text(body.nextStep, 'Další krok', 5_000),
    nextContactDate,
    isInternal: booleanValue(body.isInternal, 'Interní záznam', false),
  };
}
