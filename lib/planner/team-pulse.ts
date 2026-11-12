import { logAIUsage } from '@/lib/ai-usage';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { canonicalFirstName, normalizePersonToken } from './work-projection';
import { dateInZone, plusDays } from './time';

export type TeamDailyTaskItem = {
  id: string;
  workOrderId?: string;
  title: string;
  clientName?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'RESCHEDULED';
  acknowledged?: boolean;
  note?: string | null;
  newDateLabel?: string | null;
  hoursWorked?: number | null;
  href: string;
};

export type MemberDailyActivity = {
  activeTasks: TeamDailyTaskItem[];
  completedTasks: TeamDailyTaskItem[];
  rescheduledTasks: TeamDailyTaskItem[];
  loggedHoursToday: number;
  entriesCountToday: number;
};

export type CompanyDailyFeedItem = TeamDailyTaskItem & {
  workerNames: string[];
  updatedAt?: string;
};

export type CompanyDailyPulse = {
  date: string;
  activeCount: number;
  acknowledgedCount: number;
  completedCount: number;
  rescheduledCount: number;
  loggedHoursTotal: number;
  recentFeed: CompanyDailyFeedItem[];
};

export type MeetingActionItemDraft = {
  id: string;
  title: string;
  assigneeName: string | null;
  assigneeUserId: string | null;
  dueDate: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  estimatedHours: number | null;
  createWorkOrder: boolean;
  addToMyPlannerBlock: boolean;
  blockStartTime?: string | null;
  createdWorkOrderId?: string | null;
  createdPlannerBlockId?: string | null;
};

export type MeetingReportRecord = {
  id: string;
  title: string;
  meetingDate: string;
  createdAt: string;
  createdByName: string;
  sourceType: 'TRANSCRIPT' | 'EMAIL';
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItemDraft[];
  emailedToCount?: number;
};

export type PulseMemberRef = {
  userId: string;
  name: string;
  employeeId?: string | null;
};

export type PulseOrderInput = {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  scheduledAt: Date;
  updatedAt: Date;
  planningConstraints: unknown;
  assignments: Array<{
    userId: string | null;
    workerName: string;
    acknowledgedAt?: Date | null;
    note?: string | null;
  }>;
};

export type PulseWorkEntryInput = {
  id: string;
  employeeId: string;
  workOrderId: string | null;
  workTaskId: string;
  clientName: string | null;
  remunerationMethod: string;
  quantity: number;
  unit: string;
  note: string | null;
  workTaskTitle?: string | null;
};

