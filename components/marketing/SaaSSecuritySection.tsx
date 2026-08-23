'use client';

import { ShieldCheck, Lock, UserCheck, History, Server } from 'lucide-react';

export function SaaSSecuritySection() {
  const securityFeatures = [
    { title: 'Řízení přístupových rolí (RBAC)', desc: '8 úrovní oprávnění (Vlastník, Admin, Obchodník, Montážník, Účetní, Prohlížeč).' },
    { title: 'Zabezpečené relace & šifrování', desc: 'Moderní HTTPS šifrování, chráněné session cookies a bezpečné resetování hesel.' },
    { title: 'Auditní protokol aktivit', desc: 'Detailní historie o vytvoření nabídek, změnách ceníků a úpravách rezervací.' },
    { title: 'Izolace organizací (Multi-tenancy)', desc: 'Striktní oddělení firemních databází a nosičů mezi subjekty (Součást SaaS verze).' },
  ];

  return (
    <section className="py-20 bg-slate-900/40 border-t border-slate-800 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            BEZPEČNOST A ROLENÍ PŘÍSTUPY
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Vaše obchodní data pod kontrolou.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            SeePoint OS chrání vaše ceníky, obchodní případy a zákaznická data pokročilým systémem uživatelských rolí.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityFeatures.map((sec) => (
            <div key={sec.title} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 shadow-lg">
              <div className="size-10 rounded-2xl bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">{sec.title}</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">{sec.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
