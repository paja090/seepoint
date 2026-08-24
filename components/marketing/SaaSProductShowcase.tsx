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
  const [activeTab, setActiveTab] = useState<
    'map' | 'inventory' | 'occupancy' | 'offers' | 'ai' | 'route' | 'warehouse' | 'network'
  >('map');

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
  const [scanningReceipt, setScanningReceipt] = useState(false);

  // Interactive B2B Network Simulator State
  const [selectedNetworkCampaign, setSelectedNetworkCampaign] = useState<'cz_national' | 'moravia_regional' | 'd1_highway'>('cz_national');
  const [networkDispatched, setNetworkDispatched] = useState(false);
  const [isSimulatingNetwork, setIsSimulatingNetwork] = useState(false);

  const handleSimulateNetwork = (type: 'cz_national' | 'moravia_regional' | 'd1_highway') => {
    setSelectedNetworkCampaign(type);
    setIsSimulatingNetwork(true);
    setNetworkDispatched(false);
    setTimeout(() => {
      setIsSimulatingNetwork(false);
      setNetworkDispatched(true);
    }, 500);
  };

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

  return (
    <section id="produkt" className="py-12 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Tab Selector Bar */}
        <div className="flex items-center justify-center overflow-x-auto py-2 scrollbar-none">
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>🗺️ Živá Mapa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>📦 Evidence</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('occupancy')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'occupancy'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>📅 Obsazenost</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('offers')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'offers'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📜 Nabídky</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
              <span>🤖 AI Nabídky & Radar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('route')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'route'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Navigation className="w-4 h-4 text-emerald-300" />
              <span>🚗 Optimalizátor Tras</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('warehouse')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'warehouse'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Receipt className="w-4 h-4 text-amber-300" />
              <span>🧾 AI Sklad & Účtenky</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('network')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'network'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-sky-300 animate-pulse" />
              <span>🌐 SeePoint Network (B2B Burza)</span>
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
                os.seepoint.cz / {activeTab}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Interaktivní simulace SeePoint OS
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
                      ● Volné dnes (274)
                    </span>
                  </div>
                </div>

                <ShowcaseInteractiveMap />
              </div>
            )}

            {/* TAB 2: INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white">Katalog reklamních nosičů a ploch</h3>
                    <p className="text-xs text-slate-400">Přehled 842 položek s GPS a fotografiemi</p>
                  </div>
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    Fulltext filtr & Export do Excelu
                  </span>
                </div>

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
              </div>
            )}

            {/* TAB 3: OCCUPANCY */}
            {activeTab === 'occupancy' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-black text-white">Plánovač obsazenosti nosičů</h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300">● Obsazeno</span>
                    <span className="px-2 py-1 rounded bg-amber-950 text-amber-300">● Rezervace</span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">○ Volno</span>
                  </div>
                </div>

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
              </div>
            )}

            {/* TAB 4: OFFERS */}
            {activeTab === 'offers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white">Interaktivní klientské nabídky</h3>
                    <p className="text-xs text-slate-400">Digitální nabídka pro klienta bez nutnosti tisknout PDF</p>
                  </div>
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    🔒 Neveřejný token pro klienta
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

            {/* TAB 5: AI RADAR & OFFER GENERATOR SANDBOX */}
            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <span>Vyzkoušejte si SeePoint AI naživo</span>
                    </h3>
                    <p className="text-xs text-slate-400">Klikněte na vzorové zadání a podívejte se na výsledek AI</p>
                  </div>
                  <span className="text-xs font-bold text-purple-300 bg-purple-950 px-3 py-1 rounded-full border border-purple-800">
                    Běží na Gemini Flash Engine
                  </span>
                </div>

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
            )}

            {/* TAB 6: FIELD ROUTE OPTIMIZER SIMULATOR */}
            {activeTab === 'route' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-emerald-400" />
                      <span>AI Optimalizátor Tras Montáží v terénu</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Montážník má na den 5 výlepů. Podívejte se, jak systém ušetří kilometry a čas.
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
                        <span>⚡ Spustit optimalizaci trasy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Route Result Comparison Box */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Původní neoptimalizovaná trasa
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
                        Optimalizováno SeePoint TSP Engine
                      </span>
                      {routeOptimized && (
                        <span className="px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 text-[10px] font-black">
                          Úspora -57 % km!
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

            {/* TAB 7: WAREHOUSE & OCR RECEIPT SCANNER */}
            {activeTab === 'warehouse' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-amber-400" />
                      <span>AI Sklad, Nákupy & OCR Účtenky z mobilu</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Montážník vyfotí účtenku na benzínce nebo materiál v dílně – AI okamžitě vytěží data.
                    </p>
                  </div>

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
                          <strong className="text-emerald-400">Připsáno k vozidlu 1T4-8921</strong>
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

            {/* TAB 8: SEEPOINT B2B NETWORK & SHARING */}
            {activeTab === 'network' && (
              <div className="p-4 sm:p-6 space-y-6">
                {/* Header info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-950 text-blue-300 border border-blue-800">
                        B2B PARTNERSKÁ BURZA PLOCH
                      </span>
                      <span className="text-xs text-emerald-400 font-bold">● 42 zapojených agentur v ČR</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                      SeePoint Network: Prodávejte kampaně po celé republice bez investic do vlastních sloupů
                    </h3>
                    <p className="text-xs text-slate-300">
                      Zkombinujte vlastní nosiče s volnou kapacitou partnerských agentur. Systém automaticky rozdělí marže a odešle montážní podklady.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300">
                      Vaše agentura: <strong className="text-purple-300">SeePoint Ostrava (280 nosičů)</strong>
                    </span>
                  </div>
                </div>

                {/* Campaign Selector Presets */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-400 block">
                    Zvolte typ meziměstské klientské poptávky k simulaci:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSimulateNetwork('cz_national')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between space-y-1 ${
                        selectedNetworkCampaign === 'cz_national'
                          ? 'border-blue-500 bg-blue-950/40 shadow-lg ring-1 ring-blue-500/30'
                          : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-black text-white">🇨🇿 Celorepubliková kampaň</strong>
                        <span className="text-[10px] font-bold text-blue-300">Ostrava + Brno + Olomouc</span>
                      </div>
                      <span className="text-[11px] text-slate-400">15 nosičů · Automobilový prodejce</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateNetwork('moravia_regional')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between space-y-1 ${
                        selectedNetworkCampaign === 'moravia_regional'
                          ? 'border-blue-500 bg-blue-950/40 shadow-lg ring-1 ring-blue-500/30'
                          : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-black text-white">🎯 Region Severní Morava</strong>
                        <span className="text-[10px] font-bold text-blue-300">Ostrava + Opava + Havířov</span>
                      </div>
                      <span className="text-[11px] text-slate-400">10 nosičů · Nákupní park & Retail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateNetwork('d1_highway')}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between space-y-1 ${
                        selectedNetworkCampaign === 'd1_highway'
                          ? 'border-blue-500 bg-blue-950/40 shadow-lg ring-1 ring-blue-500/30'
                          : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-black text-white">🚗 Dálniční koridor D1</strong>
                        <span className="text-[10px] font-bold text-blue-300">Praha ➔ Brno ➔ Ostrava</span>
                      </div>
                      <span className="text-[11px] text-slate-400">8 Bigboardů · Fast Food řetězec</span>
                    </button>
                  </div>
                </div>

                {/* Network Breakdown Visual Pipeline */}
                <div className="rounded-2xl border border-blue-900/50 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950/20 p-4 sm:p-6 space-y-6">
                  {/* Financial & Volume Summary Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Own Carriers */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-purple-800/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-300">1. VLASTNÍ NOSIČE (Ostrava)</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-950 text-purple-300 border border-purple-800">
                          100 % VÝNOS
                        </span>
                      </div>
                      <div className="text-xl font-black text-white">
                        {selectedNetworkCampaign === 'cz_national' && '8 nosičů · 28 000 Kč'}
                        {selectedNetworkCampaign === 'moravia_regional' && '6 nosičů · 21 000 Kč'}
                        {selectedNetworkCampaign === 'd1_highway' && '3 Bigboardy · 36 000 Kč'}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Vlastní plocha: Promo Tower Místecká, CLP 28. října a Billboardy Rudná.
                      </p>
                    </div>

                    {/* 2. Partner Carriers Network */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-blue-800/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-blue-300">2. PARTNERSKÁ SÍŤ B2B</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-950 text-blue-300 border border-blue-800">
                          +15 % PROVIZE
                        </span>
                      </div>
                      <div className="text-xl font-black text-white">
                        {selectedNetworkCampaign === 'cz_national' && '7 nosičů · +4 200 Kč provize'}
                        {selectedNetworkCampaign === 'moravia_regional' && '4 nosiče · +2 400 Kč provize'}
                        {selectedNetworkCampaign === 'd1_highway' && '5 Bigboardů · +9 000 Kč provize'}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {selectedNetworkCampaign === 'cz_national' && '4x Brno (MedialBrno) + 3x Olomouc (Haná OOH).'}
                        {selectedNetworkCampaign === 'moravia_regional' && '2x Opava (OpavaMedia) + 2x Havířov (OOH Havířov).'}
                        {selectedNetworkCampaign === 'd1_highway' && '3x D1 Praha-Brno + 2x D1 Vysočina.'}
                      </p>
                    </div>

                    {/* 3. Total Agency Gain */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/70 to-slate-950 border border-emerald-700/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-300">CELKOVÝ ZISK VAŠÍ AGENTURY</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                          JEDINÁ NABÍDKA
                        </span>
                      </div>
                      <div className="text-2xl font-black text-emerald-400">
                        {selectedNetworkCampaign === 'cz_national' && '32 200 Kč'}
                        {selectedNetworkCampaign === 'moravia_regional' && '23 400 Kč'}
                        {selectedNetworkCampaign === 'd1_highway' && '45 000 Kč'}
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium">
                        Klient zaplatí vám. Systém automaticky vyúčtuje provize partnerským agenturám.
                      </p>
                    </div>
                  </div>

                  {/* Automated Dispatch Status Box */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center font-black">
                        📲
                      </div>
                      <div>
                        <strong className="text-xs font-bold text-white block">
                          Automatická synchronizace montáží do mobilních aplikací partnerů
                        </strong>
                        <span className="text-[11px] text-slate-400">
                          Po schválení klientem se montážní úkoly s tiskovými daty samy rozešlou montážníkům v Brně i Olomouci.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSimulateNetwork(selectedNetworkCampaign)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg transition cursor-pointer shrink-0"
                    >
                      {isSimulatingNetwork ? 'Simuluji přepočet sítě...' : '⚡ Přepočítat síťové marže'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

