'use client';
import { useState } from 'react';
export function PostponeRouteButton({ planId, unified = false }: { planId: string; unified?: boolean }) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function postpone() {
    setBusy(true);setError('');
    try {
      const response=await fetch(unified?'/api/work/route/continue':'/api/election-removal/plans/postpone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId})});
      const data=await response.json();if(!response.ok)throw new Error(data.error || 'Přesun trasy selhal.');
      window.location.assign(unified?'/work/dispatch?planner=work&date='+encodeURIComponent(data.date)+'&plan='+encodeURIComponent(data.id):'/work/route?date='+encodeURIComponent(data.date)+'&id='+encodeURIComponent(data.id));
    }catch(error){setError(error instanceof Error?error.message:'Přesun trasy selhal.');setBusy(false);}
  }
  return <div className="space-y-2"><button type="button" disabled={busy} onClick={postpone} className="rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">{busy?'Přesouvám zbývající práci…':'Pokračovat další den'}</button><p className="text-xs text-slate-500">Přesune všechny nedokončené body výjezdu. Posádky, auta i hlášené problémy zůstanou stejné.</p>{error&&<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}</div>;
}