function asObject(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

export function matchWorkerToMember(
  assignment: { userId: string | null; workerName: string },
  members: PulseMemberRef[]
): PulseMemberRef | null {
  if (assignment.userId) {
    const byId = members.find((m) => m.userId === assignment.userId);
    if (byId) return byId;
  }
  const rawName = assignment.workerName?.trim();
  if (!rawName) return null;

  const normFull = normalizePersonToken(rawName);
  const direct = members.find((m) => normalizePersonToken(m.name) === normFull);
  if (direct) return direct;

  const tokens = normFull.split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const firstCanonical = canonicalFirstName(tokens[0]);

  const firstMatches = members.filter((m) => {
    const memberTokens = normalizePersonToken(m.name).split(' ').filter(Boolean);
    return memberTokens.length > 0 && canonicalFirstName(memberTokens[0]) === firstCanonical;
  });

  if (tokens.length > 1 && firstMatches.length > 1) {
    const surnamePrefix = tokens[tokens.length - 1].slice(0, 3);
    const bySurname = firstMatches.find((m) => {
      const memberTokens = normalizePersonToken(m.name).split(' ').filter(Boolean);
      const last = memberTokens[memberTokens.length - 1] || '';
      return surnamePrefix.length >= 2 && last.startsWith(surnamePrefix);
    });
    if (bySurname) return bySurname;
  }

  return firstMatches.length === 1 ? firstMatches[0] : null;
}

function isOrderAcknowledgedByWorker(
  pc: Record<string, unknown>,
  assignment: { userId: string | null; workerName: string; acknowledgedAt?: Date | null }
): boolean {
  if (assignment.acknowledgedAt) return true;
  const ackMap = asObject(pc.dailyBriefingAck);
  for (const val of Object.values(ackMap)) {
    const entry = asObject(val);
    if (entry.acknowledgedAt) {
      const ackName = typeof entry.workerName === 'string' ? entry.workerName : '';
      if (!ackName) return true;
      const aTokens = normalizePersonToken(ackName).split(' ');
      const wTokens = normalizePersonToken(assignment.workerName).split(' ');
      if (aTokens[0] && wTokens[0] && canonicalFirstName(aTokens[0]) === canonicalFirstName(wTokens[0])) {
        return true;
      }
    }
  }
  return false;
}

function resolveRescheduledFromDate(
  order: PulseOrderInput,
  targetDate: string,
  timezone: string
): { movedFromDate: boolean; newDateLabel: string; reason: string | null } {
  const pc = asObject(order.planningConstraints);
  const currentDayIso = dateInZone(order.scheduledAt, timezone);
  const newDateLabel = order.scheduledAt.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    timeZone: timezone,
  });

  const history = Array.isArray(pc.rescheduleHistory) ? pc.rescheduleHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = asObject(history[i]);
    if (h.fromDate === targetDate && currentDayIso !== targetDate) {
      return {
        movedFromDate: true,
        newDateLabel,
        reason: typeof h.reason === 'string' && h.reason.trim() ? h.reason.trim() : null,
      };
    }
  }

  if (pc.sheetScheduledDateAtReschedule === targetDate && currentDayIso !== targetDate) {
    return {
      movedFromDate: true,
      newDateLabel,
      reason:
        typeof pc.lastWorkerReason === 'string' && pc.lastWorkerReason.trim()
          ? pc.lastWorkerReason.trim()
          : null,
    };
  }

  return { movedFromDate: false, newDateLabel, reason: null };
}

