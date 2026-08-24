'use client';

import { useState, useEffect } from 'react';
import { Camera, Sparkles, MapPin, Navigation, Zap, CheckCircle2 } from 'lucide-react';

const LIVE_EVENTS = [
  {
    icon: Camera,
    color: 'text-sky-400',
    bg: 'bg-sky-950/80 border-sky-800',
    badge: 'Mobilní aplikace',
    badgeColor: 'bg-sky-950 text-sky-300 border-sky-800',
    title: 'Nahrána nová fotka z montáže',
    desc: 'Montážník Petr nahrál fotku nosiče Kubánská MHD 4A (Ostrava).',
    time: 'Před 2 minutami',
  },
  {
    icon: Sparkles,
    color: 'text-purple-400',
    bg: 'bg-purple-950/80 border-purple-800',
    badge: 'SeePoint AI',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-800',
    title: 'Sestavena nabídka pro klienta',
    desc: 'Vygenerována kampaň pro Autoservis Ostrava (12 nosičů, -10%).',
    time: 'Před 4 minutami',
  },
  {
    icon: Navigation,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/80 border-emerald-800',
    badge: 'Optimalizátor tras',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    title: 'Trasa výjezdu zkrácena o 24.4 km',
    desc: 'Systém přeorganizoval 6 montážních bodů a ušetřil 57 % času.',
    time: 'Před 6 minutami',
  },
  {
    icon: MapPin,
    color: 'text-amber-400',
    bg: 'bg-amber-950/80 border-amber-800',
    badge: 'Dispečink sítě',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    title: 'Nový nosič synchronizován na mapu',
    desc: 'Promo Tower Místecká byla zaevidována a uvolněna k pronájmu.',
    time: 'Před 9 minutami',
  },
];

export function SaaSLiveActivityToast() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show first toast after 2.5s
    const initialTimer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);

    // Rotate every 7 seconds
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
        setIsVisible(true);
      }, 400);
    }, 7500);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const event = LIVE_EVENTS[currentIndex];
  const Icon = event.icon;

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-sm hidden sm:block pointer-events-none">
      <div
        className={`p-3.5 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl backdrop-blur-md transition-all duration-500 ease-out transform ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl border ${event.bg} ${event.color} shrink-0 mt-0.5 shadow-md`}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${event.badgeColor}`}>
                {event.badge}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">{event.time}</span>
            </div>

            <h4 className="text-xs font-black text-white truncate">{event.title}</h4>
            <p className="text-[11px] text-slate-300 font-medium leading-tight line-clamp-2">{event.desc}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
