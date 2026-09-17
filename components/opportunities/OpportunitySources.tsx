'use client';
import { useState } from 'react';
type Source = { id: string; sourceTitle: string; sourceUrl: string; sourceDomain: string | null; sourcePublishedAt: string | null; createdAt: string; semanticConfidence: number | null; semanticDecision: string | null };
type Detail = { sources: Source[]; mergedRecords?: { id: string; title: string; status: string; client: { name: string } | null; createdOffer: { id: string; title: string } | null }[]; fieldProvenance?: Record<string, string>; semanticData?: Record<string, string>; dataConflicts?: { field: string; sourceId: string; value: string; existingValue: string }[] };
const labels: Record<string, string> = { companyName: 'Investor', projectName: 'Projekt', city: 'Město', region: 'Kraj', country: 'Země', address: 'Adresa', location: 'Místo stavby', projectDescription: 'Popis projektu', category: 'Kategorie', opportunityType: 'Typ', estimatedValue: 'Hodnota investice', currency: 'Měna', projectSize: 'Kapacita', projectIdentifier: 'ID projektu', tenderIdentifier: 'ID tendru', announcementDate: 'Oznámeno', expectedStartDate: 'Zahájení', expectedCompletionDate: 'Dokončení' };
export function OpportunitySources({ opportunityId, count, onChanged }: { opportunityId: string; count: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canReview, setCanReview] = useState(false);
  async function load() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/sales/opportunities/${encodeURIComponent(opportunityId)}`);
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setDetail(data.item); setCanReview(data.canReviewSources === true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Zdroje se nepodařilo načíst.'); }
    finally { setBusy(false); }
  }
  async function detach(sourceId: string) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/sales/radar/duplicates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'DETACH', sourceId }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      await load(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Oddělení se nezdařilo.'); }
    finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
    <button type="button" aria-expanded={open} disabled={busy} className="font-bold text-purple-300" onClick={() => { setOpen(!open); if (!open) void load(); }}>Zdroje ({count}) {open ? '▴' : '▾'}</button>
    {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
    {busy && <p role="status">Načítání…</p>}
    {open && detail && <div className="mt-3 space-y-3">
      {detail.sources.map(source => <div key={source.id} className="space-y-1 border-t border-slate-800 pt-2">
        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-purple-300 hover:underline">{source.sourceTitle}</a>
        <p>{source.sourceDomain || 'Zdroj'} · Publikováno: {source.sourcePublishedAt ? new Date(source.sourcePublishedAt).toLocaleDateString('cs-CZ') : 'neuvedeno'} · Nalezeno: {new Date(source.createdAt).toLocaleDateString('cs-CZ')}</p>
        <p className="break-all text-slate-400">{source.sourceUrl}</p>
        {source.semanticDecision === 'SAME_OPPORTUNITY' && source.semanticConfidence != null && <p>Jistota přiřazení: {Math.round(source.semanticConfidence * 100)} %</p>}
        {Object.entries(detail.fieldProvenance || {}).filter(([, id]) => id === source.id).map(([field]) => <p key={field}><span className="text-slate-400">{labels[field] || field}:</span> {detail.semanticData?.[field]}</p>)}
        {canReview && detail.sources.length > 1 && <button type="button" disabled={busy} className="text-amber-300 underline disabled:opacity-50" onClick={() => void detach(source.id)}>Tento zdroj nepatří k této příležitosti</button>}
      </div>)}
      {!!detail.dataConflicts?.length && <div className="rounded-lg border border-amber-800 p-2 text-amber-200"><strong>Rozdílné údaje ve zdrojích – vyžadují kontrolu</strong>{detail.dataConflicts.map((c, i) => <p key={`${c.sourceId}-${c.field}-${i}`}>{labels[c.field] || c.field}: {c.existingValue} / {c.value}</p>)}</div>}
      {!!detail.mergedRecords?.length && <div className="border-t border-slate-800 pt-2"><strong>Původní obchodní záznamy</strong>{detail.mergedRecords.map(record => <p key={record.id} className="mt-1">{record.title}{record.client ? ` · CRM: ${record.client.name}` : ''}{record.createdOffer && <> · <a className="text-purple-300 underline" href={`/offers/${encodeURIComponent(record.createdOffer.id)}`}>Nabídka: {record.createdOffer.title}</a></>}</p>)}</div>}
    </div>}
  </div>;
}
