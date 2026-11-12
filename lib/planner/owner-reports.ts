import { logAIUsage } from '@/lib/ai-usage';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { dateInZone } from './time';
import type { MemberDailyActivity, CompanyDailyPulse, PulseMemberRef } from './team-pulse';
import {
  APPROVAL_CATEGORY_LABELS,
  type ApprovalCategory,
  type ApprovalStatus,
  type OwnerEmailDigestSettings,
} from './owner-constants';

export {
  APPROVAL_CATEGORY_LABELS,
  type ApprovalCategory,
  type ApprovalStatus,
  type OwnerEmailDigestSettings,
};

export type ApprovalRequestRecord = {
  id: string;
  date: string;
  requesterUserId: string;
  requesterName: string;
  category: ApprovalCategory;
  title: string;
  detail: string;
  amountLabel?: string | null;
  offerId?: string | null;
  status: ApprovalStatus;
  decidedByUserId?: string | null;
  decidedByName?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

export type DailyCheckoutRecord = {
  id: string;
  date: string;
  userId: string;
  userName: string;
  submittedAt: string;
  autoSummary: string;
  manualSummary: string;
  blockers?: string | null;
  approvalRequestId?: string | null;
};

export type UserSalesDailyActivity = {
  offersSentCount: number;
  offersSentValueCzk: number;
  offersAcceptedCount: number;
  crmTasksDoneCount: number;
};

export type SalesDailySummary = {
  offersCreatedToday: number;
  offersSentToday: number;
  offersAcceptedToday: number;
  offersSentValueCzk: number;
  offersAcceptedValueCzk: number;
  crmTasksDoneToday: number;
  byUserId: Record<string, UserSalesDailyActivity>;
};

export type OwnerReportSnapshot = {
  date: string;
  sales: SalesDailySummary;
  submittedCheckoutsCount: number;
  totalMembersCount: number;
  checkoutsByUserId: Record<string, DailyCheckoutRecord>;
  pendingApprovals: ApprovalRequestRecord[];
  recentDecisions: ApprovalRequestRecord[];
};

export type SalesOfferInput = {
  id: string;
  title: string;
  status: string;
  totalPrice: number | null;
  subtotal: number | null;
  createdByUserId: string | null;
  createdAt: Date;
  sentAt: Date | null;
  acceptedAt: Date | null;
};

export type SalesCrmTaskInput = {
  id: string;
  title: string;
  status: string;
  assignedUserId: string;
  completedAt: Date | null;
};

function asObject(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

export function sanitizeCheckouts(raw: unknown): DailyCheckoutRecord[] {
  if (!Array.isArray(raw)) return [];
  const list: DailyCheckoutRecord[] = [];
  for (const item of raw) {
    const o = asObject(item);
    if (
      typeof o.id !== 'string' ||
      typeof o.date !== 'string' ||
      typeof o.userId !== 'string' ||
      typeof o.userName !== 'string'
    ) {
      continue;
    }
    list.push({
      id: o.id,
      date: o.date,
      userId: o.userId,
      userName: o.userName,
      submittedAt: typeof o.submittedAt === 'string' ? o.submittedAt : new Date().toISOString(),
      autoSummary: typeof o.autoSummary === 'string' ? o.autoSummary : '',
      manualSummary: typeof o.manualSummary === 'string' ? o.manualSummary : '',
      blockers: typeof o.blockers === 'string' ? o.blockers : null,
      approvalRequestId: typeof o.approvalRequestId === 'string' ? o.approvalRequestId : null,
    });
  }
  return list.slice(0, 120);
}

export function sanitizeApprovalRequests(raw: unknown): ApprovalRequestRecord[] {
  if (!Array.isArray(raw)) return [];
  const validCategories = new Set<ApprovalCategory>([
    'DISCOUNT',
    'EXPENSE',
    'SCHEDULE',
    'COMMERCIAL',
    'OTHER',
  ]);
  const validStatuses = new Set<ApprovalStatus>([
    'PENDING',
    'APPROVED',
    'INFO_REQUESTED',
    'REJECTED',
  ]);
  const list: ApprovalRequestRecord[] = [];
  for (const item of raw) {
    const o = asObject(item);
    if (
      typeof o.id !== 'string' ||
      typeof o.title !== 'string' ||
      typeof o.requesterUserId !== 'string'
    ) {
      continue;
    }
    const category = validCategories.has(o.category as ApprovalCategory)
      ? (o.category as ApprovalCategory)
      : 'OTHER';
    const status = validStatuses.has(o.status as ApprovalStatus)
      ? (o.status as ApprovalStatus)
      : 'PENDING';
    list.push({
      id: o.id,
      date: typeof o.date === 'string' ? o.date : new Date().toISOString().slice(0, 10),
      requesterUserId: o.requesterUserId,
      requesterName: typeof o.requesterName === 'string' ? o.requesterName : 'Kolega',
      category,
      title: o.title,
      detail: typeof o.detail === 'string' ? o.detail : '',
      amountLabel: typeof o.amountLabel === 'string' ? o.amountLabel : null,
      offerId: typeof o.offerId === 'string' ? o.offerId : null,
      status,
      decidedByUserId: typeof o.decidedByUserId === 'string' ? o.decidedByUserId : null,
      decidedByName: typeof o.decidedByName === 'string' ? o.decidedByName : null,
      decisionNote: typeof o.decisionNote === 'string' ? o.decisionNote : null,
      decidedAt: typeof o.decidedAt === 'string' ? o.decidedAt : null,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    });
  }
  return list.slice(0, 100);
}

export function buildSalesDailySummary(params: {
  date: string;
  timezone: string;
  members: PulseMemberRef[];
  offers: SalesOfferInput[];
  crmTasks: SalesCrmTaskInput[];
}): SalesDailySummary {
  const { date, timezone, members, offers, crmTasks } = params;
  const byUserId: Record<string, UserSalesDailyActivity> = {};

  for (const m of members) {
    byUserId[m.userId] = {
      offersSentCount: 0,
      offersSentValueCzk: 0,
      offersAcceptedCount: 0,
      crmTasksDoneCount: 0,
    };
  }

  let offersCreatedToday = 0;
  let offersSentToday = 0;
  let offersAcceptedToday = 0;
  let offersSentValueCzk = 0;
  let offersAcceptedValueCzk = 0;
  let crmTasksDoneToday = 0;

  for (const offer of offers) {
    const val = Number(offer.totalPrice ?? offer.subtotal ?? 0) || 0;
    const ownerId = offer.createdByUserId;

    if (dateInZone(offer.createdAt, timezone) === date) {
      offersCreatedToday += 1;
    }

    if (offer.sentAt && dateInZone(offer.sentAt, timezone) === date) {
      offersSentToday += 1;
      offersSentValueCzk += val;
      if (ownerId && byUserId[ownerId]) {
        byUserId[ownerId].offersSentCount += 1;
        byUserId[ownerId].offersSentValueCzk += val;
      }
    }

    if (offer.acceptedAt && dateInZone(offer.acceptedAt, timezone) === date) {
      offersAcceptedToday += 1;
      offersAcceptedValueCzk += val;
      if (ownerId && byUserId[ownerId]) {
        byUserId[ownerId].offersAcceptedCount += 1;
      }
    }
  }

  for (const t of crmTasks) {
    if (t.status === 'DONE' && t.completedAt && dateInZone(t.completedAt, timezone) === date) {
      crmTasksDoneToday += 1;
      if (byUserId[t.assignedUserId]) {
        byUserId[t.assignedUserId].crmTasksDoneCount += 1;
      }
    }
  }

  return {
    offersCreatedToday,
    offersSentToday,
    offersAcceptedToday,
    offersSentValueCzk: Math.round(offersSentValueCzk),
    offersAcceptedValueCzk: Math.round(offersAcceptedValueCzk),
    crmTasksDoneToday,
    byUserId,
  };
}

export function buildUserAutoDaySummary(params: {
  sales?: UserSalesDailyActivity;
  work?: MemberDailyActivity;
}): string {
  const parts: string[] = [];
  const s = params.sales;
  const w = params.work;

  if (s) {
    if (s.offersSentCount > 0) {
      parts.push(
        `${s.offersSentCount} odesl. nabídk${s.offersSentCount === 1 ? 'a' : s.offersSentCount < 5 ? 'y' : 'ek'} (${s.offersSentValueCzk.toLocaleString('cs-CZ')} Kč)`
      );
    }
    if (s.offersAcceptedCount > 0) {
      parts.push(`${s.offersAcceptedCount} schválená nabídka`);
    }
    if (s.crmTasksDoneCount > 0) {
      parts.push(`${s.crmTasksDoneCount} CRM úkol${s.crmTasksDoneCount === 1 ? '' : s.crmTasksDoneCount < 5 ? 'y' : 'ů'}`);
    }
  }

  if (w) {
    if (w.completedTasks.length > 0) {
      parts.push(`${w.completedTasks.length} hotov. zakázk${w.completedTasks.length === 1 ? 'a' : w.completedTasks.length < 5 ? 'y' : 'ek'}`);
    }
    if (w.loggedHoursToday > 0) {
      parts.push(`${w.loggedHoursToday} h vykázáno`);
    }
    if (w.rescheduledTasks.length > 0) {
      parts.push(`${w.rescheduledTasks.length} přesunuto`);
    }
  }

  return parts.length
    ? parts.join(' · ')
    : 'Zatím bez uzavřených položek v systému za tento den.';
}

export function buildDeterministicOwnerExecutiveSummary(params: {
  date: string;
  companyPulse: CompanyDailyPulse | null;
  sales: SalesDailySummary;
  members: PulseMemberRef[];
  checkoutsByUserId: Record<string, DailyCheckoutRecord>;
  pendingApprovals: ApprovalRequestRecord[];
}): {
  headline: string;
  highlights: string[];
  attentionPoints: string[];
  usedAi: boolean;
} {
  const highlights: string[] = [];
  const attentionPoints: string[] = [];

  if (params.sales.offersAcceptedToday > 0 || params.sales.offersSentToday > 0) {
    highlights.push(
      `Obchod: ${params.sales.offersSentToday} odeslaných nabídek (${params.sales.offersSentValueCzk.toLocaleString('cs-CZ')} Kč), ${params.sales.offersAcceptedToday} podepsaných (${params.sales.offersAcceptedValueCzk.toLocaleString('cs-CZ')} Kč), ${params.sales.crmTasksDoneToday} dokončených CRM úkolů.`
    );
  }

  if (params.companyPulse) {
    highlights.push(
      `Provoz a terén: ${params.companyPulse.completedCount} dokončených zakázek, ${params.companyPulse.activeCount} v řešení, ${params.companyPulse.loggedHoursTotal} vykázaných hodin.`
    );
    if (params.companyPulse.rescheduledCount > 0) {
      attentionPoints.push(
        `${params.companyPulse.rescheduledCount} zakázek se dnes nestihlo a bylo přesunuto.`
      );
    }
  }

  const submittedCount = Object.keys(params.checkoutsByUserId).length;
  const missingNames = params.members
    .filter((m) => !params.checkoutsByUserId[m.userId])
    .map((m) => m.name);

  if (submittedCount > 0) {
    highlights.push(
      `Check-out reporty odevzdalo ${submittedCount} z ${params.members.length} členů týmu.`
    );
  }

  if (params.pendingApprovals.length > 0) {
    attentionPoints.push(
      `Čeká na vaše rozhodnutí: ${params.pendingApprovals.length} žádostí od týmu.`
    );
  }

  if (missingNames.length > 0 && missingNames.length < params.members.length) {
    attentionPoints.push(`Report zatím neodevzdal: ${missingNames.join(', ')}.`);
  }

  const headline =
    params.pendingApprovals.length > 0
      ? `Pozornost: ${params.pendingApprovals.length} čekajících schválení · ${params.companyPulse?.completedCount ?? 0} hotových zakázek · ${params.sales.offersSentToday} nabídek.`
      : `Firemní přehled za ${params.date}: ${params.companyPulse?.completedCount ?? 0} hotových zakázek · ${params.sales.offersSentToday} odeslaných nabídek.`;

  return {
    headline,
    highlights: highlights.length
      ? highlights
      : ['Zatím probíhá běžný provoz bez mimořádných výkyvů.'],
    attentionPoints,
    usedAi: false,
  };
}

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

export async function generateAiOwnerDigest(params: {
  organizationId: string;
  userId: string;
  date: string;
  companyPulse: CompanyDailyPulse | null;
  sales: SalesDailySummary;
  members: PulseMemberRef[];
  checkoutsByUserId: Record<string, DailyCheckoutRecord>;
  pendingApprovals: ApprovalRequestRecord[];
}): Promise<{
  headline: string;
  highlights: string[];
  attentionPoints: string[];
  usedAi: boolean;
}> {
  const fallback = buildDeterministicOwnerExecutiveSummary(params);
  const apiKey = getGeminiApiKey();
  if (!apiKey) return fallback;

  const peopleContext = params.members
    .map((m) => {
      const chk = params.checkoutsByUserId[m.userId];
      const s = params.sales.byUserId[m.userId];
      return `- ${m.name}: ${
        chk
          ? `Report odevzdán: "${chk.manualSummary}" (Systém: ${chk.autoSummary})${
              chk.blockers ? ` [Zásek: ${chk.blockers}]` : ''
            }`
          : `Report neodevzdán. Obchod v systému: ${s?.offersSentCount ?? 0} nabídek, ${s?.crmTasksDoneCount ?? 0} CRM úkolů.`
      }`;
    })
    .join('\n');

  const approvalsContext = params.pendingApprovals
    .map((a) => `- ${a.requesterName}: [${APPROVAL_CATEGORY_LABELS[a.category]}] ${a.title} – ${a.detail}`)
    .join('\n');

  const prompt = `Jsi výkonný ředitelský asistent majitele firmy SeePoint (venkovní reklama, obchod, montáže).
Majitel chce za 20 sekund vědět, co se dnes (${params.date}) ve firmě reálně udělalo, kdo táhne výkon a co stojí na jeho rozhodnutí.

TVRDÁ DATA ZE SYSTÉMU:
- Obchod: ${params.sales.offersSentToday} odeslaných nabídek (${params.sales.offersSentValueCzk} Kč), ${params.sales.offersAcceptedToday} podepsaných (${params.sales.offersAcceptedValueCzk} Kč), ${params.sales.crmTasksDoneToday} uzavřených CRM úkolů.
- Provoz: ${params.companyPulse?.completedCount ?? 0} hotových zakázek, ${params.companyPulse?.activeCount ?? 0} aktivních, ${params.companyPulse?.rescheduledCount ?? 0} přesunutých, ${params.companyPulse?.loggedHoursTotal ?? 0} vykázaných hodin.

LIDÉ A JEJICH REPORTY:
${peopleContext || 'Žádní členové'}

ČEKAJÍCÍ SCHVÁLENÍ MAJITELEM:
${approvalsContext || 'Žádná čekající schválení'}

Vrať POUZE validní JSON v tomto tvaru:
{
  "headline": "1 krátká úderná věta shrnující dnešní den pro majitele",
  "highlights": ["3 až 4 nejvýznamnější věci, které se dnes reálně pohly nebo dokončily (konkrétně jména, klienty, částky)"],
  "attentionPoints": ["Pouze konkrétní záseky, čekající schválení nebo lidé bez reportu – prázdné pole, pokud je vše v pořádku"]
}`;

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
              temperature: 0.2,
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
        headline?: string;
        highlights?: unknown[];
        attentionPoints?: unknown[];
      };

      await logAIUsage({
        organizationId: params.organizationId,
        userId: params.userId,
        feature: 'ASSISTANT',
        modelName: model,
        promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
        metadata: { subfeature: 'owner_daily_digest' },
      }).catch(() => {});

      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
        : fallback.highlights;
      const attentionPoints = Array.isArray(parsed.attentionPoints)
        ? parsed.attentionPoints.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
        : fallback.attentionPoints;

      return {
        headline: parsed.headline?.trim() || fallback.headline,
        highlights: highlights.length ? highlights : fallback.highlights,
        attentionPoints,
        usedAi: true,
      };
    } catch {
      continue;
    }
  }

  return fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderApprovalNotificationEmail(
  req: ApprovalRequestRecord,
  organizationName: string,
  baseUrl = 'https://seepoint.vercel.app'
): { subject: string; html: string; text: string } {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const catLabel = APPROVAL_CATEGORY_LABELS[req.category];
  const subject = `✋ Ke schválení (${catLabel}): ${req.title} – ${req.requesterName}`;

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#7c2d12 100%);padding:20px 24px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#fdba74;margin-bottom:6px;">
            ${escapeHtml(organizationName)} · Žádost o rozhodnutí vedení
          </div>
          <h1 style="margin:0;font-size:19px;font-weight:900;color:#ffffff;">
            ${escapeHtml(req.title)}
          </h1>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 12px;font-size:13px;color:#475569;">
            Žadatel: <strong>${escapeHtml(req.requesterName)}</strong> · Kategorie: <strong>${escapeHtml(catLabel)}</strong>
            ${req.amountLabel ? ` · Dopad: <strong>${escapeHtml(req.amountLabel)}</strong>` : ''}
          </p>
          <div style="padding:14px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;font-size:14px;line-height:1.5;color:#1e293b;margin-bottom:18px;">
            ${escapeHtml(req.detail || 'Bez doplňujícího popisu.')}
          </div>
          <a href="${escapeHtml(`${cleanBase}/planner`)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#059669;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">
            Otevřít v Planneru a rozhodnout →
          </a>
        </div>
      </div>
    </div>
  `;

  const text = `${subject}\nŽadatel: ${req.requesterName}\nKategorie: ${catLabel}\n${req.detail}\n\nRozhodnout v Planneru: ${cleanBase}/planner`;
  return { subject, html, text };
}

export function renderApprovalDecisionEmail(
  req: ApprovalRequestRecord,
  organizationName: string,
  baseUrl = 'https://seepoint.vercel.app'
): { subject: string; html: string; text: string } {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const statusText =
    req.status === 'APPROVED'
      ? '✅ SCHVÁLENO'
      : req.status === 'INFO_REQUESTED'
      ? '💬 DOTAZ / DOPLNIT INFO'
      : '❌ ZAMÍTNUTO';
  const subject = `${statusText}: ${req.title}`;

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="background:#0f172a;padding:20px 24px;color:#ffffff;">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#34d399;margin-bottom:6px;">
            ${escapeHtml(organizationName)} · Rozhodnutí k vaší žádosti
          </div>
          <h1 style="margin:0;font-size:19px;font-weight:900;color:#ffffff;">
            ${escapeHtml(statusText)} – ${escapeHtml(req.title)}
          </h1>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 10px;font-size:13px;color:#475569;">
            Rozhodl(a): <strong>${escapeHtml(req.decidedByName || 'Vedení')}</strong>
          </p>
          ${
            req.decisionNote
              ? `<div style="padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:14px;line-height:1.5;color:#1e293b;margin-bottom:16px;">Poznámka: ${escapeHtml(req.decisionNote)}</div>`
              : ''
          }
          <a href="${escapeHtml(`${cleanBase}/planner`)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#0f172a;color:#ffffff;font-size:13px;font-weight:800;text-decoration:none;">
            Přejít do Planneru →
          </a>
        </div>
      </div>
    </div>
  `;

  const text = `${subject}\nRozhodl(a): ${req.decidedByName || 'Vedení'}\nPoznámka: ${req.decisionNote || 'bez poznámky'}\n\nPlanner: ${cleanBase}/planner`;
  return { subject, html, text };
}

