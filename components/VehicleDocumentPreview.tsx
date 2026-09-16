'use client';

import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

export function VehicleDocumentPreview({ url, label = 'Zobrazit účtenku', thumbnail = false }: { url: string; label?: string; thumbnail?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  function show() {
    setFailed(false);
    setOpen(true);
    dialog.current?.showModal();
  }

  return <>
    <button type="button" onClick={show} aria-label={label} className={thumbnail ? 'block w-full cursor-zoom-in' : 'inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-100 px-3 text-xs font-bold text-amber-950 hover:bg-amber-200'}>
      {thumbnail ? <img src={url} alt={label} className="max-h-64 w-full rounded-xl object-contain" /> : `📷 ${label}`}
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} className="m-auto max-h-[92dvh] w-[calc(100%_-_1rem)] max-w-4xl overflow-hidden rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-950/80">
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <h2 id={titleId} className="font-bold text-slate-900">{label}</h2>
        <button type="button" autoFocus onClick={() => dialog.current?.close()} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 font-bold text-white"><X size={20} /> Zavřít</button>
      </div>
      {open && <div className="max-h-[calc(92dvh-5rem)] overflow-auto bg-slate-100 p-2">
        {failed ? <p role="alert" className="p-6 text-center text-slate-800">Fotografii se nepodařilo načíst.</p> : <img src={url} alt={label} onError={() => setFailed(true)} className="mx-auto max-h-[calc(92dvh-6rem)] max-w-full object-contain" />}
      </div>}
    </dialog>
  </>;
}
