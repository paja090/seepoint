import crypto from 'node:crypto';
import { prisma } from '../db';
import {
  resolveGoogleDriveUrl,
  formatGoogleDriveLabel,
  workPriorityLabels,
  workTypeLabels,
} from '../work';
import { dayInZone, zonedTime } from '../field-planning/profile';
import type { PlanningResult } from '../field-planning/contracts';
import { sendTransactionalEmail } from '../email';
import { isValidEmailAddress } from '../email-policy';
import { createBriefingAckToken, czechFirstNameVocative } from './briefing-ack';
import { resolveCanonicalPersonToken } from '../planner/work-projection';

export const DEFAULT_BRIEFING_TIMEZONE = 'Europe/Prague';
export const DEFAULT_BRIEFING_HOUR = 17;

export type DailyBriefingSettings = {
  enabled: boolean;
  sendHourLocal: number;
  timezone: string;
  skipWeekends: boolean;
  recipientMode: 'ALL' | 'SELECTED';
  allowedRecipientEmails: string[];
  notifyChanges: boolean;
};

export type WorkerRecipient = {
  key: string;
  employeeId?: string;
  userId?: string | null;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export type BriefingOrderInput = {
  id: string;
  title: string;
  description: string | null;
  workType: string;
  priority: string;
  status: string;
  scheduledAt: Date;
  clientName: string;
  contactName: string | null;
  contactPhone: string | null;
  locationNote: string | null;
  quantity: number | null;
  mediaLabel: string | null;
  ftdUrl: string | null;
  referenceUrl: string | null;
  pdfUrl: string | null;
  planningConstraints: unknown;
  assignments: Array<{ userId: string | null; workerName: string }>;
};

export type BriefingFieldPlanInput = {
  id: string;
  date: string;
  status: string;
  version: number;
  planningSummary: unknown;
};

export type BriefingTaskItem = {
  id: string;
  workOrderId?: string;
  title: string;
  clientName: string;
  workTypeLabel: string;
  priority: string;
  priorityLabel: string;
  routeOrder?: number;
  scheduledTimeLabel?: string;
  vehicleName?: string | null;
  crewNames: string[];
  quantity?: number | null;
  mediaLabel?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  driveUrl?: string | null;
  driveLabel?: string | null;
  referenceUrl?: string | null;
  pdfUrl?: string | null;
  detailUrl: string;
  ackUrl?: string;
  description?: string | null;
};

export type TodayOpenTaskItem = {
  id: string;
  workOrderId: string;
  title: string;
  clientName: string;
  workTypeLabel: string;
  priority: string;
  priorityLabel: string;
  scheduledTimeLabel?: string;
  address?: string | null;
  detailUrl: string;
  completeUrl?: string;
  rescheduleUrl?: string;
};

export type WorkerDailyBriefing = {
  recipient: WorkerRecipient;
  targetDate: string;
  targetDateLabel: string;
  todayDate?: string;
  todayDateLabel?: string;
  routeUrl?: string;
  myTasksUrl: string;
  ackAllUrl?: string;
  completeAllTodayUrl?: string;
  rescheduleAllTodayUrl?: string;
  vehicles: string[];
  crewMates: string[];
  todayOpenTasks?: TodayOpenTaskItem[];
  tasks: BriefingTaskItem[];
};

export type BriefingAssemblyResult = {
  targetDate: string;
  targetDateLabel: string;
  todayDate?: string;
  todayDateLabel?: string;
  briefings: WorkerDailyBriefing[];
  unmatchedWorkerNames: string[];
};

export type ManagerDigestSettings = {
  enabled: boolean;
  sendHourLocal: number;
  timezone: string;
  skipWeekends: boolean;
};

export type ManagerMorningDigestItem = {
  workOrderId: string;
  title: string;
  clientName: string;
  workerNames: string[];
  status: string;
  detailUrl: string;
  newDateLabel?: string;
  scheduledDateLabel?: string;
  overdueDays?: number;
  workerReason?: string | null;
  reportBy?: string | null;
};

export type ManagerMorningDigestData = {
  auditedDate: string;
  auditedDateLabel: string;
  plannerUrl: string;
  workUrl: string;
  rescheduledItems: ManagerMorningDigestItem[];
  unfinishedItems: ManagerMorningDigestItem[];
  olderOverdueItems?: ManagerMorningDigestItem[];
  completedItems: ManagerMorningDigestItem[];
};

const CZECH_NICKNAMES: Record<string, string[]> = {
  vladimira: ['vladka', 'vlada'],
  miroslav: ['mirek', 'mira'],
  jiri: ['jirka', 'jura'],
  ondrej: ['ondra'],
  pavel: ['paja', 'pavlik'],
  tomas: ['tom', 'tomas'],
  jan: ['honza', 'jenda'],
  josef: ['pepa'],
  frantisek: ['franta'],
  jakub: ['kuba'],
  lukas: ['luky'],
  vaclav: ['vasek', 'venda'],
  petr: ['peta'],
  martin: ['martas'],
  michal: ['misa'],
  zuzana: ['zuzka', 'zuza'],
  katerina: ['kacka', 'katka'],
  tereza: ['terka'],
  silvie: ['silva', 'silvy'],
  silva: ['silvie', 'silvy'],
  karel: ['kaja', 'karlik'],
  stanislav: ['standa'],
  jaroslav: ['jarda'],
  ladislav: ['lada'],
  zdenek: ['zdena'],
  marek: ['mara'],
};

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export const DEFAULT_MANAGER_DIGEST_HOUR = 7;

function sanitizeScheduleSettings(
  input: unknown,
  organizationId: string | undefined,
  defaultHour: number
): ManagerDigestSettings {
  const obj =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const defaultEnabled = organizationId === 'org_seepoint_default';
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : defaultEnabled;

  let sendHourLocal = defaultHour;
  if (typeof obj.sendHourLocal === 'number' && Number.isFinite(obj.sendHourLocal)) {
    sendHourLocal = Math.min(23, Math.max(0, Math.round(obj.sendHourLocal)));
  }

  let timezone = DEFAULT_BRIEFING_TIMEZONE;
  if (typeof obj.timezone === 'string' && obj.timezone.trim()) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: obj.timezone.trim() }).format();
      timezone = obj.timezone.trim();
    } catch {
      timezone = DEFAULT_BRIEFING_TIMEZONE;
    }
  }

  const skipWeekends =
    typeof obj.skipWeekends === 'boolean' ? obj.skipWeekends : false;

  return { enabled, sendHourLocal, timezone, skipWeekends };
}

export function sanitizeDailyBriefingSettings(
  input: unknown,
  organizationId?: string
): DailyBriefingSettings {
  const base = sanitizeScheduleSettings(input, organizationId, DEFAULT_BRIEFING_HOUR);
  const obj =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const recipientMode: 'ALL' | 'SELECTED' =
    obj.recipientMode === 'SELECTED' ? 'SELECTED' : 'ALL';

  const rawEmails = Array.isArray(obj.allowedRecipientEmails) ? obj.allowedRecipientEmails : [];
  const allowedRecipientEmails = [
    ...new Set(
      rawEmails
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => isValidEmailAddress(e))
    ),
  ].sort();

  const notifyChanges = typeof obj.notifyChanges === 'boolean' ? obj.notifyChanges : true;

  return {
    ...base,
    recipientMode,
    allowedRecipientEmails,
    notifyChanges,
  };
}

export function isBriefingRecipientAllowed(
  email: string,
  settings: Pick<DailyBriefingSettings, 'recipientMode' | 'allowedRecipientEmails'>
): boolean {
  if (settings.recipientMode !== 'SELECTED') return true;
  const normalized = email.trim().toLowerCase();
  return settings.allowedRecipientEmails.includes(normalized);
}

export function sanitizeManagerDigestSettings(
  input: unknown,
  organizationId?: string
): ManagerDigestSettings {
  return sanitizeScheduleSettings(input, organizationId, DEFAULT_MANAGER_DIGEST_HOUR);
}

async function getOrgPlannerDefaults(organizationId: string): Promise<Record<string, unknown>> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plannerDefaults: true },
  });
  return (org?.plannerDefaults as Record<string, unknown> | null) || {};
}

export async function getDailyBriefingSettings(
  organizationId: string
): Promise<DailyBriefingSettings> {
  const defaults = await getOrgPlannerDefaults(organizationId);
  return sanitizeDailyBriefingSettings(defaults.dailyWorkerBriefing, organizationId);
}

export async function saveDailyBriefingSettings(
  organizationId: string,
  input: Partial<DailyBriefingSettings>
): Promise<DailyBriefingSettings> {
  const defaults = await getOrgPlannerDefaults(organizationId);
  const current = sanitizeDailyBriefingSettings(defaults.dailyWorkerBriefing, organizationId);
  const merged = sanitizeDailyBriefingSettings({ ...current, ...input }, organizationId);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plannerDefaults: {
        ...defaults,
        dailyWorkerBriefing: merged,
      },
    },
  });

  return merged;
}

export async function getManagerDigestSettings(
  organizationId: string
): Promise<ManagerDigestSettings> {
  const defaults = await getOrgPlannerDefaults(organizationId);
  return sanitizeManagerDigestSettings(defaults.managerMorningDigest, organizationId);
}

export async function saveManagerDigestSettings(
  organizationId: string,
  input: Partial<ManagerDigestSettings>
): Promise<ManagerDigestSettings> {
  const defaults = await getOrgPlannerDefaults(organizationId);
  const current = sanitizeManagerDigestSettings(defaults.managerMorningDigest, organizationId);
  const merged = sanitizeManagerDigestSettings({ ...current, ...input }, organizationId);

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plannerDefaults: {
        ...defaults,
        managerMorningDigest: merged,
      },
    },
  });

  return merged;
}

export function normalizeCzechName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function isDeliverableWorkerEmail(email?: string | null): email is string {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmailAddress(trimmed)) return false;
  if (
    trimmed.endsWith('.invalid') ||
    trimmed.includes('@example.') ||
    trimmed.includes('@test.')
  ) {
    return false;
  }
  return true;
}

export function getLocalHour(now: Date, timezone = DEFAULT_BRIEFING_TIMEZONE): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(now);
  const parsed = Number.parseInt(formatted, 10);
  if (Number.isNaN(parsed)) return 0;
  return parsed === 24 ? 0 : parsed;
}

export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function getTomorrowDateStr(
  now = new Date(),
  timezone = DEFAULT_BRIEFING_TIMEZONE
): string {
  const todayStr = dayInZone(now, timezone);
  return addCalendarDays(todayStr, 1);
}

export function isWeekendDate(dateStr: string): boolean {
  const day = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function getDayBoundsUtc(
  dateStr: string,
  timezone = DEFAULT_BRIEFING_TIMEZONE
): { start: Date; end: Date } {
  const nextDateStr = addCalendarDays(dateStr, 1);
  return {
    start: new Date(zonedTime(dateStr, '00:00', timezone)),
    end: new Date(zonedTime(nextDateStr, '00:00', timezone)),
  };
}

export function formatCzechFullDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const formatted = new Intl.DateTimeFormat('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatClockInZone(iso?: string | null, timezone = DEFAULT_BRIEFING_TIMEZONE): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(d);
}

function getAliasesForFirstName(firstNameNorm: string): string[] {
  const aliases = new Set<string>([firstNameNorm]);
  const direct = CZECH_NICKNAMES[firstNameNorm];
  if (direct) direct.forEach((a) => aliases.add(a));
  for (const [canonical, list] of Object.entries(CZECH_NICKNAMES)) {
    if (list.includes(firstNameNorm)) {
      aliases.add(canonical);
      list.forEach((a) => aliases.add(a));
    }
  }
  return [...aliases];
}

export function matchWorkerAssignment(
  assignment: { userId?: string | null; workerName: string },
  directory: WorkerRecipient[]
): WorkerRecipient[] {
  // 1. Direct userId match
  if (assignment.userId) {
    const byUser = directory.find((r) => r.userId === assignment.userId);
    if (byUser) return [byUser];
  }

  const normQuery = normalizeCzechName(assignment.workerName);
  if (!normQuery) return [];

  // 2. Exact full name or exact email match
  const exactMatches = directory.filter(
    (r) =>
      normalizeCzechName(r.fullName) === normQuery ||
      normalizeCzechName(r.email) === normQuery
  );
  if (exactMatches.length > 0) return exactMatches;

  // 2b. Explicit company shorthand / nickname disambiguation (Sonik -> Marek Šlapnička, MM -> Miroslav Mec, Marek -> Marek Konečný)
  const canonicalAlias = resolveCanonicalPersonToken(assignment.workerName);
  if (canonicalAlias && canonicalAlias !== normQuery) {
    const aliasMatches = directory.filter((r) => normalizeCzechName(r.fullName) === canonicalAlias);
    if (aliasMatches.length > 0) return aliasMatches;
  }

  // 3. Name with surname initial e.g. "Marek S." or "Marek S"
  const initialMatch = normQuery.match(/^([^\s.]+)\s+([a-z])\.?$/);
  if (initialMatch) {
    const [, firstPart, lastInitial] = initialMatch;
    const byInitial = directory.filter((r) => {
      const rFirst = normalizeCzechName(r.firstName);
      const rLast = normalizeCzechName(r.lastName);
      const firstAliases = getAliasesForFirstName(rFirst);
      return firstAliases.includes(firstPart) && rLast.startsWith(lastInitial);
    });
    if (byInitial.length > 0) return byInitial;
  }

  // 4. First name, diminutive alias, or email prefix match
  const firstToken = normQuery.split(/\s+/)[0];
  const tokenMatches = directory.filter((r) => {
    const rFirst = normalizeCzechName(r.firstName);
    const firstAliases = getAliasesForFirstName(rFirst);
    if (firstAliases.includes(firstToken)) return true;

    const localPart = r.email.split('@')[0]?.toLowerCase() || '';
    const emailFirstSegment = localPart.split(/[._-]/)[0];
    return emailFirstSegment === firstToken;
  });

  // Deduplicate by lowercase email
  const uniqueByEmail = new Map<string, WorkerRecipient>();
  for (const r of tokenMatches) {
    uniqueByEmail.set(r.email.toLowerCase(), r);
  }
  return [...uniqueByEmail.values()];
}

function extractCoordinates(planningConstraints: unknown): { latitude: number; longitude: number } | null {
  if (!planningConstraints || typeof planningConstraints !== 'object' || Array.isArray(planningConstraints)) {
    return null;
  }
  const pc = planningConstraints as Record<string, unknown>;
  const nested =
    pc.location && typeof pc.location === 'object' && !Array.isArray(pc.location)
      ? (pc.location as Record<string, unknown>)
      : null;

  const rawLat = pc.latitude ?? nested?.latitude;
  const rawLng = pc.longitude ?? nested?.longitude;
  const latitude = typeof rawLat === 'number' ? rawLat : Number.parseFloat(String(rawLat ?? ''));
  const longitude = typeof rawLng === 'number' ? rawLng : Number.parseFloat(String(rawLng ?? ''));

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  ) {
    return { latitude, longitude };
  }
  return null;
}