export function sanitizeOwnerEmailDigestSettings(raw: unknown): OwnerEmailDigestSettings {
  const o = asObject(raw);
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : false;
  let sendHourLocal = 18;
  if (typeof o.sendHourLocal === 'number' && Number.isFinite(o.sendHourLocal)) {
    sendHourLocal = Math.min(23, Math.max(0, Math.round(o.sendHourLocal)));
  }

  let timezone = 'Europe/Prague';
  if (typeof o.timezone === 'string' && o.timezone.trim()) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: o.timezone.trim() }).format();
      timezone = o.timezone.trim();
    } catch {
      timezone = 'Europe/Prague';
    }
  }

  const skipWeekends = typeof o.skipWeekends === 'boolean' ? o.skipWeekends : true;
  const includeAllAdminsAndOwners =
    typeof o.includeAllAdminsAndOwners === 'boolean' ? o.includeAllAdminsAndOwners : true;

  const customRecipients = Array.isArray(o.customRecipients)
    ? [
        ...new Set(
          o.customRecipients
            .filter((r): r is string => typeof r === 'string')
            .map((r) => r.trim().toLowerCase())
            .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
        ),
      ].slice(0, 15)
    : [];

  return {
    enabled,
    sendHourLocal,
    timezone,
    skipWeekends,
    includeAllAdminsAndOwners,
    customRecipients,
  };
}

