'use client';
import {useState} from 'react';
export function AlbumTitleEditor({id,source,albumSlug,title,onSaved}:{id:string;source:string;albumSlug:string;title:string;onSaved:(title:string)=>void}) {
  const [value,setValue]=useState(title);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  async function save(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setSaved(false);
    try {
      const response=await fetch('/api/fotodokumentace/albums/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({source,albumSlug,title:value})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Název se nepodařilo uložit.');
      setValue(data.title);onSaved(data.title);setSaved(true);
    }catch(error){setError(error instanceof Error?error.message:'Název se nepodařilo uložit.');}finally{setBusy(false);}
  }
  return <form onSubmit={save} className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-2">
    <label className="block text-sm font-bold text-slate-900">Název alba pro klienta<input required maxLength={160} value={value} onChange={event=>{setValue(event.target.value);setSaved(false);}} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-2 font-normal"/></label>
    <p className="text-xs text-slate-600">Zobrazí se v hlavičce klientského odkazu i v přehledu alb. Pracovní název zakázky zůstane zachovaný. Změna platí také pro již odeslané odkazy.</p>
    <button disabled={busy||!value.trim()} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Ukládám…':'Uložit název alba'}</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{saved&&<p role="status" className="text-sm text-emerald-700">Název alba uložen.</p>}
  </form>;
}
