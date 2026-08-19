'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronDown, Compass, Image, MapPin, Sparkles, X } from 'lucide-react';
import type { SuggestedNavigationPoint } from './GoogleNavigationOfferMap';

const GoogleNavigationOfferMap = dynamic(() => import('./GoogleNavigationOfferMap').then((module) => module.GoogleNavigationOfferMap), { ssr: false });

type PricingSegment = 'COMMERCIAL' | 'CULTURE_SPORT' | 'PUBLIC_NONPROFIT' | 'CUSTOM';
type OfferType = 'STANDARD_MEDIA' | 'NAVIGATION' | 'CITY_GALLERY';
type MountingType = 'LIGHT_POLE' | 'TRACTION' | 'COLUMN';
export type ClientOption = { id: string; name: string; pricingSegment?: PricingSegment };
type PreviewItem = {
  selectionId: string; surfaceId: string | null; carrierCode: string; title: string; mediaType: string; city: string;
  latitude: number | null; longitude: number | null; catalogPrice: number | null; finalPrice: number | null;
  rentalTotal?: number | null; mountingType?: MountingType | null;
  pricingOptions?: Array<{ mountingType: MountingType; label: string; rentalTotal: number | null; total: number | null; componentPrices: Record<string, unknown> }>;
  componentPrices?: Record<string, unknown>; score: number; reasons: string[]; distanceMeters?: number;
  routePolyline?: string; routeDurationSeconds?: number; arrowDirection?: 'LEFT' | 'RIGHT' | 'STRAIGHT';
};
type Preview = {
  offerType: OfferType; recommendedOfferType: OfferType; client: { name: string; pricingSegment: PricingSegment; segmentLocked: boolean };
  city: string; dateFrom: string; dateTo: string; durationMonths: number; budget: number | null;
  target?: { name: string; address: string; latitude: number; longitude: number };
  items: PreviewItem[]; catalogTotal: number | null; budgetDifference: number | null;
  warnings: string[]; explanation: string; candidateCount: number;
};

const segmentLabels: Record<PricingSegment, string> = { COMMERCIAL: 'Komerční', CULTURE_SPORT: 'Kultura / Sport', PUBLIC_NONPROFIT: 'Veřejný / neziskový', CUSTOM: 'Individuální' };
const typeLabels: Record<OfferType, string> = { STANDARD_MEDIA: 'Standardní reklamní kampaň', NAVIGATION: 'Navigační systém', CITY_GALLERY: 'Galerie venku' };
const typeCards: Array<{ value: OfferType; icon: typeof Compass; text: string }> = [
  { value: 'NAVIGATION', icon: Compass, text: 'AI vyhledá silná místa na příjezdových trasách.' },
  { value: 'STANDARD_MEDIA', icon: Image, text: 'Billboardy, citylighty a další reklamní plochy.' },
  { value: 'CITY_GALLERY', icon: Sparkles, text: 'Projektové nabídky Galerie venku.' },
];