function buildGoogleMapsUrl(
  coords: { latitude: number; longitude: number } | null,
  address?: string | null
): string | null {
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
  }
  const cleanAddr = address?.trim();
  if (cleanAddr && cleanAddr.length >= 4 && !/^(bez poznamky|bez poznámky|-)$/i.test(cleanAddr)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
  }
  return null;
}

export function resolvePublicAppUrl(): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
      : '');
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return 'https://seepoint.cz';
}

function buildAckLink(
  organizationId: string | undefined,
  orderIds: string[],
  recipient: WorkerRecipient,
  baseUrl: string
): string | undefined {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))];
  if (!organizationId || uniqueIds.length === 0) return undefined;
  const token = createBriefingAckToken({
    orgId: organizationId,
    orderIds: uniqueIds,
    userId: recipient.userId,
    employeeId: recipient.employeeId,
    workerName: recipient.fullName,
    email: recipient.email,
  });
  return `${baseUrl}/api/work-orders/ack-email?token=${encodeURIComponent(token)}`;
}

export function buildEmailActionLink(
  organizationId: string | undefined,
  orderIdsInput: string | string[],
  action: 'complete' | 'reschedule',
  recipient: WorkerRecipient,
  baseUrl: string,
  focusOrderId?: string
): string | undefined {
  const uniqueIds = [...new Set((Array.isArray(orderIdsInput) ? orderIdsInput : [orderIdsInput]).filter(Boolean))];
  if (!organizationId || uniqueIds.length === 0) return undefined;
  const token = createBriefingAckToken({
    orgId: organizationId,
    orderIds: uniqueIds,
    action,
    userId: recipient.userId,
    employeeId: recipient.employeeId,
    workerName: recipient.fullName,
    email: recipient.email,
    ttlDays: 7,
  });
  const focusParam = focusOrderId ? `&focus=${encodeURIComponent(focusOrderId)}` : '';
  return `${baseUrl}/api/work-orders/email-action?token=${encodeURIComponent(token)}${focusParam}`;
}

export function assembleWorkerBriefings(input: {
  organizationId?: string;
  targetDate: string;
  todayDate?: string;
  orders: BriefingOrderInput[];
  todayOrders?: BriefingOrderInput[];
  fieldPlans: BriefingFieldPlanInput[];
  directory: WorkerRecipient[];
  baseUrl?: string;
  timezone?: string;
}): BriefingAssemblyResult {
  const baseUrl = (input.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');
  const timezone = input.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const targetDateLabel = formatCzechFullDate(input.targetDate);
  const todayDate = input.todayDate || addCalendarDays(input.targetDate, -1);
  const todayDateLabel = formatCzechFullDate(todayDate);

  const ordersById = new Map<string, BriefingOrderInput>();
  for (const order of input.orders) {
    ordersById.set(order.id, order);
  }

  type Bucket = {
    recipient: WorkerRecipient;
    tasks: BriefingTaskItem[];
    todayOpenTasks: TodayOpenTaskItem[];
    coveredWorkOrderIds: Set<string>;
    coveredTodayWorkOrderIds: Set<string>;
    vehicles: Set<string>;
    crewMates: Set<string>;
    hasRoute: boolean;
  };

  const buckets = new Map<string, Bucket>();
  const unmatchedNames = new Set<string>();

  function getOrCreateBucket(recipient: WorkerRecipient): Bucket {
    const key = recipient.email.toLowerCase();
    const existing = buckets.get(key);
    if (existing) return existing;
    const created: Bucket = {
      recipient,
      tasks: [],
      todayOpenTasks: [],
      coveredWorkOrderIds: new Set<string>(),
      coveredTodayWorkOrderIds: new Set<string>(),
      vehicles: new Set<string>(),
      crewMates: new Set<string>(),
      hasRoute: false,
    };
    buckets.set(key, created);
    return created;
  }

  // 1. Process approved/active FieldPlans for tomorrow (take latest version per plan date or iterate active plans)
  const sortedPlans = [...input.fieldPlans].sort((a, b) => b.version - a.version);
  const activePlan = sortedPlans[0];
  if (activePlan && activePlan.planningSummary && typeof activePlan.planningSummary === 'object') {
    const summary = activePlan.planningSummary as Partial<PlanningResult>;
    const crews = Array.isArray(summary.crews) ? summary.crews : [];

    for (const crew of crews) {
      const matchedRecipients = new Map<string, WorkerRecipient>();

      for (const empId of crew.employeeIds || []) {
        const emp = input.directory.find((d) => d.employeeId === empId);
        if (emp) matchedRecipients.set(emp.email.toLowerCase(), emp);
      }

      if (matchedRecipients.size === 0 && Array.isArray(crew.names)) {
        for (const name of crew.names) {
          const matches = matchWorkerAssignment({ workerName: name }, input.directory);
          if (matches.length === 0) unmatchedNames.add(name.trim());
          matches.forEach((m) => matchedRecipients.set(m.email.toLowerCase(), m));
        }
      }

      const stops = Array.isArray(crew.stops) ? [...crew.stops] : [];
      stops.sort((a, b) => (a.routeOrder ?? 999) - (b.routeOrder ?? 999));

      for (const recipient of matchedRecipients.values()) {
        const bucket = getOrCreateBucket(recipient);
        bucket.hasRoute = true;
        if (crew.vehicleName) bucket.vehicles.add(crew.vehicleName);
        for (const mate of crew.names || []) {
          if (normalizeCzechName(mate) !== normalizeCzechName(recipient.fullName)) {
            bucket.crewMates.add(mate);
          }
        }

        for (const stop of stops) {
          const linkedOrderId = stop.workOrderId || stop.parentWorkOrderId || undefined;
          const order = linkedOrderId ? ordersById.get(linkedOrderId) : undefined;
          if (linkedOrderId) bucket.coveredWorkOrderIds.add(linkedOrderId);

          const address = stop.address || order?.locationNote || null;
          const coords = stop.location || extractCoordinates(order?.planningConstraints);
          const driveUrl = resolveGoogleDriveUrl(order?.ftdUrl);

          bucket.tasks.push({
            id: stop.jobId || `stop-${stop.routeOrder}-${linkedOrderId || 'x'}`,
            workOrderId: linkedOrderId,
            title: stop.title || order?.title || 'Terénní zastávka',
            clientName: stop.clientName || order?.clientName || 'Výjezd',
            workTypeLabel:
              workTypeLabels[(stop.workType || order?.workType) as keyof typeof workTypeLabels] ||
              stop.workType ||
              'Výjezd',
            priority: order?.priority || 'NORMAL',
            priorityLabel:
              workPriorityLabels[(order?.priority || 'NORMAL') as keyof typeof workPriorityLabels] ||
              'Normální',
            routeOrder: stop.routeOrder,
            scheduledTimeLabel: formatClockInZone(stop.arrivalAt || stop.startAt, timezone),
            vehicleName: crew.vehicleName || null,
            crewNames: (crew.names || []).filter(
              (n) => normalizeCzechName(n) !== normalizeCzechName(recipient.fullName)
            ),
            quantity: order?.quantity ?? null,
            mediaLabel: order?.mediaLabel ?? null,
            address,
            mapsUrl: buildGoogleMapsUrl(coords, address),
            contactName: order?.contactName ?? null,
            contactPhone: order?.contactPhone ?? null,
            driveUrl,
            driveLabel: driveUrl ? formatGoogleDriveLabel(order?.ftdUrl) : null,
            referenceUrl: order?.referenceUrl ?? null,
            pdfUrl: order?.pdfUrl ?? null,
            detailUrl: linkedOrderId
              ? `${baseUrl}/work/${linkedOrderId}`
              : `${baseUrl}/my-route?date=${input.targetDate}`,
            ackUrl: linkedOrderId
              ? buildAckLink(input.organizationId, [linkedOrderId], recipient, baseUrl)
              : undefined,
            description: order?.description ?? null,
          });
        }
      }
    }
  }

  // 2. Process standalone WorkOrders scheduled for tomorrow
  for (const order of input.orders) {
    if (!order.assignments.length) continue;

    const allWorkerNames = order.assignments.map((a) => a.workerName.trim()).filter(Boolean);

    for (const assignment of order.assignments) {
      const matches = matchWorkerAssignment(assignment, input.directory);
      if (matches.length === 0) {
        if (assignment.workerName.trim()) {
          unmatchedNames.add(assignment.workerName.trim());
        }
        continue;
      }

      for (const recipient of matches) {
        const bucket = getOrCreateBucket(recipient);
        if (bucket.coveredWorkOrderIds.has(order.id)) {
          continue; // Already included cleanly with FieldPlan stop details
        }
        bucket.coveredWorkOrderIds.add(order.id);

        const coWorkers = allWorkerNames.filter(
          (w) =>
            normalizeCzechName(w) !== normalizeCzechName(recipient.fullName) &&
            normalizeCzechName(w) !== normalizeCzechName(recipient.firstName)
        );
        coWorkers.forEach((w) => bucket.crewMates.add(w));

        const coords = extractCoordinates(order.planningConstraints);
        const address = order.locationNote || null;
        const driveUrl = resolveGoogleDriveUrl(order.ftdUrl);

        // Extract explicit time mention from title if present (e.g. "9:00", "8:30")
        const timeMatch = order.title.match(/\b(\d{1,2}:\d{2})\b/);

        bucket.tasks.push({
          id: `order-${order.id}`,
          workOrderId: order.id,
          title: order.title,
          clientName: order.clientName,
          workTypeLabel:
            workTypeLabels[order.workType as keyof typeof workTypeLabels] || order.workType,
          priority: order.priority,
          priorityLabel:
            workPriorityLabels[order.priority as keyof typeof workPriorityLabels] ||
            order.priority,
          scheduledTimeLabel: timeMatch ? timeMatch[1] : undefined,
          vehicleName: null,
          crewNames: coWorkers,
          quantity: order.quantity,
          mediaLabel: order.mediaLabel,
          address,
          mapsUrl: buildGoogleMapsUrl(coords, address),
          contactName: order.contactName,
          contactPhone: order.contactPhone,
          driveUrl,
          driveLabel: driveUrl ? formatGoogleDriveLabel(order.ftdUrl) : null,
          referenceUrl: order.referenceUrl,
          pdfUrl: order.pdfUrl,
          detailUrl: `${baseUrl}/work/${order.id}`,
          ackUrl: buildAckLink(input.organizationId, [order.id], recipient, baseUrl),
          description: order.description,
        });
      }
    }
  }

  // 2b. Process today's open (unfinished) WorkOrders so workers can close/reschedule them in the same email
  for (const order of input.todayOrders ?? []) {
    if (!order.assignments.length) continue;
    for (const assignment of order.assignments) {
      const matches = matchWorkerAssignment(assignment, input.directory);
      for (const recipient of matches) {
        const bucket = getOrCreateBucket(recipient);
        if (bucket.coveredTodayWorkOrderIds.has(order.id)) continue;
        bucket.coveredTodayWorkOrderIds.add(order.id);

        const timeMatch = order.title.match(/\b(\d{1,2}:\d{2})\b/);
        bucket.todayOpenTasks.push({
          id: `today-${order.id}`,
          workOrderId: order.id,
          title: order.title,
          clientName: order.clientName,
          workTypeLabel:
            workTypeLabels[order.workType as keyof typeof workTypeLabels] || order.workType,
          priority: order.priority,
          priorityLabel:
            workPriorityLabels[order.priority as keyof typeof workPriorityLabels] ||
            order.priority,
          scheduledTimeLabel: timeMatch ? timeMatch[1] : undefined,
          address: order.locationNote || null,
          detailUrl: `${baseUrl}/work/${order.id}`,
          completeUrl: buildEmailActionLink(
            input.organizationId,
            order.id,
            'complete',
            recipient,
            baseUrl
          ),
          rescheduleUrl: buildEmailActionLink(
            input.organizationId,
            order.id,
            'reschedule',
            recipient,
            baseUrl
          ),
        });
      }
    }
  }

  // 3. Finalize and sort each worker's tasks
  const briefings: WorkerDailyBriefing[] = [...buckets.values()]
    .filter((b) => b.tasks.length > 0 || b.todayOpenTasks.length > 0)
    .map((b) => {
      b.tasks.sort((a, bTask) => {
        if (a.routeOrder !== undefined && bTask.routeOrder !== undefined) {
          return a.routeOrder - bTask.routeOrder;
        }
        if (a.routeOrder !== undefined) return -1;
        if (bTask.routeOrder !== undefined) return 1;

        const rankDiff = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[bTask.priority] ?? 2);
        if (rankDiff !== 0) return rankDiff;

        if (a.scheduledTimeLabel && bTask.scheduledTimeLabel) {
          return a.scheduledTimeLabel.localeCompare(bTask.scheduledTimeLabel);
        }
        return a.title.localeCompare(bTask.title, 'cs');
      });

      b.todayOpenTasks.sort((a, bTask) => {
        const rankDiff = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[bTask.priority] ?? 2);
        if (rankDiff !== 0) return rankDiff;
        return a.title.localeCompare(bTask.title, 'cs');
      });

      const allOrderIds = b.tasks
        .map((t) => t.workOrderId)
        .filter((id): id is string => Boolean(id));

      const allTodayOrderIds = b.todayOpenTasks
        .map((t) => t.workOrderId)
        .filter((id): id is string => Boolean(id));

      if (allTodayOrderIds.length > 1) {
        b.todayOpenTasks = b.todayOpenTasks.map((t) => ({
          ...t,
          completeUrl: buildEmailActionLink(
            input.organizationId,
            allTodayOrderIds,
            'complete',
            b.recipient,
            baseUrl,
            t.workOrderId
          ),
          rescheduleUrl: buildEmailActionLink(
            input.organizationId,
            allTodayOrderIds,
            'reschedule',
            b.recipient,
            baseUrl,
            t.workOrderId
          ),
        }));
      }

      return {
        recipient: b.recipient,
        targetDate: input.targetDate,
        targetDateLabel,
        todayDate,
        todayDateLabel,
        routeUrl: b.hasRoute ? `${baseUrl}/my-route?date=${input.targetDate}` : undefined,
        myTasksUrl: `${baseUrl}/my-tasks`,
        ackAllUrl:
          allOrderIds.length > 0
            ? buildAckLink(input.organizationId, allOrderIds, b.recipient, baseUrl)
            : undefined,
        completeAllTodayUrl:
          allTodayOrderIds.length > 0
            ? buildEmailActionLink(input.organizationId, allTodayOrderIds, 'complete', b.recipient, baseUrl)
            : undefined,
        rescheduleAllTodayUrl:
          allTodayOrderIds.length > 0
            ? buildEmailActionLink(input.organizationId, allTodayOrderIds, 'reschedule', b.recipient, baseUrl)
            : undefined,
        vehicles: [...b.vehicles],
        crewMates: [...b.crewMates],
        todayOpenTasks: b.todayOpenTasks,
        tasks: b.tasks,
      };
    })
    .sort((a, b) => a.recipient.fullName.localeCompare(b.recipient.fullName, 'cs'));

  return {
    targetDate: input.targetDate,
    targetDateLabel,
    todayDate,
    todayDateLabel,
    briefings,
    unmatchedWorkerNames: [...unmatchedNames].sort((a, b) => a.localeCompare(b, 'cs')),
  };
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (ch) => entities[ch]);
}

