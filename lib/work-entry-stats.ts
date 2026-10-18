export type StatWorkItemInput = {
  remunerationMethod?: string | null;
  rateType?: string | null;
  quantity?: string | number | null;
  unit?: string | null;
  calculatedAmount?: string | number | null;
  amount?: string | number | null;
  workType?: string | null;
  carrierType?: string | null;
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

export type CategoryBreakdownActivityItem = {
  name: string;
  entriesCount: number;
  hours: number;
  taskUnits: number;
  fixedCount: number;
  amount: number;
};

export type CategoryBreakdownRow = {
  key: string;
  label: string;
  icon: string;
  entriesCount: number;
  hours: number;
  taskUnits: number;
  fixedCount: number;
  totalAmount: number;
  sharePercent: number;
  activities: CategoryBreakdownActivityItem[];
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
  byCategory: CategoryBreakdownRow[];
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

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export type MediaCategoryInfo = {
  key: string;
  label: string;
  icon: string;
};

export const MEDIA_CATEGORIES: Record<string, MediaCategoryInfo> = {
  NAVIGATION: { key: 'NAVIGATION', label: 'Navigace & Směrovky', icon: '🧭' },
  BENCH: { key: 'BENCH', label: 'Lavičky & Mobiliář', icon: '🪑' },
  BILLBOARD: { key: 'BILLBOARD', label: 'Billboardy & Plochy', icon: '🖼️' },
  CITYLIGHT: { key: 'CITYLIGHT', label: 'Citylighty & CLV', icon: '🏙️' },
  POSTER: { key: 'POSTER', label: 'Výlep & Plakátování', icon: '📜' },
  BANNER: { key: 'BANNER', label: 'Bannery & Fasády', icon: '🧱' },
  LED: { key: 'LED', label: 'LED obrazovky', icon: '💡' },
  TRANSPORT: { key: 'TRANSPORT', label: 'Doprava & Logistika', icon: '🚚' },
  MAINTENANCE: { key: 'MAINTENANCE', label: 'Údržba & Servis', icon: '🛠️' },
  INSTALLATION: { key: 'INSTALLATION', label: 'Montáže & Konstrukce', icon: '🔧' },
  OTHER: { key: 'OTHER', label: 'Ostatní práce', icon: '📋' },
};

export function resolveMediaCategory(item: StatWorkItemInput): MediaCategoryInfo {
  const rawCarrierType = (item.carrierType || '').toUpperCase();
  const rawWorkType = (item.workType || '').toUpperCase();

  const combined = [
    item.carrierTypeLabel,
    item.taskTitle,
    item.workTask?.title,
    item.task?.title,
    item.workOrder?.title,
    item.description,
    item.workType,
  ]
    .filter(Boolean)
    .join(' ');

  const text = normalizeText(combined);

  // 1. Navigation / Směrovky / Informační značení
  if (
    rawCarrierType === 'NAVIGATION' ||
    /navigac|smerovk|smerov|tabulk|vyvesk|oznacen|rozcestn|sipk|orientac|system znacen|znacen/i.test(text)
  ) {
    return MEDIA_CATEGORIES.NAVIGATION;
  }

  // 2. Benches / Lavičky / Městský mobiliář
  if (
    rawCarrierType === 'PROMO_BENCH' ||
    /lavick|mobiliar|kose|odpadk|stojan|lavic|pristres/i.test(text)
  ) {
    return MEDIA_CATEGORIES.BENCH;
  }

  // 3. Billboards / Bigboards / Mega / Horizon
  if (
    rawCarrierType === 'BILLBOARD' ||
    rawCarrierType === 'BIGBOARD' ||
    rawCarrierType === 'PROMO_HORIZON' ||
    rawCarrierType === 'PROMO_TOWER' ||
    rawCarrierType === 'PROMO_MINITOWER' ||
    /billboard|bilbord|bigboard|megaboard|euroformat|\bbb\b|bb-|reklamni panel|reklamni ploch|ploch/i.test(text)
  ) {
    return MEDIA_CATEGORIES.BILLBOARD;
  }

  // 4. Citylighty / CLV / Vitríny
  if (
    rawCarrierType === 'CITYLIGHT' ||
    /citylight|clv|vitrin|abribus|pylon|totem|prosvet/i.test(text)
  ) {
    return MEDIA_CATEGORIES.CITYLIGHT;
  }

  // 5. Posters / Výlep / Plakátování
  if (
    rawCarrierType === 'CITY_POSTER' ||
    /vylep|lepeni|plakat|prelep|strhavani|vylepovac/i.test(text)
  ) {
    return MEDIA_CATEGORIES.POSTER;
  }

  // 6. Bannery / Fasády / Plachty
  if (
    rawCarrierType === 'BANNER' ||
    rawCarrierType === 'FACADE' ||
    /banner|fasad|placht|stit|stena/i.test(text)
  ) {
    return MEDIA_CATEGORIES.BANNER;
  }

  // 7. LED Obrazovky
  if (
    rawCarrierType === 'LED_SCREEN' ||
    /\bled\b|ledk|obrazovk|displej|display|digital/i.test(text)
  ) {
    return MEDIA_CATEGORIES.LED;
  }

  // 8. Doprava / Logistika
  if (
    rawWorkType === 'TRANSPORT' ||
    /doprav|prevoz|odvoz|rozvoz|nakladk|vykladk|svoz|stehovani|zavoz|vyjezd/i.test(text)
  ) {
    return MEDIA_CATEGORIES.TRANSPORT;
  }

  // 9. Servis / Údržba / Kontrola
  if (
    rawWorkType === 'REPAIR' ||
    rawWorkType === 'CHECK' ||
    /udrzba|oprav|servis|myti|cisteni|nater|lakov|kontrola|zamereni|revize|cist/i.test(text)
  ) {
    return MEDIA_CATEGORIES.MAINTENANCE;
  }

  // 10. Montáže / Instalace
  if (
    rawWorkType === 'INSTALLATION' ||
    rawWorkType === 'REINSTALLATION' ||
    rawWorkType === 'DEINSTALLATION' ||
    /montaz|instalac|demontaz|deinstalac|reinstalac|svareni|kotveni|beton/i.test(text)
  ) {
    return MEDIA_CATEGORIES.INSTALLATION;
  }

  return MEDIA_CATEGORIES.OTHER;
}

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

  const categoryMap = new Map<
    string,
    {
      key: string;
      label: string;
      icon: string;
      entriesCount: number;
      hours: number;
      taskUnits: number;
      fixedCount: number;
      totalAmount: number;
      activityMap: Map<
        string,
        {
          name: string;
          entriesCount: number;
          hours: number;
          taskUnits: number;
          fixedCount: number;
          amount: number;
        }
      >;
    }
  >();

  for (const item of items) {
    const method = (item.remunerationMethod || item.rateType || 'HOURLY').toUpperCase();
    const qty = Number(item.quantity ?? 0) || 0;
    const amt = Number(item.calculatedAmount ?? item.amount ?? 0) || 0;
    const unit = (item.unit || '').toLowerCase();
    const activity = resolveActivityName(item);
    const cat = resolveMediaCategory(item);

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

    // Update by-activity map
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

    // Update by-category map
    let catEntry = categoryMap.get(cat.key);
    if (!catEntry) {
      catEntry = {
        key: cat.key,
        label: cat.label,
        icon: cat.icon,
        entriesCount: 0,
        hours: 0,
        taskUnits: 0,
        fixedCount: 0,
        totalAmount: 0,
        activityMap: new Map(),
      };
      categoryMap.set(cat.key, catEntry);
    }

    catEntry.entriesCount += 1;
    catEntry.hours = Math.round((catEntry.hours + itemHours) * 100) / 100;
    catEntry.taskUnits = Math.round((catEntry.taskUnits + itemTaskUnits) * 100) / 100;
    catEntry.fixedCount += itemFixedCount;
    catEntry.totalAmount = Math.round((catEntry.totalAmount + amt) * 100) / 100;

    let subAct = catEntry.activityMap.get(activity);
    if (!subAct) {
      subAct = {
        name: activity,
        entriesCount: 0,
        hours: 0,
        taskUnits: 0,
        fixedCount: 0,
        amount: 0,
      };
      catEntry.activityMap.set(activity, subAct);
    }
    subAct.entriesCount += 1;
    subAct.hours = Math.round((subAct.hours + itemHours) * 100) / 100;
    subAct.taskUnits = Math.round((subAct.taskUnits + itemTaskUnits) * 100) / 100;
    subAct.fixedCount += itemFixedCount;
    subAct.amount = Math.round((subAct.amount + amt) * 100) / 100;
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

  const byCategory: CategoryBreakdownRow[] = Array.from(categoryMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount || b.hours - a.hours)
    .map((cat) => ({
      key: cat.key,
      label: cat.label,
      icon: cat.icon,
      entriesCount: cat.entriesCount,
      hours: cat.hours,
      taskUnits: cat.taskUnits,
      fixedCount: cat.fixedCount,
      totalAmount: cat.totalAmount,
      sharePercent:
        totalWorkAmount > 0
          ? Math.round((cat.totalAmount / totalWorkAmount) * 1000) / 10
          : items.length > 0
          ? Math.round((cat.entriesCount / items.length) * 1000) / 10
          : 0,
      activities: Array.from(cat.activityMap.values()).sort(
        (a, b) => b.amount - a.amount || b.entriesCount - a.entriesCount
      ),
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
    byCategory,
    byActivity,
  };
}
