'use client';

import { Compass, CheckCircle2, ArrowRight } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSNavigationSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const navBenefits = [
    {
      title: 'Správa bodů a sloupů VO',
      desc: 'Kompletní pasportizace sloupů veřejného osvětlení, jejich čísel a technických parametrů.',
    },
    {
      title: 'Plánování příjezdových tras',
      desc: 'Návrh směrových navigačních řetězců navádějících řidiče přímo k provozovně či pobočce.',
    },
    {
      title: 'Povolení a ochranná pásma',
      desc: 'Hlídání platnosti smluv s městy, vyhlášek a hranic památkových zón přímo v mapě.',
    },
    {
      title: 'Fotodokumentace a fakturační období',
      desc: 'Pravidelné kontroly stavu desek z terénu a automatický přehled pro měsíční nájmy.',
    },
  ];

  return (
    <section className="py-16 bg-slate-950 border-t border-slate-800 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Feature Card */}
          <div className="lg:col-span-5 rounded-3xl border border-orange-900/60 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-orange-900/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-orange-950 text-orange-300 border border-orange-800 flex items-center justify-center font-black">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">SPECIALIZOVANÝ MODUL</span>
                  <h3 className="text-lg font-black text-white">Navigační reklama VO</h3>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-950 text-orange-300 border border-orange-800">
                Povolení & Mapy
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>Cílová prodejna: Kaufland Ostrava</span>
                  <span className="text-orange-400">3 navigační body</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Příjezdové trasy zahuštěné na vytížených městských křižovatkách a sjezdech.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Ochranná pásma</span>
                  <strong className="text-emerald-400 text-xs">✓ Auto-kontrola zón</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Klientský odkaz</span>
                  <strong className="text-orange-300 text-xs">✓ Online schválení</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Explanation Text */}
          <div className="lg:col-span-7 space-y-5">
            <span className="text-[11px] font-black uppercase tracking-widest text-orange-400">
              SMĚROVÉ TABULE A NAVIGACE
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Navigační reklama bez chaosu.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Navigační desky na sloupech veřejného osvětlení (VO) mají svá přísná pravidla a administrativní nároky. SeePoint OS uchovává celou agendu na jednom místě.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {navBenefits.map((b) => (
                <div key={b.title} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                    <strong className="text-xs font-bold text-white">{b.title}</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug pl-6">{b.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <a
                href="#produkt"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs shadow-xl transition cursor-pointer"
              >
                <span>Vyzkoušet na interaktivní mapě</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