function czechTaskCountLabel(count: number): string {
  if (count === 1) return 'úkol';
  if (count >= 2 && count <= 4) return 'úkoly';
  return 'úkolů';
}

export function renderWorkerDailyBriefingEmail(
  briefing: WorkerDailyBriefing,
  organizationName: string,
  options?: { isTest?: boolean }
): { subject: string; html: string; text: string } {
  const todayOpen = briefing.todayOpenTasks ?? [];
  const countLabel = `${briefing.tasks.length} ${czechTaskCountLabel(briefing.tasks.length)}`;
  const todayCountLabel = `${todayOpen.length} ${czechTaskCountLabel(todayOpen.length)}`;
  const prefix = options?.isTest ? '[TEST] ' : '';

  const subject =
    todayOpen.length > 0 && briefing.tasks.length > 0
      ? `${prefix}Uzavření dneška (${todayOpen.length}) & plán na zítra (${briefing.targetDateLabel}) – ${countLabel}`
      : todayOpen.length > 0
      ? `${prefix}Uzavření dnešních úkolů (${briefing.todayDateLabel || 'dnes'}) – ${todayCountLabel}`
      : `${prefix}Plán práce na zítra (${briefing.targetDateLabel}) – ${countLabel}`;

  const primaryActionUrl = briefing.routeUrl || briefing.myTasksUrl;
  const primaryActionLabel = briefing.routeUrl
    ? 'Otevřít interaktivní trasu v mobilu'
    : 'Otevřít moje úkoly v SeePoint OS';

  const summaryParts: string[] = [];
  if (todayOpen.length > 0) summaryParts.push(`⏳ K uzavření dnes: ${todayCountLabel}`);
  if (briefing.tasks.length > 0) summaryParts.push(`📋 Na zítřek: ${countLabel}`);
  if (briefing.vehicles.length > 0) summaryParts.push(`🚗 ${briefing.vehicles.join(', ')}`);
  if (briefing.crewMates.length > 0) summaryParts.push(`👥 Společně s: ${briefing.crewMates.join(', ')}`);

  const batchTodayBarHtml =
    todayOpen.length > 0 && (briefing.completeAllTodayUrl || briefing.rescheduleAllTodayUrl)
      ? `<div style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#fef3c7;border:1px solid #f59e0b;">
          <div style="font-size:12px;font-weight:800;color:#78350f;margin-bottom:8px;">
            ⚡ Rychlé uzavření dneška:
          </div>
          <div>
            ${
              briefing.completeAllTodayUrl
                ? `<a href="${escapeHtml(briefing.completeAllTodayUrl)}" style="display:inline-block;margin:0 8px 6px 0;padding:10px 16px;border-radius:10px;background:#059669;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">✅ Označit vybrané / VŠECHNY jako HOTOVÉ (${todayOpen.length})</a>`
                : ''
            }
            ${
              briefing.rescheduleAllTodayUrl
                ? `<a href="${escapeHtml(briefing.rescheduleAllTodayUrl)}" style="display:inline-block;margin:0 0 6px 0;padding:10px 14px;border-radius:10px;background:#d97706;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">📝 Nahlásit nedokončené zadavateli</a>`
                : ''
            }
          </div>
        </div>`
      : '';

  const todaySectionHtml =
    todayOpen.length > 0
      ? `<div style="margin:0 0 18px;border:1px solid #fcd34d;border-radius:16px;padding:16px 16px 6px;background:#fffbeb;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#b45309;margin-bottom:4px;">
            ⏳ Kontrola dneška${briefing.todayDateLabel ? ` · ${escapeHtml(briefing.todayDateLabel)}` : ''}
          </div>
          <h2 style="margin:0 0 10px;font-size:16px;line-height:1.3;font-weight:900;color:#78350f;">
            Stihli jste dnes tyto úkoly? Označte stav jedním kliknutím:
          </h2>
          ${batchTodayBarHtml}
          ${todayOpen
            .map((t, idx) => {
              const metaParts = [escapeHtml(t.clientName), escapeHtml(t.workTypeLabel)];
              if (t.scheduledTimeLabel) metaParts.push(`⏰ ${escapeHtml(t.scheduledTimeLabel)}`);
              if (t.address) metaParts.push(escapeHtml(t.address));
              const btns: string[] = [];
              if (t.completeUrl) {
                btns.push(
                  `<a href="${escapeHtml(t.completeUrl)}" style="display:inline-block;margin:6px 6px 0 0;padding:9px 14px;border-radius:9px;background:#059669;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">✅ Hotovo</a>`
                );
              }
              if (t.rescheduleUrl) {
                btns.push(
                  `<a href="${escapeHtml(t.rescheduleUrl)}" style="display:inline-block;margin:6px 6px 0 0;padding:9px 14px;border-radius:9px;background:#d97706;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">📝 Nestihlo se / Poznámka</a>`
                );
              }
              btns.push(
                `<a href="${escapeHtml(t.detailUrl)}" style="display:inline-block;margin:6px 0 0 0;padding:9px 12px;border-radius:9px;background:#ffffff;border:1px solid #e2e8f0;color:#334155;font-size:12px;font-weight:700;text-decoration:none;">Detail →</a>`
              );
              return `
                <div style="margin:0 0 10px;border:1px solid #fde68a;border-radius:12px;padding:13px 14px;background:#ffffff;">
                  <div style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 4px;">
                    ${idx + 1}. ${escapeHtml(t.title)}
                  </div>
                  <div style="font-size:12.5px;color:#475569;line-height:1.45;">
                    ${metaParts.join(' · ')}
                  </div>
                  <div style="margin-top:6px;">
                    ${btns.join('')}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>`
      : '';

  const taskCardsHtml = briefing.tasks
    .map((task, idx) => {
      const priorityColors =
        task.priority === 'URGENT'
          ? 'background:#fee2e2;color:#991b1b;border:1px solid #fecaca;'
          : task.priority === 'HIGH'
          ? 'background:#fef3c7;color:#92400e;border:1px solid #fde68a;'
          : 'background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;';

      const orderBadge =
        task.routeOrder !== undefined
          ? `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#0284c7;color:#ffffff;font-size:11px;font-weight:800;margin-right:6px;">#${task.routeOrder}${task.scheduledTimeLabel ? ` · ${escapeHtml(task.scheduledTimeLabel)}` : ''}</span>`
          : task.scheduledTimeLabel
          ? `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:11px;font-weight:800;margin-right:6px;">⏰ ${escapeHtml(task.scheduledTimeLabel)}</span>`
          : `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:800;margin-right:6px;">${idx + 1}.</span>`;

      const specs: string[] = [];
      specs.push(`<div><strong>Klient:</strong> ${escapeHtml(task.clientName)}</div>`);
      if (task.quantity || task.mediaLabel) {
        const qtyStr = task.quantity ? `${task.quantity} ks` : '';
        const mediaStr = task.mediaLabel ? escapeHtml(task.mediaLabel) : '';
        specs.push(
          `<div><strong>Rozsah / médium:</strong> ${[qtyStr, mediaStr].filter(Boolean).join(' · ')}</div>`
        );
      }
      if (task.address) {
        specs.push(`<div><strong>Místo:</strong> ${escapeHtml(task.address)}</div>`);
      }
      if (task.crewNames.length > 0) {
        specs.push(`<div><strong>S kým:</strong> ${escapeHtml(task.crewNames.join(', '))}</div>`);
      }
      if (task.contactName || task.contactPhone) {
        const phoneHtml = task.contactPhone
          ? `<a href="tel:${escapeHtml(task.contactPhone.replace(/\s+/g, ''))}" style="color:#0284c7;text-decoration:none;font-weight:700;">${escapeHtml(task.contactPhone)}</a>`
          : '';
        specs.push(
          `<div><strong>Kontakt na místě:</strong> ${escapeHtml(task.contactName || '')}${task.contactName && phoneHtml ? ' · ' : ''}${phoneHtml}</div>`
        );
      }

      const trimmedDesc =
        task.description &&
        task.description.trim() &&
        task.description.trim() !== task.title.trim()
          ? task.description.trim().slice(0, 450)
          : '';

      const actionButtons: string[] = [];
      if (task.mapsUrl) {
        actionButtons.push(
          `<a href="${escapeHtml(task.mapsUrl)}" style="display:inline-block;margin:4px 6px 0 0;padding:8px 12px;border-radius:8px;background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;font-size:12px;font-weight:700;text-decoration:none;">🗺️ Navigovat</a>`
        );
      }
      if (task.driveUrl) {
        actionButtons.push(
          `<a href="${escapeHtml(task.driveUrl)}" style="display:inline-block;margin:4px 6px 0 0;padding:8px 12px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:12px;font-weight:700;text-decoration:none;">📁 Složka na Disku</a>`
        );
      }
      if (task.pdfUrl) {
        actionButtons.push(
          `<a href="${escapeHtml(task.pdfUrl)}" style="display:inline-block;margin:4px 6px 0 0;padding:8px 12px;border-radius:8px;background:#f8fafc;border:1px solid #cbd5e1;color:#334155;font-size:12px;font-weight:700;text-decoration:none;">📄 PDF podklady</a>`
        );
      }
      actionButtons.push(
        `<a href="${escapeHtml(task.detailUrl)}" style="display:inline-block;margin:4px 0 0 0;padding:8px 12px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;text-decoration:none;">Detail úkolu →</a>`
      );

      return `
        <div style="margin:0 0 14px;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;background:#ffffff;">
          <div style="margin:0 0 8px;">
            ${orderBadge}
            <span style="display:inline-block;padding:3px 9px;border-radius:999px;${priorityColors}font-size:11px;font-weight:700;margin-right:6px;">${escapeHtml(task.priorityLabel)}</span>
            <span style="display:inline-block;padding:3px 9px;border-radius:999px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;font-size:11px;font-weight:700;">${escapeHtml(task.workTypeLabel)}</span>
          </div>
          <h3 style="margin:0 0 10px;font-size:16px;line-height:1.35;color:#0f172a;font-weight:800;">
            ${escapeHtml(task.title)}
          </h3>
          <div style="font-size:13px;line-height:1.6;color:#334155;">
            ${specs.join('')}
          </div>
          ${trimmedDesc ? `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border-left:3px solid #cbd5e1;font-size:12.5px;line-height:1.5;color:#475569;">${escapeHtml(trimmedDesc)}</div>` : ''}
          <div style="margin-top:12px;">
            ${actionButtons.join('')}
          </div>
        </div>
      `;
    })
    .join('');

  const vocativeName = czechFirstNameVocative(briefing.recipient.firstName);
  const introText =
    todayOpen.length > 0 && briefing.tasks.length > 0
      ? `tady máš prosím rychlé uzavření dneška a zároveň přehled úkolů na zítřek:`
      : todayOpen.length > 0
      ? `prosíme o rychlé označení dnešních neuzavřených úkolů (hotovo nebo poznámka zadavateli):`
      : `tady máš přehled svých úkolů na zítřek, ať si můžeš vše v klidu připravit:`;

  const tomorrowBlockHtml =
    briefing.tasks.length > 0
      ? `${
          todayOpen.length > 0
            ? `<div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#0284c7;margin:4px 2px 10px;">
                📅 Plán práce na zítřek · ${escapeHtml(briefing.targetDateLabel)}
              </div>`
            : ''
        }${taskCardsHtml}`
      : `<div style="margin:0 0 14px;border:1px dashed #cbd5e1;border-radius:14px;padding:14px 16px;background:#ffffff;font-size:13px;color:#475569;">
          Na zítřek (${escapeHtml(briefing.targetDateLabel)}) zatím nemáš v systému přiřazené žádné další úkoly.
        </div>`;

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:24px 24px 20px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;margin-bottom:6px;">
            ${escapeHtml(organizationName)} · Automatický plán práce${options?.isTest ? ' (TESTOVACÍ NÁHLED)' : ''}
          </div>
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:900;color:#ffffff;">
            ${
              briefing.tasks.length > 0
                ? `Zítřejší plán: ${escapeHtml(briefing.targetDateLabel)}`
                : `Uzavření dneška: ${escapeHtml(briefing.todayDateLabel || 'dnes')}`
            }
          </h1>
          <p style="margin:0 0 14px;font-size:14.5px;line-height:1.5;color:#cbd5e1;">
            Ahoj <strong style="color:#ffffff;">${escapeHtml(vocativeName)}</strong>, ${introText}
          </p>
          <div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.08);font-size:12.5px;color:#e2e8f0;font-weight:600;">
            ${escapeHtml(summaryParts.join('  ·  '))}
          </div>
          <div style="margin-top:12px;">
            <a href="${escapeHtml(primaryActionUrl)}" style="display:inline-block;margin:6px 0 0 0;padding:11px 17px;border-radius:10px;background:#0284c7;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">
              📱 ${escapeHtml(primaryActionLabel)} →
            </a>
          </div>
        </div>
        <div style="padding:18px 18px 8px;">
          ${todaySectionHtml}
          ${tomorrowBlockHtml}
        </div>
        <div style="padding:14px 24px 22px;font-size:11.5px;line-height:1.5;color:#64748b;text-align:center;">
          ${
            todayOpen.length > 0
              ? 'U dnešních úkolů stačí kliknout na <strong>„Hotovo“</strong> nebo poslat krátkou <strong>poznámku zadavateli</strong> (termíny mění zadavatel).<br>'
              : ''
          }
          Úkoly není potřeba nijak potvrzovat. Případné pozdější změny plánu ti automaticky přijdou e-mailem a vždy je uvidíš aktuálně v aplikaci.
        </div>
      </div>
    </div>
  `;

  const textLines = [
    subject,
    `Ahoj ${vocativeName}, ${introText}`,
    summaryParts.join(' | '),
    ...(todayOpen.length > 0
      ? [
          '',
          `--- K UZAVŘENÍ ZA DNEŠEK (${briefing.todayDateLabel || 'dnes'}) ---`,
          ...todayOpen.flatMap((t, idx) => [
            `${idx + 1}. ${t.title} (${t.clientName})`,
            t.completeUrl ? `   Hotovo: ${t.completeUrl}` : null,
            t.rescheduleUrl ? `   Nestihlo se / Poznámka zadavateli: ${t.rescheduleUrl}` : null,
            `   Detail: ${t.detailUrl}`,
            '',
          ]),
        ]
      : []),
    '',
    ...(briefing.tasks.length > 0
      ? [
          `--- PLÁN NA ZÍTŘEK (${briefing.targetDateLabel}) ---`,
          ...briefing.tasks.flatMap((task, idx) => [
            `${idx + 1}. ${task.title} (${task.clientName})`,
            task.address ? `   Místo: ${task.address}` : null,
            task.contactPhone ? `   Kontakt: ${task.contactName || ''} ${task.contactPhone}` : null,
            task.mapsUrl ? `   Mapa: ${task.mapsUrl}` : null,
            task.driveUrl ? `   Disk: ${task.driveUrl}` : null,
            `   Detail: ${task.detailUrl}`,
            '',
          ]),
        ]
      : []),
    `Otevřít v aplikaci: ${primaryActionUrl}`,
  ].filter((l): l is string => l !== null);

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}

