'use client';

import { XCircle, CheckCircle2, ArrowRight, Table, Folder, Map, Mail, MessageSquare, FileText, Calculator } from 'lucide-react';

export function SaaSProblemSolution() {
  const chaosItems = [
    { title: 'Excel tabulky obsazenosti', desc: 'Duplicity, neaktuální stavy, manuální přepisování dat' },
    { title: 'Google Drive & složky', desc: 'Hledání fotografií a podkladů v nepřehledné struktuře' },
    { title: 'Roztrštěné Google Maps', desc: 'Žádné přímé propojení nosičů s klienty a nabídkami' },
    { title: 'Email, WhatsApp & telefony', desc: 'Domlouvání zakázek bez centrální historie a zodpovědnosti' },
    { title: 'Papírové zakázky v terénu', desc: 'Montážníci bez aktuálních informací a GPS lokace nosičů' },
  ];

  const solutionItems = [
    { title: 'Jediný centrální systém', desc: 'Klienti, nosiče, nabídky a realizace na jednom místě' },
    { title: 'Živá mapa sítě & obsazenosti', desc: 'Okamžitý přehled co je volné dnes i za půl roku' },
    { title: 'AI Copilot pro nabídky', desc: 'Sestavení klientské prezentace s fotkami během 3 minut' },
    { title: 'Mobilní aplikace pro terén', desc: 'Montáže, navigace a fotodokumentace přímo ze sloupu' },
    { title: 'Kompletní příběh zakázky', desc: 'Od první příležitosti až po vytvoření faktury na klíč' },
  ];

  return (
    <section className="py-20 bg-slate-900/50 border-y border-slate-800/80 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            PROČ SEEPOINT OS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Méně tabulek. Méně hledání. Více kontroly.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Typická reklamní společnost ztrácí desítky hodin týdně přepínáním mezi rozdrobenými nástroji. SeePoint OS spojuje celý provoz do jednoho spolehlivého motoru.
          </p>
        </div>

        {/* Problem vs Solution Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* CHAOS SIDE (Left) */}
          <div className="lg:col-span-5 rounded-3xl border border-rose-900/40 bg-slate-950/80 p-6 sm:p-8 space-y-6 shadow-xl relative">
            <div className="flex items-center gap-3 border-b border-rose-900/40 pb-4">
              <div className="size-10 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center font-black">
                ✕
              </div>
              <div>
                <h3 className="font-black text-lg text-white">Běžný chaos v reklamní agentuře</h3>
                <p className="text-xs text-rose-300/80 font-medium">7 různých nástrojů bez propojení</p>
              </div>
            </div>

            <div className="space-y-3">
              {chaosItems.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-2xl bg-rose-950/20 border border-rose-900/30">
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-xs font-bold text-slate-200 block">{item.title}</strong>
                    <span className="text-[11px] font-medium text-slate-400">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ARROW TRANSFORMER (Center) */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-4">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-xl animate-pulse">
              <ArrowRight className="w-7 h-7" />
            </div>
            <span className="mt-3 text-xs font-black uppercase tracking-wider text-purple-300">
              Přechod na
            </span>
          </div>

          {/* SOLUTION SIDE (Right) */}
          <div className="lg:col-span-5 rounded-3xl border border-purple-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30 p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-purple-800/60 pb-4">
              <div className="size-10 rounded-2xl bg-purple-950 text-purple-300 border border-purple-700 flex items-center justify-center font-black">
                ✓
              </div>
              <div>
                <h3 className="font-black text-lg text-white">SeePoint OS</h3>
                <p className="text-xs text-purple-300 font-medium">Jediný integrovaný operační systém</p>
              </div>
            </div>

            <div className="space-y-3">
              {solutionItems.map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-2xl bg-purple-950/30 border border-purple-800/40">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-xs font-bold text-white block">{item.title}</strong>
                    <span className="text-[11px] font-medium text-slate-300">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
