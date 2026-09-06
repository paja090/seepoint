'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Sparkles, MapPin, FileText, Camera, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

/**
 * Konfigurace produktového videa SeePoint OS.
 * Až bude MP4 video připraveno:
 * 1. Nahrajte soubor např. do public/videos/seepoint-demo.mp4
 * 2. Případně přidejte cover do public/images/video/seepoint-demo-cover.jpg
 * 3. Přepněte `enabled: true`.
 */
export const PRODUCT_VIDEO_CONFIG = {
  enabled: false,
  src: '/videos/seepoint-demo.mp4',
  poster: '/images/video/seepoint-demo-cover.jpg',
  title: 'SeePoint OS – Reálné workflow za 60 sekund',
};

export function SaaSProductVideoSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handlePlayToggle = () => {
    if (!PRODUCT_VIDEO_CONFIG.enabled || !videoRef.current) {
      trackSaaSEvent('product_video_play', { mode: 'placeholder_clicked' });
      onOpenDemoModal();
      return;
    }

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      trackSaaSEvent('product_video_play', { src: PRODUCT_VIDEO_CONFIG.src });
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    trackSaaSEvent('product_video_completed', { src: PRODUCT_VIDEO_CONFIG.src });
  };

  return (
    <section id="video" className="py-20 bg-slate-950 relative overflow-hidden">
      {/* Glow Ambient Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-purple-900/25 via-indigo-900/20 to-sky-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-800/80 text-purple-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span>PRODUKTOVÁ UKÁZKA</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            SeePoint OS za 60 sekund.
          </h2>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Od vyhledání volné plochy přes vytvoření klientské nabídky až po realizaci a fotodokumentaci v terénu.
          </p>
        </div>

        {/* 16:9 Video Container with Ambient Frame */}
        <div className="relative rounded-3xl border border-purple-800/60 bg-slate-950 p-2 sm:p-3.5 shadow-2xl ring-1 ring-purple-500/20">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
            {PRODUCT_VIDEO_CONFIG.enabled ? (
              <>
                <video
                  ref={videoRef}
                  src={PRODUCT_VIDEO_CONFIG.src}
                  poster={PRODUCT_VIDEO_CONFIG.poster}
                  controls={isPlaying}
                  playsInline
                  preload="metadata"
                  onEnded={handleVideoEnded}
                  className="w-full h-full object-cover"
                />

                {!isPlaying && (
                  <button
                    type="button"
                    onClick={handlePlayToggle}
                    aria-label="Přehrát produktové video"
                    className="absolute inset-0 flex items-center justify-center bg-slate-950/40 hover:bg-slate-950/30 transition backdrop-blur-[2px] group cursor-pointer"
                  >
                    <div className="size-20 sm:size-24 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition transform border border-purple-400/50">
                      <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-0.5" />
                    </div>
                  </button>
                )}
              </>
            ) : (
              /* High-End SaaS Video Placeholder */
              <div className="relative w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 p-6 sm:p-12 flex flex-col items-center justify-center text-center space-y-5">
                {/* Tech Grid Background Pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

                <div className="relative z-10 flex flex-col items-center space-y-4 max-w-lg">
                  <div
                    onClick={handlePlayToggle}
                    className="size-16 sm:size-20 rounded-3xl bg-purple-950/80 border border-purple-700/80 text-purple-300 flex items-center justify-center shadow-2xl hover:scale-105 hover:border-purple-500 transition transform cursor-pointer group"
                  >
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-purple-300 translate-x-0.5 group-hover:fill-white group-hover:text-white transition" />
                  </div>

                  <div className="space-y-1.5">
                    <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-950/90 text-purple-300 border border-purple-800">
                      Ukázka v reálném provozu
                    </span>
                    <h3 className="text-lg sm:text-2xl font-black text-white">
                      Podívejte se, jak SeePoint funguje v praxi
                    </h3>
                    <p className="text-sm text-slate-300 font-medium">
                      Krátké video představující kompletní flow od výběru nosiče na mapě přes klientský odkaz až po fotodokumentaci montážníka.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      trackSaaSEvent('product_video_cta_clicked', { source: 'video_placeholder' });
                      onOpenDemoModal();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg transition cursor-pointer"
                  >
                    <span>Domluvit živou ukázku systému</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3 Key Takeaways Under Video */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-purple-400">
              <MapPin className="w-4 h-4" />
              <strong className="text-sm font-black text-white">1. Mapa a obsazenost</strong>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Filtrování volných nosičů v reálném čase, památkové zóny a detailní technické parametry plochy.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-indigo-400">
              <FileText className="w-4 h-4" />
              <strong className="text-sm font-black text-white">2. Nabídka klientovi</strong>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Vygenerování reprezentativní prezentace s fotografiemi a veřejným klientským odkazem do 60 sekund.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-400">
              <Camera className="w-4 h-4" />
              <strong className="text-sm font-black text-white">3. Realizace a fotodokumentace</strong>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Automatické předání zakázky do mobilu montážníka, GPS navigace a okamžité nahrání hotové instalace.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