export async function loadOrganizationWorkerDirectory(
  organizationId: string
): Promise<WorkerRecipient[]> {
  const [employees, members] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        user: { select: { id: true, email: true, status: true, role: true } },
      },
      orderBy: { firstName: 'asc' },
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: ['ADMIN', 'MANAGER', 'TECHNICIAN', 'WORKER'] },
      },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    }),
  ]);

  const byEmail = new Map<string, WorkerRecipient>();

  for (const emp of employees) {
    if (emp.user?.status === 'SUSPENDED') continue;
    const emailCandidate = emp.email || emp.user?.email;
    if (!isDeliverableWorkerEmail(emailCandidate)) continue;
    const normEmail = emailCandidate.trim().toLowerCase();
    byEmail.set(normEmail, {
      key: emp.id,
      employeeId: emp.id,
      userId: emp.userId ?? emp.user?.id ?? null,
      fullName: `${emp.firstName} ${emp.lastName}`.trim(),
      firstName: emp.firstName.trim(),
      lastName: emp.lastName.trim(),
      email: normEmail,
      role: emp.role,
    });
  }

  for (const member of members) {
    if (member.user.status === 'SUSPENDED') continue;
    if (!isDeliverableWorkerEmail(member.user.email)) continue;
    const normEmail = member.user.email.trim().toLowerCase();
    if (byEmail.has(normEmail)) continue;
    const parts = member.user.name.trim().split(/\s+/);
    byEmail.set(normEmail, {
      key: `user-${member.user.id}`,
      userId: member.user.id,
      fullName: member.user.name.trim(),
      firstName: parts[0] || member.user.name.trim(),
      lastName: parts.slice(1).join(' '),
      email: normEmail,
      role: member.role,
    });
  }

  return [...byEmail.values()];
}

const BRIEFING_ORDER_SELECT = {
  id: true,
  title: true,
  description: true,
  workType: true,
  priority: true,
  status: true,
  scheduledAt: true,
  clientName: true,
  contactName: true,
  contactPhone: true,
  locationNote: true,
  quantity: true,
  mediaLabel: true,
  ftdUrl: true,
  referenceUrl: true,
  pdfUrl: true,
  planningConstraints: true,
  assignments: { select: { userId: true, workerName: true } },
} as const;

export async function loadDailyBriefingsForOrganization(
  organizationId: string,
  options?: {
    targetDate?: string;
    timezone?: string;
    baseUrl?: string;
    ignoreRecipientFilter?: boolean;
  }
): Promise<BriefingAssemblyResult> {
  const settings = await getDailyBriefingSettings(organizationId);
  const timezone = options?.timezone || settings.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const targetDate = options?.targetDate || getTomorrowDateStr(new Date(), timezone);
  const todayDate = addCalendarDays(targetDate, -1);
  const { start, end } = getDayBoundsUtc(targetDate, timezone);
  const { start: todayStart, end: todayEnd } = getDayBoundsUtc(todayDate, timezone);
  const overdueLookbackStart = new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [orders, todayOrders, fieldPlans, directory] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        scheduledAt: { gte: start, lt: end },
      },
      select: BRIEFING_ORDER_SELECT,
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    }),
    prisma.workOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        scheduledAt: { gte: overdueLookbackStart, lt: todayEnd },
      },
      select: BRIEFING_ORDER_SELECT,
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    }),
    prisma.fieldPlan.findMany({
      where: {
        organizationId,
        date: targetDate,
        status: { in: ['APPROVED', 'ACTIVE'] },
      },
      select: {
        id: true,
        date: true,
        status: true,
        version: true,
        planningSummary: true,
      },
      orderBy: { version: 'desc' },
    }),
    loadOrganizationWorkerDirectory(organizationId),
  ]);

  const assembled = assembleWorkerBriefings({
    organizationId,
    targetDate,
    todayDate,
    orders,
    todayOrders,
    fieldPlans,
    directory,
    baseUrl: options?.baseUrl,
    timezone,
  });

  if (options?.ignoreRecipientFilter) {
    return assembled;
  }

  return {
    ...assembled,
    briefings: assembled.briefings.filter((b) =>
      isBriefingRecipientAllowed(b.recipient.email, settings)
    ),
  };
}

export type SendBriefingsResult = {
  targetDate: string;
  targetDateLabel: string;
  recipientsCount: number;
  sentCount: number;
  skippedAlreadySentCount: number;
  skippedEnvCount: number;
  failedCount: number;
  unmatchedWorkerNames: string[];
  deliveries: Array<{
    recipientEmail: string;
    recipientName: string;
    taskCount: number;
    status: 'sent' | 'already_sent' | 'skipped_env' | 'failed';
    error?: string;
  }>;
};

