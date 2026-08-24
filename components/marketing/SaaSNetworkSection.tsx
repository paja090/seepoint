'use client';

import { useState } from 'react';
import { Share2, Users, Building2, TrendingUp, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, MapPin } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSNetworkSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const [selectedNetwork, setSelectedNetwork] = useState<'cz_national' | 'moravia_regional' | 'd1_highway'>('cz_national');

  const campaigns = {
    cz_national: {
      name: '🇨🇿 Celorepubliková kampaň (Ostrava + Brno + Olomouc)',
      client: 'Automobilový salon & Servis',
      ownCount: 8,
      ownRevenue: '28 000 Kč',
      partnerCount: 7,
      partnerCommission: '+4 200 Kč',
      totalRevenue: '32 200 Kč',
      partnerDetails: '4x Brno (MedialBrno) + 3x Olomouc (Haná OOH)',
    },
    moravia_regional: {
      name: '🎯 Region Severní Morava (Ostrava + Opava + Havířov)',
      client: 'Retail Park & Nákupní zóna',
      ownCount: 6,
      ownRevenue: '21 000 Kč',
      partnerCount: 4,
      partnerCommission: '+2 400 Kč',
      totalRevenue: '23 400 Kč',
      partnerDetails: '2x Opava (OpavaMedia) + 2x Havířov (OOH Havířov)',
    },
    d1_highway: {
      name: '🚗 Dálniční tah D1 (Praha ➔ Brno ➔ Ostrava)',
      client: 'Fast Food řetězec & Čerpací stanice',
      ownCount: 3,
      ownRevenue: '36 000 Kč',
      partnerCount: 5,
      partnerCommission: '+9 000 Kč',
      totalRevenue: '45 000 Kč',
      partnerDetails: '3x D1 Praha-Brno + 2x D1 Vysočina',
    },
  };

  const active = campaigns[selectedNetwork];

  return (
    <section id="network" className="py-24 bg-slate-950 border-t border-slate-850 relative overflow-hidden">
      {/* Ambient Blue-Purple Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 blur-[160px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-black uppercase tracking-widest">
            <Share2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>PŘIPRAVUJEME · SEEPOINT NETWORK</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            SeePoint Network: B2B Burza reklamních ploch
          </h2>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Prodávejte klientům kampaně po celé republice bez nutnosti stavět vlastní sloupy. Propojte svou síť s partnerskými agenturami v jiných městech a získejte 15 % provize z každé zprostředkované plochy.
          </p>
        </div>

        {/* Interactive B2B Simulator Box */}
        <div className="rounded-3xl border-2 border-blue-500/70 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950/30 p-4 sm:p-8 shadow-2xl space-y-8 ring-2 ring-blue-500/20">
          {/* Top Campaign Type Selector */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                1. Zvolte modelovou klientskou poptávku:
              </span>
              <span className="text-xs font-bold text-emerald-400">
                ● Simulace provizního clearingu
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(campaigns) as Array<keyof typeof campaigns>).map((key) => {
                const c = campaigns[key];
                const isSelected = selectedNetwork === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedNetwork(key)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/60 shadow-xl ring-2 ring-blue-500/40 scale-[1.02]'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <strong className="text-xs font-black text-white block">{c.name}</strong>
                    <span className="text-[11px] text-slate-300">{c.client}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Value Cards: Own + Partner + Total Profit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Own Carriers */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-purple-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-300">1. VLASTNÍ SÍŤ (Ostrava)</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-950 text-purple-300 border border-purple-800">
                  100 % VÝNOS
                </span>
              </div>
              <div className="text-2xl font-black text-white">{active.ownCount} nosičů · {active.ownRevenue}</div>
              <p className="text-xs text-slate-400">
                Vaše vlastní kapacity: Promo Towery, CLP a Billboardy v regionu.
              </p>
            </div>

            {/* 2. Partner Carriers Network */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-blue-800/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-300">2. PARTNERSKÁ SÍŤ B2B</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-950 text-blue-300 border border-blue-800">
                  +15 % PROVIZE
                </span>
              </div>
              <div className="text-2xl font-black text-white">{active.partnerCount} nosičů · {active.partnerCommission}</div>
              <p className="text-xs text-slate-400">
                {active.partnerDetails}
              </p>
            </div>

            {/* 3. Total Profit */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-slate-950 border-2 border-emerald-500/80 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-300">CELKOVÝ ZISK VAŠÍ AGENTURY</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                  JEDINÁ NABÍDKA
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-400">{active.totalRevenue}</div>
              <p className="text-xs text-slate-300 font-medium">
                Vše vyfakturováno pod vaší agenturou. Systém automaticky rozdělí provize partnerům.
              </p>
            </div>
          </div>

          {/* 4 Steps How Networking Works */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="text-blue-400 font-black text-sm">1. Opt-in sdílení</div>
              <p className="text-slate-400">Vyberete, které své volné nosiče chcete nabídnout partnerským agenturám s B2B slevou.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="text-purple-400 font-black text-sm">2. AI Nabídka pro klienta</div>
              <p className="text-slate-400">Obchodník sestaví meziměstskou kampaň jedním kliknutím z vlastních i cizích ploch.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="text-emerald-400 font-black text-sm">3. Automatický výnos</div>
              <p className="text-slate-400">Získáte marži z vlastních ploch + 15 % provizi z partnerských nosičů po celé ČR.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="text-sky-400 font-black text-sm">4. Mobilní montáže</div>
              <p className="text-slate-400">Montážní úkoly i tisková data se samy pošlou montážníkům v Brně či Praze do mobilní appky.</p>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Vaši klienti zůstávají výhradně vaši. Partneři vidí pouze zakázku na montáž.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                trackSaaSEvent('demo_cta_clicked', { source: 'network_section' });
                onOpenDemoModal();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs shadow-xl transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>Připojit agenturu k SeePoint Network</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
