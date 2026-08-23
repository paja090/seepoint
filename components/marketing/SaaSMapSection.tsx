'use client';

import { MapPin, CheckCircle2, ArrowRight, Eye, Layers, Compass, Sparkles } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSMapSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const mapFeatures = [
    { title: 'Dostupnost v čase', desc: 'Filtr volných nosičů pro konkrétní datumový rozsah kampaně' },
    { title: 'Typy médií', desc: 'Barevné odlišení City Posterů, Laviček, Billboardů, Towerů a Navigací' },
    { title: 'Přesné GPS souřadnice', desc: 'Každý nosič má zaměřenou polohu pro montážníky i klienty' },
    { title: 'Přiřazení ke klientovi', desc: 'Na mapě vidíte aktivní nájemce i vypršení jejich smlouvy' },
    { title: 'Fotografie z terénu', desc: 'Klimatické foto z ulice, detailní pohled i vizualizace motivu' },
    { title: 'Technický stav nosiče', desc: 'Evidence poškození, plánovaných oprav a výměn polepů' },
  ];

  return (
    <section className="py-20 bg-slate-900/60 border-t border-slate-800 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
          <div className="space-y-3 max-w-2xl">
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
              MAPOVÝ ENGINE SEEPOINT OS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Celá vaše reklamní síť na jedné mapě.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Konec hledání v PDF souborech a soukromých složkách. Obchodník i klient vidí přesnou polohu a obsazenost nosičů na interaktivní Google Mapě.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              trackSaaSEvent('demo_cta_clicked', { source: 'map_section' });
              onOpenDemoModal();
            }}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-purple-950 text-purple-200 hover:bg-purple-900 font-extrabold text-xs sm:text-sm border border-purple-700/80 transition shadow-lg shrink-0 cursor-pointer"
          >
            <span>Prohlédnout správu ploch</span>
            <ArrowRight className="w-4 h-4 text-purple-300" />
          </button>
        </div>

        {/* Full-width Map Showcase Visual */}
        <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:p-6 shadow-2xl overflow-hidden ring-1 ring-purple-900/40">
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900 min-h-[380px] p-6 flex flex-col justify-between overflow-hidden">
            {/* Grid Pattern overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:28px_28px] opacity-30" />

            {/* Header overlay */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">Mapa sítě: Ostrava, Opava, Havířov, Karviná</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ● Volné (274)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-950 text-purple-300 border border-purple-800">
                  ● Obsazeno (568)
                </span>
              </div>
            </div>

            {/* Center Pins Demo Grid */}
            <div className="relative z-10 my-auto py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/95 border border-purple-800/80 shadow-2xl backdrop-blur-md space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-purple-300 font-bold">CP-OSTR-012</span>
                  <span className="text-emerald-400 font-bold">Volné dnes</span>
                </div>
                <h4 className="font-black text-sm text-white">City Poster 28. října u Pošty</h4>
                <p className="text-xs text-slate-400">CLP vitrína prosvětlená · Pěší zóna centrum</p>
                <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-slate-800 text-purple-200">
                  <span>Standardní sazba</span>
                  <span>6 800 Kč / mes</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-md space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-indigo-300 font-bold">NAV-OPAV-14</span>
                  <span className="text-emerald-400 font-bold">Schválený sloupec VO</span>
                </div>
                <h4 className="font-black text-sm text-white">Navigační deska Olomoucká #142</h4>
                <p className="text-xs text-slate-400">Příjezdová třída od jihu · Obchodní zóna</p>
                <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-slate-800 text-indigo-200">
                  <span>Standardní sazba</span>
                  <span>1 950 Kč / mes</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-md space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-sky-300 font-bold">TOW-MIST-01</span>
                  <span className="text-purple-300 font-bold">Promo Tower (Set 4s)</span>
                </div>
                <h4 className="font-black text-sm text-white">Promo Tower Místecká / Vjezd Ostrava</h4>
                <p className="text-xs text-slate-400">Velkoplošná věž 4 strany A,B,C,D · Hlavní obchvat</p>
                <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-slate-800 text-sky-200">
                  <span>Standardní sazba</span>
                  <span>24 900 Kč / mes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Checkbox Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mapFeatures.map((feat) => (
            <div key={feat.title} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                <strong className="text-sm font-bold text-white">{feat.title}</strong>
              </div>
              <p className="text-xs text-slate-400 font-medium pl-6">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
