import Link from 'next/link';
import { ArrowUpRight, Clock, Eye, Flame, MapPin } from 'lucide-react';
import { formatCzk, type PipelineDeal } from '@/lib/mock-sales-data';

export function DealCard({ deal }: { deal: PipelineDeal }) {
  return (
    <Link
      className="group block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
      href={`/sales/crm/${deal.clientId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-slate-950">{deal.client}</p>
        {deal.priority === 'high' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
            <Flame aria-hidden size={11} />
            Priorita
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-snug text-slate-500">{deal.campaign}</p>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-bold tracking-tight text-slate-950">{formatCzk(deal.value)}</span>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <MapPin aria-hidden size={12} />
          {deal.surfaces} ploch
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">
            {deal.owner.split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </span>
          {deal.updatedLabel}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-slate-500">
          {typeof deal.views === 'number' && (
            <span className="inline-flex items-center gap-1 text-indigo-600">
              <Eye aria-hidden size={12} />
              {deal.views}×
            </span>
          )}
          {typeof deal.validDays === 'number' && (
            <span className={`inline-flex items-center gap-1 ${deal.validDays <= 5 ? 'text-red-600' : 'text-slate-500'}`}>
              <Clock aria-hidden size={12} />
              {deal.validDays} dní
            </span>
          )}
          <ArrowUpRight aria-hidden className="text-slate-300 transition group-hover:text-slate-600" size={14} />
        </span>
      </div>
    </Link>
  );
}
