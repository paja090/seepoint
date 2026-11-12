import type { PlannerItem, PlannerTask } from './domain';
import { dateInZone, localInstant, plusDays } from './time';

export type ProjectableWorkTask = {
  id: string;
  title: string;
  priority: string;
  dueDate: Date | null;
  scheduledDate: Date | null;
  plannedTimeHours: number | null;
  workOrderId: string | null;
  workOrder?: {
    id: string;
    scheduledAt: Date | null;
    locationNote?: string | null;
    clientName?: string | null;
  } | null;
};

/**
 * Strips diacritics and lowercases Czech/Latin text so diminutive names
 * (e.g. "Vlaďka", "Mirek", "Ondra") can match canonical employee names cleanly.
 */
export function normalizePersonToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const FIRST_NAME_ALIASES: Record<string, string> = {
  vladka: 'vladimira',
  vlada: 'vladimira',
  mirek: 'miroslav',
  mira: 'miroslav',
  ondra: 'ondrej',
  ondrik: 'ondrej',
  honza: 'jan',
  jenik: 'jan',
  pepa: 'josef',
  zuzka: 'zuzana',
  zuza: 'zuzana',
  kuba: 'jakub',
  katka: 'katerina',
  kaca: 'katerina',
  tomas: 'tomas',
  tom: 'tomas',
  pavel: 'pavel',
  paja: 'pavel',
  marek: 'marek',
  jiri: 'jiri',
  jirka: 'jiri',
  michal: 'michal',
  lenka: 'lenka',
  lena: 'lenka',
  sona: 'sona',
};

export const PERSON_DISPLAY_ALIASES: Record<string, string> = {
  sonik: 'Marek Šlapnička',
  mm: 'Miroslav Mec',
  mk: 'Marek Konečný',
  marek: 'Marek Konečný',
};

const PERSON_FULL_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(PERSON_DISPLAY_ALIASES).map(([k, v]) => [k, normalizePersonToken(v)])
);

/**
 * Resolves company shorthand codes/nicknames (Sonik -> Marek Šlapnička,
 * MM -> Miroslav Mec, Marek -> Marek Konečný) to their canonical display name.
 */
export function resolvePersonAliasDisplay(value: string): string | null {
  const norm = normalizePersonToken(value);
  if (!norm) return null;
  return PERSON_DISPLAY_ALIASES[norm] ?? null;
}

/**
 * Resolves shorthand codes/nicknames to a normalized token suitable for exact
 * full-name matching before falling back to first-name buckets.
 */
export function resolveCanonicalPersonToken(value: string): string {
  const norm = normalizePersonToken(value);
  if (!norm) return '';
  return PERSON_FULL_ALIASES[norm] ?? norm;
}

export function canonicalFirstName(firstName: string): string {
  const norm = normalizePersonToken(firstName);
  return FIRST_NAME_ALIASES[norm] ?? norm;
}

/**
 * Extracts explicit wall-clock meeting/delivery times such as "8:30", "9:00", "9:45"
 * from Czech task titles while ignoring numbers like dates or dimensions.
 */
export function extractClockTime(text: string): { hour: number; minute: number } | null {
  if (!text) return null;
  const regex = /(?:^|[\s(–-])([01]?\d|2[0-3]):([0-5]\d)(?=$|[\s).,;–-])/g;
  for (const match of text.matchAll(regex)) {
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (hour >= 6 && hour <= 21) {
      return { hour, minute };
    }
  }
  return null;
}

export function resolveWorkTaskEffectiveDate(task: {
  dueDate: Date | null;
  scheduledDate: Date | null;
  workOrder?: { scheduledAt: Date | null } | null;
}): Date | null {
  return task.dueDate ?? task.scheduledDate ?? task.workOrder?.scheduledAt ?? null;
}

export function projectWorkTaskToPlannerTask(
  task: ProjectableWorkTask,
  canOpenWorkOrder: boolean
): PlannerTask {
  const effectiveDate = resolveWorkTaskEffectiveDate(task);
  const workOrderHref =
    canOpenWorkOrder && task.workOrderId
      ? `/work/${encodeURIComponent(task.workOrderId)}`
      : `/my-tasks?taskId=${encodeURIComponent(task.id)}`;

  return {
    id: task.id,
    sourceKind: 'WORK_TASK',
    title: task.title,
    dueAt: effectiveDate ? effectiveDate.toISOString() : null,
    priority: task.priority,
    href: workOrderHref,
    plannedMinutes: task.plannedTimeHours ? Math.round(Number(task.plannedTimeHours) * 60) : null,
  };
}

