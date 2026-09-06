'use client';

import Link from 'next/link';

export function SaaSFooter({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-xs py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-md">
                <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                  <span className="font-black text-sm text-white">SP</span>
                </div>
              </div>
              <span className="font-black text-lg text-white">SeePoint OS</span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm font-medium">
              SeePoint OS je operační systém pro venkovní reklamu. Propojuje reklamní nosiče, klienty, nabídky, kampaně, realizace a AI na jedné platformě.
            </p>

            <div className="pt-2 text-[11px] text-slate-500 font-mono">
              Vytvořeno na základě reálného provozu outdoorové reklamní společnosti SeePoint.
            </div>
          </div>

          {/* Column 1: Produkt */}
          <div className="space-y-3">
            <h4 className="font-black text-white uppercase text-[11px] tracking-wider">Produkt</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="#produkt" className="hover:text-white transition">Inventory & Nosiče</a></li>
              <li><a href="#produkt" className="hover:text-white transition">Mapa sítě & GPS</a></li>
              <li><a href="#produkt" className="hover:text-white transition">Obsazenost & Kalendář</a></li>
              <li><a href="#produkt" className="hover:text-white transition">Generátor nabídek</a></li>
              <li><a href="#ai" className="hover:text-white transition">SeePoint AI Engine</a></li>
              <li><a href="#reseni" className="hover:text-white transition">Navigace VO</a></li>
            </ul>
          </div>

          {/* Column 2: Řešení */}
          <div className="space-y-3">
            <h4 className="font-black text-white uppercase text-[11px] tracking-wider">Řešení</h4>
            <ul className="space-y-2 font-medium">
              <li><a href="#pro-koho" className="hover:text-white transition">OOH Provozovatelé</a></li>
              <li><a href="#pro-koho" className="hover:text-white transition">Reklamní agentury</a></li>
              <li><a href="#pro-koho" className="hover:text-white transition">Obchodní týmy</a></li>
              <li><a href="#pro-koho" className="hover:text-white transition">Realizační týmy</a></li>
              <li><a href="#cenik" className="hover:text-white transition">Tarify & Ceník</a></li>
            </ul>
          </div>

          {/* Column 3: Společnost & Právní */}
          <div className="space-y-3">
            <h4 className="font-black text-white uppercase text-[11px] tracking-wider">Společnost</h4>
            <ul className="space-y-2 font-medium">
              <li><Link href="/login" className="hover:text-white transition">Přihlášení do aplikace</Link></li>
              <li><button type="button" onClick={onOpenDemoModal} className="hover:text-white transition text-left">Domluvit ukázku</button></li>
              <li><a href="#faq" className="hover:text-white transition">Časté dotazy (FAQ)</a></li>
              <li className="pt-2 text-[11px] text-slate-500">© {new Date().getFullYear()} SeePoint OS</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-medium text-slate-500">
          <div>
            SeePoint OS · Software vytvořený pro moderní správu venkovní reklamy.
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 transition cursor-pointer">Ochrana osobních údajů</span>
            <span className="hover:text-slate-400 transition cursor-pointer">Podmínky použití</span>
            <span className="hover:text-slate-400 transition cursor-pointer">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
