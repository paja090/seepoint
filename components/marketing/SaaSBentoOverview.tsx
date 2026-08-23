'use client';

import { Layers, MapPin, CalendarCheck, Users, FileText, CheckCircle2, Sparkles, Compass, ShieldCheck } from 'lucide-react';

export function SaaSBentoOverview() {
  return (
    <section className="py-24 relative" id="reseni">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            PRÉMIOVÝ BENTO OVERVIEW
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Celá reklamní společnost v jednom systému.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Každá část SeePoint OS byla navržena pro maximální rychlost obchodníka, přehled manažera i přesnost montážního týmu v terénu.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Card 1: Inventory (Large 2 cols) */}
          <div className="md:col-span-2 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6 sm:p-8 space-y-4 shadow-xl hover:border-purple-800/80 transition">
            <div className="size-12 rounded-2xl bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center font-black">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">INVENTORY — Evidence sítě nosičů</h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Billboardy, citypostery, lavičky, towery, CLV i navigační systémy. Každý nosič má svou kartu s přesnou GPS, rozměry, fotografiemi a technickým stavem.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">✓ GPS lokace</span>
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">✓ Fotogalerie</span>
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">✓ Typy nosičů</span>
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800">✓ Technický stav</span>
            </div>
          </div>

          {/* Card 2: Interactive Map */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl hover:border-purple-800/80 transition">
            <div className="size-12 rounded-2xl bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center justify-center font-black">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">MAPA — Živá síť</h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Zobrazte celou síť reklamních ploch na interaktivní mapě s filtry podle měst, cen i aktuální dostupnosti.
            </p>
            <div className="pt-2 text-xs font-bold text-indigo-300">
              Okamžitá vizualizace →
            </div>
          </div>

          {/* Card 3: Occupancy */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl hover:border-purple-800/80 transition">
            <div className="size-12 rounded-2xl bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center justify-center font-black">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">OBSAZENOST — Kalendář</h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Přesně víte, co je volné dnes i za půl roku. Režimy: Volné, Rezervované, Obsazené bez nutnosti obvolávat kolegy.
            </p>
            <div className="pt-2 flex gap-1.5 text-[10px] font-black">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300">VOLNÉ</span>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300">REZERVOVANÉ</span>
              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300">OBSAZENÉ</span>
            </div>
          </div>

          {/* Card 4: CRM */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl hover:border-purple-800/80 transition">
            <div className="size-12 rounded-2xl bg-sky-950 text-sky-300 border border-sky-800 flex items-center justify-center font-black">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">CRM — Klienti</h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Kartotéka klientů, kontaktních osob, poboček a kompletní historie schválených kampaní na 1 kliknutí.
            </p>
            <div className="pt-2 text-xs font-bold text-sky-300">
              Historie & Kontakty →
            </div>
          </div>

          {/* Card 5: Offers (Large 2 cols) */}
          <div className="md:col-span-2 rounded-3xl border border-purple-800/80 bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 p-6 sm:p-8 space-y-4 shadow-2xl hover:border-purple-700 transition">
            <div className="size-12 rounded-2xl bg-purple-950 text-purple-200 border border-purple-700 flex items-center justify-center font-black">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">NABÍDKY — Generátor klientských konceptů</h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Připravte reprezentativní nabídku během několika minut. Obsahuje vybrané nosiče, fotky, mapu, kalkulaci i online klientský odkaz `/offer/[token]`. Podporuje i nezávazné koncepty bez cen!
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-bold text-purple-200">
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-purple-800/80">✓ Klientský odkaz</span>
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-purple-800/80">✓ Koncepty bez cen</span>
              <span className="px-3 py-1 rounded-xl bg-slate-950 border border-purple-800/80">✓ PDF & Print</span>
            </div>
          </div>

          {/* Card 6: Realization */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 shadow-xl hover:border-purple-800/80 transition">
            <div className="size-12 rounded-2xl bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center justify-center font-black">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">REALIZACE — Workflow</h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Řízení zakázky od výroby tisků, přes plánování montážníků až po finální klientskou fotodokumentaci.
            </p>
            <div className="pt-2 text-xs font-bold text-emerald-400">
              Terénní montáže →
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
