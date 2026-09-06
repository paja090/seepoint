'use client';

import { useState } from 'react';
import {
  MapPin,
  Layers,
  Calendar,
  FileText,
  Sparkles,
  Navigation,
  Receipt,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  Car,
  Wrench,
  Fuel,
  Check,
  RefreshCw,
} from 'lucide-react';
import { ShowcaseInteractiveMap } from './ShowcaseInteractiveMap';

export function SaaSProductShowcase() {
  const [activeTab, setActiveTab] = useState<'map' | 'inventory' | 'offers' | 'route' | 'ai'>('map');
  const [inventorySubTab, setInventorySubTab] = useState<'catalog' | 'occupancy'>('catalog');
  const [aiSubTab, setAiSubTab] = useState<'offers' | 'warehouse'>('offers');

  // Interactive Route Simulator State
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Interactive AI Offer Generator Sandbox State
  const [selectedAiPrompt, setSelectedAiPrompt] = useState('Autoservis Ostrava');
  const [isGeneratingAiOffer, setIsGeneratingAiOffer] = useState(false);
  const [generatedAiResult, setGeneratedAiResult] = useState<{
    client: string;
    budget: string;
    carriers: string[];
    summary: string;
  } | null>({
    client: 'Autocentrum Poruba',
    budget: '45 000 Kč / měsíc',
    carriers: ['Promo Tower Místecká (4s)', 'City Poster 28. října', 'Navigační tabule Rudná'],
    summary: 'Optimální zásah řidičů z D1 a návštěvníků nákupní zóny Poruba s odhadovaným zásahem 85 000 kontaktů/týden.',
  });

  // Interactive Warehouse Receipt Scanner State
  const [selectedReceipt, setSelectedReceipt] = useState<'fuel' | 'tools'>('fuel');

  const handleSimulateRoute = () => {
    setOptimizing(true);
    setTimeout(() => {
      setRouteOptimized(true);
      setOptimizing(false);
    }, 600);
  };

  const handleSimulateAiOffer = (preset: string) => {
    setSelectedAiPrompt(preset);
    setIsGeneratingAiOffer(true);
    setTimeout(() => {
      if (preset === 'Autoservis Ostrava') {
        setGeneratedAiResult({
          client: 'Autocentrum Poruba',
          budget: '45 000 Kč / měsíc',
          carriers: ['Promo Tower Místecká (4s)', 'City Poster 28. října', 'Navigační tabule Rudná'],
          summary: 'Optimální zásah řidičů z D1 a návštěvníků nákupní zóny Poruba s odhadovaným zásahem 85 000 kontaktů/týden.',
        });
      } else if (preset === 'Restaurace & Fast Food') {
        setGeneratedAiResult({
          client: 'Burger & Grill D1',
          budget: '28 000 Kč / měsíc',
          carriers: ['3x Sloup VO Sjezd D1', 'City Poster Centrum', 'Směrová tabule Hlučínská'],
          summary: 'Navigační řetězec navádějící tranzitní dopravu přímo ze sjezdu dálnice k restauraci.',
        });
      } else {
        setGeneratedAiResult({
          client: 'Havířovský Letní Festival',
          budget: '75 000 Kč (Kampaň 14 dní)',
          carriers: ['Promo Tower Havířov Centrum', '6x City Poster zastávky MHD', 'Billboard Hlavní třída'],
          summary: 'Masivní zásah pěších i řidičů před zahájením městského festivalu s vysokou frekvencí zhlédnutí.',
        });
      }
      setIsGeneratingAiOffer(false);
    }, 500);
  };

  const getTabPath = () => {
    switch (activeTab) {
      case 'map':
        return 'mapa';
      case 'inventory':
        return inventorySubTab === 'catalog' ? 'evidence-nosicu' : 'obsazenost';
      case 'offers':
        return 'klientska-nabidka';
      case 'route':
        return 'realizace-teren';
      case 'ai':
        return aiSubTab === 'offers' ? 'ai-nabidky' : 'ai-sklad-uctenky';
    }
  };

  return (
    <section id="produkt" className="py-16 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span>INTERAKTIVNÍ ROZHRANÍ SYSTÉMU</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Prozkoumejte SeePoint OS v akci.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Vyzkoušejte si 5 klíčových modulů od interaktivní mapy nosičů přes kalkulaci nabídek až po optimalizaci montáží.
          </p>
        </div>

        {/* 5 Core Tabs Selector */}
        <div className="flex items-center justify-center overflow-x-auto py-2 scrollbar-none">
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/90 backdrop-blur-md shadow-2xl">
            {/* 1. Mapa */}
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapPin className={`w-4 h-4 ${activeTab === 'map' ? 'text-white' : 'text-purple-400'}`} />
              <span>1. Mapa</span>
            </button>

            {/* 2. Evidence & Obsazenost */}
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'inventory' ? 'text-white' : 'text-sky-400'}`} />
              <span>2. Evidence & obsazenost</span>
            </button>

            {/* 3. Nabídky */}
            <button
              type="button"
              onClick={() => setActiveTab('offers')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'offers'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className={`w-4 h-4 ${activeTab === 'offers' ? 'text-white' : 'text-amber-400'}`} />
              <span>3. Nabídky</span>
            </button>

            {/* 4. Realizace */}
            <button
              type="button"
              onClick={() => setActiveTab('route')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'route'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Navigation className={`w-4 h-4 ${activeTab === 'route' ? 'text-white' : 'text-emerald-400'}`} />
              <span>4. Realizace</span>
            </button>

            {/* 5. AI */}
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === 'ai' ? 'text-white' : 'text-purple-400 animate-pulse'}`} />
              <span>5. AI</span>
            </button>
          </div>
        </div>

        {/* Main Interface Screen Container */}
        <div className="relative rounded-3xl border border-slate-800 bg-slate-950 p-2 sm:p-4 shadow-2xl overflow-hidden ring-1 ring-slate-800/80">
          {/* Top Window Chrome Controls */}
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/60 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-rose-500/80" />
              <span className="size-3 rounded-full bg-amber-500/80" />
              <span className="size-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-bold text-slate-400 font-mono">
                os.seepoint.cz / {getTabPath()}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Interaktivní ukázka SeePoint OS
              </span>
            </div>
          </div>

          {/* SCREEN CONTENT BY TAB */}
          <div className="p-4 sm:p-6 min-h-[460px] bg-slate-900/40 rounded-b-2xl relative space-y-6">
            {/* TAB 1: MAP */}
            {activeTab === 'map' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-white">Živá interaktivní mapa nosičů</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Vyzkoušejte si kliknout na nosiče na mapě, prohlédnout detaily, obsazenost a chráněné památkové zóny.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-200">
                      Všechny typy médií (6)
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ● Volné nosiče
                    </span>
                  </div>
                </div>

                <ShowcaseInteractiveMap />
              </div>
            )}

            {/* TAB 2: INVENTORY & OCCUPANCY */}
            {activeTab === 'inventory' && (
              <div className="space-y-4">
                {/* Inner Subtab Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {inventorySubTab === 'catalog' ? 'Katalog reklamních nosičů a ploch' : 'Plánovač obsazenosti nosičů'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {inventorySubTab === 'catalog'
                        ? 'Přehledná evidence nosičů s GPS, technickými rozměry a fotografiemi'
                        : 'Kalendářní přehled volných, rezervovaných a obsazených kapacit'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setInventorySubTab('catalog')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        inventorySubTab === 'catalog'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Katalog nosičů
                    </button>
                    <button
                      type="button"
                      onClick={() => setInventorySubTab('occupancy')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        inventorySubTab === 'occupancy'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Kalendář obsazenosti
                    </button>
                  </div>
                </div>

                {inventorySubTab === 'catalog' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300 font-medium">
                      <thead className="bg-slate-900 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="p-3">Kód</th>
                          <th className="p-3">Název a adresa</th>
                          <th className="p-3">Typ média</th>
                          <th className="p-3">Město</th>
                          <th className="p-3">Stav nosiče</th>
                          <th className="p-3">Cena/měs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        <tr className="hover:bg-slate-900/60 transition">
                          <td className="p-3 font-mono text-purple-300 font-bold">CP-OSTR-012</td>
                          <td className="p-3 font-bold text-white">City Poster 28. října / Pošta</td>
                          <td className="p-3">City Poster (CLP)</td>
                          <td className="p-3">Ostrava centrum</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Aktivní · Výborný
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">6 800 Kč</td>
                        </tr>
                        <tr className="hover:bg-slate-900/60 transition">
                          <td className="p-3 font-mono text-purple-300 font-bold">TOW-MIST-01</td>
                          <td className="p-3 font-bold text-white">Promo Tower Místecká (Set 4 strany A,B,C,D)</td>
                          <td className="p-3">Promo Tower</td>
                          <td className="p-3">Ostrava jih</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Aktivní · Kompletní
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">24 900 Kč</td>
                        </tr>
                        <tr className="hover:bg-slate-900/60 transition">
                          <td className="p-3 font-mono text-purple-300 font-bold">NAV-OPAV-14</td>
                          <td className="p-3 font-bold text-white">Městská navigace VO (Sloup #142)</td>
                          <td className="p-3">Navigační tabule</td>
                          <td className="p-3">Opava</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Povoleno městem
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">1 950 Kč</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="grid grid-cols-6 gap-2 text-center text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
                      <div>Nosič</div>
                      <div>Září</div>
                      <div>Říjen</div>
                      <div>Listopad</div>
                      <div>Prosinec</div>
                      <div>Leden</div>
                    </div>

                    <div className="grid grid-cols-6 gap-2 items-center text-xs p-2 rounded bg-slate-900/80">
                      <div className="font-bold text-white">Tower Místecká</div>
                      <div className="p-2 rounded bg-emerald-950 text-emerald-300 text-center font-bold">Obsazeno (KFC)</div>
                      <div className="p-2 rounded bg-emerald-950 text-emerald-300 text-center font-bold">Obsazeno (KFC)</div>
                      <div className="p-2 rounded bg-amber-950 text-amber-300 text-center font-bold">Rezervace</div>
                      <div className="p-2 rounded bg-slate-800 text-slate-400 text-center">Volno</div>
                      <div className="p-2 rounded bg-slate-800 text-slate-400 text-center">Volno</div>
                    </div>

                    <div className="grid grid-cols-6 gap-2 items-center text-xs p-2 rounded bg-slate-900/80">
                      <div className="font-bold text-white">CLP 28. října</div>
                      <div className="p-2 rounded bg-emerald-950 text-emerald-300 text-center font-bold">Obsazeno (Primark)</div>
                      <div className="p-2 rounded bg-emerald-950 text-emerald-300 text-center font-bold">Obsazeno (Primark)</div>
                      <div className="p-2 rounded bg-emerald-950 text-emerald-300 text-center font-bold">Obsazeno (Primark)</div>
                      <div className="p-2 rounded bg-emerald-950 text-emerald-300 text-center font-bold">Obsazeno (Vánoce)</div>
                      <div className="p-2 rounded bg-slate-800 text-slate-400 text-center">Volno</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: OFFERS */}
            {activeTab === 'offers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white">Interaktivní klientské nabídky</h3>
                    <p className="text-xs text-slate-400">Digitální nabídka pro klienta s mapou a fotkami bez nutnosti zdlouhavého skládání PDF</p>
                  </div>
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    🌐 Veřejný klientský odkaz
                  </span>
                </div>

                <div className="rounded-2xl border border-purple-800/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 p-5 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                        Vzorová nabídka
                      </span>
                      <h4 className="text-base font-bold text-white mt-1">Koncept OOH kampaně – Primark Ostrava</h4>
                      <p className="text-xs text-slate-400">12 vybraných prémiových nosičů v okolí prodejny</p>
                    </div>

                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Klient si může vybrat nosiče online
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Lokalita kampaně</span>
                      <strong className="text-white">Centrum + OC Nová Karolina</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Skladba nosičů</span>
                      <strong className="text-white">Tower (4s) + 6x CLP + 2x Lavička</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Interaktivní schválení</span>
                      <strong className="text-emerald-400">1-klik schválení klientem</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ROUTE (REALIZACE) */}
            {activeTab === 'route' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-emerald-400" />
                      <span>Plánovač tras montáží a výjezdů v terénu</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Montážník má na daný den více výjezdů. Podívejte se, jak systém seřadí zastávky do logické trasy.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateRoute}
                    disabled={optimizing}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg transition transform active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    {optimizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Přepočítávám trasu...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>⚡ Spustit modelový výpočet trasy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Route Result Comparison Box */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Původní neoptimalizovaná trasa (modelový příklad)
                    </span>
                    <div className="text-2xl font-black text-rose-400">42.8 km · 110 min</div>
                    <p className="text-xs text-slate-400">Náhodné pořadí zakázek dle data zadání (křížení po městě).</p>
                    <div className="text-xs text-slate-500 font-mono space-y-1 pt-2 border-t border-slate-900">
                      <div>1. Poruba → 2. Havířov → 3. Centrum → 4. Vítkovice</div>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border transition-all duration-300 space-y-3 ${
                      routeOptimized
                        ? 'bg-emerald-950/60 border-emerald-600 shadow-xl'
                        : 'bg-slate-950 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                        Optimalizováno SeePoint trasováním
                      </span>
                      {routeOptimized && (
                        <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 text-[10px] font-black">
                          Modelová úspora: -57 % km
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-emerald-400">18.4 km · 45 min</div>
                    <p className="text-xs text-slate-300">
                      Seřazeno podle nejkratší trasy s 1-klik otevřením do Google Maps / Waze.
                    </p>
                    <div className="text-xs text-emerald-300 font-mono space-y-1 pt-2 border-t border-emerald-900/60">
                      <div>1. Poruba → 2. Vítkovice → 3. Centrum → 4. Havířov</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: AI ASISTENT & SKLAD */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                {/* Inner Subtab Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <span>{aiSubTab === 'offers' ? 'AI Generátor nabídek' : 'AI Sklad & Účtenky z mobilu'}</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      {aiSubTab === 'offers'
                        ? 'Generování klientských konceptů podle textového zadání'
                        : 'Vytěžování fotografií účtenek za pohonné hmoty a materiál'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setAiSubTab('offers')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        aiSubTab === 'offers'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      AI Nabídky
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSubTab('warehouse')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        aiSubTab === 'warehouse'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      AI Sklad & Účtenky
                    </button>
                  </div>
                </div>

                {aiSubTab === 'offers' ? (
                  <div className="space-y-4">
                    {/* Preset Prompt Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSimulateAiOffer('Autoservis Ostrava')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          selectedAiPrompt === 'Autoservis Ostrava'
                            ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        🚗 Kampaň pro Autoservis (Ostrava)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimulateAiOffer('Restaurace & Fast Food')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          selectedAiPrompt === 'Restaurace & Fast Food'
                            ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        🍔 Navigační cedule pro Restauraci (D1)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimulateAiOffer('Městský Festival')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          selectedAiPrompt === 'Městský Festival'
                            ? 'bg-purple-600 text-white border-purple-400 shadow-lg'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        🎪 Letní Festival (Havířov)
                      </button>
                    </div>

                    {/* Generated AI Result Card */}
                    {isGeneratingAiOffer ? (
                      <div className="p-8 rounded-2xl bg-slate-950 border border-purple-800/80 flex flex-col items-center justify-center space-y-3">
                        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                        <span className="text-sm font-bold text-purple-200">SeePoint AI analyzuje nosiče a počítá kampaň...</span>
                      </div>
                    ) : (
                      generatedAiResult && (
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-950 to-indigo-950/70 border border-purple-700/80 space-y-4 shadow-xl">
                          <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
                            <div>
                              <span className="text-[10px] font-black uppercase text-purple-300 tracking-wider">
                                AI Vygenerovaná kampaň
                              </span>
                              <h4 className="text-base font-black text-white">{generatedAiResult.client}</h4>
                            </div>
                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {generatedAiResult.budget}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed font-medium">{generatedAiResult.summary}</p>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-slate-400 block uppercase">
                              Doporučené nosiče ze sítě:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {generatedAiResult.carriers.map((c, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1 rounded-lg bg-slate-900 text-xs font-bold text-purple-200 border border-purple-800/80"
                                >
                                  📍 {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt('fuel')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          selectedReceipt === 'fuel'
                            ? 'bg-amber-600 text-white border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        ⛽ Účtenka za palivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt('tools')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          selectedReceipt === 'tools'
                            ? 'bg-amber-600 text-white border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        📦 Nářadí & Regál dílny
                      </button>
                    </div>

                    {/* Receipt Result Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/50 via-slate-950 to-slate-950 border border-amber-700/60 space-y-4 shadow-xl">
                      {selectedReceipt === 'fuel' ? (
                        <>
                          <div className="flex items-center justify-between border-b border-amber-800/60 pb-3">
                            <div>
                              <span className="text-[10px] font-black uppercase text-amber-300">
                                Vytěženo z fotografie účtenky
                              </span>
                              <h4 className="text-base font-black text-white">ORLEN Benzina – Ostrava Rudná</h4>
                            </div>
                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                              1 450,50 Kč
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block">Palivo</span>
                              <strong className="text-white">Diesel (Efecta)</strong>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block">Objem</span>
                              <strong className="text-white">38,50 litrů</strong>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block">Tachometr</span>
                              <strong className="text-white">184 250 km</strong>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block">Stav</span>
                              <strong className="text-emerald-400">Přiřazeno k vozidlu montážníka</strong>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between border-b border-amber-800/60 pb-3">
                            <div>
                              <span className="text-[10px] font-black uppercase text-amber-300">
                                AI Detekce materiálu v dílně
                              </span>
                              <h4 className="text-base font-black text-white">Rozpoznané položky z fotky regálu</h4>
                            </div>
                            <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-950 text-amber-300 border border-amber-800">
                              4 položky detekovány
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                              <div>
                                <strong className="text-white block">Stahovací pásky černé 500mm</strong>
                                <span className="text-slate-400">Regál B2 - Spojovací materiál</span>
                              </div>
                              <span className="font-bold text-amber-400">5 balení (500 ks)</span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                              <div>
                                <strong className="text-white block">Aku vrtačka DeWalt 18V</strong>
                                <span className="text-slate-400">Regál A1 - Vratné nářadí</span>
                              </div>
                              <span className="font-bold text-emerald-400">2 sady</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
