'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Download, Share, X, CheckCircle2, Sparkles, MoreVertical, PlusSquare } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }

    // Check if running as standalone PWA already
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone;

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(iosDevice);

    // Capture Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Always show install bar on mobile browsers if not installed
    const isMobile = /mobile|android|iphone|ipad/.test(userAgent);
    if (isMobile && !isStandalone) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          setShowPrompt(false);
        }
        setDeferredPrompt(null);
        return;
      } catch {
        // Fallback to visual instructions
      }
    }

    // If browser didn't fire native prompt, show visual step-by-step guidance
    setShowInstructions(true);
  }

  if (installed || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 sm:left-4 sm:right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom duration-300">
      <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-2xl border border-emerald-500/50 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-black shadow-md">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white">Aplikace SeePOINT na plochu</h3>
                <Sparkles size={14} className="text-emerald-400" />
              </div>
              <p className="text-xs text-slate-300">Otevírejte aplikaci 1 kliknutím z ikonky v mobilu</p>
            </div>
          </div>

          <button
            onClick={() => setShowPrompt(false)}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main 1-Tap Install Button */}
        <button
          onClick={handleInstallClick}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition"
        >
          <Download size={16} />
          <span>Přidat ikonu na plochu mobilu</span>
        </button>

        {/* Fallback Step-by-Step Instructions Modal / Box */}
        {(showInstructions || isIos) && (
          <div className="mt-1 rounded-2xl bg-slate-900/90 p-3.5 text-xs text-slate-200 border border-slate-800 space-y-2 animate-in fade-in duration-200">
            {isIos ? (
              <>
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Share size={15} />
                  <span>Jak přidat na iPhone / iPad (Safari):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 font-medium">
                  <li>V Safari dole klikněte na ikonu <b>Sdílet</b> <Share size={12} className="inline text-emerald-400" /> (čtvereček se šipkou).</li>
                  <li>Klepněte na <b>"Přidat na plochu"</b> <PlusSquare size={12} className="inline text-emerald-400" /> (Add to Home Screen).</li>
                  <li>Potvrďte tlačítkem <b>Přidat</b> — ikona se objeví na ploše!</li>
                </ol>
              </>
            ) : (
              <>
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <MoreVertical size={15} />
                  <span>Jak přidat na Android (Chrome):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 font-medium">
                  <li>V prohlížeči Chrome vpravo nahoře klepněte na <b>3 tečky</b> <MoreVertical size={12} className="inline text-emerald-400" />.</li>
                  <li>Vyberte položku <b>"Přidat na plochu"</b> nebo <b>"Nainstalovat aplikaci"</b>.</li>
                  <li>Aplikace SeePOINT se uloží přímo mezi vaše mobilní aplikace!</li>
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
