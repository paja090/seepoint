'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function SaaSFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Pro koho je SeePoint OS?',
      a: 'SeePoint OS je navržen pro provozovatele OOH médií (vlastníky billboardů, citylightů, laviček, towerů, navigací VO), reklamní agentury, obchodní týmy i montážníky v terénu, kteří potřebují mít přehled o obsazenosti, nabídkách a realizacích v jednom systému.',
    },
    {
      q: 'Lze převést naše data z Excelu, i když mají vlastní strukturu?',
      a: 'Ano, data nemusí odpovídat žádné předem dané šabloně. V rámci asistovaného importu vám pomůžeme převést a napárovat vaše stávající tabulky nosičů, adresy, GPS souřadnice, fotografie i kontakty na klienty bez nutnosti začínat od nuly.',
    },
    {
      q: 'Jak dlouho trvá nasazení?',
      a: 'Základní spuštění systému s naimportovanou sítí nosičů a přístupy pro tým obvykle trvá jen několik pracovních dnů. Celý proces probíhá s naší asistencí.',
    },
    {
      q: 'Funguje systém na mobilu v terénu?',
      a: 'Ano. Systém obsahuje optimalizované mobilní rozhraní pro montážníky a techniky. Umožňuje 1-klikové spuštění GPS navigace k nosiči, zobrazení pracovního úkolu, nahrání fotodokumentace před a po instalaci i vyfocení účtenky za materiál.',
    },
    {
      q: 'Jak fungují klientské nabídky a hlídání obsazenosti?',
      a: 'Obchodník vidí volné plochy v reálném čase pro zvolený termín kampaně (nebo se zeptá česky AI asistenta). Vybrané nosiče vloží do nabídky a systém vygeneruje interaktivní prezentaci s mapou a fotkami přes veřejný klientský odkaz, kde může klient kampaň rovnou schválit.',
    },
    {
      q: 'Jsou v ceníku skryté poplatky nebo dlouhodobé závazky?',
      a: 'Ne. Měsíční tarif zahrnuje kompletní cloudový provoz, mapové podklady i pravidelné aktualizace. Tarif můžete kdykoliv změnit podle toho, jak roste vaše síť nosičů.',
    },
    {
      q: 'Můžeme nejprve vidět demo na vlastních datech?',
      a: 'Určitě. Pošlete nám vzorek 20 nosičů v Excelu a my vám zdarma připravíme živou ukázku vaší sítě na mapě včetně vzorové klientské nabídky. Stačí kliknout na tlačítko „Domluvit ukázku“.',
    },
    {
      q: 'Jak jsou zabezpečena naše obchodní data?',
      a: 'Systém využívá přísné oddělení organizací (multi-tenancy), řízení přístupových rolí (RBAC – obchodník, montážník, účetní, administrátor), auditní historii změn v rezervacích a šifrovanou komunikaci přes HTTPS.',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-slate-900/40 border-t border-slate-800 relative">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-purple-400">
            ČASTÉ DOTAZY A ODPOVĚDI
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Vše, co potřebujete vědět.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Máte dotaz ohledně fungování SeePoint OS? Zde najdete nejčastější odpovědi.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.q}
                className={`rounded-2xl border transition duration-200 overflow-hidden ${
                  isOpen
                    ? 'border-purple-800/80 bg-slate-950 shadow-xl'
                    : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <strong className="text-base sm:text-lg font-bold text-white">{faq.q}</strong>
                  <ChevronDown
                    className={`w-5 h-5 text-purple-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-sm sm:text-base text-slate-200 font-medium leading-relaxed border-t border-slate-800/60 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
