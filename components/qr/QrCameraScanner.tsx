'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, Search, Camera, ArrowRight } from 'lucide-react';

export function QrCameraScanner() {
  const router = useRouter();
  const [manualCode, setManualCode] = useState('');

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    router.push(`/qr/${encodeURIComponent(manualCode.trim())}`);
  }

  return (
    <div className="space-y-6">
      {/* Visual QR Code Scanner Frame */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-400 border border-sky-500/30">
          <QrCode size={40} className="animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-white">Naskenovat QR Nálepku</h2>
          <p className="text-xs font-medium text-slate-400 mt-1 max-w-sm mx-auto">
            Nasměrujte fotoaparát vašeho mobilu na QR štítek umístěný na nosiči, sloupu VO nebo lavičce.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              const code = prompt('Zadejte kód nosiče (např. VO-4012 nebo CAR-089):');
              if (code) router.push(`/qr/${encodeURIComponent(code.trim())}`);
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white hover:bg-sky-500 shadow-lg active:scale-98 transition cursor-pointer"
          >
            <Camera size={18} /> Spustit Fotoaparát Pro Skenování
          </button>
        </div>
      </div>

      {/* Manual Code Search Fallback */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Search size={16} className="text-sky-600" />
          <span>Nebo zadejte Kód Nosiče ručně:</span>
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Např. VO-4012, CAR-089, VO 4012..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
          >
            <span>Otevřít</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