export function buildCompanyAndMemberDailyPulse(params: {
  date: string;
  timezone: string;
  members: PulseMemberRef[];
  orders: PulseOrderInput[];
  workEntries: PulseWorkEntryInput[];
}): {
  companyPulse: CompanyDailyPulse;
  byUserId: Record<string, MemberDailyActivity>;
} {
  const { date, timezone, members, orders, workEntries } = params;

  const byUserId: Record<string, MemberDailyActivity> = {};
  const employeeToUser = new Map<string, string>();
  for (const m of members) {
    byUserId[m.userId] = {
      activeTasks: [],
      completedTasks: [],
      rescheduledTasks: [],
      loggedHoursToday: 0,
      entriesCountToday: 0,
    };
    if (m.employeeId) {
      employeeToUser.set(m.employeeId, m.userId);
    }
  }

  // Group WorkEntries by workOrderId and employeeId
  const hoursByOrderAndUser = new Map<string, number>();
  const notesByOrderAndUser = new Map<string, string>();
  let loggedHoursTotal = 0;

  for (const entry of workEntries) {
    const userId = employeeToUser.get(entry.employeeId);
    const isHours =
      entry.remunerationMethod === 'HOURLY' ||
      entry.unit.toLowerCase().includes('hod') ||
      entry.unit.toLowerCase() === 'h';
    const hrs = isHours ? Number(entry.quantity) || 0 : 0;
    if (hrs > 0) {
      loggedHoursTotal += hrs;
    }

    if (userId && byUserId[userId]) {
      byUserId[userId].entriesCountToday += 1;
      byUserId[userId].loggedHoursToday =
        Math.round((byUserId[userId].loggedHoursToday + hrs) * 10) / 10;

      if (entry.workOrderId) {
        const key = `${entry.workOrderId}:${userId}`;
        hoursByOrderAndUser.set(key, (hoursByOrderAndUser.get(key) ?? 0) + hrs);
        if (entry.note?.trim()) {
          notesByOrderAndUser.set(key, entry.note.trim());
        }
      } else {
        // Standalone workTask entry without workOrder
        byUserId[userId].completedTasks.push({
          id: `entry:${entry.id}`,
          title: entry.workTaskTitle || 'Výkaz práce',
          clientName: entry.clientName,
          status: 'DONE',
          note: entry.note,
          hoursWorked: hrs > 0 ? Math.round(hrs * 10) / 10 : null,
          href: '/work/entries',
        });
      }
    }
  }

  let activeCount = 0;
  let acknowledgedCount = 0;
  let completedCount = 0;
  let rescheduledCount = 0;
  const recentFeed: CompanyDailyFeedItem[] = [];

  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;
    const pc = asObject(order.planningConstraints);
    const scheduledDayIso = dateInZone(order.scheduledAt, timezone);
    const completedViaEmailAt =
      typeof pc.completedViaEmailAt === 'string' ? pc.completedViaEmailAt : null;
    const completedDayIso =
      completedViaEmailAt && !Number.isNaN(new Date(completedViaEmailAt).getTime())
        ? dateInZone(new Date(completedViaEmailAt), timezone)
        : dateInZone(order.updatedAt, timezone);

    const rescheduleCheck = resolveRescheduledFromDate(order, date, timezone);
    const workerNote =
      typeof pc.lastWorkerNote === 'string' && pc.lastWorkerNote.trim()
        ? pc.lastWorkerNote.trim()
        : typeof pc.lastWorkerReason === 'string' && pc.lastWorkerReason.trim()
        ? pc.lastWorkerReason.trim()
        : null;

    const workerNames = order.assignments.map((a) => a.workerName.trim()).filter(Boolean);
    const matchedMembers = new Map<string, { member: PulseMemberRef; assignment: PulseOrderInput['assignments'][number] }>();
    for (const assignment of order.assignments) {
      const m = matchWorkerToMember(assignment, members);
      if (m && !matchedMembers.has(m.userId)) {
        matchedMembers.set(m.userId, { member: m, assignment });
      }
    }

    if (rescheduleCheck.movedFromDate) {
      rescheduledCount += 1;
      const feedItem: CompanyDailyFeedItem = {
        id: order.id,
        workOrderId: order.id,
        title: order.title,
        clientName: order.clientName,
        status: 'RESCHEDULED',
        note: rescheduleCheck.reason || workerNote,
        newDateLabel: rescheduleCheck.newDateLabel,
        href: `/work/${order.id}`,
        workerNames,
        updatedAt: order.updatedAt.toISOString(),
      };
      recentFeed.push(feedItem);

      for (const { member } of matchedMembers.values()) {
        byUserId[member.userId]?.rescheduledTasks.push({
          id: order.id,
          workOrderId: order.id,
          title: order.title,
          clientName: order.clientName,
          status: 'RESCHEDULED',
          note: rescheduleCheck.reason || workerNote,
          newDateLabel: rescheduleCheck.newDateLabel,
          href: `/work/${order.id}`,
        });
      }
      continue;
    }

    if (order.status === 'DONE' && (scheduledDayIso === date || completedDayIso === date)) {
      completedCount += 1;
      const feedItem: CompanyDailyFeedItem = {
        id: order.id,
        workOrderId: order.id,
        title: order.title,
        clientName: order.clientName,
        status: 'DONE',
        note: workerNote,
        href: `/work/${order.id}`,
        workerNames,
        updatedAt: order.updatedAt.toISOString(),
      };
      recentFeed.push(feedItem);

      for (const { member } of matchedMembers.values()) {
        const key = `${order.id}:${member.userId}`;
        const hrs = hoursByOrderAndUser.get(key) ?? null;
        const entryNote = notesByOrderAndUser.get(key) ?? null;
        byUserId[member.userId]?.completedTasks.push({
          id: order.id,
          workOrderId: order.id,
          title: order.title,
          clientName: order.clientName,
          status: 'DONE',
          note: workerNote || entryNote,
          hoursWorked: hrs && hrs > 0 ? Math.round(hrs * 10) / 10 : null,
          href: `/work/${order.id}`,
        });
      }
      continue;
    }

    if (scheduledDayIso === date && order.status !== 'DONE') {
      activeCount += 1;
      const anyAck = order.assignments.some((a) => isOrderAcknowledgedByWorker(pc, a));
      if (anyAck) acknowledgedCount += 1;

      const statusNorm: 'TODO' | 'IN_PROGRESS' =
        order.status === 'IN_PROGRESS' || order.status === 'HANDED_OVER'
          ? 'IN_PROGRESS'
          : 'TODO';

      recentFeed.push({
        id: order.id,
        workOrderId: order.id,
        title: order.title,
        clientName: order.clientName,
        status: statusNorm,
        acknowledged: anyAck,
        note: workerNote,
        href: `/work/${order.id}`,
        workerNames,
        updatedAt: order.updatedAt.toISOString(),
      });

      for (const { member, assignment } of matchedMembers.values()) {
        const ack = isOrderAcknowledgedByWorker(pc, assignment);
        byUserId[member.userId]?.activeTasks.push({
          id: order.id,
          workOrderId: order.id,
          title: order.title,
          clientName: order.clientName,
          status: statusNorm,
          acknowledged: ack,
          note: assignment.note || workerNote,
          href: `/work/${order.id}`,
        });
      }
    }
  }

  recentFeed.sort((a, b) => {
    const rank = (s: TeamDailyTaskItem['status']) =>
      s === 'DONE' ? 0 : s === 'RESCHEDULED' ? 1 : s === 'IN_PROGRESS' ? 2 : 3;
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  return {
    companyPulse: {
      date,
      activeCount,
      acknowledgedCount,
      completedCount,
      rescheduledCount,
      loggedHoursTotal: Math.round(loggedHoursTotal * 10) / 10,
      recentFeed: recentFeed.slice(0, 12),
    },
    byUserId,
  };
}

function parseCzechDateToken(text: string, defaultDate: string): string {
  const lower = normalizePersonToken(text);
  if (/\bdnes\b/.test(lower)) return defaultDate;
  if (/\bzitra\b/.test(lower)) return plusDays(defaultDate, 1);
  if (/\bpozitri\b/.test(lower)) return plusDays(defaultDate, 2);

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const czMatch = text.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(20\d{2}))?/);
  if (czMatch) {
    const day = Number.parseInt(czMatch[1], 10);
    const month = Number.parseInt(czMatch[2], 10);
    const year = czMatch[3] ? Number.parseInt(czMatch[3], 10) : Number.parseInt(defaultDate.slice(0, 4), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return plusDays(defaultDate, 1);
}

export function extractMeetingStructuredFallback(
  transcript: string,
  members: PulseMemberRef[],
  defaultDate: string,
  explicitTitle?: string
): {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItemDraft[];
} {
  const lines = transcript
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean);

  const title =
    explicitTitle?.trim() ||
    (lines[0] && lines[0].length <= 80 ? lines[0] : `Porada týmu (${defaultDate})`);

  const decisions: string[] = [];
  const actionItems: MeetingActionItemDraft[] = [];

  for (const line of lines) {
    const norm = normalizePersonToken(line);
    if (
      norm.startsWith('rozhodnuti:') ||
      norm.startsWith('zaver:') ||
      norm.startsWith('dohodnuto:') ||
      norm.includes('schvaleno') ||
      norm.includes('odsuhlaseno')
    ) {
      const cleaned = line.replace(/^(rozhodnutí|závěr|dohodnuto)\s*:\s*/i, '').trim();
      if (cleaned) decisions.push(cleaned);
      continue;
    }

    // Check if line mentions any team member or starts with Úkol / TODO / Akce
    let matchedMember: PulseMemberRef | null = null;
    for (const m of members) {
      const mTokens = normalizePersonToken(m.name).split(' ').filter(Boolean);
      const firstCanon = mTokens[0] ? canonicalFirstName(mTokens[0]) : '';
      const words = norm.split(/[^a-z0-9]+/).filter(Boolean);
      if (words.some((w) => canonicalFirstName(w) === firstCanon)) {
        matchedMember = m;
        break;
      }
    }

    const isExplicitTask =
      norm.startsWith('ukol:') ||
      norm.startsWith('todo:') ||
      norm.startsWith('akce:') ||
      /\b(zajisti|pripravi|udela|zkontroluje|zavola|posle|namontuje|vylepi|objedna)\b/.test(norm);

    if (matchedMember || isExplicitTask) {
      const cleanedTitle = line
        .replace(/^(úkol|ukol|todo|akce)\s*:\s*/i, '')
        .trim()
        .slice(0, 180);

      if (cleanedTitle.length >= 4) {
        const isUrgent = /\b(urgent|ihned|hned|priorit|specha)\b/.test(norm);
        actionItems.push({
          id: `item-${actionItems.length + 1}`,
          title: cleanedTitle,
          assigneeName: matchedMember?.name ?? null,
          assigneeUserId: matchedMember?.userId ?? null,
          dueDate: parseCzechDateToken(line, defaultDate),
          priority: isUrgent ? 'HIGH' : 'NORMAL',
          estimatedHours: 1,
          createWorkOrder: Boolean(matchedMember),
          addToMyPlannerBlock: !matchedMember,
          blockStartTime: '10:00',
        });
      }
    }
  }

  const summary =
    lines.slice(0, 3).join(' ').slice(0, 380) ||
    'Zápis z porady byl zpracován. Zkontrolujte navržené úkoly a rozhodnutí níže.';

  if (decisions.length === 0 && lines.length > 0) {
    decisions.push(lines[0].slice(0, 200));
  }

  return {
    title,
    summary,
    decisions: decisions.slice(0, 8),
    actionItems: actionItems.slice(0, 15),
  };
}

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

