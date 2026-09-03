export const NAVIGATION_REPORT_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'SENT', 'ARCHIVED'] as const;

export type NavigationReportStatusValue = (typeof NAVIGATION_REPORT_STATUSES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NavigationDocumentationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NavigationDocumentationValidationError';
  }
}

export function isPublicNavigationReportStatus(status: string): boolean {
  return status === 'PUBLISHED' || status === 'SENT';
}

export function assertPublicNavigationReport(status: string, tokenExpiresAt: Date | null, now = new Date()): void {
  if (!isPublicNavigationReportStatus(status)) {
    throw new NavigationDocumentationValidationError('Report není publikovaný.');
  }
  if (!tokenExpiresAt || tokenExpiresAt.getTime() <= now.getTime()) {
    throw new NavigationDocumentationValidationError('Veřejný odkaz není platný.');
  }
}

export function parseNavigationReportStatus(value: unknown): NavigationReportStatusValue {
  if (typeof value !== 'string' || !NAVIGATION_REPORT_STATUSES.includes(value as NavigationReportStatusValue)) {
    throw new NavigationDocumentationValidationError('Neplatný stav reportu.');
  }
  return value as NavigationReportStatusValue;
}

export function parseQuarter(value: unknown): number {
  const quarter = Number(value);
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new NavigationDocumentationValidationError('Čtvrtletí musí být číslo 1 až 4.');
  }
  return quarter;
}

export function parseReportYear(value: unknown): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new NavigationDocumentationValidationError('Rok musí být v rozmezí 2000 až 2100.');
  }
  return year;
}

export function parseRequiredText(value: unknown, label: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new NavigationDocumentationValidationError(`${label} je povinný.`);
  if (text.length > maxLength) throw new NavigationDocumentationValidationError(`${label} je příliš dlouhý.`);
  return text;
}

export function parseOptionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (text.length > maxLength) throw new NavigationDocumentationValidationError(`${label} je příliš dlouhý.`);
  return text || null;
}

export function parseRecipientEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new NavigationDocumentationValidationError('Zadejte platnou e-mailovou adresu příjemce.');
  }
  return email;
}

export function parseTokenExpiry(value: unknown, now = new Date()): Date {
  const fallback = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = new Date(String(value));
  const max = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(parsed.getTime()) || parsed <= now || parsed > max) {
    throw new NavigationDocumentationValidationError('Platnost odkazu musí být v budoucnu, nejvýše jeden rok.');
  }
  return parsed;
}

export function isClientApprovedPhoto(photo: { isPrivate?: boolean; isClientVisible?: boolean } | null | undefined): boolean {
  return Boolean(photo && photo.isPrivate !== true && photo.isClientVisible === true);
}
