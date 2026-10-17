export type StatWorkItemInput = {
  remunerationMethod?: string | null;
  rateType?: string | null;
  quantity?: string | number | null;
  unit?: string | null;
  calculatedAmount?: string | number | null;
  amount?: string | number | null;
  workType?: string | null;
  carrierTypeLabel?: string | null;
  taskTitle?: string | null;
  workTask?: { title?: string | null } | null;
  task?: { title?: string | null } | null;
  workOrder?: { title?: string | null } | null;
  description?: string | null;
};

export type ActivityBreakdownRow = {
  activity: string;
  entriesCount: number;
  hours: number;
  taskUnits: number;
  fixedCount: number;
  totalAmount: number;
  sharePercent: number;
};

export type WorkStatisticsSummary = {
  entriesCount: number;
  totalHours: number;
  totalTaskUnits: number;
  totalFixedJobs: number;
  totalWorkAmount: number;
  hourlyAmount: number;
  taskAmount: number;
  fixedAmount: number;
  byActivity: ActivityBreakdownRow[];
};

const WORK_TYPE_FALLBACK_LABELS: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava / Servis',
  CHECK: 'Kontrola / Zaměření',
  TRANSPORT: 'Doprava / Převoz',
  OTHER: 'Ostatní práce',
};

export const OTHER_COST_PRESETS = [
  {
    key: 'COMPANY_CAR',
    label: 'Využití služebního auta',
    icon: '🚗',
    category: 'FUEL',
    defaultDirection: 'DEDUCTION' as const,
    placeholderAmount: '1500',
    hint: 'Srážka za soukromé km / využití firemního vozu nebo náhrada',
  },
  {
    key: 'RENT',
    label: 'Nájem (dílna / vybavení)',
    icon: '🏢',
    category: 'RENT',
    defaultDirection: 'DEDUCTION' as const,
    placeholderAmount: '3000',
    hint: 'Pronájem dílny, skladu, plošiny nebo nářadí',
  },
  {
    key: 'PHONE',
    label: 'Telefon / Tarif',
    icon: '📱',
    category: 'PHONE',
    defaultDirection: 'DEDUCTION' as const,
    placeholderAmount: '500',
    hint: 'Firemní tarif, telefon nebo příspěvek na telefon',
  },
  {
    key: 'FUEL_PARKING',
    label: 'Palivo / Parkovné',
    icon: '⛽',
    category: 'FUEL',
    defaultDirection: 'REIMBURSEMENT' as const,
    placeholderAmount: '1200',
    hint: 'Proplacení tankování nebo parkovného na výjezdu',
  },
  {
    key: 'MATERIAL',
    label: 'Materiál / Nákup',
    icon: '🧰',
    category: 'PURCHASE',
    defaultDirection: 'REIMBURSEMENT' as const,
    placeholderAmount: '850',
    hint: 'Nákup spojovacího materiálu, lepidla, nářadí v terénu',
  },
  {
    key: 'ADVANCE',
    label: 'Záloha',
    icon: '💵',
    category: 'OTHER',
    defaultDirection: 'ADVANCE' as const,
    placeholderAmount: '5000',
    hint: 'Vyplacená záloha (odečítá se z konečné částky k výplatě)',
  },
  {
    key: 'BONUS',
    label: 'Prémie / Odmena',
    icon: '⭐',
    category: 'OTHER',
    defaultDirection: 'BONUS' as const,
    placeholderAmount: '2000',
    hint: 'Mimořádná odměna nebo příplatek ke mzdě',
  },
] as const;

export function resolveActivityName(item: StatWorkItemInput): string {
  const fromCarrierLabel = item.carrierTypeLabel?.trim();
  if (fromCarrierLabel) return fromCarrierLabel;

  const fromTaskTitle = item.taskTitle?.trim();
  if (fromTaskTitle) return fromTaskTitle;

  const fromWorkTask = item.workTask?.title?.trim();
  if (fromWorkTask) return fromWorkTask;

  const fromTask = item.task?.title?.trim();
  if (fromTask) return fromTask;

  const fromOrder = item.workOrder?.title?.trim();
  if (fromOrder) return fromOrder;

  const fromDesc = item.description?.trim();
  if (fromDesc && !fromDesc.startsWith('Práce ')) return fromDesc;

  if (item.workType && WORK_TYPE_FALLBACK_LABELS[item.workType]) {
    return WORK_TYPE_FALLBACK_LABELS[item.workType];
  }

  return 'Ostatní práce';
}

export function computeWorkStatistics(items: StatWorkItemInput[]): WorkStatisticsSummary {
  let totalHours = 0;
  let totalTaskUnits = 0;
  let totalFixedJobs = 0;
  let totalWorkAmount = 0;
  let hourlyAmount = 0;
  let taskAmount = 0;
  let fixedAmount = 0;

  const map = new Map<
    string,
    {
      activity: string;
      entriesCount: number;
      hours: number;
      taskUnits: number;
      fixedCount: number;
      totalAmount: number;
    }
  >();

  for (const item of items) {
    const method = (item.remunerationMethod || item.rateType || 'HOURLY').toUpperCase();
    const qty = Number(item.quantity ?? 0) || 0;
    const amt = Number(item.calculatedAmount ?? item.amount ?? 0) || 0;
    const unit = (item.unit || '').toLowerCase();
    const activity = resolveActivityName(item);

    totalWorkAmount += amt;

    let itemHours = 0;
    let itemTaskUnits = 0;
    let itemFixedCount = 0;

    if (method === 'HOURLY' || unit === 'hod' || unit === 'h') {
      itemHours = qty;
      totalHours += qty;
      hourlyAmount += amt;
    } else if (method === 'FIXED') {
      itemFixedCount = 1;
      totalFixedJobs += 1;
      fixedAmount += amt;
    } else {
      itemTaskUnits = qty;
      totalTaskUnits += qty;
      taskAmount += amt;
    }

    const existing = map.get(activity) || {
      activity,
      entriesCount: 0,
      hours: 0,
      taskUnits: 0,
      fixedCount: 0,
      totalAmount: 0,
    };

    existing.entriesCount += 1;
    existing.hours = Math.round((existing.hours + itemHours) * 100) / 100;
    existing.taskUnits = Math.round((existing.taskUnits + itemTaskUnits) * 100) / 100;
    existing.fixedCount += itemFixedCount;
    existing.totalAmount = Math.round((existing.totalAmount + amt) * 100) / 100;
    map.set(activity, existing);
  }

  totalHours = Math.round(totalHours * 100) / 100;
  totalTaskUnits = Math.round(totalTaskUnits * 100) / 100;
  totalWorkAmount = Math.round(totalWorkAmount * 100) / 100;
  hourlyAmount = Math.round(hourlyAmount * 100) / 100;
  taskAmount = Math.round(taskAmount * 100) / 100;
  fixedAmount = Math.round(fixedAmount * 100) / 100;

  const byActivity: ActivityBreakdownRow[] = Array.from(map.values())
    .sort((a, b) => b.totalAmount - a.totalAmount || b.hours - a.hours)
    .map((row) => ({
      ...row,
      sharePercent:
        totalWorkAmount > 0
          ? Math.round((row.totalAmount / totalWorkAmount) * 1000) / 10
          : items.length > 0
          ? Math.round((row.entriesCount / items.length) * 1000) / 10
          : 0,
    }));

  return {
    entriesCount: items.length,
    totalHours,
    totalTaskUnits,
    totalFixedJobs,
    totalWorkAmount,
    hourlyAmount,
    taskAmount,
    fixedAmount,
    byActivity,
  };
}