export function projectWorkTaskToTimelineItem(
  task: ProjectableWorkTask,
  timezone: string,
  canOpenWorkOrder: boolean,
  hideDetails = false
): PlannerItem | null {
  const effectiveDate = resolveWorkTaskEffectiveDate(task);
  if (!effectiveDate) return null;

  const dayStr = dateInZone(effectiveDate, timezone);
  const clock = extractClockTime(task.title);
  const plannedMins = task.plannedTimeHours ? Math.max(15, Math.min(8 * 60, Math.round(Number(task.plannedTimeHours) * 60))) : null;
  const href =
    !hideDetails && canOpenWorkOrder && task.workOrderId
      ? `/work/${encodeURIComponent(task.workOrderId)}`
      : !hideDetails
      ? `/my-tasks?taskId=${encodeURIComponent(task.id)}`
      : undefined;

  const displayTitle = hideDetails ? 'Plán práce' : task.title;
  const location = !hideDetails && task.workOrder?.locationNote ? task.workOrder.locationNote : undefined;

  if (clock) {
    const hh = String(clock.hour).padStart(2, '0');
    const mm = String(clock.minute).padStart(2, '0');
    const start = localInstant(dayStr, `${hh}:${mm}`, timezone);
    const durationMins = plannedMins ?? 30;
    const end = new Date(+start + durationMins * 60000);
    return {
      id: `work-task:${task.id}`,
      title: displayTitle,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      source: 'WORK_PLAN',
      busy: true,
      allDay: false,
      ...(location ? { location } : {}),
      ...(href ? { href } : {}),
    };
  }

  if (plannedMins !== null) {
    const start = localInstant(dayStr, '08:00', timezone);
    const end = new Date(+start + plannedMins * 60000);
    return {
      id: `work-task:${task.id}`,
      title: displayTitle,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      source: 'WORK_PLAN',
      busy: true,
      allDay: false,
      ...(location ? { location } : {}),
      ...(href ? { href } : {}),
    };
  }

  return {
    id: `work-task:${task.id}`,
    title: displayTitle,
    startAt: localInstant(dayStr, '00:00', timezone).toISOString(),
    endAt: localInstant(plusDays(dayStr, 1), '00:00', timezone).toISOString(),
    source: 'WORK_PLAN',
    busy: false,
    allDay: true,
    ...(location ? { location } : {}),
    ...(href ? { href } : {}),
  };
}

/**
 * Orders tasks so today's and imminent upcoming work always surface ahead of
 * distant future weeks or stale backlog, keeping Priority actionable.
 */
export function sortPlannerTasks(tasks: PlannerTask[], todayDate: string, timezone: string): PlannerTask[] {
  const rankBucket = (task: PlannerTask) => {
    if (!task.dueAt) return 3;
    const d = dateInZone(new Date(task.dueAt), timezone);
    if (d === todayDate) return 0;
    if (d > todayDate) return 1;
    return 2; // overdue
  };

  return [...tasks].sort((a, b) => {
    const bucketDiff = rankBucket(a) - rankBucket(b);
    if (bucketDiff !== 0) return bucketDiff;

    const bucket = rankBucket(a);
    if (bucket === 2 && a.dueAt && b.dueAt) {
      // Most recently overdue first so stale months-old items don't bury yesterday's work.
      return b.dueAt.localeCompare(a.dueAt);
    }
    if (a.dueAt && b.dueAt) {
      const timeDiff = a.dueAt.localeCompare(b.dueAt);
      if (timeDiff !== 0) return timeDiff;
    }
    return a.title.localeCompare(b.title, 'cs');
  });
}

export function buildPlannerAttentionItems(params: {
  tasks: PlannerTask[];
  todayDate: string;
  tomorrowDate: string;
  timezone: string;
  hasCollision: boolean;
  unassignedOrdersCount?: number;
}): Array<{ title: string; reason: string; href: string }> {
  const { tasks, todayDate, tomorrowDate, timezone, hasCollision, unassignedOrdersCount = 0 } = params;
  const items: Array<{ title: string; reason: string; href: string }> = [];

  if (hasCollision) {
    items.push({
      title: 'Časová kolize v plánu',
      reason: 'Dvě události se překrývají.',
      href: '/planner',
    });
  }

  if (unassignedOrdersCount > 0) {
    items.push({
      title: `${unassignedOrdersCount} zakázek v Plánu práce bez přiřazeného pracovníka`,
      reason: 'Dnes nebo zítra · vyžaduje přiřazení',
      href: '/work',
    });
  }

  const dueToday = tasks.filter((t) => t.dueAt && dateInZone(new Date(t.dueAt), timezone) === todayDate);
  const dueTomorrow = tasks.filter((t) => t.dueAt && dateInZone(new Date(t.dueAt), timezone) === tomorrowDate);
  const overdue = tasks
    .filter((t) => t.dueAt && dateInZone(new Date(t.dueAt), timezone) < todayDate)
    .sort((a, b) => (b.dueAt || '').localeCompare(a.dueAt || ''));

  for (const t of dueToday.slice(0, 3)) {
    items.push({ title: t.title, reason: 'Dnes v plánu', href: t.href });
  }
  for (const t of dueTomorrow.slice(0, 2)) {
    items.push({ title: t.title, reason: 'Zítra v plánu', href: t.href });
  }
  for (const t of overdue.slice(0, 2)) {
    const formatted = new Date(t.dueAt!).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      timeZone: timezone,
    });
    items.push({ title: t.title, reason: `Po termínu (${formatted})`, href: t.href });
  }

  return items.slice(0, 6);
}
