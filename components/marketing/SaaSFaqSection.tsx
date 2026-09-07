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
      q: 'Lze převést naše data z Excelu?',
      a: 'Ano. Pomůžeme vám převést vaše stávající data nosičů, adresy, GPS souřadnice, technické parametry i kontakty na klienty bez nutnosti začínat od nuly.',
    },
    {
      q: 'Musíme mít data ve stejném formátu?',
      a: 'Nemusíte. Data nemusí přesně kopírovat naši šablonu. V rámci asistovaného importu vám pomůžeme upravit a napárovat vaše současné tabulky a soubory do struktury SeePoint OS.',
    },
    {
      q: 'Jak dlouho trvá nasazení?',
      a: 'Základní spuštění systému s naimportovanou sítí nosičů a přístupy pro tým obvykle trvá jen několik pracovních dnů. Celý proces probíhá s naší asistencí.',
    },
    {
      q: 'Funguje systém na mobilu?',
      a: 'Ano. Systém obsahuje optimalizované mobilní rozhraní pro montážníky a techniky v terénu. Umožňuje 1-klikové spuštění GPS navigace k nosiči, zobrazení pracovního úkolu i nahrání fotodokumentace před a po instalaci.',
    },
    {
      q: 'Jak fungují nabídky a obsazenost?',
      a: 'Obchodník vidí volné plochy v reálném čase pro zvolený termín kampaně. Vybrané nosiče vloží do nabídky a systém vygeneruje reprezentativní prezentaci s mapou a fotkami dostupnou přes bezpečný veřejný klientský odkaz.',
    },
    {
      q: 'Můžeme nejprve vidět demo?',
      a: 'Určitě. Rádi vám systém předvedeme na reálném workflow venkovní reklamy nebo vám připravíme ukázku na vašich vlastních 20 nosičích. Stačí kliknout na tlačítko "Domluvit ukázku".',
    },
    {
      q: 'Jak jsou zabezpečena naše data?',
      a: 'Systém využívá přísné oddělení organizací (multi-tenancy), propracované řízení přístupových rolí (RBAC), auditní protokolování změn v rezervacích a šifrovanou komunikaci přes HTTPS.',
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
