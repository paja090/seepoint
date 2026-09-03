'use client';

import { Map, HardDrive, FileSpreadsheet, Sparkles, CheckCircle2, Clock } from 'lucide-react';

export function SaaSIntegrationsSection() {
  const activeIntegrations = [
    { title: 'Google Maps Engine', desc: 'Satelitní a silniční mapy, geokódování tras a bodů VO', icon: Map, color: 'text-emerald-400' },
    { title: 'Google Drive & Cloud', desc: 'Ukládání fotografií z terénu a klientských dokumentů', icon: HardDrive, color: 'text-sky-400' },
    { title: 'CSV / TSV Import', desc: 'Kontrolovaný import nosičů a navigací s náhledem před zápisem', icon: FileSpreadsheet, color: 'text-purple-400' },
    { title: 'SeePoint AI Engine', desc: 'Inteligentní analýza spádovosti, tras a vyhlášek měst', icon: Sparkles, color: 'text-purple-300' },
  ];

  const upcomingIntegrations = [
    { title: 'Microsoft 365 / Outlook', desc: 'Synchronizace kalendářů a schůzek obchodníků' },
    { title: 'Účetní systémy (Pohoda / Money)', desc: 'Přímý export schválených podkladů pro fakturaci' },
    { title: 'WhatsApp Business API', desc: 'Zasílání upozornění montážníkům v terénu' },
  ];

  return (
    <section className="py-20 border-t border-slate-800 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            INTEGRACE & ROZHRANÍ
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Zapadne do vašeho současného workflow.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            SeePoint OS je připraven pro propojení s vašimi stávajícími nástroji pro mapy, soubory a výkaznictví.
          </p>
        </div>

        {/* Active Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeIntegrations.map((ig) => {
            const IconComp = ig.icon;
            return (
              <div key={ig.title} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="size-10 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black">
                    <IconComp className={`w-5 h-5 ${ig.color}`} />
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Aktivní
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">{ig.title}</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">{ig.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Upcoming Integrations Strip */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wider">
              Plánované integrace (Připravujeme)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingIntegrations.map((up) => (
              <div key={up.title} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <strong className="text-xs font-bold text-slate-200 block">{up.title}</strong>
                <span className="text-[11px] font-medium text-slate-400">{up.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
