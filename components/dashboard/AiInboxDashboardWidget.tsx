'use client';

import Link from 'next/link';
import { Mail, Sparkles, ArrowRight, CheckCircle2, Clock } from 'lucide-react';

export type AiInboxDashboardSummary = {
  unreviewedCount: number;
  recentMessages?: Array<{
    id: string;
    subject: string;
    fromName: string | null;
    fromEmail: string;
    classification: string;
    receivedAt: string;
  }>;
};

export function AiInboxDashboardWidget({
  summary,
}: {
  summary: AiInboxDashboardSummary;
}) {
  const count = summary.unreviewedCount;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
            <Mail size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg">AI Inbox</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100/70 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                <Sparkles size={11} />
                <span>Poptávky & E-maily</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatická analýza a příprava akcí pro CRM, nabídky a zakázky
            </p>
          </div>
        </div>

        <Link
          href="/ai-inbox"
          className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 active:scale-95 transition"
        >
          <span>Přejít do Inboxu</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`rounded-2xl p-4 border ${count > 0 ? 'bg-amber-50/50 border-amber-200/80' : 'bg-slate-50 border-slate-200/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">K vyřízení / potvrzení</span>
            <Clock size={16} className={count > 0 ? 'text-amber-600' : 'text-slate-400'} />
          </div>
          <p className={`mt-2 text-3xl font-black ${count > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
            {count}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {count === 0 ? 'Žádné zprávy nečekají na schválení' : count === 1 ? '1 zpráva čeká na potvrzení akce' : `${count} zpráv čeká na potvrzení akcí`}
          </p>
        </div>

        <div className="rounded-2xl p-4 border bg-emerald-50/40 border-emerald-200/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Human-in-the-loop</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-xs text-slate-600 mt-2">
            AI generuje návrhy klientů, nabídek a zakázek. Žádné změny v CRM nevzniknou bez vašeho schválení.
          </p>
          <div className="mt-2 text-[11px] font-bold text-emerald-700">
            100% kontrola nad daty
          </div>
        </div>
      </div>
    </div>
  );
}
