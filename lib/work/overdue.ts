export interface OverdueOrderInput {
  status: string;
  scheduledAt: Date | string;
  deadlineAt?: Date | string | null;
}

export interface WorkOrderOverdueInfo {
  isOverdue: boolean;
  overdueDays: number;
  overdueSource: 'scheduled' | 'deadline' | null;
}

export interface WorkOrderEmailActionSummary {
  action: 'COMPLETED' | 'RESCHEDULED' | 'REPORTED_UNFINISHED';
  label: string;
  actorName: string | null;
  at: string | null;
  reason: string | null;
}

const CLOSED_STATUSES = new Set(['DONE', 'CANCELLED']);

function toLocalDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Unified definition of whether a work order is overdue across all Work Plan views,
 * notifications, dashboards, and briefings.
 *
 * An open work order (status not DONE / CANCELLED) is overdue if:
 *  - its scheduled day (`scheduledAt`) is strictly before today's start, OR
 *  - its explicit `deadlineAt` has already passed (`deadlineAt < now`).
 */
export function getWorkOrderOverdueInfo(
  order: OverdueOrderInput,
  now: Date = new Date()
): WorkOrderOverdueInfo {
  if (CLOSED_STATUSES.has(order.status)) {
    return { isOverdue: false, overdueDays: 0, overdueSource: null };
  }

  const todayStart = toLocalDayStart(now);
  const scheduledDate = order.scheduledAt instanceof Date ? order.scheduledAt : new Date(order.scheduledAt);
  const deadlineDate =
    order.deadlineAt == null
      ? null
      : order.deadlineAt instanceof Date
      ? order.deadlineAt
      : new Date(order.deadlineAt);

  const scheduledValid = !Number.isNaN(scheduledDate.getTime());
  const deadlineValid = deadlineDate !== null && !Number.isNaN(deadlineDate.getTime());

  const scheduledDayStart = scheduledValid ? toLocalDayStart(scheduledDate) : null;
  const isScheduledOverdue = scheduledDayStart !== null && scheduledDayStart.getTime() < todayStart.getTime();
  const isDeadlineOverdue = deadlineValid && deadlineDate!.getTime() < now.getTime();

  if (!isScheduledOverdue && !isDeadlineOverdue) {
    return { isOverdue: false, overdueDays: 0, overdueSource: null };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const scheduledDays = isScheduledOverdue
    ? Math.max(1, Math.round((todayStart.getTime() - scheduledDayStart!.getTime()) / msPerDay))
    : 0;
  const deadlineDays = isDeadlineOverdue
    ? Math.max(1, Math.ceil((now.getTime() - deadlineDate!.getTime()) / msPerDay))
    : 0;

  if (isDeadlineOverdue && deadlineDays >= scheduledDays) {
    return { isOverdue: true, overdueDays: deadlineDays, overdueSource: 'deadline' };
  }
  return { isOverdue: true, overdueDays: scheduledDays, overdueSource: 'scheduled' };
}

export function isWorkOrderOverdue(order: OverdueOrderInput, now: Date = new Date()): boolean {
  return getWorkOrderOverdueInfo(order, now).isOverdue;
}

export function formatOverdueDaysLabel(days: number): string {
  if (days <= 1) return '1 den';
  if (days >= 2 && days <= 4) return `${days} dny`;
  return `${days} dní`;
}

/**
 * Extracts structured email-action metadata from `WorkOrder.planningConstraints`
 * so all Work Plan views can clearly show when an order was completed, rescheduled,
 * or reported unfinished via e-mail.
 */
export function extractWorkOrderEmailAction(
  planningConstraints: unknown
): WorkOrderEmailActionSummary | null {
  if (
    !planningConstraints ||
    typeof planningConstraints !== 'object' ||
    Array.isArray(planningConstraints)
  ) {
    return null;
  }

  const pc = planningConstraints as Record<string, unknown>;
  const rawAction = typeof pc.lastEmailAction === 'string' ? pc.lastEmailAction : null;
  if (
    rawAction !== 'COMPLETED' &&
    rawAction !== 'RESCHEDULED' &&
    rawAction !== 'REPORTED_UNFINISHED'
  ) {
    return null;
  }

  const actorName =
    typeof pc.lastWorkerReportBy === 'string' && pc.lastWorkerReportBy.trim()
      ? pc.lastWorkerReportBy.trim()
      : null;
  const at =
    typeof pc.lastWorkerReportAt === 'string' && pc.lastWorkerReportAt.trim()
      ? pc.lastWorkerReportAt.trim()
      : null;
  const reason =
    typeof pc.lastWorkerReason === 'string' && pc.lastWorkerReason.trim()
      ? pc.lastWorkerReason.trim()
      : typeof pc.lastWorkerNote === 'string' && pc.lastWorkerNote.trim()
      ? pc.lastWorkerNote.trim()
      : null;

  const label =
    rawAction === 'COMPLETED'
      ? 'Dokončeno z e-mailu'
      : rawAction === 'RESCHEDULED'
      ? 'Přesunuto z e-mailu'
      : 'Hlášení z e-mailu (nestihlo se)';

  return {
    action: rawAction,
    label,
    actorName,
    at,
    reason,
  };
}