export async function sendDailyBriefingsForOrganization(
  organizationId: string,
  options?: {
    targetDate?: string;
    force?: boolean;
    dryRun?: boolean;
    testRecipientEmail?: string;
    baseUrl?: string;
  }
): Promise<SendBriefingsResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const organizationName = org?.name || 'SeePoint OS';
  const assembly = await loadDailyBriefingsForOrganization(organizationId, {
    targetDate: options?.targetDate,
    baseUrl: options?.baseUrl,
  });

  const deliveries: SendBriefingsResult['deliveries'] = [];
  let sentCount = 0;
  let skippedAlreadySentCount = 0;
  let skippedEnvCount = 0;
  let failedCount = 0;

  // Test email mode: send a single preview email to the requested admin/manager
  if (options?.testRecipientEmail) {
    const testEmail = options.testRecipientEmail.trim().toLowerCase();
    if (!isValidEmailAddress(testEmail)) {
      throw new Error('Zadaný testovací e-mail nemá platný formát.');
    }

    const ownBriefing = assembly.briefings.find((b) => b.recipient.email === testEmail);
    const matchingWorkerBriefing = ownBriefing || assembly.briefings[0];
    const isOwn = Boolean(ownBriefing);

    const baseUrl = (options.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');
    const sampleBriefing: WorkerDailyBriefing = matchingWorkerBriefing
      ? {
          ...matchingWorkerBriefing,
          ackAllUrl: isOwn ? matchingWorkerBriefing.ackAllUrl : undefined,
          todayOpenTasks: isOwn
            ? matchingWorkerBriefing.todayOpenTasks
            : (matchingWorkerBriefing.todayOpenTasks ?? []).map((t) => ({
                ...t,
                completeUrl: undefined,
                rescheduleUrl: undefined,
              })),
          tasks: isOwn
            ? matchingWorkerBriefing.tasks
            : matchingWorkerBriefing.tasks.map((t) => ({ ...t, ackUrl: undefined })),
          recipient: {
            ...matchingWorkerBriefing.recipient,
            email: testEmail,
          },
        }
      : {
          recipient: {
            key: 'test-preview',
            fullName: 'Testovací příjemce',
            firstName: 'Testovací',
            lastName: 'příjemce',
            email: testEmail,
            role: 'ADMIN',
          },
          targetDate: assembly.targetDate,
          targetDateLabel: assembly.targetDateLabel,
          todayDate: assembly.todayDate,
          todayDateLabel: assembly.todayDateLabel,
          myTasksUrl: `${baseUrl}/my-tasks`,
          vehicles: ['Dodávka 1 (ukázka)'],
          crewMates: ['Kolega z týmu'],
          todayOpenTasks: [
            {
              id: 'sample-today-1',
              workOrderId: 'sample-today-1',
              title: 'Ukázkový dnešní úkol k uzavření (Hotovo / Poznámka)',
              clientName: organizationName,
              workTypeLabel: 'Instalace',
              priority: 'NORMAL',
              priorityLabel: 'Normální',
              scheduledTimeLabel: '14:00',
              detailUrl: `${baseUrl}/work`,
            },
          ],
          tasks: [
            {
              id: 'sample-1',
              title: 'Ukázkový úkol – na zítřek zatím nebyla v systému žádná zakázka',
              clientName: organizationName,
              workTypeLabel: 'Ukázka šablony',
              priority: 'NORMAL',
              priorityLabel: 'Normální',
              scheduledTimeLabel: '08:30',
              crewNames: [],
              quantity: 2,
              mediaLabel: 'CityLight',
              address: 'Ukázková adresa 123, Ostrava',
              mapsUrl: 'https://www.google.com/maps/search/?api=1&query=49.8209,18.2625',
              detailUrl: `${baseUrl}/work`,
              description:
                'Jakmile budete mít na zítřek přiřazené zakázky, montéři v takovémto přehledu obdrží všechny detaily, kontakty, mapu i odkaz na Google Disk.',
            },
          ],
        };

    const rendered = renderWorkerDailyBriefingEmail(sampleBriefing, organizationName, {
      isTest: true,
    });

    const result = await sendTransactionalEmail({
      to: testEmail,
      bcc: [],
      subject: rendered.subject,
      message: rendered.text,
      customHtml: rendered.html,
      template: 'worker-daily-briefing',
      organizationId,
      allowPlatformFallback: true,
      metadata: {
        targetDate: assembly.targetDate,
        isTest: true,
        taskCount: sampleBriefing.tasks.length,
      },
    });

    if (result.status === 'sent') sentCount = 1;
    else skippedEnvCount = 1;

    deliveries.push({
      recipientEmail: testEmail,
      recipientName: sampleBriefing.recipient.fullName,
      taskCount: sampleBriefing.tasks.length,
      status: result.status === 'sent' ? 'sent' : 'skipped_env',
    });

    return {
      targetDate: assembly.targetDate,
      targetDateLabel: assembly.targetDateLabel,
      recipientsCount: 1,
      sentCount,
      skippedAlreadySentCount,
      skippedEnvCount,
      failedCount,
      unmatchedWorkerNames: assembly.unmatchedWorkerNames,
      deliveries,
    };
  }

  if (options?.dryRun) {
    return {
      targetDate: assembly.targetDate,
      targetDateLabel: assembly.targetDateLabel,
      recipientsCount: assembly.briefings.length,
      sentCount: 0,
      skippedAlreadySentCount: 0,
      skippedEnvCount: 0,
      failedCount: 0,
      unmatchedWorkerNames: assembly.unmatchedWorkerNames,
      deliveries: assembly.briefings.map((b) => ({
        recipientEmail: b.recipient.email,
        recipientName: b.recipient.fullName,
        taskCount: b.tasks.length,
        status: 'sent',
      })),
    };
  }

  // Check already-sent emails for this targetDate in last 36 hours to stay idempotent
  const alreadySentEmails = new Set<string>();
  if (!options?.force && assembly.briefings.length > 0) {
    const recentLogs = await prisma.emailLog.findMany({
      where: {
        organizationId,
        template: 'worker-daily-briefing',
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) },
      },
      select: { recipient: true, metadata: true },
    });
    for (const log of recentLogs) {
      const meta = (log.metadata as Record<string, unknown> | null) || null;
      if (meta && meta.targetDate === assembly.targetDate && meta.isTest !== true) {
        alreadySentEmails.add(log.recipient.trim().toLowerCase());
      }
    }
  }

  for (const briefing of assembly.briefings) {
    const emailLower = briefing.recipient.email.toLowerCase();
    if (alreadySentEmails.has(emailLower)) {
      skippedAlreadySentCount++;
      deliveries.push({
        recipientEmail: briefing.recipient.email,
        recipientName: briefing.recipient.fullName,
        taskCount: briefing.tasks.length,
        status: 'already_sent',
      });
      continue;
    }

    const rendered = renderWorkerDailyBriefingEmail(briefing, organizationName);
    const planSnapshot = buildWorkerDayPlanSnapshot(briefing.tasks);
    const idempHash = crypto
      .createHash('sha256')
      .update(`${organizationId}:${assembly.targetDate}:${emailLower}`)
      .digest('hex')
      .slice(0, 16);

    try {
      const result = await sendTransactionalEmail({
        to: briefing.recipient.email,
        bcc: [],
        subject: rendered.subject,
        message: rendered.text,
        customHtml: rendered.html,
        template: 'worker-daily-briefing',
        organizationId,
        allowPlatformFallback: true,
        idempotencyKey: options?.force
          ? undefined
          : `daily-briefing/${assembly.targetDate}/${idempHash}`,
        metadata: {
          targetDate: assembly.targetDate,
          employeeId: briefing.recipient.employeeId ?? null,
          userId: briefing.recipient.userId ?? null,
          recipientName: briefing.recipient.fullName,
          taskCount: briefing.tasks.length,
          planSnapshotHash: planSnapshot.hash,
          planSnapshotTasks: planSnapshot.tasks,
          isTest: false,
        },
      });

      if (result.status === 'sent') {
        sentCount++;
        deliveries.push({
          recipientEmail: briefing.recipient.email,
          recipientName: briefing.recipient.fullName,
          taskCount: briefing.tasks.length,
          status: 'sent',
        });
      } else {
        skippedEnvCount++;
        deliveries.push({
          recipientEmail: briefing.recipient.email,
          recipientName: briefing.recipient.fullName,
          taskCount: briefing.tasks.length,
          status: 'skipped_env',
        });
      }
    } catch (err) {
      failedCount++;
      deliveries.push({
        recipientEmail: briefing.recipient.email,
        recipientName: briefing.recipient.fullName,
        taskCount: briefing.tasks.length,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Odeslání selhalo.',
      });
    }
  }

  return {
    targetDate: assembly.targetDate,
    targetDateLabel: assembly.targetDateLabel,
    recipientsCount: assembly.briefings.length,
    sentCount,
    skippedAlreadySentCount,
    skippedEnvCount,
    failedCount,
    unmatchedWorkerNames: assembly.unmatchedWorkerNames,
    deliveries,
  };
}

export type WorkerDayPlanTaskSnapshot = {
  id: string;
  title: string;
  clientName: string;
  scheduledTimeLabel: string | null;
  address: string | null;
  priority: string;
  workTypeLabel: string;
  description: string | null;
  crewNames: string[];
  detailUrl: string;
  mapsUrl: string | null;
  driveUrl: string | null;
};

export type WorkerDayPlanSnapshot = {
  hash: string;
  tasks: WorkerDayPlanTaskSnapshot[];
};

export type WorkerPlanUpdatedTask = {
  task: WorkerDayPlanTaskSnapshot;
  changes: string[];
};

export type WorkerPlanDiff = {
  added: WorkerDayPlanTaskSnapshot[];
  updated: WorkerPlanUpdatedTask[];
  removed: WorkerDayPlanTaskSnapshot[];
};

export function buildWorkerDayPlanSnapshot(
  tasks: BriefingTaskItem[]
): WorkerDayPlanSnapshot {
  const normalized: WorkerDayPlanTaskSnapshot[] = tasks
    .map((task) => ({
      id: task.workOrderId || task.id,
      title: task.title.trim(),
      clientName: task.clientName.trim(),
      scheduledTimeLabel: task.scheduledTimeLabel?.trim() || null,
      address: task.address?.trim() || null,
      priority: task.priority,
      workTypeLabel: task.workTypeLabel,
      description: task.description?.trim().slice(0, 300) || null,
      crewNames: [...new Set((task.crewNames || []).map((n) => n.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, 'cs')
      ),
      detailUrl: task.detailUrl,
      mapsUrl: task.mapsUrl || null,
      driveUrl: task.driveUrl || null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Hash only schedule-relevant fields (exclude baseUrl-dependent links so origin differences never cause false alerts)
  const canonicalForHash = normalized.map((t) => ({
    id: t.id,
    title: t.title,
    clientName: t.clientName,
    scheduledTimeLabel: t.scheduledTimeLabel,
    address: t.address,
    priority: t.priority,
    workTypeLabel: t.workTypeLabel,
    description: t.description,
    crewNames: t.crewNames,
  }));

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalForHash))
    .digest('hex')
    .slice(0, 20);

  return { hash, tasks: normalized };
}

export function diffWorkerDayPlanSnapshots(
  previous: WorkerDayPlanTaskSnapshot[],
  current: WorkerDayPlanTaskSnapshot[]
): WorkerPlanDiff {
  const prevById = new Map(previous.map((t) => [t.id, t]));
  const currById = new Map(current.map((t) => [t.id, t]));

  const added: WorkerDayPlanTaskSnapshot[] = [];
  const updated: WorkerPlanUpdatedTask[] = [];
  const removed: WorkerDayPlanTaskSnapshot[] = [];

  for (const curr of current) {
    const prev = prevById.get(curr.id);
    if (!prev) {
      added.push(curr);
      continue;
    }

    const changes: string[] = [];
    if (prev.title !== curr.title) changes.push('Změněn název');
    if (prev.clientName !== curr.clientName) changes.push('Změněn klient');
    if ((prev.scheduledTimeLabel || null) !== (curr.scheduledTimeLabel || null)) {
      changes.push(
        curr.scheduledTimeLabel
          ? `Změněn čas (${curr.scheduledTimeLabel})`
          : 'Odebrán konkrétní čas'
      );
    }
    if ((prev.address || null) !== (curr.address || null)) changes.push('Změněno místo');
    if (prev.priority !== curr.priority) changes.push('Změněna priorita');
    if (prev.workTypeLabel !== curr.workTypeLabel) changes.push('Změněn typ práce');
    if ((prev.description || null) !== (curr.description || null)) changes.push('Upraveno zadání');
    if ((prev.crewNames || []).join('|') !== (curr.crewNames || []).join('|')) {
      changes.push('Změněn tým');
    }

    if (changes.length > 0) {
      updated.push({ task: curr, changes });
    }
  }

  for (const prev of previous) {
    if (!currById.has(prev.id)) {
      removed.push(prev);
    }
  }

  return { added, updated, removed };
}

function parseStoredSnapshotTasks(raw: unknown): WorkerDayPlanTaskSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: WorkerDayPlanTaskSnapshot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.title !== 'string') continue;
    parsed.push({
      id: obj.id,
      title: obj.title,
      clientName: typeof obj.clientName === 'string' ? obj.clientName : 'Bez klienta',
      scheduledTimeLabel:
        typeof obj.scheduledTimeLabel === 'string' ? obj.scheduledTimeLabel : null,
      address: typeof obj.address === 'string' ? obj.address : null,
      priority: typeof obj.priority === 'string' ? obj.priority : 'NORMAL',
      workTypeLabel: typeof obj.workTypeLabel === 'string' ? obj.workTypeLabel : 'Práce',
      description: typeof obj.description === 'string' ? obj.description : null,
      crewNames: Array.isArray(obj.crewNames)
        ? obj.crewNames.filter((n): n is string => typeof n === 'string')
        : [],
      detailUrl: typeof obj.detailUrl === 'string' ? obj.detailUrl : '',
      mapsUrl: typeof obj.mapsUrl === 'string' ? obj.mapsUrl : null,
      driveUrl: typeof obj.driveUrl === 'string' ? obj.driveUrl : null,
    });
  }
  return parsed;
}

