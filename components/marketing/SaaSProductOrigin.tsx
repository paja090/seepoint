'use client';

import { Building2, ShieldCheck, CheckCircle2, Award, Users } from 'lucide-react';

export function SaaSProductOrigin() {
  return (
    <section className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Story */}
          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-black uppercase tracking-wider text-purple-400">
              PŘÍBĚH VZNIKU PRODUKTU
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Vznikl v reálném provozu. <br />
              <span className="text-purple-400">Ne v zasedačce.</span>
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              <p>
                SeePoint OS vzniká přímo při každodenním provozu outdoorové reklamní společnosti SeePoint. Jednotlivé funkce nevznikly jako teoretický koncept, ale vycházejí z reálných potřeb obchodníků, přípravářů realizace i pracovníků v terénu.
              </p>
              <p>
                Díky tomu systém řeší přesně ty překážky, se kterými se OOH společnosti potýkají každý den: od rychlého zjištění obsazenosti nosiče až po nahrání fotodokumentace ze sloupu veřejného osvětlení.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-sm font-bold text-slate-200">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <Building2 className="w-4 h-4 text-purple-400" />
                <span>SeePoint outdoor agentura</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Ověřeno v živém provozu</span>
              </div>
            </div>
          </div>

          {/* Right Verified Metrics Box */}
          <div className="lg:col-span-5 rounded-3xl border border-purple-800/80 bg-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl">
            <h3 className="text-lg font-black text-white border-b border-slate-800 pb-3">
              Ověřeno každodenním provozem
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300 font-medium block">Spravované nosiče</span>
                  <strong className="text-2xl font-black text-white">800+ nosičů</strong>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                  Ostrava & Kraj
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300 font-medium block">Dokončené realizace</span>
                  <strong className="text-2xl font-black text-emerald-400">10 000+</strong>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Montáže & Výlepy
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300 font-medium block">Vývoj a podpora</span>
                  <strong className="text-2xl font-black text-indigo-400">Přímý kontakt</strong>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Český tým
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
