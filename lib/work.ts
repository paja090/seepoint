import type { WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';
export type { WorkOrderStatus, WorkPriority, WorkType };

export const workRequesters = ['MAREK', 'MIREK', 'VLAĎKA', 'SILVA', 'ZUZANA'] as const;

export const workStatusLabels: Record<WorkOrderStatus, string> = {
  NEW: 'Nový',
  PLANNED: 'Naplánovaný',
  HANDED_OVER: 'Předaný pracovníkům',
  IN_PROGRESS: 'Probíhá',
  DONE: 'Hotový',
  CANCELLED: 'Zrušený',
};

export type WorkScope = 'WORKSHOP' | 'FIELD';

export const workScopeLabels: Record<WorkScope, string> = {
  WORKSHOP: 'Dílna / Tisk / DTP',
  FIELD: 'Výjezd / Montáž v terénu',
};

import { DEFAULT_WORK_CATEGORIES, type WorkCategory } from './work-categories';
export type { WorkCategory };
export const agencyWorkCategories = DEFAULT_WORK_CATEGORIES;

export const workPriorityLabels: Record<WorkPriority, string> = {
  LOW: 'Nízká',
  NORMAL: 'Běžná',
  HIGH: 'Vysoká',
  URGENT: 'Urgentní',
};

export const workPriorityStyles: Record<WorkPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
  NORMAL: 'bg-sky-100 text-sky-800 ring-sky-200',
  HIGH: 'bg-orange-100 text-orange-800 ring-orange-300',
  URGENT: 'bg-red-100 text-red-800 ring-red-300',
};

export const workTypeLabels: Record<WorkType, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava',
  CHECK: 'Kontrola',
  TRANSPORT: 'Převoz',
  OTHER: 'Jiná práce',
};

export const workStatusStyles: Record<WorkOrderStatus, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  PLANNED: 'bg-blue-100 text-blue-800',
  HANDED_OVER: 'bg-violet-100 text-violet-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function formatWorkDate(value: Date | string) {
  const date =
    typeof value === 'string'
      ? new Date(value.includes('T') ? value : `${value}T12:00:00`)
      : value;
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  return new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
}

export function formatWorkPrice(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Cena neuvedena';
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 }).format(Number(value));
}

/**
 * Resolves Google Drive link from either a full URL, raw drive ID, or folder name.
 * Handles Czech folder naming conventions from Google Sheets (e.g. "04 01 Promed optic 1 ks deinstalace").
 */
export function resolveGoogleDriveUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // 1. Full HTTP/HTTPS URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // 2. Starts with drive.google.com or docs.google.com (missing scheme)
  if (/^(drive|docs)\.google\.com/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // 3. Raw Google Drive folder/file ID (25-50 characters alphanumeric, dashes, underscores)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return `https://drive.google.com/drive/folders/${trimmed}`;
  }

  // 4. Folder name / search query (e.g. "04 01 Promed optic 1 ks deinstalace")
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(trimmed)}`;
}

/**
 * Returns human-friendly label for Google Drive folder link.
 */
export function formatGoogleDriveLabel(value?: string | null): string {
  if (!value) return 'Otevřít Google Disk ↗';
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return 'Otevřít složku na Google Disku ↗';
  }
  return `Otevřít složku na Disku („${trimmed}“) ↗`;
}

export type WorkOrderInvoicingShape = {
  status: string;
  ftdSent?: boolean;
  invoiced?: boolean;
  invoiceExempt?: boolean;
  ftdSkipped?: boolean;
  ftdUrl?: string | null;
};

/**
 * Extracts normalized workflow flags from WorkOrder.planningConstraints JSON.
 */
export function extractWorkOrderConstraintFlags(planningConstraints: unknown): {
  invoiceExempt: boolean;
  ftdSkipped: boolean;
  completedBySheetColor: boolean;
} {
  if (!planningConstraints || typeof planningConstraints !== 'object' || Array.isArray(planningConstraints)) {
    return { invoiceExempt: false, ftdSkipped: false, completedBySheetColor: false };
  }
  const pc = planningConstraints as Record<string, unknown>;
  return {
    invoiceExempt: pc.invoiceExempt === true,
    ftdSkipped: pc.ftdSkipped === true,
    completedBySheetColor: pc.completedBySheetColor === true,
  };
}

/**
 * Completed/FTD-sent jobs awaiting invoice (excluding cancelled, invoiced, and FAKT = BEZ exempt jobs).
 */
export function isOrderReadyForInvoicing(order: WorkOrderInvoicingShape): boolean {
  return Boolean(
    order.ftdSent &&
    !order.invoiced &&
    !order.invoiceExempt &&
    order.status !== 'CANCELLED'
  );
}

/**
 * Finished (DONE) jobs that are neither invoiced nor marked exempt (FAKT = BEZ) and don't yet have FTD = ANO.
 */
export function isOrderDoneWithoutFtdFlag(order: WorkOrderInvoicingShape): boolean {
  return Boolean(
    order.status === 'DONE' &&
    !order.ftdSent &&
    !order.invoiced &&
    !order.invoiceExempt
  );
}

