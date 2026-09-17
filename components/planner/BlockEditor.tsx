'use client';
import { primaryButton, secondaryButton } from './styles';
import { useEffect, useRef, useState } from 'react';
import type { PlannerItem, PlannerTask } from '@/lib/planner/domain';
import { dateInZone, localInstant } from '@/lib/planner/time';
import { plannerRequest } from './api';

export function BlockEditor({ date, timezone, workingStart, tasks, block, startAt, onClose, onSaved }: { date: string; timezone: string; workingStart: string; tasks: PlannerTask[]; block?: PlannerItem; startAt?: string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const local = (iso: string) => `${dateInZone(new Date(iso), timezone)}T${new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))}`;
  const [title, setTitle] = useState(block?.title || '');
  const defaultStart = startAt || localInstant(date, workingStart, timezone).toISOString();
  const [start, setStart] = useState(block ? local(block.startAt) : local(defaultStart));
  const [end, setEnd] = useState(block ? local(block.endAt) : local(new Date(Date.parse(defaultStart) + 3600000).toISOString()));
  const [category, setCategory] = useState(block?.category || 'FOCUS');
  const [task, setTask] = useState('');
  const [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function save(remove = false) {
    setSaving(true); setError('');
    try {
      const chosen = tasks.find(t => `${t.sourceKind}:${t.id}` === task);
      await plannerRequest(block ? `/blocks/${block.id}` : '/blocks', remove ? { version: block?.version } : { title, startAt: localInstant(start.slice(0, 10), start.slice(11), timezone).toISOString(), endAt: localInstant(end.slice(0, 10), end.slice(11), timezone).toISOString(), category, requestKey: requestKey.current, sourceKind: chosen?.sourceKind, sourceId: chosen?.id, version: block?.version }, remove ? 'DELETE' : block ? 'PATCH' : 'POST');
      onSaved(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Blok se nepodařilo uložit.'); } finally { setSaving(false); }
  }
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="block-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl backdrop:bg-slate-950/70">
    <div className="mb-5 flex items-center justify-between"><h2 id="block-title" className="text-xl font-bold">{block ? 'Upravit pracovní blok' : 'Vytvořit prostor pro práci'}</h2><button type="button" onClick={onClose} className={secondaryButton}>Zavřít</button></div>
    <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-4">
      <label className="block text-sm font-semibold">Název<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border p-3" placeholder="Na čem budu pracovat?" /></label>
      {!block && <label className="block text-sm font-semibold">Propojit s úkolem<select value={task} onChange={e => { setTask(e.target.value); const t = tasks.find(t => `${t.sourceKind}:${t.id}` === e.target.value); if (t) setTitle(t.title); }} className="mt-1 w-full rounded-xl border p-3"><option value="">Bez propojení</option>{tasks.map(t => <option key={`${t.sourceKind}:${t.id}`} value={`${t.sourceKind}:${t.id}`}>{t.title}</option>)}</select></label>}
      <label className="block text-sm font-semibold">Druh práce<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{[['FOCUS', 'Soustředěná práce'], ['MEETING', 'Schůzka'], ['PROJECT', 'Projektová práce'], ['OPERATIONS', 'Operativa'], ['DEVELOPMENT', 'Rozvoj firmy']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      <p className="text-xs text-slate-500">Časy jsou v zóně {timezone}. Blok se uloží do SeePointu.</p>
      <label className="block text-sm font-semibold">Od<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} className="mt-1 w-full min-w-0 rounded-xl border p-3" /></label>
      <label className="block text-sm font-semibold">Do<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} className="mt-1 w-full min-w-0 rounded-xl border p-3" /></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">{block && <button type="button" disabled={saving} onClick={() => { if (confirm('Odstranit tento pracovní blok?')) void save(true); }} className={secondaryButton}>Odstranit</button>}<button disabled={saving} className={primaryButton}>{saving ? 'Ukládám…' : 'Potvrdit a uložit'}</button></div>
    </form>
  </dialog>;
}
