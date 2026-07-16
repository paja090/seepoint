import { Check } from 'lucide-react';
import Link from 'next/link';

const stages = [
  { key: 'brief', label: 'Zadání' },
  { key: 'planner', label: 'Plánování' },
  { key: 'pricing', label: 'Cenotvorba' },
  { key: 'preview', label: 'Klientský náhled' },
  { key: 'approval', label: 'Kontrola a odeslání' },
  { key: 'feedback', label: 'Zpětná vazba' },
  { key: 'conversion', label: 'Převod' },
  { key: 'done', label: 'Hotovo' },
] as const;

export type OfferProcessStage = typeof stages[number]['key'];

export function OfferProcessStepper({ current, offerId, offerType = 'STANDARD_MEDIA' }: { current: OfferProcessStage; offerId: string; offerType?: 'STANDARD_MEDIA' | 'NAVIGATION' | 'CITY_GALLERY' }) {
  const visibleStages = offerType === 'STANDARD_MEDIA' ? stages : stages.filter((stage) => ['brief', 'preview', 'approval', 'feedback', 'done'].includes(stage.key));
  const currentStep = visibleStages.findIndex((stage) => stage.key === current);
  const href = (key: OfferProcessStage) => {
    if (key === 'brief') return offerType === 'NAVIGATION' ? `/offers/${offerId}/navigation/edit` : offerType === 'CITY_GALLERY' ? `/offers/${offerId}/city-gallery/edit` : `/offers/${offerId}/edit`;
    if (['planner', 'pricing', 'preview', 'approval'].includes(key)) return `/offers/${offerId}/${key}`;
    return `/offers/${offerId}`;
  };

  return <nav aria-label="Průběh obchodního workflow" className="card mb-6 overflow-x-auto !p-4"><ol className="flex min-w-max items-center gap-1">{visibleStages.map((stage, index) => {
    const done = index < currentStep;
    const active = index === currentStep;
    return <li className="flex items-center gap-1" key={stage.key}><Link aria-current={active ? 'step' : undefined} className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-slate-950 text-white' : done ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-500 hover:bg-slate-100'}`} href={href(stage.key)}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? 'bg-white text-slate-950' : done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{done ? <Check aria-hidden="true" size={14} /> : index + 1}</span><span className="whitespace-nowrap">{stage.label}</span></Link>{index < visibleStages.length - 1 && <span aria-hidden="true" className={`h-px w-5 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}</li>;
  })}</ol></nav>;
}
