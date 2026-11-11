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

export const DEFAULT_BRIEFING_TIMEZONE = 'Europe/Prague';
export const DEFAULT_BRIEFING_HOUR = 17;

export type DailyBriefingSettings = {
  enabled: boolean;
  sendHourLocal: number;
  timezone: string;
  skipWeekends: boolean;
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
  description?: string | null;
};

export type WorkerDailyBriefing = {
  recipient: WorkerRecipient;
  targetDate: string;
  targetDateLabel: string;
  routeUrl?: string;
  myTasksUrl: string;
  vehicles: string[];
  crewMates: string[];
  tasks: BriefingTaskItem[];
};

export type BriefingAssemblyResult = {
  targetDate: string;
  targetDateLabel: string;
  briefings: WorkerDailyBriefing[];
  unmatchedWorkerNames: string[];
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

export function sanitizeDailyBriefingSettings(
  input: unknown,
  organizationId?: string
): DailyBriefingSettings {
  const obj =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const defaultEnabled = organizationId === 'org_seepoint_default';
  const enabled =
    typeof obj.enabled === 'boolean' ? obj.enabled : defaultEnabled;

  let sendHourLocal = DEFAULT_BRIEFING_HOUR;
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

export async function getDailyBriefingSettings(
  organizationId: string
): Promise<DailyBriefingSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plannerDefaults: true },
  });
  const defaults = (org?.plannerDefaults as Record<string, unknown> | null) || null;
  return sanitizeDailyBriefingSettings(defaults?.dailyWorkerBriefing, organizationId);
}

