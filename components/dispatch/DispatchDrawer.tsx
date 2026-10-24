'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native dialog supplies focus containment, Escape and a top layer above Leaflet. */
export function DispatchDrawer({ title, onClose, busy = false, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="dispatch-panel-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}
    className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/30 sm:rounded-l-3xl">
    <div className="flex min-h-full flex-col" onClick={event => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
        <h2 id="dispatch-panel-title" className="text-xl font-bold">{title}</h2>
        <button type="button" aria-label="Zavřít panel" disabled={busy} onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 disabled:opacity-40"><X size={20}/></button>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
