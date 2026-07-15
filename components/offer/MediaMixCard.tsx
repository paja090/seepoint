import { Eye, LayoutGrid } from 'lucide-react';
import type { ProposalMediaType } from '@/lib/offers/presentation';
import { TONE_CLASSES, formatCzk } from '@/lib/offers/presentation';

export function MediaMixCard({ media, sharePercent }: { media: ProposalMediaType; sharePercent: number }) {
  const tone = TONE_CLASSES[media.tone];
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative h-40 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={media.imageAlt} className="h-full w-full object-cover" src={media.image || '/placeholder.svg'} />
        <span
          className={`absolute left-3 top-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white ${tone.bg}`}
        >
          {media.name}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-sm leading-6 text-slate-600">{media.description}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <LayoutGrid aria-hidden size={14} />
              Plochy
            </div>
            <p className="mt-1 text-lg font-semibold text-slate-900">{media.surfaceCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Eye aria-hidden size={14} />
              Lokality
            </div>
            <p className="mt-1 text-lg font-semibold text-slate-900">{media.locationCount}</p>
          </div>
        </div>

        <div className="mt-auto">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Podíl v media mixu</span>
            <span className={tone.text}>{sharePercent} %</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${tone.bg}`} style={{ width: `${sharePercent}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Mezisoučet</span>
          <span className="text-lg font-semibold text-slate-950">{formatCzk(media.subtotal)}</span>
        </div>
      </div>
    </article>
  );
}