export async function saveDailyBriefingSettings(
  organizationId: string,
  input: Partial<DailyBriefingSettings>
): Promise<DailyBriefingSettings> {
  const current = await getDailyBriefingSettings(organizationId);
  const merged = sanitizeDailyBriefingSettings(
    { ...current, ...input },
    organizationId
  );

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plannerDefaults: true },
  });
  const existingDefaults =
    (org?.plannerDefaults as Record<string, unknown> | null) || {};

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plannerDefaults: {
        ...existingDefaults,
        dailyWorkerBriefing: merged,
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

export function assembleWorkerBriefings(input: {
  targetDate: string;
  orders: BriefingOrderInput[];
  fieldPlans: BriefingFieldPlanInput[];
  directory: WorkerRecipient[];
  baseUrl?: string;
  timezone?: string;
}): BriefingAssemblyResult {
  const baseUrl = (input.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');
  const timezone = input.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const targetDateLabel = formatCzechFullDate(input.targetDate);

  const ordersById = new Map<string, BriefingOrderInput>();
  for (const order of input.orders) {
    ordersById.set(order.id, order);
  }

  type Bucket = {
    recipient: WorkerRecipient;
    tasks: BriefingTaskItem[];
    coveredWorkOrderIds: Set<string>;
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
      coveredWorkOrderIds: new Set<string>(),
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
          description: order.description,
        });
      }
    }
  }

  // 3. Finalize and sort each worker's tasks
  const briefings: WorkerDailyBriefing[] = [...buckets.values()]
    .filter((b) => b.tasks.length > 0)
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

      return {
        recipient: b.recipient,
        targetDate: input.targetDate,
        targetDateLabel,
        routeUrl: b.hasRoute ? `${baseUrl}/my-route?date=${input.targetDate}` : undefined,
        myTasksUrl: `${baseUrl}/my-tasks`,
        vehicles: [...b.vehicles],
        crewMates: [...b.crewMates],
        tasks: b.tasks,
      };
    })
    .sort((a, b) => a.recipient.fullName.localeCompare(b.recipient.fullName, 'cs'));

  return {
    targetDate: input.targetDate,
    targetDateLabel,
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
  const countLabel = `${briefing.tasks.length} ${czechTaskCountLabel(briefing.tasks.length)}`;
  const prefix = options?.isTest ? '[TEST] ' : '';
  const subject = `${prefix}Plán práce na zítra (${briefing.targetDateLabel}) – ${countLabel}`;

  const primaryActionUrl = briefing.routeUrl || briefing.myTasksUrl;
  const primaryActionLabel = briefing.routeUrl
    ? 'Otevřít interaktivní trasu v mobilu'
    : 'Otevřít moje úkoly v SeePoint OS';

  const summaryParts: string[] = [`📋 ${countLabel}`];
  if (briefing.vehicles.length > 0) summaryParts.push(`🚗 ${briefing.vehicles.join(', ')}`);
  if (briefing.crewMates.length > 0) summaryParts.push(`👥 Společně s: ${briefing.crewMates.join(', ')}`);

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

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:24px 24px 20px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;margin-bottom:6px;">
            ${escapeHtml(organizationName)} · Automatický plán práce${options?.isTest ? ' (TESTOVACÍ NÁHLED)' : ''}
          </div>
          <h1 style="margin:0 0 6px;font-size:22px;line-height:1.25;font-weight:900;color:#ffffff;">
            Zítřejší plán: ${escapeHtml(briefing.targetDateLabel)}
          </h1>
          <p style="margin:0 0 14px;font-size:14px;color:#cbd5e1;">
            Dobrý den, <strong style="color:#ffffff;">${escapeHtml(briefing.recipient.fullName)}</strong>, zde máte přehled úkolů na zítřek, abyste se mohl/a předem připravit.
          </p>
          <div style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.08);font-size:12.5px;color:#e2e8f0;font-weight:600;">
            ${escapeHtml(summaryParts.join('  ·  '))}
          </div>
          <div style="margin-top:16px;">
            <a href="${escapeHtml(primaryActionUrl)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#0284c7;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">
              📱 ${escapeHtml(primaryActionLabel)} →
            </a>
          </div>
        </div>
        <div style="padding:18px 18px 8px;">
          ${taskCardsHtml}
        </div>
        <div style="padding:14px 24px 22px;font-size:11.5px;line-height:1.5;color:#64748b;text-align:center;">
          Tento souhrn byl automaticky odeslán systémem SeePoint OS den předem.<br>
          Případné ranní změny či doplnění vždy uvidíte aktuálně v aplikaci.
        </div>
      </div>
    </div>
  `;

  const textLines = [
    `${prefix}Plán práce na zítra (${briefing.targetDateLabel}) – ${organizationName}`,
    `Pracovník: ${briefing.recipient.fullName}`,
    summaryParts.join(' | '),
    '',
    ...briefing.tasks.flatMap((task, idx) => [
      `${idx + 1}. ${task.title} (${task.clientName})`,
      task.address ? `   Místo: ${task.address}` : null,
      task.contactPhone ? `   Kontakt: ${task.contactName || ''} ${task.contactPhone}` : null,
      task.mapsUrl ? `   Mapa: ${task.mapsUrl}` : null,
      task.driveUrl ? `   Disk: ${task.driveUrl}` : null,
      `   Detail: ${task.detailUrl}`,
      '',
    ]).filter((l): l is string => l !== null),
    `Otevřít v aplikaci: ${primaryActionUrl}`,
  ];

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

export async function loadDailyBriefingsForOrganization(
  organizationId: string,
  options?: { targetDate?: string; timezone?: string; baseUrl?: string }
): Promise<BriefingAssemblyResult> {
  const settings = await getDailyBriefingSettings(organizationId);
  const timezone = options?.timezone || settings.timezone || DEFAULT_BRIEFING_TIMEZONE;
  const targetDate = options?.targetDate || getTomorrowDateStr(new Date(), timezone);
  const { start, end } = getDayBoundsUtc(targetDate, timezone);

  const [orders, fieldPlans, directory] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        scheduledAt: { gte: start, lt: end },
      },
      select: {
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
      },
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

  return assembleWorkerBriefings({
    targetDate,
    orders,
    fieldPlans,
    directory,
    baseUrl: options?.baseUrl,
    timezone,
  });
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

    const matchingWorkerBriefing =
      assembly.briefings.find((b) => b.recipient.email === testEmail) || assembly.briefings[0];

    const baseUrl = (options.baseUrl || resolvePublicAppUrl()).replace(/\/+$/, '');
    const sampleBriefing: WorkerDailyBriefing = matchingWorkerBriefing
      ? {
          ...matchingWorkerBriefing,
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
          myTasksUrl: `${baseUrl}/my-tasks`,
          vehicles: ['Dodávka 1 (ukázka)'],
          crewMates: ['Kolega z týmu'],
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
