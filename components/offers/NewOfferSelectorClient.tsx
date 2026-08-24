'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, GalleryHorizontalEnd, MapPinned, PanelsTopLeft, Sparkles } from 'lucide-react';
import { AiOfferGeneratorModal } from '@/components/offers/AiOfferGeneratorModal';

export function NewOfferSelectorClient({
  clientId,
  clientOptions = [],
}: {
  clientId?: string;
  clientOptions?: Array<{ id: string; name: string }>;
}) {
  const [aiModalOpen, setAiModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Featured AI Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-800/80 bg-gradient-to-r from-slate-950 via-purple-950 to-slate-950 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-900/80 text-purple-200 border border-purple-700">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Doporučený postup</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ✨ Vygenerovat nabídku pomocí AI Copilota
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Zadejte rozpočet, město nebo cíl. AI vybere ideální dostupné reklamní plochy či navigační body a připraví celou nabídku během 3 vteřin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg transition transform active:scale-95 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Spustit AI Copilota</span>
          </button>
        </div>
      </div>

      {/* Grid of Manual / Specific Offer Types */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* AI Copilot Card */}
        <button
          type="button"
          onClick={() => setAiModalOpen(true)}
          className="group text-left flex min-h-64 flex-col rounded-3xl border-2 border-purple-600/60 bg-slate-900/90 p-6 shadow-md transition hover:-translate-y-1 hover:border-purple-500 hover:shadow-xl cursor-pointer"
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-purple-950 text-purple-300 ring-1 ring-purple-700">
            <Sparkles size={27} className="text-purple-400" />
          </span>
          <h2 className="mt-6 text-xl font-bold text-white flex items-center gap-2">
            <span>AI Copilot</span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-900 text-purple-200">✨ Doporučeno</span>
          </h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-300 font-medium">
            Automatické sestavení nabídky podle rozpočtu, měst a cílů s doporučeným mixem médií.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-purple-300">
            Spustit generátor <ArrowRight className="transition group-hover:translate-x-1" size={16} />
          </span>
        </button>

        {/* Navigation */}
        <Link
          className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
          href={clientId ? `/offers/new/navigation?clientId=${encodeURIComponent(clientId)}` : '/offers/new/navigation'}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-orange-50 text-orange-700 ring-1 ring-orange-200">
            <MapPinned size={27} />
          </span>
          <h2 className="mt-6 text-xl font-semibold text-slate-950">Navigace</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
            Flexibilní cílový bod a plánované navigační body vytvářené přímo v mapě.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
            Pokračovat manuálně <ArrowRight className="transition group-hover:translate-x-1" size={16} />
          </span>
        </Link>

        {/* City Gallery */}
        <Link
          className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
          href={clientId ? `/offers/new/city-gallery?clientId=${encodeURIComponent(clientId)}` : '/offers/new/city-gallery'}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-purple-50 text-purple-700 ring-1 ring-purple-200">
            <GalleryHorizontalEnd size={27} />
          </span>
          <h2 className="mt-6 text-xl font-semibold text-slate-950">Galerie venku / City Gallery</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
            Samostatná nabídka pro projekt, lokalitu nebo připravovanou realizaci Galerie venku.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
            Pokračovat manuálně <ArrowRight className="transition group-hover:translate-x-1" size={16} />
          </span>
        </Link>

        {/* Standard Media */}
        <Link
          className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
          href={clientId ? `/offers/new/standard?clientId=${encodeURIComponent(clientId)}` : '/offers/new/standard'}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-200">
            <PanelsTopLeft size={27} />
          </span>
          <h2 className="mt-6 text-xl font-semibold text-slate-950">Standardní reklamní média</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
            Existující billboardy, lavičky, citypostery, CLV, towery a fasády s dostupností.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
            Pokračovat manuálně <ArrowRight className="transition group-hover:translate-x-1" size={16} />
          </span>
        </Link>
      </div>

      {/* Templates & Catalog Promo Banner */}
      <div className="rounded-3xl border border-emerald-300/60 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Katalog hotových konceptů</span>
          <h3 className="text-lg font-black text-white">Hledáte inspiraci nebo hotový balíček pro klienta?</h3>
          <p className="text-xs text-slate-300">
            Prohlédněte si vzorové šablony pro Billboardové sítě, Městský mobiliář, Fasády či Navigační řetězce.
          </p>
        </div>
        <Link
          href={clientId ? `/offers/templates?clientId=${encodeURIComponent(clientId)}` : '/offers/templates'}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shrink-0 flex items-center gap-2 shadow-sm"
        >
          <span>Otevřít Katalog šablon</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <AiOfferGeneratorModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        clients={clientOptions}
        preFill={clientId ? { clientId } : undefined}
      />
    </div>
  );
}
