'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Compass, Image, Sparkles, X } from 'lucide-react';
const GoogleNavigationOfferMap = dynamic(() => import('./GoogleNavigationOfferMap').then((module) => module.GoogleNavigationOfferMap), { ssr: false });

type PricingSegment = 'COMMERCIAL' | 'CULTURE_SPORT' | 'PUBLIC_NONPROFIT' | 'CUSTOM';
type OfferType = 'STANDARD_MEDIA' | 'NAVIGATION' | 'CITY_GALLERY';
type MountingType = 'LIGHT_POLE' | 'TRACTION' | 'COLUMN';
export type ClientOption = { id: string; name: string; pricingSegment?: PricingSegment };
type Preview = {
  offerType: OfferType; recommendedOfferType: OfferType; client: { name: string; pricingSegment: PricingSegment; segmentLocked: boolean };
  city: string; dateFrom: string; dateTo: string; durationMonths: number; budget: number | null;
  target?: { name: string; address: string; latitude: number; longitude: number };
  items: Array<{ selectionId: string; surfaceId: string | null; carrierCode: string; title: string; mediaType: string; city: string; latitude: number | null; longitude: number | null; catalogPrice: number | null; finalPrice: number | null; rentalTotal?: number | null; mountingType?: MountingType | null; pricingOptions?: Array<{ mountingType: MountingType; label: string; rentalTotal: number | null; total: number | null; componentPrices: Record<string, unknown> }>; componentPrices?: Record<string, unknown>; score: number; reasons: string[]; distanceMeters?: number; routePolyline?: string; arrowDirection?: string }>;
  catalogTotal: number | null; budgetDifference: number | null; warnings: string[]; explanation: string; candidateCount: number;
};

const segmentLabels: Record<PricingSegment, string> = { COMMERCIAL: 'Komerční', CULTURE_SPORT: 'Kultura / Sport', PUBLIC_NONPROFIT: 'Veřejný / neziskový', CUSTOM: 'Individuální' };
const typeLabels: Record<OfferType, string> = { STANDARD_MEDIA: 'Standardní reklamní kampaň', NAVIGATION: 'Navigační systém', CITY_GALLERY: 'Galerie venku' };
const typeCards: Array<{ value: OfferType; icon: typeof Compass; text: string }> = [
  { value: 'NAVIGATION', icon: Compass, text: 'Navigační cedule vedoucí ke konkrétnímu cíli.' },
  { value: 'STANDARD_MEDIA', icon: Image, text: 'Billboardy, Citylighty, City Postery, lavičky a Towery.' },
  { value: 'CITY_GALLERY', icon: Sparkles, text: 'Projektové nabídky Galerie venku.' },
];

