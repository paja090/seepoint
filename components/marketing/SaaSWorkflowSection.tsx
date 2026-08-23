'use client';

import { CheckCircle2, ArrowRight, Sparkles, FileText, CheckSquare, Palette, Wrench, Camera, Receipt, Clock } from 'lucide-react';

export function SaaSWorkflowSection() {
  const steps = [
    { num: '01', title: 'Poptávka', desc: 'AI Radar nebo příchozí klientský kontakt', icon: Sparkles, color: 'text-purple-400 border-purple-800 bg-purple-950/60' },
    { num: '02', title: 'Nabídka', desc: 'Generátor ploch, mapy a klientského odkazu', icon: FileText, color: 'text-indigo-400 border-indigo-800 bg-indigo-950/60' },
    { num: '03', title: 'Schváleno', desc: 'Akceptace nabídky a zarezervování termínů', icon: CheckSquare, color: 'text-emerald-400 border-emerald-800 bg-emerald-950/60' },
    { num: '04', title: 'Zakázka', desc: 'Vytvoření produkční zakázky v systému', icon: Clock, color: 'text-sky-400 border-sky-800 bg-sky-950/60' },
    { num: '05', title: 'Grafika', desc: 'Schválení tiskových motivů a rozměrů', icon: Palette, color: 'text-amber-400 border-amber-800 bg-amber-950/60' },
    { num: '06', title: 'Výroba', desc: 'Tisk plakátů, polepů a výroba desek VO', icon: Wrench, color: 'text-orange-400 border-orange-800 bg-orange-950/60' },
    { num: '07', title: 'Instalace', desc: 'Mobilní plánovač a navigace pro montážníky', icon: Wrench, color: 'text-purple-400 border-purple-800 bg-purple-950/60' },
    { num: '08', title: 'Fotodokumentace', desc: 'Pořízení fotografií z ulice u nového nosiče', icon: Camera, color: 'text-emerald-400 border-emerald-800 bg-emerald-950/60' },
    { num: '09', title: 'Fakturace', desc: 'Automatické podklady pro vyúčtování kampaně', icon: Receipt, color: 'text-indigo-400 border-indigo-800 bg-indigo-950/60' },
  ];

  return (
    <section className="py-20 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            KOMPLETNÍ WORKFLOW PROCES
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Od první poptávky až po realizaci.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Předvídatelný, automatizovaný řetězec kroků, ve kterém se neztratí žádný úkol, fotografie ani podklad k fakturaci.
          </p>
        </div>

        {/* Desktop Horizontal / Grid Timeline */}
        <div className="hidden lg:grid grid-cols-9 gap-2 relative pt-6">
          {/* Connector Line */}
          <div className="absolute top-[52px] left-8 right-8 h-0.5 bg-gradient-to-r from-purple-800 via-indigo-700 to-emerald-700 z-0" />

          {steps.map((step, idx) => {
            const IconComponent = step.icon;
            return (
              <div key={step.title} className="relative z-10 flex flex-col items-center text-center space-y-3">
                <div className={`size-12 rounded-2xl border ${step.color} flex items-center justify-center font-black shadow-lg backdrop-blur-md`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-500 font-bold block">{step.num}</span>
                  <strong className="text-xs font-black text-white block">{step.title}</strong>
                  <p className="text-[10px] text-slate-400 font-medium leading-snug">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile & Tablet Vertical Timeline */}
        <div className="lg:hidden space-y-4 max-w-lg mx-auto relative pl-6 border-l-2 border-purple-800/80">
          {steps.map((step) => {
            const IconComponent = step.icon;
            return (
              <div key={step.title} className="relative flex items-start gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-lg">
                <span className="absolute -left-[33px] top-5 size-4 rounded-full bg-purple-600 border-4 border-slate-950" />
                <div className={`size-10 rounded-xl border ${step.color} flex items-center justify-center font-black shrink-0`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-purple-400">{step.num}</span>
                    <strong className="text-sm font-bold text-white">{step.title}</strong>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