export async function analyzeMeetingTranscript(params: {
  organizationId: string;
  userId: string;
  transcript: string;
  explicitTitle?: string;
  meetingDate: string;
  members: PulseMemberRef[];
}): Promise<{
  title: string;
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItemDraft[];
  usedAi: boolean;
}> {
  const fallback = extractMeetingStructuredFallback(
    params.transcript,
    params.members,
    params.meetingDate,
    params.explicitTitle
  );

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { ...fallback, usedAi: false };
  }

  const membersListStr = params.members
    .map((m) => `- userId: "${m.userId}", Jméno: "${m.name}"`)
    .join('\n');

  const prompt = `Jsi výkonný AI asistent pro vedení firmy SeePoint (venkovní reklama, montáže, obchod, výroba).
Dostáváš přepis nebo souhrn z porady (z nahrávací krabičky nebo poznámek).
Datum porady: ${params.meetingDate}.

ČLENOVÉ TÝMU V SYSTÉMU:
${membersListStr || 'Žádní členové'}

Tvým úkolem je vytvořit přehledný manažerský zápis z porady a vytáhnout všechny konkrétní úkoly (kdo má co udělat a do kdy).
Pokud je v textu zmíněno křestní jméno nebo přezdívka (např. Mirek -> Miroslav, Vlaďka -> Vladimíra, Jirka -> Jiří, Pája -> Pavel, Silva -> Silvie), spáruj úkol se správným členem týmu z nabídky výše.

Vrať POUZE validní JSON objekt v tomto formátu:
{
  "title": "Stručný a výstižný název porady",
  "summary": "Shrnutí hlavního obsahu porady (2-4 věty)",
  "decisions": ["Rozhodnutí nebo klíčový závěr 1", "Rozhodnutí 2"],
  "actionItems": [
    {
      "title": "Konkrétní popis úkolu (co přesně udělat)",
      "assigneeUserId": "userId člena týmu ze seznamu výše nebo null",
      "assigneeName": "Jméno člena týmu nebo null",
      "dueDate": "YYYY-MM-DD (výchozí ${plusDays(params.meetingDate, 1)}, pokud není řečeno jinak)",
      "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
      "estimatedHours": 1
    }
  ]
}

ZÁZNAM Z PORADY:
<transcript>
${params.transcript.slice(0, 12000)}
</transcript>`;

  for (const model of PREFERRED_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.15,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) continue;
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) continue;

      const parsed = JSON.parse(rawText) as {
        title?: string;
        summary?: string;
        decisions?: unknown[];
        actionItems?: Array<Record<string, unknown>>;
      };

      await logAIUsage({
        organizationId: params.organizationId,
        userId: params.userId,
        feature: 'ASSISTANT',
        modelName: model,
        promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
        metadata: { subfeature: 'planner_meeting_report' },
      }).catch(() => {});

      const actionItems: MeetingActionItemDraft[] = Array.isArray(parsed.actionItems)
        ? parsed.actionItems
            .map((item, idx): MeetingActionItemDraft | null => {
              const itemTitle = typeof item.title === 'string' ? item.title.trim() : '';
              if (!itemTitle) return null;

              const rawAssigneeId =
                typeof item.assigneeUserId === 'string' ? item.assigneeUserId : null;
              const rawAssigneeName =
                typeof item.assigneeName === 'string' ? item.assigneeName : '';

              const matched =
                (rawAssigneeId ? params.members.find((m) => m.userId === rawAssigneeId) : null) ||
                matchWorkerToMember({ userId: null, workerName: rawAssigneeName }, params.members);

              const dueDate =
                typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)
                  ? item.dueDate
                  : plusDays(params.meetingDate, 1);

              const prio =
                item.priority === 'LOW' ||
                item.priority === 'NORMAL' ||
                item.priority === 'HIGH' ||
                item.priority === 'URGENT'
                  ? item.priority
                  : 'NORMAL';

              const est =
                typeof item.estimatedHours === 'number' &&
                Number.isFinite(item.estimatedHours) &&
                item.estimatedHours > 0
                  ? Math.min(24, Math.round(item.estimatedHours * 2) / 2)
                  : 1;

              return {
                id: `ai-item-${idx + 1}`,
                title: itemTitle.slice(0, 180),
                assigneeName: matched?.name ?? (rawAssigneeName || null),
                assigneeUserId: matched?.userId ?? null,
                dueDate,
                priority: prio,
                estimatedHours: est,
                createWorkOrder: Boolean(matched),
                addToMyPlannerBlock: !matched,
                blockStartTime: '10:00',
              };
            })
            .filter((x): x is MeetingActionItemDraft => Boolean(x))
        : fallback.actionItems;

      const decisions = Array.isArray(parsed.decisions)
        ? parsed.decisions
            .filter((d): d is string => typeof d === 'string' && Boolean(d.trim()))
            .map((d) => d.trim())
            .slice(0, 10)
        : fallback.decisions;

      return {
        title: params.explicitTitle?.trim() || parsed.title?.trim() || fallback.title,
        summary: parsed.summary?.trim() || fallback.summary,
        decisions: decisions.length ? decisions : fallback.decisions,
        actionItems,
        usedAi: true,
      };
    } catch {
      continue;
    }
  }

  return { ...fallback, usedAi: false };
}

