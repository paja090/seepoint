import { Download, Share2, MapPin, Phone } from 'lucide-react';
import { campaign, salesperson } from '@/lib/proposal-data';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
        <MapPin className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900">
        See<span className="text-brand">POINT</span>
      </span>
    </div>
  );
}

export function ProposalHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden h-6 w-px bg-slate-200 lg:block" />
          <div className="hidden lg:block">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Campaign proposal</p>
            <p className="text-sm font-semibold text-slate-900">{campaign.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="mr-1 hidden items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 xl:flex">
            <img src={salesperson.image || '/placeholder.svg'} alt={salesperson.name} className="h-7 w-7 rounded-full object-cover" />
            <div className="leading-tight">
              <p className="text-xs font-semibold text-slate-900">{salesperson.name}</p>
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <Phone className="h-3 w-3" /> {salesperson.phone}
              </p>
            </div>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download PDF</span>
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share proposal</span>
          </button>
        </div>
      </div>
    </header>
  );
}
