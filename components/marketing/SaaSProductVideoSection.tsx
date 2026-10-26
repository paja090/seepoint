'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  Zap,
  Film,
  Download,
} from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export type VideoMode = 'short' | 'full';

export interface VideoChapter {
  time: number;
  title: string;
  badge: string;
  description: string;
}

export const FULL_CHAPTERS: VideoChapter[] = [
  { time: 0, title: 'Úvod', badge: '01', description: 'Více prostoru pro obchod, méně rutiny' },
  { time: 9, title: 'Evidence nosičů', badge: '02', description: 'Reálné plochy SeePoint a fotografie' },
  { time: 26, title: 'Mapa ploch', badge: '03', description: 'Výběr nosičů v interaktivní mapě' },
  { time: 44, title: 'AI dostupnost', badge: '04', description: 'Přirozený dotaz na volné termíny v češtině' },
  { time: 61, title: 'AI nabídka', badge: '05', description: 'Copilot sestaví koncept a rozpočet' },
  { time: 79, title: 'Strategie', badge: '06', description: 'Fáze kampaně a klientský odkaz' },
  { time: 93, title: 'AI úkoly', badge: '07', description: 'Diktování a automatický rozpad úkolů' },
  { time: 111, title: 'Plán trasy', badge: '08', description: 'Optimalizace výjezdu pro posádku' },
  { time: 128, title: 'Montáž v terénu', badge: '09', description: 'Mobilní rozhraní a fotodokumentace' },
  { time: 146, title: 'Fakturace zakázky', badge: '10', description: 'Kontrola položek a okamžitý náhled dokladu' },
  { time: 157, title: 'Závěr', badge: '11', description: 'Domluvte si ukázku pro vaši síť' },
];

export const SHORT_CHAPTERS: VideoChapter[] = [
  { time: 0, title: 'Úvod', badge: '01', description: 'Představení SeePoint OS' },
  { time: 5, title: 'AI nabídka', badge: '02', description: 'Bleskový návrh mediálního konceptu' },
  { time: 23, title: 'AI úkoly', badge: '03', description: 'Strukturovaný checklist z jednoho zadání' },
  { time: 41, title: 'AI dostupnost', badge: '04', description: 'Volné reklamní plochy na dotaz' },
  { time: 57, title: 'Závěr', badge: '05', description: 'Vaše plochy, váš tým, jeden systém' },
];

export const VIDEO_SOURCES: Record<VideoMode, { src: string; duration: number; label: string; sublabel: string }> = {
  short: {
    src: '/images/video/seepoint-demo-short.mp4',
    duration: 61,
    label: '⚡ Svižný přehled (60 s)',
    sublabel: 'Klíčové funkce v jedné minutě',
  },
  full: {
    src: '/images/video/seepoint-demo.mp4',
    duration: 162,
    label: '🎬 Kompletní ukázka (2:40 min)',
    sublabel: 'Celé flow od nabídky po fakturaci',
  },
};

