'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LocationPickerMap } from '@/components/election-removal/LocationPickerMap';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import { dispositions, type Operation, type Disposition } from '@/lib/election-removal/task-spec';

const templates: Array<[Operation,string]> = [['REPLACE_AD','Výměna reklamy'],['INSTALL_OBJECT','Instalace objektu'],['REMOVE_OBJECT','Demontáž'],['RELOCATION','Přesun objektu'],['REPAIR','Oprava'],['OTHER','Jiná práce']];
export function DispatchIntake({onClose}:{onClose:()=>void}) {
  const router=useRouter();const [operation,setOperation]=useState<Operation>('REPLACE_AD');
  const [disposition,setDisposition]=useState<Disposition>('LEAVE');
  const [location,setLocation]=useState<{latitude:number;longitude:number}|null>(null);
  const [destination,setDestination]=useState<{latitude:number;longitude:number}|null>(null);
  const [requestKey]=useState(()=>crypto.randomUUID());const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const transport=['WAREHOUSE','TRANSFER','CLIENT'].includes(disposition);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;
    if(!location || (transport&&!destination)){setError('Vyberte místo práce a případně místo předání v mapě.');return;}
    const form=new FormData(event.currentTarget);const value=(key:string)=>String(form.get(key)??'').trim();
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/work/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey,clientName:value('client'),task:{label:value('title'),description:value('description'),operationType:operation,mediaType:value('media'),objectType:value('media'),quantity:Number(value('quantity')), ...location,gpsConfirmed:true,materialDisposition:disposition,materialInstructions:value('instructions'),destinationName:value('destinationName'),destinationLatitude:transport?destination?.latitude:null,destinationLongitude:transport?destination?.longitude:null,destinationGpsConfirmed:transport,referenceUrl:value('reference'),contact:value('contact'),accessInstructions:value('access'),...(value('minutes')?{serviceMinutes:Number(value('minutes'))}:{}),...(value('workers')?{requiredWorkers:Number(value('workers'))}:{})}})});
      const result=await response.json();if(!response.ok)throw Error(result.error || 'Uložení se nezdařilo.');
      router.refresh();onClose();
    }catch(e){setError(e instanceof Error?e.message:'Uložení se nezdařilo.');setBusy(false);}
  }
  return <section className="rounded-2xl border bg-white p-5 shadow-sm" aria-labelledby="intake-title">
    <div className="flex items-start justify-between gap-4"><div><h2 id="intake-title" className="text-xl font-bold">Co potřebujeme udělat?</h2><p className="mt-1 text-sm text-slate-600">Termín, posádku a auto vyberete až při plánování výjezdu.</p></div><button type="button" onClick={onClose} disabled={busy} className="btn">Zavřít zadání</button></div>
    <div className="my-4 flex flex-wrap gap-2">{templates.map(([key,label])=><button type="button" key={key} aria-pressed={operation===key} className={'rounded-xl border px-3 py-2 text-sm '+(operation===key?'bg-sky-800 text-white':'bg-white')} onClick={()=>{setOperation(key);if(key==='RELOCATION')setDisposition('TRANSFER');}}>{label}</button>)}</div>
    <form onSubmit={submit} className="space-y-4">
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Název práce<input name="title" required maxLength={200} className="input mt-1 w-full" placeholder="Např. Výměna reklamy u nádraží"/></label><label className="text-sm font-semibold">Klient (volitelné)<input name="client" maxLength={200} className="input mt-1 w-full"/></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Médium nebo objekt<select name="media" className="input mt-1 w-full">{Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm font-semibold">Počet kusů<input name="quantity" type="number" min={1} max={10000} defaultValue={1} required className="input mt-1 w-full"/></label></div>
      <div><h3 className="font-semibold">{operation==='RELOCATION'?'Místo vyzvednutí':'Místo práce'}</h3><p className="mb-2 text-sm text-slate-600">Vyhledejte adresu a potvrďte místo v mapě. Nosič nemusí být v evidenci.</p><LocationPickerMap latitude={location?.latitude??null} longitude={location?.longitude??null} onChange={setLocation}/>{location&&<p className="mt-1 text-sm text-emerald-800">Místo vybráno: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}</div>
      <label className="block text-sm font-semibold">Pokyn pro technika<textarea name="description" required={operation==='OTHER'} maxLength={4000} className="input mt-1 w-full" rows={2} placeholder="Co udělat a na co si dát pozor"/></label>
      <label className="block text-sm font-semibold">Co s materiálem?<select value={disposition} onChange={e=>setDisposition(e.target.value as Disposition)} className="input mt-1 w-full">{Object.entries(dispositions).filter(([key])=>operation!=='RELOCATION'||['TRANSFER','WAREHOUSE','CLIENT'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {transport&&<div className="space-y-2 rounded-xl bg-slate-50 p-3"><label className="block text-sm font-semibold">Místo předání<input name="destinationName" required maxLength={200} className="input mt-1 w-full" placeholder="Název skladu nebo cílového místa"/></label><LocationPickerMap latitude={destination?.latitude??null} longitude={destination?.longitude??null} onChange={setDestination}/><p className="text-sm text-slate-600">Vyzvednutí a předání budou dva navazující kroky stejné práce.</p></div>}
      {disposition==='OTHER'&&<label className="block text-sm font-semibold">Pokyny k materiálu<textarea name="instructions" required className="input mt-1 w-full"/></label>}
      {operation==='REPLACE_AD'&&<label className="block text-sm font-semibold">Nová grafika / podklady (odkaz, volitelné)<input name="reference" type="url" className="input mt-1 w-full" placeholder="https://…"/></label>}
      <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Pokročilé nastavení</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Odhad minut (volitelné)<input name="minutes" type="number" min={1} max={1440} className="input w-full"/></label><label>Potřebný počet pracovníků<input name="workers" type="number" min={1} max={20} defaultValue={1} className="input w-full"/></label><label>Kontakt<input name="contact" maxLength={500} className="input w-full"/></label><label>Přístup na místo<input name="access" maxLength={4000} className="input w-full"/></label></div></details>
      <button type="submit" disabled={busy} className="rounded-xl bg-sky-800 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Ukládám…':'Uložit do fronty práce'}</button>
    </form>
  </section>;
}
