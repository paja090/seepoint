'use client';

import Image from 'next/image';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Play, Layers, MapPin, Building2, TrendingUp, Smartphone, Laptop, Check } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSHero({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  return (
    <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden">
      {/* Background Ambient Glowing Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] bg-gradient-to-tr from-purple-900/30 via-indigo-900/20 to-blue-900/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-purple-800/60 shadow-lg text-slate-200">
          <span className="flex size-2 rounded-full bg-purple-500 animate-ping" />
          <span className="text-[11px] font-black tracking-widest uppercase text-purple-300">
            PLATFORMA PRO VENKOVNÍ REKLAMU
          </span>
          <span className="h-3 w-px bg-slate-800" />
          <span className="text-xs font-bold text-slate-300 hidden sm:inline">
            SaaS verze 2.0
          </span>
        </div>

        {/* H1 Title */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
            Operační systém pro <br />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
              venkovní reklamu.
            </span>
          </h1>

          <p className="text-lg sm:text-2xl font-bold text-slate-200 leading-snug max-w-3xl mx-auto">
            Reklamní plochy, klienti, nabídky, kampaně, realizace, fotodokumentace a AI v jednom systému.
          </p>

          <p className="text-sm sm:text-base text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            SeePoint OS propojuje obchod, kancelář a pracovníky v terénu – od první obchodní příležitosti až po dokončenou kampaň.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-950/80 border border-purple-800 text-purple-200 text-xs font-bold shadow-lg">
            <span>📊</span>
            <span>Pošlete nám váš Excel s 20 nosiči – zdarma vám do 24h vygenerujeme živou mapu sítě i nabídku!</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => {
              trackSaaSEvent('demo_cta_clicked', { source: 'hero' });
              onOpenDemoModal();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-black text-base shadow-2xl hover:shadow-purple-900/50 transition transform active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-purple-200 animate-pulse" />
            <span>Domluvit ukázku</span>
          </button>

          <a
            href="#produkt"
            onClick={() => trackSaaSEvent('product_demo_clicked', { source: 'hero' })}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-extrabold text-sm border border-slate-700/80 shadow-xl transition"
          >
            <span>Prohlédnout platformu</span>
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </a>
        </div>

        {/* Trust Badge */}
        <div className="pt-2 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Vytvořeno na základě skutečného provozu outdoorové reklamní společnosti.</span>
        </div>

        {/* REAL AUTHENTIC APP SHOWCASE: LAPTOP + MOBILE PHONE FRAME */}
        <div className="pt-8 max-w-6xl mx-auto relative">
          <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-3 sm:p-5 shadow-2xl ring-1 ring-purple-500/20">
            {/* Top Browser Chrome Bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2.5 bg-slate-900/90 rounded-t-2xl mb-2">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-rose-500/80" />
                <span className="size-3 rounded-full bg-amber-500/80" />
                <span className="size-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                  <span className="text-emerald-400">🔒 https://</span>os.seepoint.cz/map
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  874 nosičů v síti
                </span>
              </div>
            </div>

            {/* Main Screen Layout Container */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col md:flex-row items-center gap-4">
              {/* Laptop Real Screen Frame */}
              <div className="relative w-full aspect-[16/9] overflow-hidden rounded-xl bg-slate-900 flex-1">
                <Image
                  src="/images/real_seepoint_map_screen.png"
                  alt="SeePoint OS Reálná Mapa Nosičů"
                  fill
                  priority
                  unoptimized
                  className="object-cover object-top"
                  sizes="(max-width: 1200px) 100vw, 1200px"
                />
              </div>

              {/* Floating Mobile Phone Frame Overlap */}
              <div className="hidden lg:block absolute -bottom-6 -right-4 w-72 aspect-[9/19] rounded-[40px] p-2.5 bg-slate-900 border-4 border-slate-700 shadow-2xl ring-2 ring-purple-500/40 z-20 overflow-hidden transform hover:scale-105 transition duration-300">
                {/* Mobile Camera Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full z-30 flex items-center justify-center">
                  <div className="size-2 rounded-full bg-slate-800" />
                </div>

                <div className="relative w-full h-full rounded-[30px] overflow-hidden bg-slate-950 border border-slate-800">
                  <Image
                    src="/images/real_seepoint_mobile_screen.png"
                    alt="SeePoint OS Mobilní Aplikace"
                    fill
                    priority
                    unoptimized
                    className="object-cover object-top"
                    sizes="300px"
                  />
                </div>
              </div>
            </div>

            {/* Bottom floating legend badges */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800">
                <Laptop className="w-4 h-4 text-purple-400" />
                <span className="font-bold">Webový dispečink (874 nosičů na mapě)</span>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Mobilní aplikace montážníka (Foto & GPS)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Pillars Strip */}
        <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1">
            <div className="text-purple-400 font-black text-xl">800+</div>
            <div className="text-xs font-semibold text-slate-400">Spravovaných nosičů</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1">
            <div className="text-indigo-400 font-black text-xl">100 %</div>
            <div className="text-xs font-semibold text-slate-400">Kontrola nad nabídkami</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1">
            <div className="text-sky-400 font-black text-xl">Terén & Web</div>
            <div className="text-xs font-semibold text-slate-400">Živá synchronizace</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1">
            <div className="text-emerald-400 font-black text-xl">SeePoint AI</div>
            <div className="text-xs font-semibold text-slate-400">Prodeje & Generátor</div>
          </div>
        </div>
      </div>
    </section>
  );
}