export function sanitizeMeetingReports(raw: unknown): MeetingReportRecord[] {
  if (!Array.isArray(raw)) return [];
  const result: MeetingReportRecord[] = [];
  for (const item of raw) {
    const obj = asObject(item);
    if (typeof obj.id !== 'string' || typeof obj.title !== 'string') continue;
    result.push({
      id: obj.id,
      title: obj.title,
      meetingDate: typeof obj.meetingDate === 'string' ? obj.meetingDate : '',
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
      createdByName: typeof obj.createdByName === 'string' ? obj.createdByName : 'Manažer',
      sourceType: obj.sourceType === 'EMAIL' ? 'EMAIL' : 'TRANSCRIPT',
      summary: typeof obj.summary === 'string' ? obj.summary : '',
      decisions: Array.isArray(obj.decisions)
        ? obj.decisions.filter((d): d is string => typeof d === 'string')
        : [],
      actionItems: Array.isArray(obj.actionItems)
        ? (obj.actionItems as MeetingActionItemDraft[])
        : [],
      emailedToCount: typeof obj.emailedToCount === 'number' ? obj.emailedToCount : 0,
    });
  }
  return result.slice(0, 30);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMeetingReportEmail(
  report: MeetingReportRecord,
  organizationName: string,
  baseUrl = 'https://seepoint.vercel.app'
): { subject: string; html: string; text: string } {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const subject = `Zápis z porady: ${report.title} (${report.meetingDate})`;

  const decisionsHtml = report.decisions.length
    ? `<ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.6;color:#1e293b;">
        ${report.decisions.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}
       </ul>`
    : '<p style="margin:0;font-size:13px;color:#64748b;">Bez zaznamenaných rozhodnutí.</p>';

  const tasksHtml = report.actionItems.length
    ? report.actionItems
        .map(
          (item) => `
        <div style="margin:0 0 8px;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;">
          <div style="font-size:14px;font-weight:800;color:#0f172a;">
            ${escapeHtml(item.title)}
          </div>
          <div style="margin-top:4px;font-size:12px;color:#475569;">
            Odpovědná osoba: <strong>${escapeHtml(item.assigneeName || 'Nepřiřazeno')}</strong>
            · Termín: <strong>${escapeHtml(item.dueDate)}</strong>
            ${
              item.createdWorkOrderId
                ? ` · <a href="${escapeHtml(`${cleanBase}/work/${item.createdWorkOrderId}`)}" style="color:#059669;font-weight:700;text-decoration:none;">Otevřít zakázku →</a>`
                : ''
            }
          </div>
        </div>`
        )
        .join('')
    : '<p style="margin:0;font-size:13px;color:#64748b;">Žádné úkoly nebyly vytvořeny.</p>';

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#064e3b 100%);padding:22px 24px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6ee7b7;margin-bottom:6px;">
            ${escapeHtml(organizationName)} · Zápis a úkoly z porady
          </div>
          <h1 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#ffffff;">
            ${escapeHtml(report.title)}
          </h1>
          <div style="font-size:12.5px;color:#cbd5e1;">
            Datum: ${escapeHtml(report.meetingDate)} · Zapsal(a): ${escapeHtml(report.createdByName)}
          </div>
        </div>
        <div style="padding:20px 24px;">
          <h2 style="margin:0 0 8px;font-size:13px;font-weight:900;text-transform:uppercase;color:#047857;">Shrnutí porady</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#334155;">
            ${escapeHtml(report.summary)}
          </p>
          <h2 style="margin:0 0 8px;font-size:13px;font-weight:900;text-transform:uppercase;color:#0f172a;">Klíčová rozhodnutí a závěry</h2>
          <div style="margin-bottom:16px;">
            ${decisionsHtml}
          </div>
          <h2 style="margin:0 0 8px;font-size:13px;font-weight:900;text-transform:uppercase;color:#0f172a;">Rozdělené úkoly (${report.actionItems.length})</h2>
          ${tasksHtml}
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e2e8f0;">
            <a href="${escapeHtml(`${cleanBase}/planner`)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#059669;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">
              Otevřít Planner a přehled týmu →
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    subject,
    `Zapsal(a): ${report.createdByName}`,
    '',
    'SHRNUTÍ:',
    report.summary,
    '',
    'ROZHODNUTÍ:',
    ...report.decisions.map((d) => `- ${d}`),
    '',
    'ÚKOLY:',
    ...report.actionItems.map(
      (i) => `- ${i.title} (${i.assigneeName || 'Nepřiřazeno'}, termín ${i.dueDate})`
    ),
    '',
    `Planner: ${cleanBase}/planner`,
  ].join('\n');

  return { subject, html, text };
}