export function renderWorkerPlanChangeEmail(input: {
  recipient: Pick<WorkerRecipient, 'firstName' | 'fullName' | 'email'>;
  organizationName: string;
  targetDate: string;
  targetDateLabel: string;
  isToday: boolean;
  diff: WorkerPlanDiff;
  totalCurrentTasks: number;
  myTasksUrl: string;
}): { subject: string; html: string; text: string } {
  const dayWord = input.isToday ? 'dnes' : 'zítra';
  const vocativeName = czechFirstNameVocative(input.recipient.firstName);

  const summaryBits: string[] = [];
  if (input.diff.added.length > 0) summaryBits.push(`+${input.diff.added.length} nový`);
  if (input.diff.updated.length > 0) summaryBits.push(`${input.diff.updated.length} upraveno`);
  if (input.diff.removed.length > 0) summaryBits.push(`${input.diff.removed.length} odebráno/přesunuto`);

  const subject = `🔄 Změna v plánu na ${dayWord} (${input.targetDateLabel}): ${summaryBits.join(', ')}`;

  const renderTaskCard = (
    task: WorkerDayPlanTaskSnapshot,
    badge: { text: string; bg: string; border: string; color: string },
    extraLine?: string
  ) => {
    const meta: string[] = [`Klient: <strong>${escapeHtml(task.clientName)}</strong>`];
    if (task.scheduledTimeLabel) meta.push(`⏰ ${escapeHtml(task.scheduledTimeLabel)}`);
    if (task.address) meta.push(`📍 ${escapeHtml(task.address)}`);
    if (task.crewNames.length > 0) meta.push(`👥 ${escapeHtml(task.crewNames.join(', '))}`);

    const buttons: string[] = [];
    if (task.mapsUrl) {
      buttons.push(
        `<a href="${escapeHtml(task.mapsUrl)}" style="display:inline-block;margin:4px 6px 0 0;padding:7px 11px;border-radius:8px;background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;font-size:12px;font-weight:700;text-decoration:none;">🗺️ Navigovat</a>`
      );
    }
    if (task.driveUrl) {
      buttons.push(
        `<a href="${escapeHtml(task.driveUrl)}" style="display:inline-block;margin:4px 6px 0 0;padding:7px 11px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:12px;font-weight:700;text-decoration:none;">📁 Složka na Disku</a>`
      );
    }
    if (task.detailUrl) {
      buttons.push(
        `<a href="${escapeHtml(task.detailUrl)}" style="display:inline-block;margin:4px 0 0 0;padding:7px 11px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;text-decoration:none;">Detail úkolu →</a>`
      );
    }

    return `
      <div style="margin:0 0 12px;border:1px solid ${badge.border};border-radius:12px;padding:14px 16px;background:${badge.bg};">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:${badge.color};margin-bottom:4px;">
          ${escapeHtml(badge.text)}
        </div>
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 4px;">
          ${escapeHtml(task.title)}
        </div>
        <div style="font-size:12.5px;color:#475569;line-height:1.5;">
          ${meta.join(' · ')}
        </div>
        ${
          extraLine
            ? `<div style="margin-top:6px;padding:6px 10px;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;font-size:12px;color:#334155;font-weight:600;">${escapeHtml(extraLine)}</div>`
            : ''
        }
        ${
          task.description && task.description !== task.title
            ? `<div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.45;">${escapeHtml(task.description)}</div>`
            : ''
        }
        ${buttons.length > 0 ? `<div style="margin-top:8px;">${buttons.join('')}</div>` : ''}
      </div>
    `;
  };

  const sectionsHtml = [
    ...input.diff.added.map((t) =>
      renderTaskCard(t, {
        text: '➕ Nový úkol v plánu',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        color: '#047857',
      })
    ),
    ...input.diff.updated.map((u) =>
      renderTaskCard(
        u.task,
        {
          text: '✏️ Upravený úkol',
          bg: '#eff6ff',
          border: '#bfdbfe',
          color: '#1d4ed8',
        },
        `Co se změnilo: ${u.changes.join(' · ')}`
      )
    ),
    ...input.diff.removed.map((t) =>
      renderTaskCard(
        { ...t, mapsUrl: null, driveUrl: null, detailUrl: '' },
        {
          text: '🚫 Odebráno / přesunuto na jiný den',
          bg: '#fffbeb',
          border: '#fde68a',
          color: '#b45309',
        }
      )
    ),
  ].join('');

  const totalLabel = `${input.totalCurrentTasks} ${czechTaskCountLabel(input.totalCurrentTasks)}`;

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);padding:22px 24px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;margin-bottom:6px;">
            ${escapeHtml(input.organizationName)} · Aktualizace plánu práce
          </div>
          <h1 style="margin:0 0 8px;font-size:20px;line-height:1.25;font-weight:900;color:#ffffff;">
            Změna v plánu na ${escapeHtml(dayWord)} (${escapeHtml(input.targetDateLabel)})
          </h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#cbd5e1;">
            Ahoj <strong style="color:#ffffff;">${escapeHtml(vocativeName)}</strong>, v tvém plánu na ${escapeHtml(dayWord)} došlo ke změně. Aktuálně máš na tento den celkem <strong style="color:#ffffff;">${escapeHtml(totalLabel)}</strong>.
          </p>
          <a href="${escapeHtml(input.myTasksUrl)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0284c7;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">
            📱 Otevřít aktuální plán v aplikaci →
          </a>
        </div>
        <div style="padding:18px 20px 10px;">
          ${sectionsHtml}
        </div>
        <div style="padding:12px 24px 20px;font-size:11.5px;line-height:1.5;color:#64748b;text-align:center;">
          Úkoly není potřeba potvrzovat. Aktuální přehled najdeš vždy v aplikaci SeePoint OS.
        </div>
      </div>
    </div>
  `;

  const textLines = [
    subject,
    `Ahoj ${vocativeName}, v tvém plánu na ${dayWord} (${input.targetDateLabel}) došlo ke změně. Celkem máš nyní ${totalLabel}.`,
    '',
    ...input.diff.added.map(
      (t) =>
        `[NOVÝ ÚKOL] ${t.title} (${t.clientName})${t.scheduledTimeLabel ? ` | ${t.scheduledTimeLabel}` : ''}${
          t.address ? ` | ${t.address}` : ''
        }${t.detailUrl ? ` | ${t.detailUrl}` : ''}`
    ),
    ...input.diff.updated.map(
      (u) =>
        `[UPRAVENO: ${u.changes.join(', ')}] ${u.task.title} (${u.task.clientName})${
          u.task.detailUrl ? ` | ${u.task.detailUrl}` : ''
        }`
    ),
    ...input.diff.removed.map(
      (t) => `[ODEBRÁNO / PŘESUNUTO] ${t.title} (${t.clientName})`
    ),
    '',
    `Aktuální plán: ${input.myTasksUrl}`,
  ];

  return { subject, html, text: textLines.join('\n') };
}

export type NotifyPlanChangesResult = {
  checkedDates: string[];
  sentCount: number;
  skippedNoChangeCount: number;
  skippedNotEligibleCount: number;
  failedCount: number;
  deliveries: Array<{
    targetDate: string;
    recipientEmail: string;
    recipientName: string;
    added: number;
    updated: number;
    removed: number;
    status: 'sent' | 'skipped_env' | 'failed';
    error?: string;
  }>;
};

export async function notifyWorkerPlanChangesForOrganization(
  organizationId: string,
  options?: {
    dates?: string[];
    baseUrl?: string;
    now?: Date;
    changedOrderIds?: string[];
  }
): Promise<NotifyPlanChangesResult> {
  const settings = await getDailyBriefingSettings(organizationId);
  if (!settings.enabled || !settings.notifyChanges) {
    return {
      checkedDates: [],
      sentCount: 0,
      skippedNoChangeCount: 0,
      skippedNotEligibleCount: 0,
      failedCount: 0,
      deliveries: [],
    };
  }

  const now = options?.now ?? new Date();
  const timezone = settings.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const todayDate = dayInZone(now, timezone);
  const tomorrowDate = addCalendarDays(todayDate, 1);
  const localHour = getLocalHour(now, timezone);
  const baseUrl = (options?.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');

  const requestedDates = options?.dates?.length
    ? [...new Set(options.dates.filter((d) => d === todayDate || d === tomorrowDate))]
    : [todayDate, tomorrowDate];

  if (requestedDates.length === 0) {
    return {
      checkedDates: [],
      sentCount: 0,
      skippedNoChangeCount: 0,
      skippedNotEligibleCount: 0,
      failedCount: 0,
      deliveries: [],
    };
  }

  const [org, recentLogs, directory] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.emailLog.findMany({
      where: {
        organizationId,
        template: { in: ['worker-daily-briefing', 'worker-plan-change'] },
        status: 'SENT',
        sentAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
      select: {
        recipient: true,
        template: true,
        sentAt: true,
        metadata: true,
      },
      orderBy: { sentAt: 'desc' },
    }),
    loadOrganizationWorkerDirectory(organizationId),
  ]);

  const organizationName = org?.name || 'SeePoint OS';
  const directoryByEmail = new Map(directory.map((d) => [d.email.toLowerCase(), d]));
  const changedIdsSet = new Set((options?.changedOrderIds || []).filter(Boolean));

  const checkedDates: string[] = [];
  const deliveries: NotifyPlanChangesResult['deliveries'] = [];
  let sentCount = 0;
  let skippedNoChangeCount = 0;
  let skippedNotEligibleCount = 0;
  let failedCount = 0;

  for (const targetDate of requestedDates) {
    if (settings.skipWeekends && isWeekendDate(targetDate)) {
      skippedNotEligibleCount++;
      continue;
    }

    const isToday = targetDate === todayDate;
    const isTomorrow = targetDate === tomorrowDate;

    const latestLogByEmail = new Map<
      string,
      {
        hash: string | null;
        tasks: WorkerDayPlanTaskSnapshot[] | null;
        recipientName: string | null;
      }
    >();
    let hasAnyBriefingForDate = false;

    for (const log of recentLogs) {
      const meta = asPcObj(log.metadata);
      if (meta.targetDate !== targetDate || meta.isTest === true) continue;
      if (log.template === 'worker-daily-briefing') {
        hasAnyBriefingForDate = true;
      }
      const emailLower = log.recipient.trim().toLowerCase();
      if (!latestLogByEmail.has(emailLower)) {
        latestLogByEmail.set(emailLower, {
          hash: typeof meta.planSnapshotHash === 'string' ? meta.planSnapshotHash : null,
          tasks: parseStoredSnapshotTasks(meta.planSnapshotTasks),
          recipientName: typeof meta.recipientName === 'string' ? meta.recipientName : null,
        });
      }
    }

    if (isTomorrow) {
      const tomorrowWindowOpen = hasAnyBriefingForDate || localHour > settings.sendHourLocal;
      if (!tomorrowWindowOpen) {
        skippedNotEligibleCount++;
        continue;
      }
    } else if (isToday) {
      if (localHour >= 19) {
        skippedNotEligibleCount++;
        continue;
      }
      if (!hasAnyBriefingForDate && changedIdsSet.size === 0) {
        skippedNotEligibleCount++;
        continue;
      }
    }

    checkedDates.push(targetDate);

    const assembly = await loadDailyBriefingsForOrganization(organizationId, {
      targetDate,
      timezone,
      baseUrl,
    });

    const briefingByEmail = new Map(
      assembly.briefings.map((b) => [b.recipient.email.toLowerCase(), b])
    );

    const candidateEmails = new Set<string>();
    for (const email of briefingByEmail.keys()) {
      candidateEmails.add(email);
    }
    for (const email of latestLogByEmail.keys()) {
      if (isBriefingRecipientAllowed(email, settings)) {
        candidateEmails.add(email);
      }
    }

    for (const email of candidateEmails) {
      const briefing = briefingByEmail.get(email);
      const currentTasks = briefing?.tasks ?? [];
      const currentSnap = buildWorkerDayPlanSnapshot(currentTasks);
      const prevLog = latestLogByEmail.get(email);

      let diff: WorkerPlanDiff;

      if (prevLog) {
        if (!prevLog.tasks) {
          // Legacy briefing log sent prior to snapshot tracking — skip to avoid false full-plan resend
          skippedNotEligibleCount++;
          continue;
        }
        if (prevLog.hash && prevLog.hash === currentSnap.hash) {
          skippedNoChangeCount++;
          continue;
        }
        diff = diffWorkerDayPlanSnapshots(prevLog.tasks, currentSnap.tasks);
      } else {
        // Worker had no prior briefing for this date (e.g. had 0 tasks at 17:00 and got a new task later)
        if (currentSnap.tasks.length === 0) {
          skippedNoChangeCount++;
          continue;
        }
        const relevantAdded =
          !hasAnyBriefingForDate && isToday && changedIdsSet.size > 0
            ? currentSnap.tasks.filter((t) => changedIdsSet.has(t.id))
            : currentSnap.tasks;

        if (relevantAdded.length === 0) {
          skippedNoChangeCount++;
          continue;
        }
        diff = { added: relevantAdded, updated: [], removed: [] };
      }

      // Never treat tasks that were simply marked DONE as "removed / cancelled" change alerts
      if (diff.removed.length > 0) {
        const removedIds = diff.removed.map((t) => t.id);
        const statuses = await prisma.workOrder.findMany({
          where: { organizationId, id: { in: removedIds } },
          select: { id: true, status: true },
        });
        const doneIds = new Set(statuses.filter((s) => s.status === 'DONE').map((s) => s.id));
        if (doneIds.size > 0) {
          diff = {
            ...diff,
            removed: diff.removed.filter((t) => !doneIds.has(t.id)),
          };
        }
      }

      if (diff.added.length === 0 && diff.updated.length === 0 && diff.removed.length === 0) {
        skippedNoChangeCount++;
        continue;
      }

      const dirEntry = directoryByEmail.get(email);
      const fallbackName = prevLog?.recipientName || dirEntry?.fullName || email.split('@')[0];
      const recipientInfo = briefing?.recipient ??
        dirEntry ?? {
          firstName: fallbackName.split(/\s+/)[0] || 'kolega',
          fullName: fallbackName,
          email,
        };

      const rendered = renderWorkerPlanChangeEmail({
        recipient: recipientInfo,
        organizationName,
        targetDate,
        targetDateLabel: assembly.targetDateLabel,
        isToday,
        diff,
        totalCurrentTasks: currentSnap.tasks.length,
        myTasksUrl: briefing?.myTasksUrl || `${baseUrl}/my-tasks`,
      });

      const emailHash = crypto
        .createHash('sha256')
        .update(`${organizationId}:${targetDate}:${email}`)
        .digest('hex')
        .slice(0, 12);

      try {
        const result = await sendTransactionalEmail({
          to: email,
          bcc: [],
          subject: rendered.subject,
          message: rendered.text,
          customHtml: rendered.html,
          template: 'worker-plan-change',
          organizationId,
          allowPlatformFallback: true,
          idempotencyKey: `plan-change/${targetDate}/${emailHash}/${currentSnap.hash}`,
          metadata: {
            targetDate,
            recipientName: recipientInfo.fullName,
            taskCount: currentSnap.tasks.length,
            planSnapshotHash: currentSnap.hash,
            planSnapshotTasks: currentSnap.tasks,
            addedCount: diff.added.length,
            updatedCount: diff.updated.length,
            removedCount: diff.removed.length,
            isTest: false,
          },
        });

        if (result.status === 'sent') {
          sentCount++;
          deliveries.push({
            targetDate,
            recipientEmail: email,
            recipientName: recipientInfo.fullName,
            added: diff.added.length,
            updated: diff.updated.length,
            removed: diff.removed.length,
            status: 'sent',
          });
        } else {
          deliveries.push({
            targetDate,
            recipientEmail: email,
            recipientName: recipientInfo.fullName,
            added: diff.added.length,
            updated: diff.updated.length,
            removed: diff.removed.length,
            status: 'skipped_env',
          });
        }
      } catch (err) {
        failedCount++;
        deliveries.push({
          targetDate,
          recipientEmail: email,
          recipientName: recipientInfo.fullName,
          added: diff.added.length,
          updated: diff.updated.length,
          removed: diff.removed.length,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Odeslání změny selhalo.',
        });
      }
    }
  }

  return {
    checkedDates,
    sentCount,
    skippedNoChangeCount,
    skippedNotEligibleCount,
    failedCount,
    deliveries,
  };
}

