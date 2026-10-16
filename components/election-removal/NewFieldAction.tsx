'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export function NewFieldAction() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <form className="rounded-xl border bg-white p-5 space-y-3" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); const form = new FormData(e.currentTarget);
    try { const r = await fetch('/api/election-removal/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(form), points: [] }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error); router.push('/election-removal/' + data.campaignId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Založení selhalo.'); } finally { setBusy(false); }
  }}><h2 className="text-xl font-semibold">Základní údaje</h2>
    <label className="block">Název<input className="block w-full rounded border p-2" name="name" required /></label>
    <label className="block">Pro koho (nepovinné)<input className="block w-full rounded border p-2" name="clientName" /></label>
    <label className="block">Termín<input className="block rounded border p-2" name="targetDate" type="date" required /></label>
    <label className="block">Společné instrukce<textarea className="block w-full rounded border p-2" name="description" /></label>
    {error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={!ready || busy} className="rounded bg-sky-700 px-4 py-2 text-white">Založit a zadat práci</button>
  </form>;
}
