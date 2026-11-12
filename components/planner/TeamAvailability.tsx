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
  Clock,
  FileText,
  Mail,
  Mic,
  Plus,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import type { Interval } from '@/lib/planner/domain';
import { dayRange, plusDays } from '@/lib/planner/time';
import { plannerRequest } from './api';
import type { MeetingActionItemDraft, MeetingReportRecord } from '@/lib/planner/team-pulse';

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

  // Meeting modal form state
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
  const [sendMeetingEmail, setSendMeetingEmail] = useState(true);

  const toggleMemberExpand = (id: string) => {
    setExpandedMembers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
        setMeetingTitle(res.draft.title || meetingTitle || 'Porada týmu');
        setMeetingSummary(res.draft.summary || '');
        setMeetingDecisions(res.draft.decisions || []);
        setMeetingTasks(res.draft.actionItems || []);
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
      const res = await plannerRequest<{ ok: boolean; report: MeetingReportRecord }>('/meetings', {
        action: 'commit',
        title: meetingTitle,
        meetingDate,
        summary: meetingSummary,
        decisions: meetingDecisions,
        actionItems: meetingTasks,
        sendEmailToManagers: sendMeetingEmail,
      });

      if (res.ok) {
        setShowMeetingModal(false);
        setMeetingStep('input');
        setMeetingTranscript('');
        setMeetingSummary('');
        setMeetingDecisions([]);
        setMeetingTasks([]);
        onReload?.();
      }
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : 'Uložení porady selhalo.');
    } finally {
      setSavingMeeting(false);
    }
  };

  const pulse = data.companyPulse;

  return (
    <div className="space-y-6">
      {/* HEADER & QUICK ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
            <Users className="h-3 w-3" />
            <span>Přehled firmy a týmu</span>
          </span>
          <h2 className="mt-1 text-xl font-black text-slate-900">Co se dnes ve firmě dělá</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Kapacita lidí, hotové zakázky, terénní práce a zápisy z porad z nahrávací krabičky.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* FIREMNÍ PULS DNE - KPI BANNER */}
      {pulse && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Hotovo dnes</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-950">{pulse.completedCount}</p>
            <p className="mt-1 text-[11px] font-medium text-emerald-800">dokončené zakázky za den</p>
          </div>

          <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">V řešení / Na trase</span>
              <Clock className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-sky-950">{pulse.activeCount}</p>
            <p className="mt-1 text-[11px] font-medium text-sky-800">aktivních zakázek v termínu</p>
          </div>

          <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Potvrzeno pracovníky</span>
              <UserCheck className="h-4 w-4 text-teal-600" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-teal-950">{pulse.acknowledgedCount}</p>
            <p className="mt-1 text-[11px] font-medium text-teal-800">potvrdilo e-mail „Vím o tom“</p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Přesunuto s důvodem</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-950">{pulse.rescheduledCount}</p>
            <p className="mt-1 text-[11px] font-medium text-amber-800">nestihlo se / přeplánováno</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Vykázáno dnes</span>
              <Clock className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
              {pulse.loggedHoursTotal} <span className="text-sm font-bold text-slate-500">h</span>
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-600">záznamy z terénu a výkazů</p>
          </div>
        </section>
      )}

      {/* TEAM MEMBERS CARDS WITH LIVE ACTIVITY ACCORDIONS */}
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
                      {act && act.loggedHoursToday > 0 && (
                        <span className="text-[11px] font-bold text-emerald-700">
                          {act.loggedHoursToday} h vykázáno dnes
                        </span>
                      )}
                    </div>
                  </label>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${pillTone}`}>
                    {member.today.utilization} %
                  </span>
                </div>

                <div className="mt-4 space-y-1.5">
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

                <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
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
                    onClick={() => setActiveReportDetail(report)}
                    className="text-xs font-extrabold text-emerald-800 hover:underline"
                  >
                    Zobrazit celý zápis a rozhodnutí →
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

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={sendMeetingEmail}
                      onChange={(e) => setSendMeetingEmail(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600"
                    />
                    <span>Odeslat přehledný zápis a seznam úkolů všem manažerům e-mailem</span>
                  </label>
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
    </div>
  );
}