export type ManagerAuditOrderInput = {
  id: string;
  title: string;
  clientName: string;
  status: string;
  scheduledAt: Date;
  updatedAt: Date;
  planningConstraints: unknown;
  assignments: Array<{ workerName: string }>;
};

function asPcObj(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function assembleManagerMorningDigest(input: {
  auditedDate: string;
  yesterdayOrders: ManagerAuditOrderInput[];
  recentRescheduledOrders?: ManagerAuditOrderInput[];
  olderOverdueOrders?: ManagerAuditOrderInput[];
  baseUrl?: string;
  timezone?: string;
}): ManagerMorningDigestData {
  const baseUrl = (input.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');
  const timezone = input.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const auditedDateLabel = formatCzechFullDate(input.auditedDate);

  const rescheduledMap = new Map<string, ManagerMorningDigestItem>();
  for (const order of input.recentRescheduledOrders ?? []) {
    const pc = asPcObj(order.planningConstraints);
    const reportAtStr = typeof pc.lastWorkerReportAt === 'string' ? pc.lastWorkerReportAt : null;
    const movedFromAuditedDay = pc.sheetScheduledDateAtReschedule === input.auditedDate;
    const reportDateIso =
      reportAtStr && !Number.isNaN(new Date(reportAtStr).getTime())
        ? dayInZone(new Date(reportAtStr), timezone)
        : null;
    const reportedOnAuditedDay = reportDateIso === input.auditedDate;
    if (!movedFromAuditedDay && !reportedOnAuditedDay) continue;
    if (pc.lastEmailAction !== 'RESCHEDULED' && !reportAtStr) continue;

    const newDayIso = dayInZone(order.scheduledAt, timezone);
    if (newDayIso <= input.auditedDate && pc.lastEmailAction !== 'RESCHEDULED') continue;

    rescheduledMap.set(order.id, {
      workOrderId: order.id,
      title: order.title,
      clientName: order.clientName,
      workerNames: order.assignments.map((a) => a.workerName.trim()).filter(Boolean),
      status: order.status,
      detailUrl: `${baseUrl}/work/${order.id}`,
      newDateLabel: formatCzechFullDate(newDayIso),
      workerReason: typeof pc.lastWorkerReason === 'string' ? pc.lastWorkerReason : null,
      reportBy: typeof pc.lastWorkerReportBy === 'string' ? pc.lastWorkerReportBy : null,
    });
  }

  const unfinishedItems: ManagerMorningDigestItem[] = [];
  const completedItems: ManagerMorningDigestItem[] = [];
  const seenIds = new Set<string>(rescheduledMap.keys());

  for (const order of input.yesterdayOrders) {
    if (order.status === 'CANCELLED') continue;
    if (rescheduledMap.has(order.id)) continue;
    seenIds.add(order.id);

    const pc = asPcObj(order.planningConstraints);
    const preferredReason =
      pc.lastEmailAction === 'REPORTED_UNFINISHED' && typeof pc.lastWorkerReason === 'string'
        ? pc.lastWorkerReason
        : typeof pc.lastWorkerNote === 'string'
        ? pc.lastWorkerNote
        : typeof pc.lastWorkerReason === 'string'
        ? pc.lastWorkerReason
        : null;
    const item: ManagerMorningDigestItem = {
      workOrderId: order.id,
      title: order.title,
      clientName: order.clientName,
      workerNames: order.assignments.map((a) => a.workerName.trim()).filter(Boolean),
      status: order.status,
      detailUrl: `${baseUrl}/work/${order.id}`,
      workerReason: preferredReason,
      reportBy: typeof pc.lastWorkerReportBy === 'string' ? pc.lastWorkerReportBy : null,
    };

    if (order.status === 'DONE') {
      completedItems.push(item);
    } else {
      unfinishedItems.push(item);
    }
  }

  const olderOverdueItems: ManagerMorningDigestItem[] = [];
  const auditedStartMs = new Date(`${input.auditedDate}T00:00:00Z`).getTime();
  for (const order of input.olderOverdueOrders ?? []) {
    if (order.status === 'DONE' || order.status === 'CANCELLED') continue;
    if (seenIds.has(order.id)) continue;
    seenIds.add(order.id);

    const pc = asPcObj(order.planningConstraints);
    const schedDayIso = dayInZone(order.scheduledAt, timezone);
    const schedDayMs = new Date(`${schedDayIso}T00:00:00Z`).getTime();
    const daysPastAudited = Number.isFinite(schedDayMs)
      ? Math.max(2, Math.round((auditedStartMs - schedDayMs) / (24 * 60 * 60 * 1000)) + 1)
      : 2;

    olderOverdueItems.push({
      workOrderId: order.id,
      title: order.title,
      clientName: order.clientName,
      workerNames: order.assignments.map((a) => a.workerName.trim()).filter(Boolean),
      status: order.status,
      detailUrl: `${baseUrl}/work/${order.id}`,
      scheduledDateLabel: formatCzechFullDate(schedDayIso),
      overdueDays: daysPastAudited,
      workerReason:
        typeof pc.lastWorkerReason === 'string'
          ? pc.lastWorkerReason
          : typeof pc.lastWorkerNote === 'string'
          ? pc.lastWorkerNote
          : null,
      reportBy: typeof pc.lastWorkerReportBy === 'string' ? pc.lastWorkerReportBy : null,
    });
  }

  return {
    auditedDate: input.auditedDate,
    auditedDateLabel,
    plannerUrl: `${baseUrl}/planner`,
    workUrl: `${baseUrl}/work`,
    rescheduledItems: [...rescheduledMap.values()],
    unfinishedItems,
    olderOverdueItems,
    completedItems,
  };
}

export function renderManagerMorningDigestEmail(
  digest: ManagerMorningDigestData,
  organizationName: string,
  options?: { isTest?: boolean; batchCompleteUrl?: string; batchRescheduleUrl?: string }
): { subject: string; html: string; text: string } {
  const prefix = options?.isTest ? '[TEST] ' : '';
  const openCount = digest.unfinishedItems.length;
  const olderOverdueItems = digest.olderOverdueItems ?? [];
  const olderCount = olderOverdueItems.length;
  const movedCount = digest.rescheduledItems.length;
  const doneCount = digest.completedItems.length;

  const subject =
    openCount > 0 || olderCount > 0 || movedCount > 0
      ? `${prefix}Ranní kontrola plánu (${digest.auditedDateLabel}): ${openCount} neuzavřeno${
          olderCount > 0 ? `, ${olderCount} starších po termínu` : ''
        }, ${movedCount} přesunuto`
      : `${prefix}Ranní kontrola plánu (${digest.auditedDateLabel}): vše hotovo (${doneCount})`;

  const renderItemCard = (
    item: ManagerMorningDigestItem,
    accent: { border: string; bg: string; badgeText: string; badgeColor: string }
  ) => `
    <div style="margin:0 0 10px;border:1px solid ${accent.border};border-radius:12px;padding:12px 14px;background:${accent.bg};">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:${accent.badgeColor};margin-bottom:4px;">
        ${escapeHtml(accent.badgeText)}
      </div>
      <div style="font-size:14.5px;font-weight:800;color:#0f172a;margin:0 0 4px;">
        <a href="${escapeHtml(item.detailUrl)}" style="color:#0f172a;text-decoration:none;">${escapeHtml(item.title)}</a>
      </div>
      <div style="font-size:12.5px;color:#475569;line-height:1.45;">
        Klient: <strong>${escapeHtml(item.clientName)}</strong>
        ${item.workerNames.length ? ` · Tým: ${escapeHtml(item.workerNames.join(', '))}` : ''}
        ${item.scheduledDateLabel ? ` · Původní termín: <strong>${escapeHtml(item.scheduledDateLabel)}</strong>` : ''}
        ${item.newDateLabel ? ` · Nový termín: <strong>${escapeHtml(item.newDateLabel)}</strong>` : ''}
      </div>
      ${
        item.workerReason
          ? `<div style="margin-top:6px;padding:7px 10px;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;font-size:12.5px;color:#334155;">Poznámka${
              item.reportBy ? ` (${escapeHtml(item.reportBy)})` : ''
            }: ${escapeHtml(item.workerReason)}</div>`
          : ''
      }
    </div>
  `;

  const completedByRealizer = new Map<string, ManagerMorningDigestItem[]>();
  for (const item of digest.completedItems) {
    const realizer =
      item.reportBy?.trim() ||
      (item.workerNames.length > 0 ? item.workerNames.join(', ') : 'Realizační tým');
    const list = completedByRealizer.get(realizer) || [];
    list.push(item);
    completedByRealizer.set(realizer, list);
  }
  const completedGroupsHtml = Array.from(completedByRealizer.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'cs'))
    .map(
      ([realizer, items]) => `
        <div style="margin:0 0 14px;border:1px solid #a7f3d0;border-radius:12px;background:#f0fdf4;padding:12px 14px;">
          <div style="font-size:12px;font-weight:900;color:#065f46;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">
            👤 ${escapeHtml(realizer)} · ${items.length} ${items.length === 1 ? 'úkol' : items.length < 5 ? 'úkoly' : 'úkolů'}
          </div>
          ${items
            .map(
              (item) => `
              <div style="margin:0 0 8px;border:1px solid #d1fae5;border-radius:10px;padding:10px 12px;background:#ffffff;">
                <div style="font-size:13.5px;font-weight:800;color:#0f172a;">
                  <a href="${escapeHtml(item.detailUrl)}" style="color:#0f172a;text-decoration:none;">✅ ${escapeHtml(item.title)}</a>
                </div>
                <div style="font-size:12px;color:#475569;margin-top:3px;">
                  Klient: <strong>${escapeHtml(item.clientName)}</strong>
                  ${item.workerNames.length ? ` · Tým: ${escapeHtml(item.workerNames.join(', '))}` : ''}
                </div>
                ${
                  item.workerReason
                    ? `<div style="margin-top:6px;padding:6px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#334155;">💬 Poznámka: ${escapeHtml(item.workerReason)}</div>`
                    : ''
                }
              </div>`
            )
            .join('')}
        </div>`
    )
    .join('');

  const totalActionableOpen = openCount + olderCount;
  const managerBatchBarHtml =
    totalActionableOpen > 0 && (options?.batchCompleteUrl || options?.batchRescheduleUrl)
      ? `<div style="margin:0 0 12px;padding:12px 14px;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;">
          <div style="font-size:12px;font-weight:800;color:#881337;margin-bottom:8px;">
            ⚡ Hromadná akce pro neuzavřené úkoly (vyber více úkolů najednou):
          </div>
          <div>
            ${
              options?.batchCompleteUrl
                ? `<a href="${escapeHtml(options.batchCompleteUrl)}" style="display:inline-block;margin:0 8px 6px 0;padding:9px 14px;border-radius:9px;background:#059669;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">✅ Hromadně označit vybrané jako HOTOVÉ (${totalActionableOpen})</a>`
                : ''
            }
            ${
              options?.batchRescheduleUrl
                ? `<a href="${escapeHtml(options.batchRescheduleUrl)}" style="display:inline-block;margin:0 0 6px 0;padding:9px 14px;border-radius:9px;background:#d97706;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">⏳ Hromadně přesunout vybrané</a>`
                : ''
            }
          </div>
        </div>`
      : '';

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:22px 24px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#34d399;margin-bottom:6px;">
            ${escapeHtml(organizationName)} · Ranní manažerský souhrn${options?.isTest ? ' (TEST)' : ''}
          </div>
          <h1 style="margin:0 0 8px;font-size:20px;line-height:1.25;font-weight:900;color:#ffffff;">
            Kontrola plánu za ${escapeHtml(digest.auditedDateLabel)}
          </h1>
          <div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.08);font-size:13px;color:#e2e8f0;font-weight:700;">
            ❗ Neuzavřeno: ${openCount}${olderCount > 0 ? `  ·  ⚠️ Starší po termínu: ${olderCount}` : ''}  ·  ⏳ Přesunuto pracovníky: ${movedCount}  ·  ✅ Dokončeno: ${doneCount}
          </div>
          <div style="margin-top:12px;">
            <a href="${escapeHtml(digest.plannerUrl)}" style="display:inline-block;margin:4px 8px 0 0;padding:10px 16px;border-radius:10px;background:#059669;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">
              Otevřít Planner →
            </a>
            <a href="${escapeHtml(digest.workUrl)}${olderCount > 0 || openCount > 0 ? '?filter=overdue' : ''}" style="display:inline-block;margin:4px 0 0 0;padding:10px 16px;border-radius:10px;background:#334155;color:#ffffff;font-size:12.5px;font-weight:800;text-decoration:none;">
              Plán práce${olderCount + openCount > 0 ? ' (po termínu)' : ''} →
            </a>
          </div>
        </div>
        <div style="padding:18px 20px;">
          ${
            openCount > 0
              ? `<h2 style="margin:0 0 10px;font-size:14px;font-weight:900;text-transform:uppercase;color:#be123c;">❗ Neuzavřeno za včerejšek (${openCount})</h2>
                 ${managerBatchBarHtml}
                 ${digest.unfinishedItems
                   .map((i) =>
                     renderItemCard(i, {
                       border: '#fecdd3',
                       bg: '#fff1f2',
                       badgeText: 'Bez uzavření',
                       badgeColor: '#be123c',
                     })
                   )
                   .join('')}`
              : ''
          }
          ${
            olderCount > 0
              ? `<h2 style="margin:14px 0 10px;font-size:14px;font-weight:900;text-transform:uppercase;color:#9a3412;">⚠️ Starší nepřeplánované úkoly po termínu (${olderCount})</h2>
                 ${openCount === 0 ? managerBatchBarHtml : ''}
                 ${olderOverdueItems
                   .map((i) =>
                     renderItemCard(i, {
                       border: '#fdba74',
                       bg: '#fff7ed',
                       badgeText: i.overdueDays ? `Po termínu (${i.overdueDays} d)` : 'Starší po termínu',
                       badgeColor: '#9a3412',
                     })
                   )
                   .join('')}`
              : ''
          }
          ${
            movedCount > 0
              ? `<h2 style="margin:14px 0 10px;font-size:14px;font-weight:900;text-transform:uppercase;color:#b45309;">⏳ Nestihlo se / přesunuto pracovníky (${movedCount})</h2>
                 ${digest.rescheduledItems
                   .map((i) =>
                     renderItemCard(i, {
                       border: '#fde68a',
                       bg: '#fffbeb',
                       badgeText: i.newDateLabel ? `Přesunuto na ${i.newDateLabel}` : 'Přesunuto',
                       badgeColor: '#b45309',
                     })
                   )
                   .join('')}`
              : ''
          }
          ${
            doneCount > 0
              ? `<h2 style="margin:14px 0 10px;font-size:14px;font-weight:900;text-transform:uppercase;color:#047857;">✅ Dokončeno podle realizátora (${doneCount})</h2>
                 ${completedGroupsHtml}`
              : ''
          }
          ${
            openCount === 0 && olderCount === 0 && movedCount === 0 && doneCount === 0
              ? '<p style="margin:0;font-size:13px;color:#64748b;">Za tento den nebyly naplánovány žádné zakázky.</p>'
              : ''
          }
        </div>
      </div>
    </div>
  `;

  const textLines = [
    subject,
    `Neuzavřeno: ${openCount}${olderCount > 0 ? ` | Starší po termínu: ${olderCount}` : ''} | Přesunuto: ${movedCount} | Dokončeno: ${doneCount}`,
    '',
    ...digest.unfinishedItems.map(
      (i) => `[NEUZAVŘENO] ${i.title} (${i.clientName}) – ${i.workerNames.join(', ')} | ${i.detailUrl}`
    ),
    ...olderOverdueItems.map(
      (i) =>
        `[STARŠÍ PO TERMÍNU (${i.scheduledDateLabel || '?'})] ${i.title} (${i.clientName}) – ${i.workerNames.join(', ')} | ${i.detailUrl}`
    ),
    ...digest.rescheduledItems.map(
      (i) =>
        `[PŘESUNUTO -> ${i.newDateLabel || '?'}] ${i.title} (${i.workerReason || 'bez poznámky'}) | ${i.detailUrl}`
    ),
    ...digest.completedItems.map(
      (i) =>
        `[HOTOVO] ${i.title} (${i.clientName}) – Realizoval: ${i.reportBy || i.workerNames.join(', ') || 'Tým'}${
          i.workerReason ? ` | Poznámka: ${i.workerReason}` : ''
        }`
    ),
    '',
    `Planner: ${digest.plannerUrl}`,
  ];

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}

export async function loadManagerMorningDigestForOrganization(
  organizationId: string,
  options?: { auditedDate?: string; timezone?: string; baseUrl?: string }
): Promise<ManagerMorningDigestData> {
  const settings = await getManagerDigestSettings(organizationId);
  const timezone = options?.timezone || settings.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const todayStr = dayInZone(new Date(), timezone);
  const auditedDate = options?.auditedDate || addCalendarDays(todayStr, -1);
  const { start, end } = getDayBoundsUtc(auditedDate, timezone);
  const rescheduleLookbackStart = new Date(start.getTime() - 12 * 60 * 60 * 1000);
  const olderOverdueLookbackStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);

  const select = {
    id: true,
    title: true,
    clientName: true,
    status: true,
    scheduledAt: true,
    updatedAt: true,
    planningConstraints: true,
    assignments: { select: { workerName: true } },
  } as const;

  const [yesterdayOrders, recentRescheduledOrders, olderOverdueOrders] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId,
        status: { not: 'CANCELLED' },
        scheduledAt: { gte: start, lt: end },
      },
      select,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }],
    }),
    prisma.workOrder.findMany({
      where: {
        organizationId,
        status: { not: 'CANCELLED' },
        updatedAt: { gte: rescheduleLookbackStart },
      },
      select,
      orderBy: { updatedAt: 'desc' },
      take: 150,
    }),
    prisma.workOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        scheduledAt: { gte: olderOverdueLookbackStart, lt: start },
      },
      select,
      orderBy: [{ scheduledAt: 'asc' }, { priority: 'desc' }],
      take: 40,
    }),
  ]);

  return assembleManagerMorningDigest({
    auditedDate,
    yesterdayOrders,
    recentRescheduledOrders,
    olderOverdueOrders,
    baseUrl: options?.baseUrl,
    timezone,
  });
}

export async function sendManagerMorningDigestForOrganization(
  organizationId: string,
  options?: {
    auditedDate?: string;
    force?: boolean;
    testRecipientEmail?: string;
    baseUrl?: string;
  }
) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const organizationName = org?.name || 'SeePoint OS';
  const digest = await loadManagerMorningDigestForOrganization(organizationId, {
    auditedDate: options?.auditedDate,
    baseUrl: options?.baseUrl,
  });

  const baseUrl = (options?.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');
  const unfinishedOrderIds = [
    ...digest.unfinishedItems.map((i) => i.workOrderId),
    ...(digest.olderOverdueItems ?? []).map((i) => i.workOrderId),
  ].filter(Boolean);

  if (options?.testRecipientEmail) {
    const testEmail = options.testRecipientEmail.trim().toLowerCase();
    if (!isValidEmailAddress(testEmail)) {
      throw new Error('Zadaný testovací e-mail nemá platný formát.');
    }
    const testRecipient: WorkerRecipient = {
      key: `test-${testEmail}`,
      fullName: 'Manažer',
      firstName: 'Manažer',
      lastName: '',
      email: testEmail,
      role: 'MANAGER',
    };
    const rendered = renderManagerMorningDigestEmail(digest, organizationName, {
      isTest: true,
      batchCompleteUrl:
        unfinishedOrderIds.length > 0
          ? buildEmailActionLink(organizationId, unfinishedOrderIds, 'complete', testRecipient, baseUrl)
          : undefined,
      batchRescheduleUrl:
        unfinishedOrderIds.length > 0
          ? buildEmailActionLink(organizationId, unfinishedOrderIds, 'reschedule', testRecipient, baseUrl)
          : undefined,
    });
    const result = await sendTransactionalEmail({
      to: testEmail,
      bcc: [],
      subject: rendered.subject,
      message: rendered.text,
      customHtml: rendered.html,
      template: 'manager-morning-digest',
      organizationId,
      allowPlatformFallback: true,
      metadata: { auditedDate: digest.auditedDate, isTest: true },
    });
    return {
      auditedDate: digest.auditedDate,
      sentCount: result.status === 'sent' ? 1 : 0,
      skippedAlreadySentCount: 0,
      skippedEmpty: false,
      recipientsCount: 1,
    };
  }

  const totalItems =
    digest.unfinishedItems.length +
    (digest.olderOverdueItems?.length ?? 0) +
    digest.rescheduledItems.length +
    digest.completedItems.length;
  if (totalItems === 0 && !options?.force) {
    return {
      auditedDate: digest.auditedDate,
      sentCount: 0,
      skippedAlreadySentCount: 0,
      skippedEmpty: true,
      recipientsCount: 0,
    };
  }

  const directory = await loadOrganizationWorkerDirectory(organizationId);
  const managers = directory.filter((r) => ['ADMIN', 'MANAGER'].includes(r.role));
  if (managers.length === 0) {
    return {
      auditedDate: digest.auditedDate,
      sentCount: 0,
      skippedAlreadySentCount: 0,
      skippedEmpty: false,
      recipientsCount: 0,
    };
  }

  const alreadySentEmails = new Set<string>();
  if (!options?.force) {
    const recentLogs = await prisma.emailLog.findMany({
      where: {
        organizationId,
        template: 'manager-morning-digest',
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) },
      },
      select: { recipient: true, metadata: true },
    });
    for (const log of recentLogs) {
      const meta = asPcObj(log.metadata);
      if (meta.auditedDate === digest.auditedDate && meta.isTest !== true) {
        alreadySentEmails.add(log.recipient.trim().toLowerCase());
      }
    }
  }

  let sentCount = 0;
  let skippedAlreadySentCount = 0;

  for (const manager of managers) {
    const emailLower = manager.email.toLowerCase();
    if (alreadySentEmails.has(emailLower)) {
      skippedAlreadySentCount++;
      continue;
    }

    const rendered = renderManagerMorningDigestEmail(digest, organizationName, {
      batchCompleteUrl:
        unfinishedOrderIds.length > 0
          ? buildEmailActionLink(organizationId, unfinishedOrderIds, 'complete', manager, baseUrl)
          : undefined,
      batchRescheduleUrl:
        unfinishedOrderIds.length > 0
          ? buildEmailActionLink(organizationId, unfinishedOrderIds, 'reschedule', manager, baseUrl)
          : undefined,
    });

    const idempHash = crypto
      .createHash('sha256')
      .update(`${organizationId}:manager-digest:${digest.auditedDate}:${emailLower}`)
      .digest('hex')
      .slice(0, 16);

    try {
      const result = await sendTransactionalEmail({
        to: manager.email,
        bcc: [],
        subject: rendered.subject,
        message: rendered.text,
        customHtml: rendered.html,
        template: 'manager-morning-digest',
        organizationId,
        allowPlatformFallback: true,
        idempotencyKey: options?.force
          ? undefined
          : `manager-digest/${digest.auditedDate}/${idempHash}`,
        metadata: {
          auditedDate: digest.auditedDate,
          recipientName: manager.fullName,
          unfinishedCount: digest.unfinishedItems.length,
          rescheduledCount: digest.rescheduledItems.length,
          completedCount: digest.completedItems.length,
          isTest: false,
        },
      });
      if (result.status === 'sent') sentCount++;
    } catch (err) {
      console.error(`[manager-morning-digest] Failed sending to ${manager.email}:`, err);
    }
  }

  return {
    auditedDate: digest.auditedDate,
    sentCount,
    skippedAlreadySentCount,
    skippedEmpty: false,
    recipientsCount: managers.length,
  };
}