export function AiOfferGeneratorModal({ isOpen, onClose, clients = [] }: { isOpen: boolean; onClose: () => void; clients?: ClientOption[] }) {
  const router = useRouter();
  const [clientList, setClientList] = useState(clients);
  const [offerType, setOfferType] = useState<OfferType>('STANDARD_MEDIA');
  const [typeTouched, setTypeTouched] = useState(false);
  const [clientId, setClientId] = useState(''); const [clientName, setClientName] = useState('');
  const [pricingSegment, setPricingSegment] = useState<PricingSegment>('COMMERCIAL');
  const [prompt, setPrompt] = useState(''); const [city, setCity] = useState(''); const [budget, setBudget] = useState('');
  const [durationMonths, setDurationMonths] = useState(12); const [quantity, setQuantity] = useState(6);
  const [targetName, setTargetName] = useState(''); const [targetAddress, setTargetAddress] = useState('');
  const [targetLatitude, setTargetLatitude] = useState(''); const [targetLongitude, setTargetLongitude] = useState(''); const [maxRadiusKm, setMaxRadiusKm] = useState(5);
  const [preview, setPreview] = useState<Preview | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');

  const selectedClient = useMemo(() => clientList.find((client) => client.id === clientId), [clientId, clientList]);
  const recommended = useMemo<OfferType>(() => /naviga|cedul|směrov|smerov|pobočk|pobock/i.test(prompt) ? 'NAVIGATION' : /galerie venku|city gallery|výstav|vystav/i.test(prompt) ? 'CITY_GALLERY' : 'STANDARD_MEDIA', [prompt]);
  useEffect(() => { if (!typeTouched) setOfferType(recommended); }, [recommended, typeTouched]);
  useEffect(() => { if (selectedClient?.pricingSegment) setPricingSegment(selectedClient.pricingSegment); }, [selectedClient]);
  useEffect(() => {
    if (clients.length) setClientList(clients);
    else if (isOpen) void fetch('/api/clients?take=100').then((r) => r.json()).then((data) => setClientList(data.clients ?? data)).catch(() => undefined);
  }, [clients, isOpen]);
  useEffect(() => { if (!isOpen) return; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, [isOpen]);

  const requestBody = (action: 'preview' | 'confirm') => ({ action, offerType, prompt: prompt.trim(), clientId: clientId || undefined, clientName: clientName.trim() || undefined, pricingSegment, city: city.trim() || undefined, budget: budget ? Number(budget) : undefined, durationMonths, quantity, targetName: targetName.trim() || undefined, targetAddress: targetAddress.trim() || undefined, targetLatitude: targetLatitude ? Number(targetLatitude) : undefined, targetLongitude: targetLongitude ? Number(targetLongitude) : undefined, maxRadiusKm, selectedCandidateIds: action === 'confirm' ? preview?.items.map((item) => item.selectionId) : undefined, candidateMountingTypes: action === 'confirm' ? Object.fromEntries(preview?.items.filter((item) => item.mountingType).map((item) => [item.selectionId, item.mountingType]) ?? []) : undefined });
  function updateMountingType(selectionId: string, mountingType: MountingType | '') {
    setPreview((current) => {
      if (!current) return current;
      const items = current.items.map((item) => {
        if (item.selectionId !== selectionId) return item;
        const pricing = item.pricingOptions?.find((option) => option.mountingType === mountingType);
        return { ...item, mountingType: mountingType || null, rentalTotal: pricing?.rentalTotal ?? null, catalogPrice: pricing?.total ?? null, finalPrice: pricing?.total ?? null, componentPrices: pricing?.componentPrices };
      });
      const complete = items.every((item) => item.finalPrice !== null);
      const catalogTotal = complete ? items.reduce((sum, item) => sum + (item.finalPrice ?? 0), 0) : null;
      return { ...current, items, catalogTotal, budgetDifference: catalogTotal !== null && current.budget ? catalogTotal - current.budget : null };
    });
  }
  async function call(action: 'preview' | 'confirm') {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/offers/ai-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody(action)) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'AI návrh se nepodařilo připravit.');
      if (action === 'preview') setPreview(data as Preview); else { onClose(); router.push(data.redirectUrl); router.refresh(); }
    } catch (err) { setError(err instanceof Error ? err.message : 'AI návrh se nepodařilo připravit.'); } finally { setLoading(false); }
  }
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm">
    <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><h2 className="flex items-center gap-2 text-lg font-black"><Sparkles className="text-amber-400" /> AI Copilot nabídek</h2><p className="text-xs text-slate-400">Nejdřív návrh, kontrola cen a dostupnosti. Nabídka vznikne až po potvrzení.</p></div><button onClick={onClose} type="button"><X /></button></header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {error && <div className="rounded-xl border border-rose-700 bg-rose-950 p-3 text-sm text-rose-200">⚠️ {error}</div>}
        <section><h3 className="mb-3 text-sm font-black uppercase tracking-wide text-amber-400">1. Co chcete vytvořit?</h3><div className="grid gap-3 md:grid-cols-3">{typeCards.map(({ value, icon: Icon, text }) => <button key={value} type="button" onClick={() => { setOfferType(value); setTypeTouched(true); setPreview(null); }} className={`rounded-2xl border p-4 text-left ${offerType === value ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-950'}`}><Icon className="mb-2 text-amber-400" /><strong className="block text-sm">{typeLabels[value]}</strong><span className="mt-1 block text-xs text-slate-400">{text}</span>{recommended === value && <span className="mt-2 inline-block rounded bg-sky-900 px-2 py-1 text-[10px] text-sky-200">AI doporučuje</span>}</button>)}</div></section>
        <section className="grid gap-3 md:grid-cols-3"><label className="text-xs font-bold">2. Existující klient<select className="input mt-1" value={clientId} onChange={(e) => { setClientId(e.target.value); if (e.target.value) setClientName(''); setPreview(null); }}><option value="">Nový potenciální klient</option>{clientList.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="text-xs font-bold">Název nového klienta<input className="input mt-1" disabled={Boolean(clientId)} value={clientName} onChange={(e) => setClientName(e.target.value)} /></label><label className="text-xs font-bold">Cenová kategorie<select className="input mt-1" disabled={Boolean(selectedClient)} value={pricingSegment} onChange={(e) => setPricingSegment(e.target.value as PricingSegment)}>{Object.entries(segmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><span className="mt-1 block font-normal text-slate-400">{selectedClient ? 'Uložený segment klienta je zdroj pravdy.' : 'Potvrďte doporučený segment nového klienta.'}</span></label></section>
        <section><label className="text-sm font-black uppercase tracking-wide text-amber-400">3. Co klient potřebuje?<textarea className="input mt-2 min-h-24 normal-case tracking-normal text-white" value={prompt} onChange={(e) => { setPrompt(e.target.value); setPreview(null); }} placeholder="KFC chce navigaci k nové pobočce, cca 6 cedulí na rok." /></label></section>
        <section className="grid gap-3 md:grid-cols-4"><label className="text-xs font-bold">Město / lokalita<input className="input mt-1" value={city} onChange={(e) => setCity(e.target.value)} /></label><label className="text-xs font-bold">Počet ploch<input className="input mt-1" min="1" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label><label className="text-xs font-bold">Délka (měsíce)<input className="input mt-1" min="1" type="number" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} /></label><label className="text-xs font-bold">Max. rozpočet Kč<input className="input mt-1" min="0" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></label></section>
        {offerType === 'NAVIGATION' && <section className="grid gap-3 rounded-2xl border border-sky-800 bg-sky-950/30 p-4 md:grid-cols-3"><label className="text-xs font-bold">Cíl navigace<input className="input mt-1" value={targetName} onChange={(e) => setTargetName(e.target.value)} /></label><label className="text-xs font-bold md:col-span-2">Adresa cíle<input className="input mt-1" value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} /></label><label className="text-xs font-bold">Latitude<input className="input mt-1" type="number" step="any" value={targetLatitude} onChange={(e) => setTargetLatitude(e.target.value)} /></label><label className="text-xs font-bold">Longitude<input className="input mt-1" type="number" step="any" value={targetLongitude} onChange={(e) => setTargetLongitude(e.target.value)} /></label><label className="text-xs font-bold">Max. rádius km<input className="input mt-1" type="number" min="0.5" step="0.5" value={maxRadiusKm} onChange={(e) => setMaxRadiusKm(Number(e.target.value))} /></label></section>}
        {!preview && <button className="btn-primary w-full" disabled={loading || !prompt.trim() || (!clientId && !clientName.trim())} onClick={() => void call('preview')} type="button">{loading ? 'Kontroluji dostupnost a ceny…' : 'Připravit AI návrh'}</button>}
        {preview && <section className="space-y-4 rounded-2xl border border-emerald-700 bg-slate-950 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-black">Návrh nabídky: {typeLabels[preview.offerType]}</h3><p className="text-xs text-slate-400">{preview.client.name} · {segmentLabels[preview.client.pricingSegment]} · {preview.city || 'bez lokality'} · {preview.dateFrom} – {preview.dateTo}</p></div><div className="text-right"><div className="text-xs text-slate-400">Ceníková cena</div><strong className="text-xl">{preview.catalogTotal === null ? 'Nelze určit' : `${preview.catalogTotal.toLocaleString('cs-CZ')} Kč`}</strong>{preview.budgetDifference != null && <div className={preview.budgetDifference > 0 ? 'text-rose-400' : 'text-emerald-400'}>{preview.budgetDifference > 0 ? '+' : ''}{preview.budgetDifference.toLocaleString('cs-CZ')} Kč vůči rozpočtu</div>}</div></div>
          {preview.warnings.map((warning) => <div key={warning} className="rounded-lg bg-amber-950 p-2 text-xs text-amber-200">⚠️ {warning}</div>)}
          {preview.offerType === 'NAVIGATION' && preview.target && <GoogleNavigationOfferMap target={{ latitude: preview.target.latitude, longitude: preview.target.longitude, label: preview.target.name, address: preview.target.address }} points={preview.items.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({ id: item.selectionId, label: item.carrierCode, latitude: item.latitude!, longitude: item.longitude!, calculatedDistanceMeters: item.distanceMeters, routePolyline: item.routePolyline, arrowDirectionEnum: item.arrowDirection }))} mode="point" onMapClick={() => undefined} onPointMove={() => undefined} onTargetSelect={() => undefined} />}
          <div className="max-h-80 space-y-2 overflow-y-auto">{preview.items.map((item, index) => <div className="rounded-xl border border-slate-800 p-3" key={item.selectionId}><div className="flex justify-between gap-2"><strong>{index + 1}. {item.carrierCode} · {item.title}</strong><span>{item.finalPrice == null ? '⚠️ předběžně bez ceny' : `${item.finalPrice.toLocaleString('cs-CZ')} Kč`}</span></div><p className="mt-1 text-xs text-slate-400">Skóre {item.score}/100 · {item.distanceMeters ? `${Math.round(item.distanceMeters)} m od cíle · ` : ''}{item.reasons.join(' ')}</p>{preview.offerType === 'NAVIGATION' && <label className="mt-3 block text-xs font-bold text-slate-300">Předpokládaný typ konstrukce<select className="input mt-1" value={item.mountingType ?? ''} onChange={(event) => updateMountingType(item.selectionId, event.target.value as MountingType | '')}><option value="">Určí obchodník podle fotografie</option>{item.pricingOptions?.map((option) => <option key={option.mountingType} value={option.mountingType}>{option.label} · {option.total === null ? 'cena není nastavena' : `${option.total.toLocaleString('cs-CZ')} Kč`}</option>)}</select></label>}<button className="mt-2 text-xs font-bold text-rose-300" onClick={() => setPreview((current) => current ? { ...current, items: current.items.filter((candidate) => candidate.selectionId !== item.selectionId) } : current)} type="button">Odebrat bod / plochu</button></div>)}</div>
          <div className="rounded-xl bg-sky-950 p-3"><strong className="text-sm">Proč AI navrhla tuto variantu?</strong><p className="mt-1 text-xs text-sky-100">{preview.explanation}</p></div>
          <div className="flex gap-2"><button className="rounded-xl border border-slate-600 px-4 py-2 text-sm" onClick={() => setPreview(null)} type="button">Upravit zadání</button><button className="btn-primary flex-1" disabled={loading || preview.items.length === 0 && preview.offerType !== 'CITY_GALLERY'} onClick={() => void call('confirm')} type="button">{loading ? 'Ověřuji znovu…' : 'Potvrdit a vytvořit koncept nabídky'}</button></div>
        </section>}
      </div>
    </div>
  </div>;
}
