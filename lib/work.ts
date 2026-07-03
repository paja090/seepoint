import type { WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';

export const workRequesters = ['MAREK', 'MIREK', 'VLAĎKA', 'SILVA', 'ZUZANA'] as const;

export const workStatusLabels: Record<WorkOrderStatus, string> = {
  NEW: 'Nový',
  PLANNED: 'Naplánovaný',
  HANDED_OVER: 'Předaný pracovníkům',
  IN_PROGRESS: 'Probíhá',
  DONE: 'Hotový',
  CANCELLED: 'Zrušený',
};

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

export function formatWorkDate(value: Date) {
  return new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }).format(value);
}

export function formatWorkPrice(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Cena neuvedena';
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 }).format(Number(value));
}
