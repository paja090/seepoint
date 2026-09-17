'use client';
import { useState } from 'react';
type Proposal = { id: string; canonicalOpportunityId: string; candidateOpportunityId: string; sourceTitle: string; sourceUrl: string; semanticConfidence: number | null; resolution: { reason?: string; conflictingSignals?: string[] } | null };
type Opportunity = { id: string; companyName: string; title: string; city: string | null; semanticData: Record<string, string> | null };
export function RadarDuplicateReview({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [items, setItems] = useState<Proposal[]>([]), [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [canReview, setCanReview] = useState(false), [cursor, setCursor] = useState<string | null>(null);
  const [backfillCursor, setBackfillCursor] = useState<string | null>(null);
  async function load(next?: string) {
    const res = await fetch(`/api/sales/radar/duplicates${next ? `?cursor=${encodeURIComponent(next)}` : ''}`);
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Načtení návrhů selhalo.');
    setItems(data.items); setOpportunities(data.opportunities); setCanReview(data.canReview); setCursor(data.nextCursor);
  }
  async function perform(action?: string, sourceId?: string, next?: string) {
    setBusy(true); setMessage('');
    try {
      if (action) {
        const res = await fetch('/api/sales/radar/duplicates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, sourceId, cursor: action === 'BACKFILL_PREVIEW' ? backfillCursor : undefined }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error);
        if (action === 'BACKFILL_PREVIEW') { setBackfillCursor(data.nextCursor); setMessage(`Prověřeno ${data.processed} příležitostí, ${data.proposals} návrhů. ${data.nextCursor ? 'Pokračujte další dávkou.' : 'Historie prošla kontrolou.'}`); }
        else { setMessage(action === 'MERGE' ? 'Příležitosti byly sjednoceny. Zdroje lze znovu oddělit.' : 'Příležitosti zůstávají oddělené.'); onChanged(); }
      }
      await load(next);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Akce se nezdařila.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
    <button type="button" aria-expanded={open} disabled={busy} className="font-bold text-purple-300" onClick={() => { setOpen(!open); if (!open) void perform(); }}>Možné duplicity {open ? '▴' : '▾'}</button>
    {open && <div className="mt-3 space-y-3">
      {canReview && <button type="button" disabled={busy} className="rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:opacity-50" onClick={() => void perform('BACKFILL_PREVIEW')}>{backfillCursor ? 'Prověřit další historickou dávku' : 'Backfill Semantic Deduplication – vytvořit návrhy'}</button>}
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">Zpracování…</p>}
      {!items.length && !busy && <p>Žádné návrhy ke kontrole.</p>}
      {items.map(item => <article key={item.id} className="space-y-2 rounded-xl border border-slate-800 p-3">
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-purple-300 hover:underline">{item.sourceTitle}</a>
        <div className="grid gap-2 sm:grid-cols-2">{[item.canonicalOpportunityId, item.candidateOpportunityId].map((id, i) => { const o = opportunities.find(x => x.id === id); return <div key={`${id}-${i}`} className="rounded-lg bg-slate-950 p-2 text-xs"><strong>{i ? 'Navrhovaná kanonická příležitost' : 'Nová příležitost'}</strong><p>{o?.companyName} – {o?.title}</p><p>{o?.city}</p>{['projectName', 'address', 'projectSize', 'tenderIdentifier', 'projectIdentifier'].map(k => o?.semanticData?.[k] ? <p key={k}>{o.semanticData[k]}</p> : null)}</div>; })}</div>
        <p className="text-xs">{item.resolution?.reason} {item.semanticConfidence != null ? `(${Math.round(item.semanticConfidence * 100)} %)` : ''}</p>
        {!!item.resolution?.conflictingSignals?.length && <p className="text-xs text-amber-300">Konflikty: {item.resolution.conflictingSignals.join(', ')}</p>}
        {canReview && <div className="flex flex-wrap gap-3 text-xs"><button type="button" disabled={busy} className="text-emerald-300 underline disabled:opacity-50" onClick={() => void perform('MERGE', item.id)}>Je to stejná příležitost</button><button type="button" disabled={busy} className="text-sky-300 underline disabled:opacity-50" onClick={() => void perform('KEEP_SEPARATE', item.id)}>Jde o jinou příležitost</button></div>}
      </article>)}
      {cursor && <button type="button" disabled={busy} onClick={() => void perform(undefined, undefined, cursor)}>Další návrhy</button>}
    </div>}
  </section>;
}
