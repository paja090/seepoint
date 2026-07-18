import { AlertTriangle, CalendarClock, Camera, Check, Eye, Layers, MapPin } from 'lucide-react';
import Link from 'next/link';
import { MEDIA_TYPE_META, type ProposalMediaTypeKey } from '@/lib/offers/presentation';
import type { OfferView } from '@/lib/offers/view-model';
import { offerDateRange, type OfferConflictView } from '@/lib/offers/workflow';
import { OfferProcessStepper } from './OfferProcessStepper';

const tones: Record<string, string> = {
  blue: 'bg-sky-600',
  purple: 'bg-purple-600',
  orange: 'bg-orange-500',
  green: 'bg-emerald-600',
  indigo: 'bg-indigo-600',
};
const date = (value: string | null) => value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('cs-CZ') : 'neuvedeno';
const mediaMeta = (value: string) => MEDIA_TYPE_META[(value in MEDIA_TYPE_META ? value : 'OTHER') as ProposalMediaTypeKey];

export function OfferPlanner({ offer, conflicts }: { offer: OfferView; conflicts: OfferConflictView[] }) {
  const range = offerDateRange(offer);
  const cities = new Set(offer.items.map((item) => item.surface.carrier.city));
  const mediaTypes = new Set(offer.items.map((item) => item.surface.mediaType));
  const photos = offer.items.reduce((sum, item) => sum + item.surface.photos.length, 0);
  const groups = [...new Set(offer.items.map((item) => item.surface.mediaType))].map((type) => {
    const items = offer.items.filter((item) => item.surface.mediaType === type);
    const starts = items.map((item) => item.dateFrom).filter(Boolean).sort() as string[];
    const ends = items.map((item) => item.dateTo).filter(Boolean).sort() as string[];
    const startOffset = range.from && starts[0] ? Math.max(0, (new Date(starts[0]).getTime() - new Date(range.from).getTime()) / 86_400_000) : 0;
    const groupDays = starts[0] && ends.at(-1) ? Math.max(1, (new Date(ends.at(-1)!).getTime() - new Date(starts[0]).getTime()) / 86_400_000 + 1) : range.days;
    return { type, items, start: range.days ? startOffset / range.days * 100 : 0, width: range.days ? Math.min(100, groupDays / range.days * 100) : 100 };
  });
  const segments = Array.from({ length: Math.min(5, Math.max(1, Math.ceil(range.days / 7))) }, (_, index) => `T${index + 1}`);

  return (
    <div className="space-y-6">
      <OfferProcessStepper current="planner" offerId={offer.id!} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat hint="v návrhu kampaně" label="Vybrané plochy" value={offer.items.length} />
        <MiniStat hint="skladba kampaně" label="Typy médií" value={mediaTypes.size} />
        <MiniStat hint={range.days ? `${date(range.from)} – ${date(range.to)}` : 'termín není kompletní'} label="Délka kampaně" value={`${range.days} dní`} />
        <MiniStat hint={`${photos} dostupných fotografií`} label="Pokrytí měst" value={cities.size} />
      </div>

      <section className="card">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock aria-hidden="true" className="text-slate-500" size={18} />
          <h2 className="text-base font-semibold text-slate-950">Časová osa kampaně</h2>
          <span className="ml-auto rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">{range.days} dní</span>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-[150px_1fr] gap-3"><span /><div className="grid gap-1 text-center text-[11px] font-medium text-slate-500" style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}>{segments.map((segment) => <span key={segment}>{segment}</span>)}</div></div>
          {groups.map((group) => {
            const meta = mediaMeta(group.type);
            return (
              <div className="grid grid-cols-[150px_1fr] items-center gap-3" key={group.type}>
                <div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${tones[meta.tone]}`} /><span className="truncate text-sm font-medium text-slate-800">{meta.label}</span><span className="text-xs text-slate-400">{group.items.length}×</span></div>
                <div className="relative h-8 rounded-lg bg-slate-100"><div className={`absolute inset-y-0 flex items-center rounded-lg px-2 text-[11px] font-semibold text-white ${tones[meta.tone]}`} style={{ left: `${group.start}%`, width: `${group.width}%` }}>{date(group.items[0]?.dateFrom)} – {date(group.items[0]?.dateTo)}</div></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center gap-2"><Layers aria-hidden="true" className="text-slate-500" size={18} /><h2 className="text-base font-semibold text-slate-950">Dostupnost vybraných ploch</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-1 text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wide text-slate-400"><th className="px-2 text-left font-medium">Plocha</th>{segments.map((segment) => <th className="px-2 text-center font-medium" key={segment}>{segment}</th>)}</tr></thead>
            <tbody>{offer.items.map((item) => {
              const conflict = conflicts.find((entry) => entry.surfaceId === item.surfaceId);
              const meta = mediaMeta(item.surface.mediaType);
              return (
                <tr key={item.id ?? item.surfaceId}>
                  <td className="px-2 py-1"><div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${tones[meta.tone]}`} /><div><p className="font-medium leading-tight text-slate-800">{item.surface.carrier.code}</p><p className="text-xs leading-tight text-slate-400">{item.surface.carrier.city}</p></div></div></td>
                  {segments.map((segment) => <td className="px-1" key={segment}><div className={`grid h-9 place-items-center rounded-lg text-[11px] font-semibold ${conflict ? conflict.severity === 'block' ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'bg-slate-950 text-white'}`}>{conflict ? <AlertTriangle aria-hidden="true" size={14} /> : <Check aria-hidden="true" size={14} />}</div></td>)}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="size-3 rounded bg-slate-950" />Vybráno</span><span className="flex items-center gap-1.5"><span className="size-3 rounded bg-amber-100 ring-1 ring-amber-300" />Jednání</span><span className="flex items-center gap-1.5"><span className="size-3 rounded bg-red-100 ring-1 ring-red-300" />Kolize</span></div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center gap-2"><AlertTriangle aria-hidden="true" className="text-amber-500" size={18} /><h2 className="text-base font-semibold text-slate-950">Detekce kolizí</h2><span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${conflicts.length ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>{conflicts.length ? `${conflicts.length} k vyřešení` : 'Bez kolizí'}</span></div>
        {conflicts.length === 0 ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">Všechny vybrané plochy jsou pro zadaný termín dostupné.</p> : <div className="space-y-3">{conflicts.map((conflict) => <div className={`rounded-xl border p-4 ${conflict.severity === 'block' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`} key={`${conflict.surfaceId}-${conflict.dateFrom}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{conflict.carrierCode} · {conflict.surfaceName}</p><p className="mt-1 text-sm text-slate-600">{conflict.clientName} · {conflict.campaignName}</p><p className="mt-1 text-sm text-slate-500">{date(conflict.dateFrom)} – {date(conflict.dateTo)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${conflict.severity === 'block' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{conflict.severity === 'block' ? 'Tvrdá kolize' : 'Měkká kolize'}</span></div></div>)}</div>}
      </section>

      <div className="flex flex-wrap gap-3"><Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={`/offers/${offer.id}/preview`}><Eye aria-hidden="true" size={16} />Náhled klientské nabídky</Link><span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"><MapPin aria-hidden="true" size={16} />{offer.items.length} ploch v {cities.size} městech</span><span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"><Camera aria-hidden="true" size={16} />{photos} fotografií</span></div>

      <footer className="flex items-center justify-between border-t border-slate-200 pt-6"><Link className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href={`/offers/${offer.id}/edit`}>← Zpět: Zadání</Link><Link className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white" href={`/offers/${offer.id}/pricing`}>Pokračovat: Cenotvorba →</Link></footer>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>;
}
