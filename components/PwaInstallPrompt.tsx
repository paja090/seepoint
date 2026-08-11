'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Download, Share, X, CheckCircle2, Sparkles } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA already
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
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

    // Show prompt for iOS if not already installed
    if (iosDevice && !isStandalone) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }

  if (installed || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom duration-300">
      <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-2xl border border-emerald-500/40 backdrop-blur-xl flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-black shadow-md">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white">Přidat SeePOINT na plochu</h3>
                <Sparkles size={14} className="text-emerald-400" />
              </div>
              <p className="text-xs text-slate-300">Otevírejte aplikaci 1 klepnutím na ikonu v mobilu</p>
            </div>
          </div>

          <button
            onClick={() => setShowPrompt(false)}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-900 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action button for Android/Chrome */}
        {deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition"
          >
            <Download size={16} />
            <span>Nainstalovat Aplikaci SeePOINT</span>
          </button>
        )}

        {/* Instructions for iOS Safari */}
        {isIos && (
          <div className="rounded-2xl bg-slate-900/90 p-3 text-xs text-slate-300 border border-slate-800 space-y-1">
            <p className="font-bold text-white flex items-center gap-1.5">
              <Share size={14} className="text-emerald-400" />
              <span>Návod pro iPhone / iPad (Safari):</span>
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-300 font-medium">
              <li>Dole v Safari klepněte na tlačítko <b>Sdílet</b> (kvadrátek se šipkou).</li>
              <li>Zvolte <b>"Přidat na plochu"</b> (Add to Home Screen).</li>
              <li>Aplikace SeePOINT se objeví přímo mezi vašimi mobilními aplikacemi!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
