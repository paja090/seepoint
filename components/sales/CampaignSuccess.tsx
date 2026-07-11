import Link from 'next/link';
import { Bell, BriefcaseBusiness, Calendar, CheckCircle2, CircleDot, FileText, PartyPopper, Users } from 'lucide-react';
import {
  formatCzk,
  successNextActions,
  successSummary,
  successTimeline,
  type NextAction,
} from '@/lib/mock-sales-data';
import { WorkflowStepper } from './WorkflowStepper';
import { MiniStat } from './ui';

const ACTION_ICON: Record<NextAction['icon'], React.ReactNode> = {
  calendar: <Calendar size={18} />,
  briefcase: <BriefcaseBusiness size={18} />,
  file: <FileText size={18} />,
  users: <Users size={18} />,
  bell: <Bell size={18} />,
};

export function CampaignSuccess() {
  return (
    <div className="space-y-6">
      <WorkflowStepper current="success" />

      {/* Hero */}
      <section className="card overflow-hidden !p-0">
        <div className="bg-slate-950 px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40">
              <PartyPopper aria-hidden size={24} />
            </span>
            <div>
              <p className="text-sm font-medium text-emerald-300">Kampaň úspěšně vytvořena</p>
              <h2 className="text-2xl font-semibold tracking-tight text-balance">{successSummary.campaign}</h2>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
            Nabídka pro {successSummary.client} byla schválena a převedena na kampaň{' '}
            <span className="font-semibold text-white">{successSummary.campaignId}</span>. Plochy jsou
            rezervovány a workflow předáno provozu a fakturaci.
          </p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Kampaň ID" value={successSummary.campaignId} />
          <MiniStat label="Rezervované plochy" value={`${successSummary.reservations}/${successSummary.surfaces}`} hint="všechny potvrzeny" />
          <MiniStat label="Hodnota kampaně" value={formatCzk(successSummary.value)} hint="s DPH" />
          <MiniStat label="Termín" value="Srpen 2026" hint={successSummary.period} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Timeline */}
        <section className="card">
          <h2 className="mb-4 text-base font-semibold text-slate-950">Harmonogram realizace</h2>
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {successTimeline.map((milestone) => (
              <li className="relative" key={milestone.id}>
                <span className={`absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full ring-2 ${milestone.done ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-white text-slate-400 ring-slate-200'}`}>
                  {milestone.done ? <CheckCircle2 size={15} /> : <CircleDot size={15} />}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`font-medium ${milestone.done ? 'text-slate-900' : 'text-slate-700'}`}>{milestone.label}</p>
                  <span className="text-xs text-slate-400">{milestone.date}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">Odpovídá: {milestone.owner}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Next actions + owner */}
        <aside className="space-y-6">
          <section className="card">
            <h2 className="text-base font-semibold text-slate-950">Další kroky</h2>
            <div className="mt-3 space-y-2">
              {successNextActions.map((action) => (
                <Link
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
                  href={action.href}
                  key={action.id}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    {ACTION_ICON[action.icon]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{action.label}</p>
                    <p className="text-xs text-slate-500">{action.detail}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="text-base font-semibold text-slate-950">Odpovědný obchodník</h2>
            <div className="mt-3 flex items-center gap-3">
              <img
                alt={successSummary.owner}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-100"
                src={successSummary.ownerAvatar || '/placeholder.svg'}
              />
              <div>
                <p className="font-semibold text-slate-950">{successSummary.owner}</p>
                <p className="text-sm text-slate-500">{successSummary.ownerRole}</p>
              </div>
            </div>
            <Link
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/sales"
            >
              Zpět na sales dashboard
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
