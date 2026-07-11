'use client';

import { useState } from 'react';
import { CheckCircle2, Eye, HelpCircle, MessageSquare, PencilLine, Send, Sparkles, ThumbsUp } from 'lucide-react';
import { feedbackRequests, feedbackTimeline, type FeedbackEvent } from '@/lib/mock-sales-data';
import { WorkflowStepper } from './WorkflowStepper';
import { MiniStat, StatusPill, WorkflowFooter } from './ui';

const EVENT_META: Record<FeedbackEvent['type'], { icon: React.ReactNode; ring: string; text: string }> = {
  sent: { icon: <Send size={15} />, ring: 'bg-sky-100 ring-sky-200', text: 'text-sky-700' },
  viewed: { icon: <Eye size={15} />, ring: 'bg-slate-100 ring-slate-200', text: 'text-slate-600' },
  question: { icon: <HelpCircle size={15} />, ring: 'bg-amber-100 ring-amber-200', text: 'text-amber-700' },
  revision: { icon: <PencilLine size={15} />, ring: 'bg-indigo-100 ring-indigo-200', text: 'text-indigo-700' },
  approved: { icon: <ThumbsUp size={15} />, ring: 'bg-emerald-100 ring-emerald-200', text: 'text-emerald-700' },
};

export function ClientFeedback() {
  const [reply, setReply] = useState('');
  const [approved, setApproved] = useState(false);

  return (
    <div className="space-y-6">
      <WorkflowStepper current="feedback" />

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Zobrazení nabídky" value="4×" hint="poslední: 11. 7. 08:30" />
        <MiniStat label="Otevřené dotazy" value={feedbackRequests.filter((r) => r.status === 'open').length} hint="čeká na reakci" />
        <MiniStat label="Stav" value={approved ? 'Schváleno' : 'V jednání'} hint={approved ? 'klient potvrdil' : 'probíhá revize'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Timeline */}
        <section className="card">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare aria-hidden className="text-slate-500" size={18} />
            <h2 className="text-base font-semibold text-slate-950">Průběh komunikace</h2>
          </div>
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {feedbackTimeline.map((event) => {
              const meta = EVENT_META[event.type];
              return (
                <li className="relative" key={event.id}>
                  <span className={`absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full ring-2 ${meta.ring} ${meta.text}`}>
                    {meta.icon}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{event.actor}</p>
                    <span className="text-xs text-slate-400">{event.time}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{event.text}</p>
                </li>
              );
            })}
            {approved && (
              <li className="relative">
                <span className="absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200">
                  <ThumbsUp size={15} />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">McDonald&apos;s ČR</p>
                  <span className="text-xs text-slate-400">nyní</span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-emerald-700">Klient nabídku schválil.</p>
              </li>
            )}
          </ol>
        </section>

        {/* Requests + reply */}
        <aside className="space-y-6">
          <section className="card">
            <h2 className="text-base font-semibold text-slate-950">Požadavky klienta</h2>
            <div className="mt-3 space-y-3">
              {feedbackRequests.map((request) => (
                <div className="rounded-xl border border-slate-200 p-3" key={request.id}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{request.author}</p>
                    {request.status === 'resolved' ? (
                      <StatusPill icon={<CheckCircle2 size={12} />} label="Vyřešeno" tone="emerald" />
                    ) : (
                      <StatusPill label="Otevřené" tone="amber" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{request.text}</p>
                  <p className="mt-1 text-xs text-slate-400">{request.date}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="text-base font-semibold text-slate-950">Reagovat</h2>
            <textarea
              className="input mt-3 min-h-[96px] resize-y"
              onChange={(event) => setReply(event.target.value)}
              placeholder="Napište odpověď klientovi nebo interní poznámku…"
              value={reply}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                disabled={reply.trim().length === 0}
                onClick={() => setReply('')}
                type="button"
              >
                <Send aria-hidden size={15} /> Odeslat
              </button>
              <a
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                href="/sales/pricing"
              >
                <PencilLine aria-hidden size={15} /> Upravit nabídku
              </a>
            </div>
          </section>

          <section className="card bg-emerald-50 ring-1 ring-emerald-200">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="text-emerald-600" size={18} />
              <h2 className="text-base font-semibold text-emerald-900">Simulace schválení</h2>
            </div>
            <p className="mt-1 text-sm text-emerald-800">
              Pro ukázku workflow můžete simulovat schválení nabídky klientem.
            </p>
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              disabled={approved}
              onClick={() => setApproved(true)}
              type="button"
            >
              <ThumbsUp aria-hidden size={16} /> {approved ? 'Nabídka schválena' : 'Klient schvaluje nabídku'}
            </button>
          </section>
        </aside>
      </div>

      <WorkflowFooter current="feedback" nextLabel={approved ? 'Převést na kampaň' : 'Pokračovat: Převod'} />
    </div>
  );
}
