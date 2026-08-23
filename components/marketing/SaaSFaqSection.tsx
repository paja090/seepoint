'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function SaaSFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Pro koho je SeePoint OS určen?',
      a: 'SeePoint OS je navržen pro provozovatele OOH médií (vlastníky billboardů, citylightů, laviček, towerů, navigací), reklamní agentury i obchodní a instalační týmy, kteří potřebují mít přehled o obsazenosti a realizacích v jednom systému.',
    },
    {
      q: 'Je systém pouze pro billboardy?',
      a: 'Ne. Systém podporuje všechny typy venkovní reklamy: Billboardy, Bigboardy, City Postery (CLP vitríny), Reklamní lavičky, Promo Towery, Navigační desky na sloupech VO i speciální městská média.',
    },
    {
      q: 'Lze převést současná data z Excelu?',
      a: 'Ano. Součástí našeho asistovaného onboarding procesu je bezpečný import nosičů, adres, GPS souřadnic i klientů z vašich stávajících tabulek a databází.',
    },
    {
      q: 'Funguje systém na telefonu v terénu?',
      a: 'Ano. SeePoint OS obsahuje mobilní rozhraní přizpůsobené pro montážníky a techniky. Umožňuje 1-klikové spustění GPS navigace k nosiči, zobrazení výkazu a přímé nahrání fotodokumentace z mobilu.',
    },
    {
      q: 'Jak funguje fotodokumentace?',
      a: 'Montážník nahraje fotografii přímo u nosiče ze svého telefonu. Systém ji automaticky zkomprimuje, přiřadí k příslušné kampani a nosiči a zpřístupní ji v klientském protokolu.',
    },
    {
      q: 'Obsahuje SeePoint OS AI funkce?',
      a: 'Ano. Systém obsahuje AI Sales Radar pro vyhledávání regionálních obchodních příležitostí a AI Generátor nabídek, který podle zadání v přirozené řeči vybere nejvhodnější příjezdové trasy mimo dálnice a památkové zóny.',
    },
    {
      q: 'Musíme měnit svůj současný způsob práce?',
      a: 'Nemusíte. SeePoint OS se přizpůsobí vašim stávajícím procesům. Můžete začít pouhou evidencí nosičů a postupně zapojovat generátor nabídek, klientské odkazy či terénní výkazy.',
    },
    {
      q: 'Jak probíhá nasazení systému?',
      a: 'Nasazení probíhá ve 4 krocích: 1. Převedení vašich dat, 2. Nastavení firemního prostředí a ceníků, 3. Pozvání vašeho týmu, 4. Spuštění provozu. Vše s naší asistencí.',
    },
    {
      q: 'Můžeme systém nejdříve vidět na ukázce?',
      a: 'Určitě. Rádi vám systém předvedeme na reálném workflow venkovní reklamy a projde s vámi možnosti převodu vašich procesů. Stačí kliknout na "Domluvit ukázku".',
    },
  ];

  return (
    <section id="faq" className="py-20 bg-slate-900/40 border-t border-slate-800 relative">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            ČASTÉ OTÁZKY A ODPOVĚDI
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Vše, co potřebujete vědět.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Máte dotaz ohledně fungování SeePoint OS? Zde najdete nejčastější odpovědi.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
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
                  <strong className="text-sm sm:text-base font-bold text-white">{faq.q}</strong>
                  <ChevronDown
                    className={`w-5 h-5 text-purple-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-300 font-medium leading-relaxed border-t border-slate-800/60 pt-4">
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
