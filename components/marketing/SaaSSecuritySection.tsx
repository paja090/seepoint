'use client';

import { ShieldCheck, UserCheck, Lock, History } from 'lucide-react';

export function SaaSSecuritySection() {
  const securityFeatures = [
    {
      icon: UserCheck,
      title: 'Řízení přístupů',
      desc: 'Přístupové role pro vlastníka, administrátora, obchodníka, montážníka i účetní.',
    },
    {
      icon: ShieldCheck,
      title: 'Oddělení organizací',
      desc: 'Důsledná izolace dat a nosičů mezi firmami v rámci multi-tenant architektury.',
    },
    {
      icon: History,
      title: 'Audit změn',
      desc: 'Přehledná historie rezervací nosičů, úprav ceníků a schvalování nabídek.',
    },
    {
      icon: Lock,
      title: 'Šifrovaná komunikace',
      desc: 'Zabezpečený přenos dat přes HTTPS a chráněné uživatelské relace.',
    },
  ];

  return (
    <section className="py-16 bg-slate-900/30 border-t border-slate-850 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-purple-400">
            DŮVĚRA & ZABEZPEČENÍ
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Vaše obchodní data pod kontrolou.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            SeePoint OS chrání vaše ceníky, klienty a interní data osvědčenými bezpečnostními principy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {securityFeatures.map((sec) => {
            const Icon = sec.icon;
            return (
              <div key={sec.title} className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-2.5 shadow-lg">
                <div className="size-10 rounded-2xl bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center font-black">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{sec.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{sec.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
