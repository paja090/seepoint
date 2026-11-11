'use client';

import { Radar, Sparkles, Flame, CalendarClock, FileText, CheckCircle2, Plus, Clock, PauseCircle } from 'lucide-react';
import type { RadarRunSummary, RadarStatusSummary } from '@/lib/opportunities/types';

type Stats = {
  totalNew: number;
  totalHighScore: number;
  totalContactThisWeek: number;
  totalProposals: number;
  totalConverted: number;
};

function formatRadarRunTimestamp(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });
}

function describeRadarRunOutcome(run: RadarRunSummary): { label: string; toneClass: string } {
  if (run.status === 'RUNNING') {
    return { label: 'probíhá', toneClass: 'text-amber-300' };
  }
  if (run.status === 'FAILED') {
    return { label: 'chyba', toneClass: 'text-rose-300' };
  }
  if (run.opportunitiesCreated > 0) {
    return { label: `+${run.opportunitiesCreated} nových`, toneClass: 'text-emerald-300' };
  }
  return { label: '0 nových', toneClass: 'text-slate-300' };
}

export function SalesOpportunitiesHeader({
  stats,
  radarStatus,
  onOpenManualModal,
  onAutoDiscover,
  onOpenSettings,
  isAutoDiscovering,
  canAutoDiscover,
}: {
  stats: Stats;
  radarStatus?: RadarStatusSummary;
  onOpenManualModal: () => void;
  onAutoDiscover: () => void;
  onOpenSettings?: () => void;
  isAutoDiscovering?: boolean;
  canAutoDiscover: boolean;
}) {
  const cronRun = radarStatus?.lastCronRun ?? null;
  const lastRun = radarStatus?.lastRun ?? null;
  const cronOutcome = cronRun ? describeRadarRunOutcome(cronRun) : null;
  const manualDiffRun = lastRun && lastRun.id !== cronRun?.id ? lastRun : null;
  const manualOutcome = manualDiffRun ? describeRadarRunOutcome(manualDiffRun) : null;

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-800/60 mb-2">
            <Radar className="w-3.5 h-3.5 text-purple-400" />
            <span>AI OOH Business Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>AI Obchodní radar</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            „Firmy a události s vysokým potenciálem pro venkovní reklamu (OOH).“
          </p>

          {radarStatus ? (
            <div className="mt-2.5 inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-300">
              {radarStatus.enabled ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Automat Po–Pá 7:00 (v létě 8:00)</span>
                  </span>
                  <span className="text-slate-600">·</span>
                  <span suppressHydrationWarning>
                    Poslední cron:{' '}
                    {cronRun && cronOutcome ? (
                      <>
                        <strong className="text-white">{formatRadarRunTimestamp(cronRun.finishedAt || cronRun.startedAt)}</strong>{' '}
                        <span className={cronOutcome.toneClass}>({cronOutcome.label})</span>
                      </>
                    ) : (
                      <strong className="text-slate-400">zatím neproběhl</strong>
                    )}
                  </span>
                  {manualDiffRun && manualOutcome ? (
                    <>
                      <span className="text-slate-600">·</span>
                      <span suppressHydrationWarning>
                        Poslední ruční:{' '}
                        <strong className="text-white">{formatRadarRunTimestamp(manualDiffRun.finishedAt || manualDiffRun.startedAt)}</strong>{' '}
                        <span className={manualOutcome.toneClass}>({manualOutcome.label})</span>
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
                    <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Automatické skenování vypnuto</span>
                  </span>
                  {lastRun ? (
                    <>
                      <span className="text-slate-600">·</span>
                      <span suppressHydrationWarning>
                        Poslední běh:{' '}
                        <strong className="text-white">{formatRadarRunTimestamp(lastRun.finishedAt || lastRun.startedAt)}</strong>{' '}
                        <span className={describeRadarRunOutcome(lastRun).toneClass}>({describeRadarRunOutcome(lastRun).label})</span>
                      </span>
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {canAutoDiscover && onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition active:scale-95"
            >
              <span>⚙️ Nastavení radaru</span>
            </button>
          ) : null}

          {canAutoDiscover ? (
            <button
              type="button"
              disabled={isAutoDiscovering}
              onClick={onAutoDiscover}
              className="ai-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-purple-300 ${isAutoDiscovering ? 'animate-spin' : ''}`} />
              <span>{isAutoDiscovering ? 'AI prohledává signály…' : 'Spustit AI hledání'}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenManualModal}
            className="ai-secondary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nová AI příležitost</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between gap-2 text-slate-400 [&>svg]:shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider">Nové příležitosti</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">{stats.totalNew}</p>
          <p className="text-[10px] font-semibold text-slate-400">Nové nepřezkoumané signály</p>
        </div>

        {/* KPI 2 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between gap-2 text-slate-400 [&>svg]:shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider">Silné (Score 80+)</span>
            <Flame className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.totalHighScore}</p>
          <p className="text-[10px] font-semibold text-slate-400">Nejvyšší potenciál zásahu</p>
        </div>

        {/* KPI 3 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between gap-2 text-slate-400 [&>svg]:shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider">K oslovení do 30 dnů</span>
            <CalendarClock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400">{stats.totalContactThisWeek}</p>
          <p className="text-[10px] font-semibold text-slate-400">Nadcházející události v příštích 30 dnech</p>
        </div>

        {/* KPI 4 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between gap-2 text-slate-400 [&>svg]:shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider">Vytvořené návrhy</span>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sky-400">{stats.totalProposals}</p>
          <p className="text-[10px] font-semibold text-slate-400">Připravené koncepty kampaní</p>
        </div>

        {/* KPI 5 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md col-span-2 md:col-span-1">
          <div className="flex items-center justify-between gap-2 text-slate-400 [&>svg]:shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider">Konverze</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.totalConverted}</p>
          <p className="text-[10px] font-semibold text-slate-400">Převedeno na zakázky</p>
        </div>
      </div>
    </div>
  );
}