export const PRODUCT_VIDEO_CONFIG = {
  enabled: true,
  poster: '/images/video/seepoint-demo-cover.jpg',
  title: 'SeePoint OS – AI v každodenní praxi',
};

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function SaaSProductVideoSection(_props?: { onOpenDemoModal?: () => void }) {
  const [mode, setMode] = useState<VideoMode>('short');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activeChapters = mode === 'full' ? FULL_CHAPTERS : SHORT_CHAPTERS;
  const currentChapter =
    [...activeChapters].reverse().find((c) => currentTime >= c.time) || activeChapters[0];

  const handlePlayToggle = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      trackSaaSEvent('product_video_play', { mode, src: VIDEO_SOURCES[mode].src });
    }
  }, [isPlaying, mode]);

  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleFullscreen = () => {
    const el = containerRef.current || videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const jumpToChapter = (chapterTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = chapterTime;
    setCurrentTime(chapterTime);
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    trackSaaSEvent('product_video_chapter_jump', { mode, targetTime: chapterTime });
  };

  const handleModeChange = (newMode: VideoMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setCurrentTime(0);
    setIsPlaying(false);
    trackSaaSEvent('product_video_mode_change', { mode: newMode });
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [mode, playbackRate]);

  return (
    <section id="video" className="py-20 bg-slate-950 relative overflow-hidden">
      {/* Glow Ambient Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-purple-900/25 via-indigo-900/20 to-sky-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-800/80 text-purple-300 text-xs font-black uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span>PRODUKTOVÁ VIDEOPREZENTACE</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-bold">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Český hlasový průvodce</span>
            </div>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            SeePoint OS v praxi se zvukem.
          </h2>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Poslechněte si komentovanou ukázku systému: od evidence nosičů a AI sestavení nabídky přes plánování tras až po mobilní fotodokumentaci a fakturaci.
          </p>

          {/* Mode Switcher Pills */}
          <div className="pt-2 flex justify-center">
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/90 border border-purple-900/60 shadow-xl">
              <button
                type="button"
                onClick={() => handleModeChange('short')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  mode === 'short'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Rychlý přehled (60 s)</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('full')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  mode === 'full'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Film className="w-4 h-4 text-purple-300" />
                <span>Kompletní průchod (2:40 min)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 16:9 Video Container with Ambient Frame */}
        <div
          ref={containerRef}
          className="relative rounded-3xl border border-purple-800/60 bg-slate-950 p-2 sm:p-3.5 shadow-2xl ring-1 ring-purple-500/20 group/player"
        >
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
            <video
              ref={videoRef}
              key={VIDEO_SOURCES[mode].src}
              src={VIDEO_SOURCES[mode].src}
              poster={PRODUCT_VIDEO_CONFIG.poster}
              playsInline
              preload="metadata"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => {
                setIsPlaying(false);
                trackSaaSEvent('product_video_completed', { mode, src: VIDEO_SOURCES[mode].src });
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-contain cursor-pointer"
              onClick={handlePlayToggle}
            />

            {/* Top-Left Live Chapter Badge */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-purple-500/30 text-xs font-semibold text-purple-200 shadow-xl pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white">{currentChapter.title}</span>
              <span className="hidden sm:inline text-slate-400">· {currentChapter.description}</span>
              <span className="text-purple-300 font-mono text-[11px] ml-1">
                {formatTime(currentTime)} / {formatTime(VIDEO_SOURCES[mode].duration)}
              </span>
            </div>

            {/* Play Overlay Button */}
            {!isPlaying && (
              <button
                type="button"
                onClick={handlePlayToggle}
                aria-label="Přehrát video se zvukem"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/40 hover:bg-slate-950/30 transition backdrop-blur-[2px] group cursor-pointer z-10"
              >
                <div className="size-20 sm:size-24 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition transform border border-purple-400/50">
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-0.5" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-slate-950/85 border border-purple-500/40 text-xs font-bold text-purple-200 shadow-lg">
                  🔊 Spustit video s českým komentářem
                </span>
              </button>
            )}

            {/* Custom Control Bar at Bottom */}
            <div
              className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent flex items-center justify-between gap-3 z-20 transition duration-300 ${
                isPlaying ? 'opacity-100 sm:opacity-0 sm:group-hover/player:opacity-100' : 'opacity-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  aria-label={isPlaying ? 'Pozastavit' : 'Přehrát'}
                  className="p-2 rounded-xl bg-slate-900/80 hover:bg-purple-600 text-white border border-slate-700/60 transition cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>

                <button
                  type="button"
                  onClick={handleMuteToggle}
                  aria-label={isMuted ? 'Zapnout zvuk' : 'Ztlumit zvuk'}
                  className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>

                <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/60 rounded-xl p-1 text-xs font-bold text-slate-300">
                  {[1, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleSpeedChange(rate)}
                      className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                        playbackRate === rate ? 'bg-purple-600 text-white shadow-xs' : 'hover:text-white'
                      }`}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={VIDEO_SOURCES[mode].src}
                  download={mode === 'short' ? 'seepoint-demo-short.mp4' : 'seepoint-demo.mp4'}
                  title="Stáhnout video v MP4"
                  className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden md:inline">Stáhnout MP4</span>
                </a>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label="Celá obrazovka"
                  className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Chapters Navigation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold uppercase tracking-wider text-purple-300">
              Kapitoly videa ({activeChapters.length})
            </span>
            <span>Kliknutím na kapitolu přeskočíte přímo na danou část</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeChapters.map((chapter) => {
              const isActive = currentChapter.title === chapter.title;
              return (
                <button
                  key={chapter.time}
                  type="button"
                  onClick={() => jumpToChapter(chapter.time)}
                  className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                    isActive
                      ? 'bg-purple-900/50 border-purple-500 text-white shadow-lg ring-1 ring-purple-500/50'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-purple-600/60 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-purple-300'
                    }`}
                  >
                    {formatTime(chapter.time)}
                  </span>
                  <span>{chapter.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
