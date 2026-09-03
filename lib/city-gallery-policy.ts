import { CityGalleryProjectStatus } from '@prisma/client';

export const CITY_GALLERY_PERMIT_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
export type CityGalleryPermitStatus = typeof CITY_GALLERY_PERMIT_STATUSES[number];

export class CityGalleryValidationError extends Error {
  constructor(message: string, readonly code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'CityGalleryValidationError';
  }
}

const MAX_TEXT: Record<string, number> = {
  title: 180,
  city: 100,
  locality: 180,
  address: 300,
  description: 4000,
  permitNumber: 120,
  permitNote: 2000,
  cityOfficialContact: 300,
  organizerName: 180,
  artistName: 180,
};

function cleanText(value: unknown, field: keyof typeof MAX_TEXT, label: string, required = false) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new CityGalleryValidationError(`${label} musí být text.`);
  }
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw new CityGalleryValidationError(`${label} je povinný údaj.`);
  if (result.length > MAX_TEXT[field]) throw new CityGalleryValidationError(`${label} je příliš dlouhý.`);
  return result || null;
}

function dateOnly(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CityGalleryValidationError(`${label} musí být platné datum.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new CityGalleryValidationError(`${label} musí být platné datum.`);
  }
  return parsed;
}

export function parseCityGalleryProjectStatus(value: unknown) {
  if (typeof value !== 'string' || !Object.values(CityGalleryProjectStatus).includes(value as CityGalleryProjectStatus)) {
    throw new CityGalleryValidationError('Neplatný stav projektu Galerie venku.');
  }
  return value as CityGalleryProjectStatus;
}

function permitStatus(value: unknown) {
  if (typeof value !== 'string' || !CITY_GALLERY_PERMIT_STATUSES.includes(value as CityGalleryPermitStatus)) {
    throw new CityGalleryValidationError('Neplatný stav povolení projektu.');
  }
  return value as CityGalleryPermitStatus;
}

export function parseCityGalleryProjectInput(raw: unknown, defaults?: { status: CityGalleryProjectStatus }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CityGalleryValidationError('Data projektu nejsou platná.');
  const input = raw as Record<string, unknown>;
  const frameCount = input.frameCount === undefined ? 6 : Number(input.frameCount);
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 10_000) {
    throw new CityGalleryValidationError('Počet nosičů musí být celé číslo od 1 do 10 000.');
  }
  const nextStatus = parseCityGalleryProjectStatus(input.status ?? defaults?.status ?? 'DRAFT');
  const nextPermitStatus = permitStatus(input.permitStatus ?? 'SUBMITTED');
  const permitValidFrom = dateOnly(input.permitValidFrom, 'Začátek platnosti povolení');
  const permitValidTo = dateOnly(input.permitValidTo, 'Konec platnosti povolení');
  const dateFrom = dateOnly(input.dateFrom, 'Začátek projektu');
  const dateTo = dateOnly(input.dateTo, 'Konec projektu');
  if (permitValidFrom && permitValidTo && permitValidFrom > permitValidTo) {
    throw new CityGalleryValidationError('Začátek platnosti povolení musí být před jeho koncem.');
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new CityGalleryValidationError('Začátek projektu musí být před jeho koncem.');
  }
  if (nextStatus === 'ACTIVE' && nextPermitStatus !== 'APPROVED') {
    throw new CityGalleryValidationError('Aktivní projekt musí mít schválené povolení.', 'PERMIT_REQUIRED');
  }
  if (nextStatus === 'ACTIVE' && (!permitValidFrom || !permitValidTo)) {
    throw new CityGalleryValidationError('Aktivní projekt musí mít vyplněnou platnost povolení.', 'PERMIT_REQUIRED');
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (nextStatus === 'ACTIVE' && permitValidFrom && permitValidFrom > today) {
    throw new CityGalleryValidationError('Projekt nelze aktivovat před začátkem platnosti povolení.', 'PERMIT_NOT_ACTIVE');
  }
  if (nextStatus === 'ACTIVE' && permitValidTo && permitValidTo < today) {
    throw new CityGalleryValidationError('Projekt nelze aktivovat s propadlým povolením.', 'PERMIT_EXPIRED');
  }
  return {
    title: cleanText(input.title, 'title', 'Název projektu', true)!,
    status: nextStatus,
    city: cleanText(input.city, 'city', 'Město') ?? 'Ostrava',
    locality: cleanText(input.locality, 'locality', 'Lokalita'),
    address: cleanText(input.address, 'address', 'Adresa'),
    description: cleanText(input.description, 'description', 'Popis'),
    frameCount,
    permitStatus: nextPermitStatus,
    permitNumber: cleanText(input.permitNumber, 'permitNumber', 'Číslo povolení'),
    permitValidFrom,
    permitValidTo,
    permitNote: cleanText(input.permitNote, 'permitNote', 'Poznámka k povolení'),
    cityOfficialContact: cleanText(input.cityOfficialContact, 'cityOfficialContact', 'Kontakt na úředníka'),
    organizerName: cleanText(input.organizerName, 'organizerName', 'Pořadatel'),
    artistName: cleanText(input.artistName, 'artistName', 'Autor'),
    dateFrom,
    dateTo,
  };
}

const ALLOWED_TRANSITIONS: Record<CityGalleryProjectStatus, readonly CityGalleryProjectStatus[]> = {
  DRAFT: ['DRAFT', 'PLANNED', 'ARCHIVED'],
  PLANNED: ['DRAFT', 'PLANNED', 'ACTIVE', 'ARCHIVED'],
  ACTIVE: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['COMPLETED', 'ARCHIVED'],
  ARCHIVED: ['ARCHIVED'],
};

export function assertCityGalleryStatusTransition(from: CityGalleryProjectStatus, to: CityGalleryProjectStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new CityGalleryValidationError(`Projekt nelze převést ze stavu ${from} do stavu ${to}.`, 'INVALID_STATUS_TRANSITION');
  }
}

export function assertCityGalleryActivation(input: {
  permitStatus: string | null;
  permitValidFrom: Date | null;
  permitValidTo: Date | null;
}) {
  if (input.permitStatus !== 'APPROVED' || !input.permitValidFrom || !input.permitValidTo) {
    throw new CityGalleryValidationError('Aktivní projekt musí mít schválené povolení a vyplněnou jeho platnost.', 'PERMIT_REQUIRED');
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (input.permitValidFrom > today) {
    throw new CityGalleryValidationError('Projekt nelze aktivovat před začátkem platnosti povolení.', 'PERMIT_NOT_ACTIVE');
  }
  if (input.permitValidTo < today) {
    throw new CityGalleryValidationError('Projekt nelze aktivovat s propadlým povolením.', 'PERMIT_EXPIRED');
  }
}

export function parseCityGalleryFleetInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CityGalleryValidationError('Data fondu nosičů nejsou platná.');
  const input = raw as Record<string, unknown>;
  const totalFrames = Number(input.totalFrames);
  const maintenanceCount = Number(input.maintenanceCount ?? 0);
  if (!Number.isInteger(totalFrames) || totalFrames < 1 || totalFrames > 100_000) {
    throw new CityGalleryValidationError('Celkový počet nosičů musí být celé číslo od 1 do 100 000.');
  }
  if (!Number.isInteger(maintenanceCount) || maintenanceCount < 0 || maintenanceCount > totalFrames) {
    throw new CityGalleryValidationError('Počet nosičů v údržbě musí být celé číslo mezi 0 a celkovým fondem.');
  }
  return { totalFrames, maintenanceCount };
}
