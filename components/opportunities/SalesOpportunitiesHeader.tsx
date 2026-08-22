'use client';

import { Radar, Sparkles, Building2, Flame, CalendarClock, FileText, CheckCircle2, Plus } from 'lucide-react';

type Stats = {
  totalNew: number;
  totalHighScore: number;
  totalContactThisWeek: number;
  totalProposals: number;
  totalConverted: number;
};

export function SalesOpportunitiesHeader({
  stats,
  onOpenManualModal,
  onAutoDiscover,
  isAutoDiscovering,
}: {
  stats: Stats;
  onOpenManualModal: () => void;
  onAutoDiscover: () => void;
  isAutoDiscovering?: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-800/60 mb-2">
            <Radar className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>AI Business Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>AI Obchodní radar</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            „Firmy a události, kde SeePoint právě teď vidí obchodní příležitost.“
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isAutoDiscovering}
            onClick={onAutoDiscover}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg transition transform active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-purple-300 ${isAutoDiscovering ? 'animate-spin' : ''}`} />
            <span>{isAutoDiscovering ? 'AI prohledává MS kraj…' : '🤖 Spustit AI Hledání v MS kraji'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenManualModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nová AI příležitost</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Nové příležitosti</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white">{stats.totalNew}</p>
          <p className="text-[10px] font-semibold text-slate-400">Nové nepřezkoumané signály</p>
        </div>

        {/* KPI 2 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Silné (Score 80+)</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-400">{stats.totalHighScore}</p>
          <p className="text-[10px] font-semibold text-slate-400">Nejvyšší potenciál zásahu</p>
        </div>

        {/* KPI 3 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">K oslovení tento týden</span>
            <CalendarClock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400">{stats.totalContactThisWeek}</p>
          <p className="text-[10px] font-semibold text-slate-400">Události do 30-90 dnů</p>
        </div>

        {/* KPI 4 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Vytvořené návrhy</span>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sky-400">{stats.totalProposals}</p>
          <p className="text-[10px] font-semibold text-slate-400">Odeslané koncepty kampaní</p>
        </div>

        {/* KPI 5 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5 shadow-md col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
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