export function AiOfferGeneratorModal({ isOpen, onClose, clients = [] }: { isOpen: boolean; onClose: () => void; clients?: ClientOption[] }) {
  const router = useRouter();
  const [clientList, setClientList] = useState(clients);
  const [offerType, setOfferType] = useState<OfferType>('STANDARD_MEDIA');
  const [typeTouched, setTypeTouched] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [pricingSegment, setPricingSegment] = useState<PricingSegment>('COMMERCIAL');
  const [prompt, setPrompt] = useState('');
  const [city, setCity] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [budget, setBudget] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);
  const [quantity, setQuantity] = useState(6);
  const [targetName, setTargetName] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [maxRadiusKm, setMaxRadiusKm] = useState(5);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [routeAnalysis, setRouteAnalysis] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [routeAnalysisMessage, setRouteAnalysisMessage] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedClient = useMemo(() => clientList.find((client) => client.id === clientId), [clientId, clientList]);
  const recommended = useMemo<OfferType>(() => /naviga|cedul|směrov|smerov|pobočk|pobock/i.test(prompt) ? 'NAVIGATION' : /galerie venku|city gallery|výstav|vystav/i.test(prompt) ? 'CITY_GALLERY' : 'STANDARD_MEDIA', [prompt]);
  useEffect(() => { if (!typeTouched) setOfferType(recommended); }, [recommended, typeTouched]);
  useEffect(() => { if (selectedClient?.pricingSegment) setPricingSegment(selectedClient.pricingSegment); }, [selectedClient]);
  useEffect(() => {
    if (clients.length) setClientList(clients);
    else if (isOpen) void fetch('/api/clients?take=100').then((response) => response.json()).then((data) => setClientList(data.clients ?? data)).catch(() => undefined);
  }, [clients, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const navigationPrompt = prompt.trim() || `Navrhnout navigační systém k cíli ${targetName.trim()}`;
  const requestBody = (action: 'preview' | 'confirm') => ({
    action,
    offerType,
    prompt: offerType === 'NAVIGATION' ? navigationPrompt : prompt.trim(),
    clientId: clientId || undefined,
    clientName: clientName.trim() || undefined,
    pricingSegment,
    city: offerType === 'NAVIGATION' ? undefined : city.trim() || undefined,
    mediaType: mediaType || undefined,
    clientMessage: clientMessage.trim() || undefined,
    budget: budget ? Number(budget) : undefined,
    durationMonths,
    quantity,
    targetName: targetName.trim() || undefined,
    targetAddress: targetAddress.trim() || undefined,
    maxRadiusKm,
    selectedCandidateIds: action === 'confirm' ? preview?.items.map((item) => item.selectionId) : undefined,
    candidateMountingTypes: action === 'confirm' ? Object.fromEntries(preview?.items.filter((item) => item.mountingType).map((item) => [item.selectionId, item.mountingType]) ?? []) : undefined,
    navigationPoints: action === 'confirm' && preview?.offerType === 'NAVIGATION' ? preview.items.flatMap((item) => item.latitude == null || item.longitude == null ? [] : [{
      id: item.selectionId,
      title: item.title,
      latitude: item.latitude,
      longitude: item.longitude,
      score: item.score,
      reasons: item.reasons,
      distanceMeters: item.distanceMeters,
      routeDurationSeconds: item.routeDurationSeconds,
      routePolyline: item.routePolyline,
      arrowDirection: item.arrowDirection,
    }]) : undefined,
  });

  const updateMountingType = (selectionId: string, mountingType: MountingType | '') => {
    setPreview((current) => {
      if (!current) return current;
      const items = current.items.map((item) => {
        if (item.selectionId !== selectionId) return item;
        const selectedOption = item.pricingOptions?.find((option) => option.mountingType === mountingType);
        return {
          ...item,
          mountingType: mountingType || null,
          rentalTotal: selectedOption ? selectedOption.rentalTotal : item.rentalTotal,
          finalPrice: selectedOption ? selectedOption.total : item.finalPrice,
          componentPrices: selectedOption ? selectedOption.componentPrices : item.componentPrices,
        };
      });
      const catalogTotal = items.some((item) => item.finalPrice === null)
        ? null
        : items.reduce((sum, item) => sum + (item.finalPrice ?? 0), 0);
      return {
        ...current,
        items,
        catalogTotal,
        budgetDifference: catalogTotal !== null && current.budget ? catalogTotal - current.budget : null,
      };
    });
  };

  const handleSuggestedPoints = useCallback((suggestions: SuggestedNavigationPoint[], analysisError?: string) => {
    if (!suggestions.length) {
      setRouteAnalysis('error');
      setRouteAnalysisMessage(analysisError || 'Vhodná místa se nepodařilo automaticky určit.');
      return;
    }
    setPreview((current) => {
      if (!current || current.offerType !== 'NAVIGATION') return current;
      const items = suggestions.map((suggestion, index): PreviewItem => {
        const original = current.items[index] ?? current.items[0];
        return {
          ...original,
          selectionId: suggestion.id,
          carrierCode: `NAV-${index + 1}`,
          title: suggestion.title,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          score: suggestion.score,
          reasons: suggestion.reasons,
          distanceMeters: suggestion.distanceMeters,
          routeDurationSeconds: suggestion.routeDurationSeconds,
          routePolyline: suggestion.routePolyline,
          arrowDirection: suggestion.arrowDirection,
        };
      });
      return {
        ...current,
        items,
        candidateCount: suggestions.length,
        warnings: current.warnings.filter((warning) => !/Mapa ještě hledá|Google Routes|radiální/i.test(warning)),
        explanation: `AI vybrala ${suggestions.length} rozhodovacích míst na reálných příjezdových trasách. Upřednostnila křižovatky, odbočení a hlavní tahy v účinné vzdálenosti před cílem.`,
      };
    });
    setRouteAnalysis('done');
    setRouteAnalysisMessage(`${suggestions.length} míst vybráno z reálných jízdních tras.`);
  }, []);

  async function call(action: 'preview' | 'confirm') {
    setLoading(true);
    setError('');
    if (action === 'preview' && offerType === 'NAVIGATION') {
      setRouteAnalysis('running');
      setRouteAnalysisMessage('Hledám křižovatky, odbočení a hlavní příjezdové tahy…');
    }
    try {
      const response = await fetch('/api/offers/ai-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody(action)) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI návrh se nepodařilo připravit.');
      if (action === 'preview') {
        const p = data as Preview;
        setPreview(p);
        setClientMessage(p.explanation || '');
      } else { onClose(); router.push(data.redirectUrl); router.refresh(); }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI návrh se nepodařilo připravit.');
      if (action === 'preview') setRouteAnalysis('idle');
    } finally { setLoading(false); }
  }

  const canPreview = Boolean(clientId || clientName.trim()) && (offerType === 'NAVIGATION' ? Boolean(targetName.trim() && targetAddress.trim()) : Boolean(prompt.trim()));
  if (!isOpen) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-sm sm:p-3">
    <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl sm:rounded-3xl">
      <header className="flex items-start justify-between border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
        <div><h2 className="flex items-center gap-2 text-lg font-black"><Sparkles className="text-amber-400" /> AI Copilot nabídek</h2><p className="mt-0.5 text-xs text-slate-400">AI připraví návrh. Obchodník jej potvrdí a doladí.</p></div>
        <button aria-label="Zavřít" className="rounded-lg p-1 hover:bg-slate-800" onClick={onClose} type="button"><X /></button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        {error && <div className="rounded-xl border border-rose-700 bg-rose-950 p-3 text-sm text-rose-200">⚠️ {error}</div>}

        {!preview && <>
          <section>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-amber-400">Co chcete vytvořit?</h3>
            <div className="grid grid-cols-3 gap-2">{typeCards.map(({ value, icon: Icon, text }) => <button key={value} type="button" onClick={() => { setOfferType(value); setTypeTouched(true); }} className={`rounded-xl border p-3 text-left ${offerType === value ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-950'}`}><Icon className="mb-1 h-5 w-5 text-amber-400" /><strong className="block text-xs sm:text-sm">{typeLabels[value]}</strong><span className="mt-1 hidden text-xs text-slate-400 sm:block">{text}</span></button>)}</div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-2">
            <label className="text-xs font-bold">Klient<select className="input mt-1" value={clientId} onChange={(event) => { setClientId(event.target.value); if (event.target.value) setClientName(''); }}><option value="">Nový potenciální klient</option>{clientList.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            {!clientId && <label className="text-xs font-bold">Název klienta<input className="input mt-1" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Např. KFC" /></label>}
          </section>

          {offerType === 'NAVIGATION' ? <>
            <section className="space-y-3 rounded-2xl border border-sky-800 bg-sky-950/30 p-4">
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-sky-400" /><div><h3 className="text-sm font-black">Kam má navigace dovést řidiče?</h3><p className="text-xs text-slate-400">Stačí název cíle a běžná adresa. Polohu si AI dohledá sama.</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">Cíl navigace<input className="input mt-1" value={targetName} onChange={(event) => setTargetName(event.target.value)} placeholder="Např. prodejna SeePoint" /></label>
                <label className="text-xs font-bold">Adresa cíle<input className="input mt-1" value={targetAddress} onChange={(event) => setTargetAddress(event.target.value)} placeholder="Ulice a číslo, město" /></label>
              </div>
              <label className="block text-xs font-bold">Co je pro trasu důležité? <span className="font-normal text-slate-500">(nepovinné)</span><textarea className="input mt-1 min-h-16" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Např. zachytit příjezd od centra a z dálnice" /></label>
              <div><span className="text-xs font-bold">Kolik bodů navrhnout?</span><div className="mt-2 flex gap-2">{[4, 6, 8].map((count) => <button key={count} type="button" onClick={() => setQuantity(count)} className={`min-w-14 rounded-lg border px-3 py-2 text-sm font-black ${quantity === count ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 bg-slate-900'}`}>{count}</button>)}</div></div>
            </section>
          </> : <>
            <section><label className="text-sm font-black uppercase tracking-wide text-amber-400">Co klient potřebuje?<textarea className="input mt-2 min-h-24 normal-case tracking-normal text-white" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Popište kampaň, lokalitu a očekávání klienta." /></label></section>
            <section className="grid gap-3 sm:grid-cols-5">
              <label className="text-xs font-bold">Město / lokalita<input className="input mt-1" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Všechna města" /></label>
              <label className="text-xs font-bold">Typ média / Mix
                <select className="input mt-1" value={mediaType} onChange={(event) => setMediaType(event.target.value)}>
                  <option value="">✨ Automatický mix (Lavičky, City postery, Billboardy...)</option>
                  <option value="PROMO_BENCH">Lavičky / Babičky (PROMO_BENCH)</option>
                  <option value="CITY_POSTER">City postery (CITY_POSTER)</option>
                  <option value="CITYLIGHT">Citylight / CLV (CITYLIGHT)</option>
                  <option value="BILLBOARD">Billboardy (BILLBOARD)</option>
                  <option value="BIGBOARD">Bigboardy (BIGBOARD)</option>
                  <option value="LED_SCREEN">LED obrazovky (LED_SCREEN)</option>
                  <option value="BANNER">Bannery / Plachty (BANNER)</option>
                </select>
              </label>
              <label className="text-xs font-bold">Počet ploch<input className="input mt-1" min="1" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
            </section>
          </>}

          <details className="group rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold text-slate-300">Cenová kategorie a rozpočet <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <label className="text-xs font-bold">Cenová kategorie<select className="input mt-1" disabled={Boolean(selectedClient)} value={pricingSegment} onChange={(event) => setPricingSegment(event.target.value as PricingSegment)}>{Object.entries(segmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="text-xs font-bold">Délka (měsíce)<input className="input mt-1" min="1" type="number" value={durationMonths} onChange={(event) => setDurationMonths(Number(event.target.value))} /></label>
              <label className="text-xs font-bold">Max. rozpočet Kč<input className="input mt-1" min="0" type="number" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Bez omezení" /></label>
              {offerType === 'NAVIGATION' && <label className="text-xs font-bold">Oblast hledání (km)<input className="input mt-1" min="1" max="15" step="1" type="number" value={maxRadiusKm} onChange={(event) => setMaxRadiusKm(Number(event.target.value))} /></label>}
            </div>
          </details>

          <button className="btn-primary w-full" disabled={loading || !canPreview} onClick={() => void call('preview')} type="button">{loading ? 'Připravuji návrh…' : offerType === 'NAVIGATION' ? 'Najít nejlepší navigační body' : 'Připravit AI návrh'}</button>
        </>}

        {preview && <section className="space-y-4 rounded-2xl border border-emerald-700 bg-slate-950 p-3 sm:p-4">
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-black">Návrh: {typeLabels[preview.offerType]}</h3><p className="text-xs text-slate-400">{preview.client.name} · {preview.city || preview.target?.address || 'bez lokality'} · {preview.dateFrom} – {preview.dateTo}</p></div><div className="text-left sm:text-right"><div className="text-xs text-slate-400">Předběžná cena</div><strong className="text-xl">{preview.catalogTotal === null ? 'Doplní se po ověření' : `${preview.catalogTotal.toLocaleString('cs-CZ')} Kč`}</strong></div></div>

          {preview.warnings.length > 0 && <details className="rounded-xl border border-amber-900/70 bg-amber-950/60 p-3"><summary className="cursor-pointer text-xs font-bold text-amber-200">Co musí obchodník ověřit ({preview.warnings.length})</summary><ul className="mt-2 space-y-1 pl-4 text-xs text-amber-100">{preview.warnings.map((warning) => <li className="list-disc" key={warning}>{warning}</li>)}</ul></details>}

          {preview.offerType === 'NAVIGATION' && preview.target && <div className="space-y-2">
            <div className={`rounded-lg px-3 py-2 text-xs font-bold ${routeAnalysis === 'error' ? 'bg-amber-950 text-amber-200' : routeAnalysis === 'done' ? 'bg-emerald-950 text-emerald-200' : 'bg-sky-950 text-sky-200'}`}>{routeAnalysis === 'running' && <span className="mr-2 inline-block animate-spin">◌</span>}{routeAnalysisMessage || 'Analyzuji příjezdové trasy…'}</div>
            <GoogleNavigationOfferMap
              compact
              readOnly
              target={{ latitude: preview.target.latitude, longitude: preview.target.longitude, label: preview.target.name, address: preview.target.address }}
              points={preview.items.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({ id: item.selectionId, label: item.title, latitude: item.latitude!, longitude: item.longitude!, calculatedDistanceMeters: item.distanceMeters, routePolyline: item.routePolyline, arrowDirectionEnum: item.arrowDirection }))}
              mode="point"
              suggestionCount={quantity}
              maxRadiusKm={maxRadiusKm}
              onSuggestedPoints={handleSuggestedPoints}
              onMapClick={() => undefined}
              onPointMove={() => undefined}
              onTargetSelect={() => undefined}
            />
          </div>}

          <div className="space-y-2">{preview.items.map((item, index) => <article className="rounded-xl border border-slate-800 p-3" key={item.selectionId}>
            <div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{index + 1}. {item.title}</strong><p className="mt-1 text-xs text-slate-400">{item.distanceMeters ? `${Math.round(item.distanceMeters)} m před cílem · ` : ''}dopad {item.score}/100</p></div><span className="shrink-0 text-xs font-bold">{item.finalPrice == null ? 'cena po ověření' : `${item.finalPrice.toLocaleString('cs-CZ')} Kč`}</span></div>
            <p className="mt-2 text-xs text-slate-300">{item.reasons.slice(0, 2).join(' ')}</p>
            {preview.offerType === 'NAVIGATION' && <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-sky-300">Konstrukce a cena</summary><label className="mt-2 block text-xs font-bold text-slate-300">Předpokládaný typ<select className="input mt-1" value={item.mountingType ?? ''} onChange={(event) => updateMountingType(item.selectionId, event.target.value as MountingType | '')}><option value="">Určí obchodník podle fotografie</option>{item.pricingOptions?.map((option) => <option key={option.mountingType} value={option.mountingType}>{option.label} · {option.total === null ? 'cena není nastavena' : `${option.total.toLocaleString('cs-CZ')} Kč`}</option>)}</select></label></details>}
            <button className="mt-2 text-xs font-bold text-rose-300" onClick={() => setPreview((current) => current ? { ...current, items: current.items.filter((candidate) => candidate.selectionId !== item.selectionId) } : current)} type="button">Odebrat bod</button>
          </article>)}</div>

          <div className="rounded-xl border border-sky-800 bg-sky-950/60 p-3">
            <label className="block text-xs font-bold text-sky-200">
              📝 Průvodní text v hlavičce nabídky (můžete upravit před vytvořením)
              <textarea
                className="input mt-1.5 min-h-20 w-full bg-slate-900 text-xs text-slate-100"
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                placeholder="Text, který uvidí klient v úvodu nabídky..."
              />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row"><button className="rounded-xl border border-slate-600 px-4 py-2 text-sm" onClick={() => { setPreview(null); setRouteAnalysis('idle'); }} type="button">Upravit zadání</button><button className="btn-primary flex-1" disabled={loading || preview.items.length === 0 && preview.offerType !== 'CITY_GALLERY' || preview.offerType === 'NAVIGATION' && routeAnalysis === 'running'} onClick={() => void call('confirm')} type="button">{loading ? 'Vytvářím koncept…' : 'Vytvořit koncept nabídky'}</button></div>
        </section>}
      </div>
    </div>
  </div>;
}
