'use client';
import { primaryButton, secondaryButton } from './styles';
import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarSearch,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Hand,
  Mail,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import type { Interval } from '@/lib/planner/domain';
import { dayRange, plusDays } from '@/lib/planner/time';
import { plannerRequest } from './api';
import type { MeetingActionItemDraft, MeetingReportRecord } from '@/lib/planner/team-pulse';
import { APPROVAL_CATEGORY_LABELS, type ApprovalStatus } from '@/lib/planner/owner-constants';

function memberInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function TeamAvailability({
  data,
  onReload,
}: {
  data: PlannerReadModel;
  onReload?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(data.preferences.defaultMeetingDuration);
  const [slots, setSlots] = useState<Interval[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [activeReportDetail, setActiveReportDetail] = useState<MeetingReportRecord | null>(null);

  // Owner executive AI digest & approval state
  const [aiDigest, setAiDigest] = useState<{
    headline: string;
    highlights: string[];
    attentionPoints: string[];
    usedAi: boolean;
  } | null>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [ownerNotice, setOwnerNotice] = useState('');

  // Owner email delivery & schedule modal state
  const initialEmailCfg = data.ownerEmailSettings;
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [manualEmailRecipients, setManualEmailRecipients] = useState(
    data.currentUserEmail || ''
  );
  const [sendingOwnerEmail, setSendingOwnerEmail] = useState(false);
  const [emailAutoEnabled, setEmailAutoEnabled] = useState(initialEmailCfg?.enabled ?? false);
  const [emailSendHour, setEmailSendHour] = useState(initialEmailCfg?.sendHourLocal ?? 18);
  const [emailSkipWeekends, setEmailSkipWeekends] = useState(initialEmailCfg?.skipWeekends ?? true);
  const [emailIncludeAdmins, setEmailIncludeAdmins] = useState(
    initialEmailCfg?.includeAllAdminsAndOwners ?? true
  );
  const [emailCustomText, setEmailCustomText] = useState(
    (initialEmailCfg?.customRecipients ?? []).join(', ')
  );
  const [savingEmailSettings, setSavingEmailSettings] = useState(false);

  // Meeting modal form state
  const meetingEmailCfg = data.meetingEmailDefaults;
  const [meetingStep, setMeetingStep] = useState<'input' | 'review'>('input');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(data.date);
  const [meetingTranscript, setMeetingTranscript] = useState('');
  const [analyzingMeeting, setAnalyzingMeeting] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [meetingSummary, setMeetingSummary] = useState('');
  const [meetingDecisions, setMeetingDecisions] = useState<string[]>([]);
  const [meetingTasks, setMeetingTasks] = useState<MeetingActionItemDraft[]>([]);
  const [sendToAssignees, setSendToAssignees] = useState(meetingEmailCfg?.sendToAssignees ?? true);
  const [sendToManagers, setSendToManagers] = useState(meetingEmailCfg?.sendToManagers ?? true);
  const [meetingRecipientIds, setMeetingRecipientIds] = useState<string[]>([]);
  const [meetingExtraEmailsText, setMeetingExtraEmailsText] = useState(
    (meetingEmailCfg?.extraRecipients ?? []).join(', ')
  );
  const [saveMeetingEmailDefaults, setSaveMeetingEmailDefaults] = useState(false);

  // Resend modal / detail state
  const [resendRecipientIds, setResendRecipientIds] = useState<string[]>([]);
  const [resendExtraText, setResendExtraText] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);

  const toggleMemberExpand = (id: string) => {
    setExpandedMembers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  async function handleGenerateDigest() {
    setLoadingDigest(true);
    setOwnerNotice('');
    try {
      const res = await plannerRequest<{
        ok: boolean;
        digest: {
          headline: string;
          highlights: string[];
          attentionPoints: string[];
          usedAi: boolean;
        };
      }>('/checkouts', { action: 'ai_digest', date: data.date });
      if (res.ok && res.digest) {
        setAiDigest(res.digest);
      }
    } catch (err) {
      setOwnerNotice(err instanceof Error ? err.message : 'Nepodařilo se vygenerovat souhrn.');
    } finally {
      setLoadingDigest(false);
    }
  }

  const [syncingSalesSheet, setSyncingSalesSheet] = useState(false);

  async function handleSyncSalesSheet() {
    setSyncingSalesSheet(true);
    setOwnerNotice('');
    try {
      const res = await fetch('/api/sales/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Synchronizace tabulky obchodníků selhala.');
      }
      setOwnerNotice(
        json.message ||
          `Tabulka obchodníků synchronizována: ${json.createdOrdersCount ?? 0} vytvořeno, ${json.updatedOrdersCount ?? 0} aktualizováno.`
      );
      if (onReload) {
        onReload();
      }
    } catch (err) {
      setOwnerNotice(err instanceof Error ? err.message : 'Chyba při synchronizaci tabulky obchodníků.');
    } finally {
      setSyncingSalesSheet(false);
    }
  }

  async function handleSendOwnerEmail() {
    setSendingOwnerEmail(true);
    setOwnerNotice('');
    try {
      const res = await plannerRequest<{
        ok: boolean;
        emailResult: {
          sentCount: number;
          skippedEnvCount: number;
          recipients: string[];
        };
      }>('/checkouts', {
        action: 'send_owner_email',
        date: data.date,
        recipientsText: manualEmailRecipients,
      });
      if (res.ok && res.emailResult) {
        setOwnerNotice(
          res.emailResult.sentCount > 0
            ? `Report majitele byl úspěšně odeslán na: ${res.emailResult.recipients.join(', ')}.`
            : `Report připraven pro ${res.emailResult.recipients.join(', ')} (náhledový režim).`
        );
        setShowEmailModal(false);
      }
    } catch (err) {
      setOwnerNotice(err instanceof Error ? err.message : 'Odeslání reportu selhalo.');
    } finally {
      setSendingOwnerEmail(false);
    }
  }

  async function handleSaveEmailSettings() {
    setSavingEmailSettings(true);
    setOwnerNotice('');
    try {
      await plannerRequest<{ ok: boolean }>('/checkouts', {
        action: 'save_email_settings',
        enabled: emailAutoEnabled,
        sendHourLocal: emailSendHour,
        skipWeekends: emailSkipWeekends,
        includeAllAdminsAndOwners: emailIncludeAdmins,
        customRecipientsText: emailCustomText,
      });
      setOwnerNotice(
        emailAutoEnabled
          ? `Automatické odesílání reportu uloženo (každý den v ${String(emailSendHour).padStart(2, '0')}:00).`
          : 'Nastavení e-mailového reportu majitele bylo uloženo.'
      );
      setShowEmailModal(false);
      onReload?.();
    } catch (err) {
      setOwnerNotice(err instanceof Error ? err.message : 'Uložení nastavení selhalo.');
    } finally {
      setSavingEmailSettings(false);
    }
  }

  async function handleDecideApproval(requestId: string, status: ApprovalStatus) {
    setDecidingId(requestId);
    setOwnerNotice('');
    try {
      await plannerRequest<{ ok: boolean }>('/checkouts', {
        action: 'decide_approval',
        requestId,
        status,
        decisionNote: decisionNotes[requestId] || '',
      });
      setOwnerNotice(
        status === 'APPROVED'
          ? 'Rozhodnutí bylo schváleno a kolega dostal e-mail.'
          : status === 'INFO_REQUESTED'
          ? 'Dotaz byl odeslán kolegovi k doplnění.'
          : 'Žádost byla zamítnuta.'
      );
      onReload?.();
    } catch (err) {
      setOwnerNotice(err instanceof Error ? err.message : 'Rozhodnutí se nepodařilo uložit.');
    } finally {
      setDecidingId(null);
    }
  }

  async function search() {
    setLoading(true);
    setError('');
    try {
      const result = await plannerRequest<{ slots: Interval[] }>('/availability', {
        userIds: selected,
        durationMinutes: duration,
        from: dayRange(data.date, data.preferences.timezone).start.toISOString(),
        to: dayRange(plusDays(data.date, 6), data.preferences.timezone).end.toISOString(),
      });
      setSlots(result.slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dostupnost se nepodařilo načíst.');
    } finally {
      setLoading(false);
    }
  }

  function computeDefaultRecipients(
    tasksList: MeetingActionItemDraft[],
    includeAssig: boolean,
    includeMgrs: boolean
  ): string[] {
    const ids = new Set<string>();
    if (includeAssig) {
      for (const t of tasksList) {
        if (t.assigneeUserId) ids.add(t.assigneeUserId);
      }
    }
    if (includeMgrs) {
      for (const m of data.teamMembers ?? []) {
        if (m.role && ['OWNER', 'ADMIN', 'MANAGER'].includes(m.role)) {
          ids.add(m.userId);
        }
      }
    }
    return [...ids];
  }

  const handleAnalyzeMeeting = async () => {
    if (!meetingTranscript.trim()) {
      setMeetingError('Vložte prosím přepis nebo poznámky z porady.');
      return;
    }
    setAnalyzingMeeting(true);
    setMeetingError('');
    try {
      const res = await plannerRequest<{
        ok: boolean;
        draft: {
          title: string;
          summary: string;
          decisions: string[];
          actionItems: MeetingActionItemDraft[];
        };
      }>('/meetings', {
        action: 'analyze',
        transcript: meetingTranscript,
        title: meetingTitle,
        meetingDate,
      });

      if (res.ok && res.draft) {
        const items = res.draft.actionItems || [];
        setMeetingTitle(res.draft.title || meetingTitle || 'Porada týmu');
        setMeetingSummary(res.draft.summary || '');
        setMeetingDecisions(res.draft.decisions || []);
        setMeetingTasks(items);
        setMeetingRecipientIds(
          computeDefaultRecipients(items, sendToAssignees, sendToManagers)
        );
        setMeetingStep('review');
      }
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : 'Analýza porady selhala.');
    } finally {
      setAnalyzingMeeting(false);
    }
  };

  const handleSaveMeeting = async () => {
    setSavingMeeting(true);
    setMeetingError('');
    try {
      const res = await plannerRequest<{
        ok: boolean;
        report: MeetingReportRecord;
        sentEmails?: string[];
      }>('/meetings', {
        action: 'commit',
        title: meetingTitle,
        meetingDate,
        summary: meetingSummary,
        decisions: meetingDecisions,
        actionItems: meetingTasks,
        recipientUserIds: meetingRecipientIds,
        extraEmailsText: meetingExtraEmailsText,
        sendToAssignees,
        sendEmailToManagers: sendToManagers,
        saveEmailDefaults: saveMeetingEmailDefaults,
      });

      if (res.ok) {
        setShowMeetingModal(false);
        setMeetingStep('input');
        setMeetingTranscript('');
        setMeetingSummary('');
        setMeetingDecisions([]);
        setMeetingTasks([]);
        setOwnerNotice(
          res.sentEmails && res.sentEmails.length > 0
            ? `Porada uložena, úkoly založeny a zápis odeslán (${res.sentEmails.join(', ')}).`
            : 'Porada byla uložena a úkoly založeny.'
        );
        onReload?.();
      }
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : 'Uložení porady selhalo.');
    } finally {
      setSavingMeeting(false);
    }
  };

  async function handleResendMeetingReport(reportId: string) {
    if (!resendRecipientIds.length && !resendExtraText.trim()) return;
    setResendingEmail(true);
    try {
      const res = await plannerRequest<{
        ok: boolean;
        sentCount: number;
        recipientEmails: string[];
      }>('/meetings', {
        action: 'resend_email',
        reportId,
        recipientUserIds: resendRecipientIds,
        extraEmailsText: resendExtraText,
      });
      if (res.ok) {
        setOwnerNotice(
          res.sentCount > 0
            ? `Zápis z porady byl přeposlán na: ${res.recipientEmails.join(', ')}.`
            : `Zápis připraven k odeslání pro: ${res.recipientEmails.join(', ')}.`
        );
        setActiveReportDetail(null);
      }
    } catch (err) {
      setOwnerNotice(err instanceof Error ? err.message : 'Přeposlání e-mailu selhalo.');
    } finally {
      setResendingEmail(false);
    }
  }

  const pulse = data.companyPulse;
  const owner = data.ownerSnapshot;

  return (
    <div className="space-y-6">
      {/* HEADER & QUICK ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
            <Users className="h-3 w-3" />
            <span>Kokpit majitele & přehled týmu</span>
          </span>
          <h2 className="mt-1 text-xl font-black text-slate-900">Co se dnes ve firmě dělá a co bylo odevzdáno</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Živý přehled obchodu, zakázek, 30sekundových reportů od lidí, žádostí ke schválení a porad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loadingDigest}
            onClick={handleGenerateDigest}
            className={secondaryButton}
          >
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>{loadingDigest ? 'Generuji souhrn…' : 'AI Souhrn dne pro majitele'}</span>
          </button>

          <button
            type="button"
            disabled={syncingSalesSheet}
            onClick={handleSyncSalesSheet}
            className={secondaryButton}
            title="Aktualizovat zakázky obchodníků z centrální Google Tabulky (MM, M, V, Z, S)"
          >
            <RefreshCw className={`h-4 w-4 text-amber-600 ${syncingSalesSheet ? 'animate-spin' : ''}`} />
            <span>{syncingSalesSheet ? 'Aktualizuji…' : '↻ Tabulka obchodníků'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className={secondaryButton}
          >
            <Mail className="h-4 w-4 text-emerald-700" />
            <span>E-mail report</span>
            {emailAutoEnabled && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" title="Automatické odesílání zapnuto" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMeetingDate(data.date);
              setMeetingStep('input');
              setShowMeetingModal(true);
            }}
            className={primaryButton}
          >
            <Mic className="h-4 w-4" />
            <span>Zpracovat poradu (krabička)</span>
          </button>
        </div>
      </div>

      {ownerNotice && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{ownerNotice}</span>
        </p>
      )}

      {/* AI EXECUTIVE DIGEST FOR COMPANY OWNER */}
      {aiDigest && (
        <section className="rounded-3xl border border-indigo-200/90 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-5 sm:p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-300" />
              <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                Jedna stránka pravdy pro majitele ({data.date})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmailModal(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Odeslat do e-mailu</span>
              </button>
              <button
                type="button"
                onClick={() => setAiDigest(null)}
                className="rounded-lg px-2 py-1 text-xs font-bold text-slate-300 hover:bg-white/10"
              >
                Skrýt
              </button>
            </div>
          </div>
          <p className="mt-3 text-base sm:text-lg font-extrabold text-white">{aiDigest.headline}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                🔥 Co se dnes reálně posunulo
              </p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-100 list-disc pl-4">
                {aiDigest.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                ✋ Záseky, schválení a disciplína
              </p>
              {aiDigest.attentionPoints.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-100 list-disc pl-4">
                  {aiDigest.attentionPoints.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-emerald-200">Žádné kritické záseky ani prodlevy.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* OWNER PENDING APPROVALS QUEUE */}
      {owner && owner.pendingApprovals.length > 0 && (
        <section className="rounded-3xl border border-amber-300/90 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <Hand className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">
                  Čeká na rozhodnutí majitele ({owner.pendingApprovals.length})
                </h3>
                <p className="text-xs text-slate-600">
                  Požadavky od obchodníků a týmu – rozhodněte jedním klikem bez obvolávání.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {owner.pendingApprovals.map((req) => (
              <div
                key={req.id}
                className="flex flex-col justify-between rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
                      {APPROVAL_CATEGORY_LABELS[req.category]}
                    </span>
                    {req.amountLabel && (
                      <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-extrabold text-white">
                        {req.amountLabel}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 text-sm font-black text-slate-900">{req.title}</h4>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    Žadatel: <strong className="text-slate-800">{req.requesterName}</strong> · {req.date}
                  </p>
                  {req.detail && (
                    <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-700">
                      {req.detail}
                    </p>
                  )}
                </div>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <input
                    type="text"
                    placeholder="Krátká poznámka nebo dotaz pro kolegu (volitelné)…"
                    value={decisionNotes[req.id] || ''}
                    onChange={(e) =>
                      setDecisionNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                    className="block w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={decidingId === req.id}
                      onClick={() => handleDecideApproval(req.id, 'APPROVED')}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Schválit</span>
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === req.id}
                      onClick={() => handleDecideApproval(req.id, 'INFO_REQUESTED')}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Zeptat se</span>
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === req.id}
                      onClick={() => handleDecideApproval(req.id, 'REJECTED')}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Zamítnout</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FIREMNÍ PULS DNE - OBCHOD + REALIZACE + REPORTY */}
      {(pulse || owner) && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {owner && (
            <>
              <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Obchod dnes</span>
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-indigo-950">
                  {owner.sales.offersSentToday} <span className="text-xs font-bold text-indigo-700">nab.</span>
                </p>
                <p className="mt-1 text-[11px] font-medium text-indigo-800">
                  {owner.sales.offersSentValueCzk.toLocaleString('cs-CZ')} Kč · {owner.sales.offersAcceptedToday} podpis
                </p>
              </div>

              <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-50/80 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Reporty lidí</span>
                  <ClipboardCheck className="h-4 w-4 text-purple-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-purple-950">
                  {owner.submittedCheckoutsCount} / {owner.totalMembersCount}
                </p>
                <p className="mt-1 text-[11px] font-medium text-purple-800">odevzdaných reportů dnes</p>
              </div>
            </>
          )}

          {pulse && (
            <>
              <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Hotovo dnes</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-emerald-950">{pulse.completedCount}</p>
                <p className="mt-1 text-[11px] font-medium text-emerald-800">dokončené zakázky</p>
              </div>

              <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Na trase</span>
                  <Clock className="h-4 w-4 text-sky-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-sky-950">{pulse.activeCount}</p>
                <p className="mt-1 text-[11px] font-medium text-sky-800">aktivních zakázek</p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Přesunuto</span>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-2 text-2xl font-black text-amber-950">{pulse.rescheduledCount}</p>
                <p className="mt-1 text-[11px] font-medium text-amber-800">odsunuto s důvodem</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Vykázáno</span>
                  <UserCheck className="h-4 w-4 text-slate-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {pulse.loggedHoursTotal} <span className="text-sm font-bold text-slate-500">h</span>
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-600">hodin ve výkazech</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* CENTRÁLNÍ TABULKA ZAKÁZEK OBCHODNÍKŮ */}
      {data.salesSheet && data.salesSheet.totalOrders > 0 && (
        <section className="rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/70 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    Zakázky obchodníků z centrální tabulky
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
                    Google Sheets
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {data.salesSheet.totalOrders} zakázek celkem · {data.salesSheet.confirmedCampaigns} potvrzených kampaní · {data.salesSheet.inRealizationCampaigns} v realizaci
                  {data.salesSheetSyncAt && ` · synchronizováno ${new Date(data.salesSheetSyncAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={syncingSalesSheet}
                onClick={handleSyncSalesSheet}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-50 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-amber-700 ${syncingSalesSheet ? 'animate-spin' : ''}`} />
                <span>{syncingSalesSheet ? 'Synchronizuji…' : 'Aktualizovat tabulku'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Object.values(data.salesSheet.bySalesperson)
              .filter((sp) => sp.totalOrdersCount > 0 || ['MM', 'M', 'V', 'Z', 'S'].includes(sp.code))
              .map((sp) => (
                <div
                  key={sp.code}
                  className="flex flex-col justify-between rounded-2xl border border-amber-200/90 bg-white p-3.5 shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-black text-slate-900 truncate">
                        {sp.name}
                      </span>
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white shrink-0">
                        {sp.displayCode || sp.code}
                      </span>
                    </div>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-950">{sp.totalOrdersCount}</span>
                      <span className="text-xs font-bold text-slate-500">zakázek</span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                        {sp.confirmedCampaignsCount} potvrzeno
                      </span>
                      {sp.inRealizationCount > 0 && (
                        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-sky-800">
                          {sp.inRealizationCount} montáž
                        </span>
                      )}
                      {sp.completedCount > 0 && (
                        <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-purple-800">
                          {sp.completedCount} hotovo
                        </span>
                      )}
                    </div>

                    {sp.activeOrders.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Aktivní kampaně ({sp.activeOrders.length})
                        </p>
                        {sp.activeOrders.slice(0, 3).map((order) => (
                          <div
                            key={order.id}
                            className="rounded-lg bg-amber-50/60 p-2 text-[11px] leading-snug text-slate-800"
                          >
                            <div className="flex items-start justify-between gap-1 font-extrabold text-slate-900">
                              <span className="truncate">{order.clientName}</span>
                              <span className="shrink-0 text-[10px] font-bold text-amber-800">
                                {order.carrierTypeLabel.replace(/\s*\(.*\)/, '')}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                              <span>{order.period || 'neuvedeno'}</span>
                              <span className="font-bold text-emerald-800">{order.checklistProgress}</span>
                            </div>
                          </div>
                        ))}
                        {sp.activeOrders.length > 3 && (
                          <p className="text-center text-[10px] font-bold text-slate-400">
                            +{sp.activeOrders.length - 3} dalších v CRM
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ZÁPISY Z PORAD & ÚKOLY V PLANNERU */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Zápisy a rozdělené úkoly z porad</h3>
              <p className="text-xs text-slate-500">
                AI automaticky vytahuje ze záznamů rozhodnutí a úkoly spárované s lidmi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMeetingDate(data.date);
              setMeetingStep('input');
              setShowMeetingModal(true);
            }}
            className={secondaryButton}
          >
            <Plus className="h-4 w-4 text-purple-700" />
            <span>+ Zadat poradu z krabičky</span>
          </button>
        </div>

        {data.meetingReports && data.meetingReports.length > 0 ? (
          <div className="mt-4 space-y-3">
            {data.meetingReports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {report.meetingDate} · Zapsal(a): {report.createdByName}
                    </span>
                    <h4 className="text-base font-black text-slate-900">{report.title}</h4>
                  </div>
                  {report.emailedToCount && report.emailedToCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      <Mail className="h-3 w-3" />
                      <span>Odesláno manažerům ({report.emailedToCount})</span>
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-2">{report.summary}</p>

                {report.actionItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      Úkoly ({report.actionItems.length}):
                    </span>
                    {report.actionItems.slice(0, 4).map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 shadow-sm"
                      >
                        <span>{t.title}</span>
                        {t.assigneeName && (
                          <span className="text-emerald-700">· {t.assigneeName}</span>
                        )}
                      </span>
                    ))}
                    {report.actionItems.length > 4 && (
                      <span className="text-xs font-bold text-slate-500">
                        +{report.actionItems.length - 4} další
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 border-t border-slate-100 pt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReportDetail(report);
                      setResendRecipientIds(
                        computeDefaultRecipients(report.actionItems, sendToAssignees, sendToManagers)
                      );
                      setResendExtraText(meetingExtraEmailsText);
                    }}
                    className="text-xs font-extrabold text-emerald-800 hover:underline"
                  >
                    Zobrazit celý zápis a odeslat lidem →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
            Zatím zde nemáte žádný nahraný zápis z porady. Klikněte výše na <strong>Zpracovat poradu</strong> a vložte text z krabičky nebo poznámky.
          </div>
        )}
      </section>

      {/* TEAM MEMBERS CARDS WITH LIVE ACTIVITY & CHECKOUT REPORTS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.team.map((member) => {
          const isChecked = selected.includes(member.id);
          const util = Math.min(100, Math.max(0, member.today.utilization));
          const barTone =
            util >= 85 ? 'bg-rose-500' : util >= 55 ? 'bg-amber-500' : 'bg-emerald-500';
          const pillTone =
            util >= 85
              ? 'bg-rose-100 text-rose-800'
              : util >= 55
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800';

          const act = member.dailyActivity;
          const salesAct = member.salesActivity;
          const chk = member.checkout;
          const isExpanded = Boolean(expandedMembers[member.id]);
          const totalActivityCount =
            (act?.completedTasks.length ?? 0) +
            (act?.activeTasks.length ?? 0) +
            (act?.rescheduledTasks.length ?? 0);

          return (
            <section
              key={member.id}
              className={`flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-sm transition ${
                isChecked
                  ? 'border-emerald-400 ring-2 ring-emerald-200/70 shadow-md'
                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex min-w-0 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked ? [...ids, member.id] : ids.filter((id) => id !== member.id)
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                      {memberInitials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{member.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[10px] font-extrabold ${
                            chk ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {chk ? '✓ Report odevzdán' : '○ Bez reportu'}
                        </span>
                        {act && act.loggedHoursToday > 0 && (
                          <span className="text-[10px] font-bold text-slate-500">
                            · {act.loggedHoursToday} h
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${pillTone}`}>
                    {member.today.utilization} %
                  </span>
                </div>

                {/* MEMBER CHECK-OUT REPORT PREVIEW */}
                {chk && (
                  <div className="mt-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-3 text-xs">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
                      Odevzdaný report dne
                    </p>
                    {chk.manualSummary && (
                      <p className="mt-1 font-semibold leading-snug text-slate-800">{chk.manualSummary}</p>
                    )}
                    {chk.blockers && (
                      <p className="mt-1 text-[11px] font-bold text-amber-800">
                        ⚠️ Zásek: {chk.blockers}
                      </p>
                    )}
                  </div>
                )}

                {/* SALES STATS MINI PILL */}
                {salesAct && (salesAct.offersSentCount > 0 || salesAct.crmTasksDoneCount > 0 || salesAct.offersAcceptedCount > 0) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-1.5 text-[11px] font-bold text-emerald-900">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />
                    <span>
                      Obchod: {salesAct.offersSentCount} nab. ({salesAct.offersSentValueCzk.toLocaleString('cs-CZ')} Kč) · {salesAct.crmTasksDoneCount} CRM
                    </span>
                  </div>
                )}

                {/* GOOGLE SHEETS SALES STATS PILL */}
                {(() => {
                  if (!data.salesSheet) return null;
                  const spEntry = Object.values(data.salesSheet.bySalesperson).find(
                    (sp) => sp.userId === member.id || sp.name.toLowerCase() === member.name.toLowerCase()
                  );
                  if (!spEntry || spEntry.totalOrdersCount === 0) return null;
                  return (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[11px] font-bold text-amber-950">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-700" />
                        <span>Tabulka obchodníka ({spEntry.code}): {spEntry.totalOrdersCount} zakázek</span>
                      </span>
                      <span className="text-[10px] font-extrabold text-amber-800">
                        {spEntry.confirmedCampaignsCount} potvrz. · {spEntry.inRealizationCount} montáž
                      </span>
                    </div>
                  );
                })()}

                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Dnešní vytížení</span>
                    <span className="text-slate-700">
                      {Math.round((member.today.freeMinutes / 60) * 10) / 10} h volno dnes
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Vytížení ${member.name}`}
                    aria-valuenow={util}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                  >
                    <div className={`h-full rounded-full transition-all ${barTone}`} style={{ width: `${util}%` }} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volno v týdnu</p>
                    <p className="mt-0.5 font-extrabold text-slate-800">{Math.round(member.weekFreeMinutes / 60)} h</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priorita & termíny</p>
                    <p className="mt-0.5 font-extrabold text-slate-800">
                      {member.importantTasks} důl. · {member.deadlines} term.
                    </p>
                  </div>
                </div>

                {member.overCapacity && (
                  <p className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Odhad práce převyšuje volnou kapacitu.</span>
                  </p>
                )}
              </div>

              {/* LIVE ACTIVITY ACCORDION */}
              {act && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleMemberExpand(member.id)}
                    className="flex w-full items-center justify-between text-xs font-extrabold text-slate-700 hover:text-emerald-800"
                  >
                    <span>
                      Dnešní práce ({totalActivityCount}) · {act.completedTasks.length} hotovo
                    </span>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 space-y-2 text-xs">
                      {/* Completed */}
                      {act.completedTasks.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            ✅ Co dnes udělal
                          </p>
                          {act.completedTasks.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-2 text-slate-800"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <Link href={t.href} className="font-bold hover:underline">
                                  {t.title}
                                </Link>
                                {t.hoursWorked && (
                                  <span className="shrink-0 font-extrabold text-emerald-800">
                                    {t.hoursWorked} h
                                  </span>
                                )}
                              </div>
                              {t.clientName && <p className="text-[11px] text-slate-500">{t.clientName}</p>}
                              {t.note && (
                                <p className="mt-1 rounded-lg bg-white/80 p-1 text-[11px] italic text-slate-600">
                                  „{t.note}“
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Active / in progress */}
                      {act.activeTasks.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                            ⏳ Dnešní aktivní zakázky
                          </p>
                          {act.activeTasks.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 text-slate-800"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <Link href={t.href} className="font-bold hover:underline">
                                  {t.title}
                                </Link>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    t.acknowledged
                                      ? 'bg-teal-100 text-teal-800'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {t.acknowledged ? 'Vím o tom' : 'Čeká'}
                                </span>
                              </div>
                              {t.clientName && <p className="text-[11px] text-slate-500">{t.clientName}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rescheduled */}
                      {act.rescheduledTasks.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            ↩️ Přesunuto z dneška
                          </p>
                          {act.rescheduledTasks.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-2 text-slate-800"
                            >
                              <Link href={t.href} className="font-bold text-amber-950 hover:underline">
                                {t.title}
                              </Link>
                              {t.newDateLabel && (
                                <p className="text-[11px] font-bold text-amber-800">
                                  Nový termín: {t.newDateLabel}
                                </p>
                              )}
                              {t.note && (
                                <p className="mt-1 rounded-lg bg-white/80 p-1 text-[11px] italic text-amber-900">
                                  Důvod: „{t.note}“
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {totalActivityCount === 0 && (
                        <p className="text-[11px] italic text-slate-400">
                          Na tento den nemá evidované zakázky v Plánu práce.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* SPOLEČNÝ TERMÍN SCHŮZKY */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <CalendarSearch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Najít společný termín</h2>
            <p className="text-xs text-slate-500">Vyberte kolegy výše a najděte první volný časový průnik.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Délka (min)</span>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 block w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
            />
          </label>
          <button disabled={loading || !selected.length} onClick={search} className={primaryButton}>
            <Clock className="h-4 w-4" />
            <span>{loading ? 'Hledám…' : 'Najít termín'}</span>
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        {slots && (
          <div className="mt-4 space-y-2">
            {!slots.length && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Nemáme společný volný termín. Zkuste jinou délku nebo týden.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((s) => (
                <p
                  key={s.startAt}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-sm font-bold text-emerald-900"
                >
                  {new Date(s.startAt).toLocaleString('cs-CZ', { timeZone: data.preferences.timezone })} · {duration} min
                </p>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Návrh nic nerezervuje ani neposílá pozvánky. Před domluvou ověřte aktuální dostupnost.
            </p>
          </div>
        )}
      </section>

      {/* DETAIL MODAL FOR SAVED MEETING REPORT */}
      {activeReportDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-400">
                  {activeReportDetail.meetingDate} · Zapsal(a): {activeReportDetail.createdByName}
                </span>
                <h3 className="text-xl font-black text-slate-900">{activeReportDetail.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReportDetail(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-800">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Shrnutí porady</h4>
                <p className="mt-1 leading-relaxed text-slate-700">{activeReportDetail.summary}</p>
              </div>

              {activeReportDetail.decisions.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Rozhodnutí a závěry
                  </h4>
                  <ul className="mt-1 space-y-1 list-disc pl-5">
                    {activeReportDetail.decisions.map((d, i) => (
                      <li key={i} className="font-semibold text-slate-800">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeReportDetail.actionItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Vytvořené úkoly ({activeReportDetail.actionItems.length})
                  </h4>
                  <div className="mt-2 space-y-2">
                    {activeReportDetail.actionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900">{item.title}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold">
                            {item.priority}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-slate-600">
                          <span>
                            Přiřazeno: <strong>{item.assigneeName || 'Nepřiřazeno'}</strong>
                          </span>
                          <span>
                            Termín: <strong>{item.dueDate}</strong>
                          </span>
                          {item.createdWorkOrderId && (
                            <Link
                              href={`/work/${item.createdWorkOrderId}`}
                              className="font-bold text-emerald-700 hover:underline"
                            >
                              Otevřít zakázku v Plánu práce →
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RESEND SECTION */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  ✉️ Poslat nebo přeposlat zápis lidem z porady
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(data.teamMembers ?? []).map((m) => {
                    const isAssigned = activeReportDetail.actionItems.some(
                      (i) => i.assigneeUserId === m.userId
                    );
                    const checked = resendRecipientIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() =>
                          setResendRecipientIds((prev) =>
                            checked ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                          )
                        }
                        className={`rounded-full px-2.5 py-1 text-xs font-bold transition border ${
                          checked
                            ? 'border-emerald-500 bg-emerald-600 text-white'
                            : isAssigned
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        {checked ? '✓ ' : ''}
                        {m.name}
                        {isAssigned ? ' (úkol)' : ''}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Další e-maily (např. externi@firma.cz, oddělené čárkou)"
                  value={resendExtraText}
                  onChange={(e) => setResendExtraText(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                />
                <button
                  type="button"
                  disabled={resendingEmail || (!resendRecipientIds.length && !resendExtraText.trim())}
                  onClick={() => handleResendMeetingReport(activeReportDetail.id)}
                  className={primaryButton}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>
                    {resendingEmail ? 'Odesílám…' : `Odeslat e-mail (${resendRecipientIds.length})`}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-3 text-right">
              <button
                type="button"
                onClick={() => setActiveReportDetail(null)}
                className={secondaryButton}
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEETING PROCESSOR MODAL (AI KRABIČKA / PŘEPIS) */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Zpracovat poradu z nahrávací krabičky</h3>
                  <p className="text-xs text-slate-500">
                    Vložte text z krabičky (nebo e-mailu). AI vytvoří shrnutí, rozhodnutí a úkoly pro lidi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMeetingModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {meetingError && (
              <p role="alert" className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700">
                {meetingError}
              </p>
            )}

            {meetingStep === 'input' ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-700">
                    <span>Název porady (volitelné)</span>
                    <input
                      type="text"
                      placeholder="např. Pondělní porada vedení"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-700">
                    <span>Datum porady</span>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
                    />
                  </label>
                </div>

                <label className="block text-xs font-bold text-slate-700">
                  <span>Přepis / výstup z krabičky nebo rychlé poznámky</span>
                  <textarea
                    rows={8}
                    placeholder="Sem vložte přepis z krabičky (např. Plaud Note / e-mail) nebo poznámky z porady...&#10;&#10;Příklad:&#10;Mirek zkontroluje nosiče v Opavě do pátku. Vlaďka připraví faktury pro klienta ABC zítra. Schválili jsme nákup nového materiálu."
                    value={meetingTranscript}
                    onChange={(e) => setMeetingTranscript(e.target.value)}
                    className="mt-1 block w-full rounded-2xl border border-slate-300 p-3 text-sm font-medium text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowMeetingModal(false)}
                    className={secondaryButton}
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    disabled={analyzingMeeting || !meetingTranscript.trim()}
                    onClick={handleAnalyzeMeeting}
                    className={primaryButton}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{analyzingMeeting ? 'AI analyzuje záznam…' : 'Analyzovat a navrhnout úkoly'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* REVIEW STEP */
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-800">
                      Návrh z AI
                    </span>
                    <button
                      type="button"
                      onClick={() => setMeetingStep('input')}
                      className="text-xs font-bold text-purple-700 underline"
                    >
                      Upravit zadání
                    </button>
                  </div>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-purple-300 bg-white px-3 py-1.5 text-sm font-black text-slate-900"
                  />
                </div>

                <label className="block text-xs font-bold text-slate-700">
                  <span>Shrnutí porady</span>
                  <textarea
                    rows={3}
                    value={meetingSummary}
                    onChange={(e) => setMeetingSummary(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800"
                  />
                </label>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Klíčová rozhodnutí
                    </span>
                    <button
                      type="button"
                      onClick={() => setMeetingDecisions([...meetingDecisions, ''])}
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      + Přidat rozhodnutí
                    </button>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {meetingDecisions.map((dec, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={dec}
                          onChange={(e) => {
                            const copy = [...meetingDecisions];
                            copy[idx] = e.target.value;
                            setMeetingDecisions(copy);
                          }}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setMeetingDecisions(meetingDecisions.filter((_, i) => i !== idx))}
                          className="text-xs text-slate-400 hover:text-rose-600"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Navržené úkoly ({meetingTasks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMeetingTasks([
                          ...meetingTasks,
                          {
                            id: `custom-${Date.now()}`,
                            title: '',
                            assigneeName: null,
                            assigneeUserId: null,
                            dueDate: plusDays(meetingDate, 1),
                            priority: 'NORMAL',
                            estimatedHours: 1,
                            createWorkOrder: true,
                            addToMyPlannerBlock: false,
                            blockStartTime: '10:00',
                          },
                        ])
                      }
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      + Přidat úkol
                    </button>
                  </div>

                  <div className="mt-2 space-y-3">
                    {meetingTasks.map((t, idx) => (
                      <div
                        key={t.id || idx}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <input
                            type="text"
                            placeholder="Popis úkolu..."
                            value={t.title}
                            onChange={(e) => {
                              const copy = [...meetingTasks];
                              copy[idx].title = e.target.value;
                              setMeetingTasks(copy);
                            }}
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setMeetingTasks(meetingTasks.filter((_, i) => i !== idx))}
                            className="text-xs text-slate-400 hover:text-rose-600"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="text-[11px] font-semibold text-slate-600">
                            <span>Kdo to má udělat</span>
                            <select
                              value={t.assigneeUserId || ''}
                              onChange={(e) => {
                                const selectedUser = (data.teamMembers ?? []).find((m) => m.userId === e.target.value);
                                const copy = [...meetingTasks];
                                copy[idx].assigneeUserId = selectedUser?.userId ?? null;
                                copy[idx].assigneeName = selectedUser?.name ?? null;
                                copy[idx].createWorkOrder = Boolean(selectedUser);
                                setMeetingTasks(copy);
                              }}
                              className="mt-0.5 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                            >
                              <option value="">Nepřiřazeno</option>
                              {(data.teamMembers ?? []).map((m) => (
                                <option key={m.userId} value={m.userId}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-[11px] font-semibold text-slate-600">
                            <span>Termín</span>
                            <input
                              type="date"
                              value={t.dueDate}
                              onChange={(e) => {
                                const copy = [...meetingTasks];
                                copy[idx].dueDate = e.target.value;
                                setMeetingTasks(copy);
                              }}
                              className="mt-0.5 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                            />
                          </label>

                          <label className="text-[11px] font-semibold text-slate-600">
                            <span>Priorita</span>
                            <select
                              value={t.priority}
                              onChange={(e) => {
                                const copy = [...meetingTasks];
                                copy[idx].priority = e.target.value as MeetingActionItemDraft['priority'];
                                setMeetingTasks(copy);
                              }}
                              className="mt-0.5 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                            >
                              <option value="NORMAL">Normální</option>
                              <option value="HIGH">Vysoká</option>
                              <option value="URGENT">Urgentní</option>
                              <option value="LOW">Nízká</option>
                            </select>
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={t.createWorkOrder}
                              onChange={(e) => {
                                const copy = [...meetingTasks];
                                copy[idx].createWorkOrder = e.target.checked;
                                setMeetingTasks(copy);
                              }}
                              className="h-3.5 w-3.5 rounded text-emerald-600"
                            />
                            <span>Vytvořit zakázku do Plánu práce</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={t.addToMyPlannerBlock}
                              onChange={(e) => {
                                const copy = [...meetingTasks];
                                copy[idx].addToMyPlannerBlock = e.target.checked;
                                setMeetingTasks(copy);
                              }}
                              className="h-3.5 w-3.5 rounded text-purple-600"
                            />
                            <span>Zapsat mně do Planneru (můj program)</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950">
                      ✉️ Komu odeslat zápis a úkoly ({meetingRecipientIds.length} lidí)
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setMeetingRecipientIds(
                            computeDefaultRecipients(meetingTasks, true, false)
                          )
                        }
                        className="font-extrabold text-emerald-800 hover:underline"
                      >
                        Jen z úkolů
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() =>
                          setMeetingRecipientIds(
                            computeDefaultRecipients(meetingTasks, true, true)
                          )
                        }
                        className="font-extrabold text-emerald-800 hover:underline"
                      >
                        Úkoly + vedení
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() => setMeetingRecipientIds([])}
                        className="font-bold text-slate-500 hover:underline"
                      >
                        Nikomu
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(data.teamMembers ?? []).map((m) => {
                      const hasTask = meetingTasks.some((t) => t.assigneeUserId === m.userId);
                      const checked = meetingRecipientIds.includes(m.userId);
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() =>
                            setMeetingRecipientIds((prev) =>
                              checked ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-bold transition border ${
                            checked
                              ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                              : hasTask
                              ? 'border-emerald-300 bg-white text-emerald-900'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          {checked ? '✓ ' : ''}
                          {m.name}
                          {hasTask ? ' (má úkol)' : ''}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    placeholder="Další e-maily (např. klient nebo externí kolega, oddělené čárkou)"
                    value={meetingExtraEmailsText}
                    onChange={(e) => setMeetingExtraEmailsText(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                  />

                  <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-emerald-200/60">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={sendToAssignees}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setSendToAssignees(val);
                          setMeetingRecipientIds(
                            computeDefaultRecipients(meetingTasks, val, sendToManagers)
                          );
                        }}
                        className="h-3.5 w-3.5 rounded text-emerald-600"
                      />
                      <span>Automaticky předvybrat lidi z úkolů</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={sendToManagers}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setSendToManagers(val);
                          setMeetingRecipientIds(
                            computeDefaultRecipients(meetingTasks, sendToAssignees, val)
                          );
                        }}
                        className="h-3.5 w-3.5 rounded text-emerald-600"
                      />
                      <span>Přidat vedení / manažery</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-900">
                      <input
                        type="checkbox"
                        checked={saveMeetingEmailDefaults}
                        onChange={(e) => setSaveMeetingEmailDefaults(e.target.checked)}
                        className="h-3.5 w-3.5 rounded text-emerald-600"
                      />
                      <span>Uložit jako výchozí pro příště</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setMeetingStep('input')}
                    className={secondaryButton}
                  >
                    ← Zpět k přepisu
                  </button>

                  <button
                    type="button"
                    disabled={savingMeeting}
                    onClick={handleSaveMeeting}
                    className={primaryButton}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {savingMeeting ? 'Vytvářím úkoly a ukládám…' : 'Potvrdit & vytvořit úkoly do Plánu'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OWNER EMAIL REPORT & SCHEDULE MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Report majitele do e-mailu</h3>
                  <p className="text-xs text-slate-500">
                    Pošlete dnešní souhrn ihned nebo zapněte každodenní automatický e-mail.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {/* SECTION 1: SEND NOW */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  Odeslat dnešní report ({data.date}) ihned
                </p>
                <label className="block text-xs font-bold text-slate-700">
                  <span>Komu poslat (e-maily oddělené čárkou; prázdné = všichni nastaveným majitelům)</span>
                  <input
                    type="text"
                    placeholder="např. majitel@firma.cz, vedeni@firma.cz"
                    value={manualEmailRecipients}
                    onChange={(e) => setManualEmailRecipients(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  disabled={sendingOwnerEmail}
                  onClick={handleSendOwnerEmail}
                  className={`${primaryButton} w-full justify-center`}
                >
                  <Mail className="h-4 w-4" />
                  <span>{sendingOwnerEmail ? 'Odesílám e-mail…' : 'Odeslat report majitele na e-mail teď'}</span>
                </button>
              </div>

              {/* SECTION 2: DAILY SCHEDULE */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Automatický denní e-mail majiteli
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-slate-900">
                    <input
                      type="checkbox"
                      checked={emailAutoEnabled}
                      onChange={(e) => setEmailAutoEnabled(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <span>{emailAutoEnabled ? 'Zapnuto' : 'Vypnuto'}</span>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-slate-700">
                    <span>Hodina odeslání (Praha)</span>
                    <select
                      value={emailSendHour}
                      onChange={(e) => setEmailSendHour(Number(e.target.value))}
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={emailSkipWeekends}
                      onChange={(e) => setEmailSkipWeekends(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <span>Vynechat víkendy (So–Ne)</span>
                  </label>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={emailIncludeAdmins}
                    onChange={(e) => setEmailIncludeAdmins(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-600"
                  />
                  <span>Posílat všem vlastníkům (OWNER) a administrátorům (ADMIN)</span>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  <span>Další e-maily příjemců (oddělené čárkou)</span>
                  <input
                    type="text"
                    placeholder="např. reditel@firma.cz, partner@firma.cz"
                    value={emailCustomText}
                    onChange={(e) => setEmailCustomText(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </label>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className={secondaryButton}
                  >
                    Zavřít
                  </button>
                  <button
                    type="button"
                    disabled={savingEmailSettings}
                    onClick={handleSaveEmailSettings}
                    className={secondaryButton}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    <span>{savingEmailSettings ? 'Ukládám…' : 'Uložit automatické odesílání'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
