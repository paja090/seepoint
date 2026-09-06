'use client';

import Image from 'next/image';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, MapPin, Building2, TrendingUp, Smartphone, Laptop, Clock, BarChart3, Layers, Zap } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';
import { AnimatedCounter } from './AnimatedCounter';

export function SaaSHero({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 overflow-hidden">
      {/* Background Ambient Glowing Gradients */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[1100px] h-[500px] bg-gradient-to-tr from-purple-900/25 via-indigo-900/20 to-blue-900/10 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        {/* 2-Column Split Hero Layout (Text on Left, 3D Showcase on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Headings, Value Proposition & CTA */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-purple-800/60 shadow-lg text-slate-200">
              <span className="flex size-2 rounded-full bg-purple-500 animate-ping" />
              <span className="text-[11px] font-black tracking-widest uppercase text-purple-300">
                SEEPOINT OS
              </span>
              <span className="h-3 w-px bg-slate-800" />
              <span className="text-xs font-bold text-slate-300">
                SaaS pro venkovní reklamu
              </span>
            </div>

            {/* Main H1 Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black tracking-tight text-white leading-[1.12]">
              Mějte své reklamní plochy{' '}
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
                pod kontrolou.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
              Mapa, obsazenost, klienti, nabídky, realizace a práce v terénu. V jednom systému vytvořeném přímo pro venkovní reklamu.
            </p>

            {/* Excel Lead Magnet Pill */}
            <div className="p-3.5 rounded-2xl bg-purple-950/80 border border-purple-700 text-purple-200 text-xs font-bold flex items-center gap-2.5 shadow-xl">
              <span className="text-lg">📊</span>
              <span>Pošlete nám Excel s 20 nosiči – zdarma vám připravíme ukázkovou živou mapu a klientskou nabídku.</span>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  trackSaaSEvent('demo_cta_clicked', { source: 'hero' });
                  onOpenDemoModal();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl text-white font-black text-sm shadow-xl hover:shadow-purple-900/50 transition transform active:scale-95 cursor-pointer shimmer-btn"
              >
                <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
                <span>Domluvit ukázku</span>
              </button>

              <a
                href="#produkt"
                onClick={() => trackSaaSEvent('product_demo_clicked', { source: 'hero' })}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-extrabold text-xs border border-slate-700/80 shadow-lg transition"
              >
                <span>Prohlédnout platformu</span>
                <ArrowRight className="w-4 h-4 text-purple-400" />
              </a>
            </div>

            {/* 3 Micro-Benefits Strip */}
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-bold text-slate-300">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-purple-750 transition">
                <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-[11px] leading-tight">Přehledná mapa všech nosičů</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-emerald-750 transition">
                <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] leading-tight">Lepší přehled o volných kapacitách</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-sky-750 transition">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-[11px] leading-tight">Přehled ochranných pásem a pravidel</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Product Showcase Device Frame with Floating Animation */}
          <div className="lg:col-span-6 relative animate-float-slow">
            <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 p-2 sm:p-3 shadow-2xl ring-1 ring-purple-500/30 animate-pulse-glow">
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-950">
                <Image
                  src="/images/hero_showcase.jpg"
                  alt="SeePoint OS 3D Mockup aplikace na notebooku a mobilu"
                  fill
                  priority
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

                {/* Floating Micro-Badges on top of visual */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/85 text-slate-200 border border-slate-800 backdrop-blur-md shadow-lg">
                    <Laptop className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-bold">Webový dispečink</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/85 text-slate-200 border border-slate-800 backdrop-blur-md shadow-lg">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold">Mobilní aplikace montážníka</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Pillars Strip with Animated Count-Ups */}
        <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1 hover:border-purple-700/60 transition group">
            <div className="text-purple-400 font-black text-2xl group-hover:scale-105 transition">
              <AnimatedCounter target={800} suffix="+" />
            </div>
            <div className="text-xs font-semibold text-slate-400">Spravovaných nosičů</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1 hover:border-indigo-700/60 transition group">
            <div className="text-indigo-400 font-black text-2xl group-hover:scale-105 transition">
              <AnimatedCounter target={100} suffix=" %" />
            </div>
            <div className="text-xs font-semibold text-slate-400">Kontrola nad nabídkami</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1 hover:border-sky-700/60 transition group">
            <div className="text-sky-400 font-black text-2xl group-hover:scale-105 transition">
              <AnimatedCounter target={57} prefix="-" suffix=" %*" />
            </div>
            <div className="text-xs font-semibold text-slate-400">Optimalizované trasy výjezdů</div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-center space-y-1 hover:border-emerald-700/60 transition group">
            <div className="text-emerald-400 font-black text-2xl group-hover:scale-105 transition">
              <AnimatedCounter target={60} prefix="Do " suffix=" s" />
            </div>
            <div className="text-xs font-semibold text-slate-400">AI Sestavení nabídky</div>
          </div>
        </div>
      </div>
    </section>
  );
}
