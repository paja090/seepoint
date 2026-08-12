'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';

type ToastItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  linkUrl: string;
  isUrgent?: boolean;
  createdAt: string;
};

export function InAppToastNotifier() {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
  const previousCountRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Web Audio Chime Synthesizer
  function playAlertChime(isUrgent = false) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isUrgent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isUrgent ? 880 : 660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isUrgent ? 1174 : 880, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Ignore browser audio context autoplay restrictions
    }
  }

  async function checkNotifications() {
    try {
      const res = await fetch('/api/notifications/unread');
      if (!res.ok) return;
      const data = await res.json();
      const items: ToastItem[] = data.items || [];

      if (items.length > 0) {
        // Find newest unseen notification
        const newest = items.find((item) => !seenIdsRef.current.has(item.id));
        if (newest) {
          seenIdsRef.current.add(newest.id);
          setActiveToast(newest);
          playAlertChime(newest.isUrgent);

          // Auto-hide toast after 7 seconds
          setTimeout(() => {
            setActiveToast((current) => (current?.id === newest.id ? null : current));
          }, 7000);
        }
      }
      previousCountRef.current = items.length;
    } catch {
      // Ignore network errors
    }
  }

  useEffect(() => {
    checkNotifications();
    const interval = setInterval(checkNotifications, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  if (!activeToast) return null;

  return (
    <div className="fixed top-4 inset-x-4 sm:inset-auto sm:right-6 sm:w-96 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`rounded-3xl border p-4 shadow-2xl backdrop-blur-xl flex items-start gap-3 relative ${
        activeToast.isUrgent
          ? 'bg-rose-950/90 border-rose-500/50 text-white'
          : 'bg-slate-900/90 border-slate-700 text-white'
      }`}>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
          activeToast.isUrgent ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'
        }`}>
          {activeToast.isUrgent ? <AlertTriangle size={20} /> : <Bell size={20} />}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10">
              {activeToast.type}
            </span>
            <span className="text-[10px] font-bold text-slate-400">Právě teď</span>
          </div>

          <h4 className="text-xs font-black leading-snug truncate">{activeToast.title}</h4>
          <p className="text-[11px] text-slate-300 font-medium mt-0.5 line-clamp-2">{activeToast.description}</p>

          <Link
            href={activeToast.linkUrl}
            onClick={() => setActiveToast(null)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-sky-400 hover:text-sky-300 transition"
          >
            <span>Otevřít detail</span>
            <ChevronRight size={13} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setActiveToast(null)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