export function renderOwnerExecutiveDigestEmail(params: {
  organizationName: string;
  date: string;
  digest: {
    headline: string;
    highlights: string[];
    attentionPoints: string[];
  };
  sales: SalesDailySummary;
  companyPulse: CompanyDailyPulse | null;
  members: PulseMemberRef[];
  checkoutsByUserId: Record<string, DailyCheckoutRecord>;
  pendingApprovals: ApprovalRequestRecord[];
  baseUrl?: string;
}): { subject: string; html: string; text: string } {
  const cleanBase = (params.baseUrl || 'https://seepoint.vercel.app').replace(/\/+$/, '');
  const submittedCount = params.members.filter((m) => Boolean(params.checkoutsByUserId[m.userId])).length;
  const subject =
    params.pendingApprovals.length > 0
      ? `📊 Report majitele (${params.date}): ${params.pendingApprovals.length} ke schválení · ${params.sales.offersSentToday} nab.`
      : `📊 Report majitele (${params.date}): ${params.companyPulse?.completedCount ?? 0} hotovo · ${params.sales.offersSentToday} nab.`;

  const highlightsHtml = params.digest.highlights.length
    ? `<ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.6;color:#1e293b;">
        ${params.digest.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
       </ul>`
    : '';

  const attentionHtml = params.digest.attentionPoints.length
    ? `<div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;">
        <div style="font-size:11px;font-weight:900;text-transform:uppercase;color:#b45309;margin-bottom:6px;">
          ⚠️ Záseky a disciplína reportů
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.55;color:#78350f;">
          ${params.digest.attentionPoints.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>
       </div>`
    : '';

  const approvalsHtml = params.pendingApprovals.length
    ? `<div style="margin-top:16px;">
        <h2 style="margin:0 0 8px;font-size:13px;font-weight:900;text-transform:uppercase;color:#c2410c;">
          ✋ Čeká na vaše schválení (${params.pendingApprovals.length})
        </h2>
        ${params.pendingApprovals
          .slice(0, 8)
          .map(
            (a) => `
          <div style="margin:0 0 8px;padding:10px 12px;border-radius:10px;border:1px solid #fed7aa;background:#fff7ed;">
            <div style="font-size:11px;font-weight:800;color:#9a3412;">
              ${escapeHtml(APPROVAL_CATEGORY_LABELS[a.category])} · ${escapeHtml(a.requesterName)}${
                a.amountLabel ? ` · <strong>${escapeHtml(a.amountLabel)}</strong>` : ''
              }
            </div>
            <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-top:2px;">${escapeHtml(a.title)}</div>
            ${a.detail ? `<div style="font-size:12.5px;color:#334155;margin-top:3px;">${escapeHtml(a.detail)}</div>` : ''}
          </div>`
          )
          .join('')}
       </div>`
    : '';

  const teamRowsHtml = params.members
    .map((m) => {
      const chk = params.checkoutsByUserId[m.userId];
      const s = params.sales.byUserId[m.userId];
      const hasSales = s && (s.offersSentCount > 0 || s.crmTasksDoneCount > 0 || s.offersAcceptedCount > 0);
      return `
        <div style="margin:0 0 8px;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;background:${
          chk ? '#ffffff' : '#f8fafc'
        };">
          <div style="font-size:13.5px;font-weight:800;color:#0f172a;">
            ${escapeHtml(m.name)}
            <span style="font-size:11px;font-weight:700;margin-left:6px;color:${chk ? '#047857' : '#94a3b8'};">
              ${chk ? '✓ Report odevzdán' : '○ Bez reportu'}
            </span>
          </div>
          ${
            chk?.manualSummary
              ? `<div style="margin-top:4px;font-size:12.5px;color:#334155;">${escapeHtml(chk.manualSummary)}</div>`
              : ''
          }
          ${
            chk?.blockers
              ? `<div style="margin-top:3px;font-size:12px;font-weight:700;color:#b45309;">⚠️ Zásek: ${escapeHtml(chk.blockers)}</div>`
              : ''
          }
          ${
            hasSales
              ? `<div style="margin-top:3px;font-size:11.5px;color:#475569;">Obchod: ${s.offersSentCount} nab. (${s.offersSentValueCzk.toLocaleString('cs-CZ')} Kč), ${s.crmTasksDoneCount} CRM úkolů</div>`
              : ''
          }
        </div>`;
    })
    .join('');

  const html = `
    <div style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 2px 10px rgba(15,23,42,0.05);">
        <div style="height:6px;background:#4f46e5;"></div>
        <div style="padding:24px 26px 18px;border-bottom:1px solid #f1f5f9;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#4f46e5;margin-bottom:6px;">
            ${escapeHtml(params.organizationName)} · Jedna stránka pravdy (${escapeHtml(params.date)})
          </div>
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;font-weight:900;color:#0f172a;">
            ${escapeHtml(params.digest.headline)}
          </h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin:0 -6px;">
            <tr>
              <td width="33%" style="padding:10px;border-radius:10px;background:#eef2ff;border:1px solid #e0e7ff;text-align:center;">
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#4338ca;">Obchod</div>
                <div style="font-size:15px;font-weight:900;color:#1e1b4b;margin-top:2px;">${params.sales.offersSentToday} nab.</div>
                <div style="font-size:11px;color:#4338ca;margin-top:1px;">${params.sales.offersSentValueCzk.toLocaleString('cs-CZ')} Kč</div>
              </td>
              <td width="33%" style="padding:10px;border-radius:10px;background:#ecfdf5;border:1px solid #d1fae5;text-align:center;">
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#047857;">Realizace</div>
                <div style="font-size:15px;font-weight:900;color:#064e3b;margin-top:2px;">${params.companyPulse?.completedCount ?? 0} hotovo</div>
                <div style="font-size:11px;color:#047857;margin-top:1px;">${params.companyPulse?.loggedHoursTotal ?? 0} h</div>
              </td>
              <td width="33%" style="padding:10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;">
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#475569;">Reporty lidí</div>
                <div style="font-size:15px;font-weight:900;color:#0f172a;margin-top:2px;">${submittedCount} / ${params.members.length}</div>
                <div style="font-size:11px;color:#64748b;margin-top:1px;">odevzdáno</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:22px 26px;">
          <h2 style="margin:0 0 10px;font-size:11px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;color:#047857;">
            🔥 Co se dnes posunulo
          </h2>
          ${highlightsHtml}
          ${attentionHtml}
          ${approvalsHtml}
          <h2 style="margin:20px 0 10px;font-size:11px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;color:#475569;">
            👥 Přehled týmu a reportů
          </h2>
          ${teamRowsHtml}
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center;">
            <a href="${escapeHtml(`${cleanBase}/planner`)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0f172a;color:#ffffff;font-size:13.5px;font-weight:800;text-decoration:none;">
              Otevřít Kokpit majitele v Planneru →
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    subject,
    '',
    params.digest.headline,
    `Obchod: ${params.sales.offersSentToday} nab. (${params.sales.offersSentValueCzk} Kč), ${params.sales.offersAcceptedToday} podepsáno`,
    `Provoz: ${params.companyPulse?.completedCount ?? 0} hotovo, ${params.companyPulse?.loggedHoursTotal ?? 0} h`,
    `Reporty týmu: ${submittedCount}/${params.members.length}`,
    '',
    'HLAVNÍ POSUNY:',
    ...params.digest.highlights.map((h) => `- ${h}`),
    ...(params.digest.attentionPoints.length
      ? ['', 'POZORNOST:', ...params.digest.attentionPoints.map((a) => `- ${a}`)]
      : []),
    ...(params.pendingApprovals.length
      ? ['', 'ČEKÁ NA SCHVÁLENÍ:', ...params.pendingApprovals.map((a) => `- ${a.title} (${a.requesterName})`)]
      : []),
    '',
    `Planner: ${cleanBase}/planner`,
  ].join('\n');

  return { subject, html, text };
}
