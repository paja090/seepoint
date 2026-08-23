'use client';

import { useState } from 'react';
import { MapPin, Layers, Calendar, FileText, Sparkles, Filter, CheckCircle2, Eye, ExternalLink, ChevronRight, Phone, Mail } from 'lucide-react';

export function SaaSProductShowcase() {
  const [activeTab, setActiveTab] = useState<'map' | 'inventory' | 'occupancy' | 'offers' | 'ai'>('map');

  return (
    <section id="produkt" className="py-12 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Tab Selector Bar */}
        <div className="flex items-center justify-center overflow-x-auto py-2 scrollbar-none">
          <div className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>🗺️ Mapa nosičů</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>📦 Evidence ploch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('occupancy')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'occupancy'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>📅 Obsazenost & Kalendář</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('offers')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'offers'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📜 Nabídky & Koncepty</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
              <span>🤖 SeePoint AI Radar</span>
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
                Živý systém v provozu
              </span>
            </div>
          </div>

          {/* SCREEN CONTENT BY TAB */}
          <div className="p-4 sm:p-6 min-h-[460px] bg-slate-900/40 rounded-b-2xl relative">
            {/* Floating Metric Badges */}
            <div className="hidden lg:grid grid-cols-4 gap-3 absolute top-6 right-6 z-20 max-w-xl">
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Síť nosičů</span>
                <strong className="text-lg font-black text-white">842 nosičů</strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Obsazenost</span>
                <strong className="text-lg font-black text-emerald-400">68 % sítě</strong>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Aktivní nabídky</span>
                <strong className="text-lg font-black text-indigo-400">12 nabídek</strong>
              </div>
              <div className="rounded-xl border border-purple-800/80 bg-purple-950/90 p-3 shadow-xl backdrop-blur-md">
                <span className="text-[10px] font-bold text-purple-300 block uppercase">AI Příležitosti</span>
                <strong className="text-lg font-black text-purple-200">5 v MS kraji</strong>
              </div>
            </div>

            {/* TAB 1: MAP */}
            {activeTab === 'map' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-white">Mapa reklamní sítě SeePoint OS</h3>
                    <p className="text-xs text-slate-400 font-medium">Kompletní přehled nosičů s filtrem médií, obsazenosti a GPS lokace.</p>
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

                {/* Map Mockup Grid */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden relative min-h-[340px] flex items-center justify-center p-6">
                  {/* Map Grid Pattern background */}
                  <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

                  {/* Simulated Map Pins */}
                  <div className="relative z-10 w-full max-w-3xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Pin Card 1 */}
                      <div className="rounded-2xl border border-purple-800/80 bg-slate-900/90 p-4 space-y-2 shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                            PROMO TOWER
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400">Volné od 1.9.</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">Ostrava – Místecká (Tower 4-stěnná)</h4>
                        <p className="text-xs text-slate-400 font-mono">GPS: 49.8355, 18.2835 · 4 strany (A,B,C,D)</p>
                        <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-slate-800">
                          <span className="text-slate-300">Cena / mes</span>
                          <span className="text-purple-300">24 900 Kč</span>
                        </div>
                      </div>

                      {/* Pin Card 2 */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-2 shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-sky-950 text-sky-300 border border-sky-800">
                            CITY POSTER (CLP)
                          </span>
                          <span className="text-[10px] font-bold text-amber-400">Rezervováno</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">Ostrava Centrum – 28. října</h4>
                        <p className="text-xs text-slate-400 font-mono">Vitrína prosvětlená · U Pošty</p>
                        <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-slate-800">
                          <span className="text-slate-300">Cena / mes</span>
                          <span className="text-white">6 800 Kč</span>
                        </div>
                      </div>

                      {/* Pin Card 3 */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-2 shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-orange-950 text-orange-300 border border-orange-800">
                            NAVIGAČNÍ ZNAČKA
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400">Volný sloupec VO</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">Opava – Olomoucká (VO křižovatka)</h4>
                        <p className="text-xs text-slate-400 font-mono">Sloup VO #142 · Městská třída</p>
                        <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-slate-800">
                          <span className="text-slate-300">Cena / mes</span>
                          <span className="text-white">1 950 Kč</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INVENTORY */}
            {activeTab === 'inventory' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-black text-white">Katalog reklamních nosičů a ploch</h3>
                  <span className="text-xs font-bold text-slate-400">Přehled 842 položek</span>
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
                      <tr>
                        <td className="p-3 font-mono text-purple-300 font-bold">CP-OSTR-012</td>
                        <td className="p-3 font-bold text-white">City Poster 28. října / Pošta</td>
                        <td className="p-3">City Poster (CLP)</td>
                        <td className="p-3">Ostrava centrum</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Aktivní · Výborný</span></td>
                        <td className="p-3 font-bold text-white">6 800 Kč</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-purple-300 font-bold">TOW-MIST-01</td>
                        <td className="p-3 font-bold text-white">Promo Tower Místecká (Set 4 strany A,B,C,D)</td>
                        <td className="p-3">Promo Tower</td>
                        <td className="p-3">Ostrava jich</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Aktivní · Kompletní</span></td>
                        <td className="p-3 font-bold text-white">24 900 Kč</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-purple-300 font-bold">NAV-OPAV-14</td>
                        <td className="p-3 font-bold text-white">Městská navigace VO (Sloup #142)</td>
                        <td className="p-3">Navigační tabule</td>
                        <td className="p-3">Opava</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Povoleno městem</span></td>
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
                  <h3 className="text-lg font-black text-white">Generování a náhledy klientských nabídek</h3>
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    🔒 Podpora nezávazných konceptů bez cen
                  </span>
                </div>

                <div className="rounded-2xl border border-purple-800/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 p-5 space-y-4 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                        Případová nabídka
                      </span>
                      <h4 className="text-base font-bold text-white mt-1">Koncept OOH kampaně – Primark (Ostrava)</h4>
                      <p className="text-xs text-slate-400">Připraveno pro klienta · 12 vybraných blízkých nosičů</p>
                    </div>

                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Připraveno k odeslání
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Proximity bod</span>
                      <strong className="text-white">Nová prodejna Karolina</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Doporučená média</span>
                      <strong className="text-white">Tower (4s) + CLP + Lavičky</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block">Veřejný klientský odkaz</span>
                      <strong className="text-purple-300">os.seepoint.cz/offer/token</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: AI */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-black text-white">SeePoint AI Sales Radar</h3>
                  </div>
                  <span className="text-xs font-bold text-purple-300 bg-purple-950 px-3 py-1 rounded-full border border-purple-800">
                    Moravskoslezský kraj (Živé sledování)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-purple-800/80 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                        Nová obchodní příležitost
                      </span>
                      <span className="text-xs font-bold text-emerald-400">Potenciál: VYSOKÝ</span>
                    </div>

                    <h4 className="font-bold text-sm text-white">Otevření nové pobočky obchodu v Ostrava-Poruba</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      AI detekovala oficiální zprávu o dokončení stavby nové obchodní jednotky na Hlavní třídě.
                    </p>

                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
                      <span className="text-slate-400">Doporučené nosiče: 6x CLP + 2x Lavička</span>
                      <span className="text-purple-300 font-bold">Vygenerovat nabídku →</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                        Kulturní událost
                      </span>
                      <span className="text-xs font-bold text-sky-400">Potenciál: STŘEDNÍ</span>
                    </div>

                    <h4 className="font-bold text-sm text-white">Městský festival Havířov 2026</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Plánovaný 3denní festival s očekávanou návštěvností 15 000 lidí.
                    </p>

                    <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
                      <span className="text-slate-400">Doporučené nosiče: Promo Tower + Billboardy</span>
                      <span className="text-indigo-300 font-bold">Vygenerovat nabídku →</span>
                    </div>
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
