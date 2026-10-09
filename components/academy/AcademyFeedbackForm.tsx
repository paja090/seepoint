'use client';
import { academyPrimaryButton } from '@/components/academy/styles';
import { useId, useState, type FormEvent } from 'react';
export function AcademyFeedbackForm({ revisionId, steps }: { revisionId: string; steps: { id: string; title: string }[] }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/academy/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId, category: data.get('category'), stepId: data.get('stepId') || null, message: data.get('message') }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.id) throw new Error(result?.error || 'Podnět se nepodařilo uložit. Text zůstává ve formuláři.');
      setMessage(`Podnět ${result.id} byl uložen pro správce Akademie. Děkujeme.`); form.reset();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Podnět se nepodařilo uložit.'); }
    finally { setBusy(false); }
  }
  return <details className="card"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Nahlásit problém s návodem</summary><form onSubmit={submit} className="mt-4 space-y-4"><p className="text-sm text-slate-600">Připojíme jen revizi této lekce a zvolený krok. Nevkládejte zákaznická data, hesla ani odkazy s přístupovým tokenem.</p><div className="grid gap-3 sm:grid-cols-2"><label htmlFor={`${id}-category`} className="text-sm font-medium">Důvod<select id={`${id}-category`} name="category" required className="mt-1 block min-h-11 w-full rounded-lg border p-2"><option value="UNCLEAR">Nejasný postup</option><option value="WRONG_UI">Obrazovka vypadá jinak</option><option value="BROKEN">Postup nefunguje</option><option value="ACCESS">Chybí oprávnění</option><option value="OUTDATED">Zastaralý návod</option></select></label><label htmlFor={`${id}-step`} className="text-sm font-medium">Krok<select id={`${id}-step`} name="stepId" className="mt-1 block min-h-11 w-full rounded-lg border p-2"><option value="">Celá lekce</option>{steps.map(step => <option key={step.id} value={step.id}>{step.title}</option>)}</select></label></div><label htmlFor={`${id}-message`} className="block text-sm font-medium">Co se stalo?<textarea id={`${id}-message`} name="message" required minLength={5} maxLength={2000} rows={4} className="mt-1 block w-full rounded-lg border p-3" /></label><button type="submit" className={academyPrimaryButton} disabled={busy}>{busy ? 'Ukládám…' : 'Odeslat podnět'}</button>{message && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-sm text-red-700' : 'break-words text-sm text-emerald-700'}>{message}</p>}</form></details>;
}
