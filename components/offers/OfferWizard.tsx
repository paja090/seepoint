'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertTriangle, ArrowLeft, ArrowRight, Calculator, Check, ImageIcon, Map, Plus, Search, Trash2, Users } from 'lucide-react';
import type { OfferClientOption, OfferSurfaceOption, OfferView } from '@/lib/offers/view-model';
import { toProposalOffer } from '@/lib/offers/presentation';
import { OfferMap } from './OfferMap';
import { OfferProposal } from '@/components/offer/OfferProposal';

type DraftItem = { surfaceId: string; dateFrom: string; dateTo: string; quantity: string; unit: string; unitPrice: string; discountPercent: string; discountAmount: string; note: string; groupLabel: string; customTitle: string; clientDescription: string };
type Conflict = { surfaceId: string; surfaceName: string; carrierCode: string; status: string; clientName: string; campaignName: string; dateFrom: string; dateTo: string; severity: 'block' | 'warning' };
const steps = ['Klient', 'Parametry', 'Plochy', 'Kalkulace', 'Dostupnost', 'Náhled', 'Dokončení'];
const mediaLabel = (value: string) => ({ CITY_POSTER: 'City Poster', PROMO_BENCH: 'Lavičky', NAVIGATION_SIGN: 'Navigace', CITYLIGHT: 'CLV', PROMO_TOWER: 'Tower', PROMO_MINITOWER: 'Minitower', LED_SCREEN: 'LED', BILLBOARD: 'Billboard', BIGBOARD: 'Bigboard', BANNER: 'Banner', FACADE: 'Fasáda', PROMO_HORIZON: 'Horizon', OTHER: 'Další' }[value] ?? value);
const cents = (raw: string) => { const normalized = raw.replace(',', '.').trim(); if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return 0; const [whole, fraction = ''] = normalized.split('.'); return Number(whole) * 100 + Number((fraction + '00').slice(0, 2)); };
const hundredths = (raw: string) => cents(raw);
const formatCents = (raw: number) => `${Math.trunc(raw / 100)}.${String(Math.abs(raw % 100)).padStart(2, '0')}`;

function inputClass(extra = '') { return `input ${extra}`; }
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) { return <label className={className}><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }

export function OfferWizard({ clients: initialClients, surfaces, initialOffer }: { clients: OfferClientOption[]; surfaces: OfferSurfaceOption[]; initialOffer?: OfferView }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [clientId, setClientId] = useState(initialOffer?.clientId ?? initialClients[0]?.id ?? '');
  const selectedClient = clients.find((client) => client.id === clientId);
  const [title, setTitle] = useState(initialOffer?.title ?? 'Nová obchodní nabídka');
  const [campaignName, setCampaignName] = useState(initialOffer?.campaignName ?? '');
  const [contactPerson, setContactPerson] = useState(initialOffer?.contactPerson ?? selectedClient?.contactPerson ?? '');
  const [contactEmail, setContactEmail] = useState(initialOffer?.contactEmail ?? selectedClient?.email ?? '');
  const [contactPhone, setContactPhone] = useState(initialOffer?.contactPhone ?? selectedClient?.phone ?? '');
  const [campaignGoal, setCampaignGoal] = useState(initialOffer?.campaignGoal ?? '');
  const [budget, setBudget] = useState(initialOffer?.budget ?? '');
  const [validUntil, setValidUntil] = useState(initialOffer?.validUntil ?? '');
  const [internalNote, setInternalNote] = useState(initialOffer?.internalNote ?? '');
  const [clientMessage, setClientMessage] = useState(initialOffer?.clientMessage ?? '');
  const [taxRate, setTaxRate] = useState(initialOffer?.taxRate ?? '21');
  const [dateFrom, setDateFrom] = useState(initialOffer?.items[0]?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(initialOffer?.items[0]?.dateTo ?? '');
  const [items, setItems] = useState<DraftItem[]>(() => initialOffer?.items.map((item) => ({ surfaceId: item.surfaceId!, dateFrom: item.dateFrom ?? '', dateTo: item.dateTo ?? '', quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice ?? '0', discountPercent: item.discountPercent ?? '0', discountAmount: item.fixedDiscountAmount ?? '0', note: item.note ?? '', groupLabel: item.groupLabel, customTitle: item.customTitle ?? '', clientDescription: item.clientDescription ?? '' })) ?? []);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [view, setView] = useState<'cards' | 'map'>('cards');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [checked, setChecked] = useState(false);
  const [confirmNegotiation, setConfirmNegotiation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contactPerson: '', email: '', phone: '', companyId: '', note: '' });

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);

  const cities = useMemo(() => [...new Set(surfaces.map((surface) => surface.carrier.city))].sort(), [surfaces]);
  const mediaTypes = useMemo(() => [...new Set(surfaces.map((surface) => surface.mediaType))].sort(), [surfaces]);
  const filtered = surfaces.filter((surface) => {
    const haystack = `${surface.carrier.code} ${surface.carrier.city} ${surface.carrier.locality ?? ''} ${surface.carrier.street ?? ''} ${surface.name}`.toLocaleLowerCase('cs');
    return (!query || haystack.includes(query.toLocaleLowerCase('cs'))) && (!city || surface.carrier.city === city) && (!mediaType || surface.mediaType === mediaType);
  });
  const selectedSurfaces = items.map((item) => surfaces.find((surface) => surface.id === item.surfaceId)).filter((surface): surface is OfferSurfaceOption => Boolean(surface));

  const totals = useMemo(() => {
    let before = 0; let discount = 0; let subtotal = 0;
    items.forEach((item) => {
      const base = Math.round(cents(item.unitPrice) * hundredths(item.quantity) / 100);
      const percent = hundredths(item.discountPercent);
      const reduction = Math.round(base * percent / 10000) + cents(item.discountAmount);
      before += base; discount += reduction; subtotal += base > reduction ? base - reduction : 0;
    });
    const tax = Math.round(subtotal * hundredths(taxRate) / 10000);
    return { before: formatCents(before), discount: formatCents(discount), subtotal: formatCents(subtotal), tax: formatCents(tax), total: formatCents(subtotal + tax) };
  }, [items, taxRate]);

  function touch() { setDirty(true); setChecked(false); setConflicts([]); }
  function selectClient(id: string) { setClientId(id); const client = clients.find((row) => row.id === id); setContactPerson(client?.contactPerson ?? ''); setContactEmail(client?.email ?? ''); setContactPhone(client?.phone ?? ''); touch(); }
  function toggleSurface(surface: OfferSurfaceOption) {
    touch();
    setItems((current) => current.some((item) => item.surfaceId === surface.id) ? current.filter((item) => item.surfaceId !== surface.id) : [...current, { surfaceId: surface.id, dateFrom, dateTo, quantity: '1', unit: 'plocha', unitPrice: surface.price || '0', discountPercent: '0', discountAmount: '0', note: '', groupLabel: surface.mediaType, customTitle: '', clientDescription: surface.carrier.description ?? '' }]);
  }
  function updateItem(index: number, key: keyof DraftItem, value: string) { touch(); setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  function payload() { return { clientId, title, campaignName, contactPerson, contactEmail, contactPhone, campaignGoal, budget, validUntil, internalNote, clientMessage, taxRate, confirmNegotiation, items }; }

  async function createClient() {
    setMessage('');
    const response = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient) });
    const data = await response.json() as OfferClientOption & { error?: string };
    if (!response.ok) { setMessage(data.error || 'Klienta se nepodařilo vytvořit.'); return; }
    setClients((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
    setClientId(data.id);
    setContactPerson(data.contactPerson ?? '');
    setContactEmail(data.email ?? '');
    setContactPhone(data.phone ?? '');
    touch();
    setShowClientForm(false);
    setNewClient({ name: '', contactPerson: '', email: '', phone: '', companyId: '', note: '' });
  }

  async function checkAvailability() {
    setMessage('Kontroluji dostupnost…'); setChecked(false);
    const response = await fetch('/api/offers/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    const data = await response.json() as { conflicts?: Conflict[]; error?: string };
    setConflicts(data.conflicts ?? []);
    if (!response.ok) { setMessage(data.error || 'Kontrolu se nepodařilo provést.'); return; }
    setChecked(true); setMessage((data.conflicts?.length ?? 0) ? 'Kontrola našla varování. Před pokračováním je potvrďte.' : 'Všechny plochy jsou v termínu dostupné.');
  }

  async function save(intent: 'draft' | 'send') {
    setSaving(true); setMessage('');
    try {
      const response = await fetch(initialOffer?.id ? `/api/offers/${initialOffer.id}` : '/api/offers', { method: initialOffer?.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload(), intent }) });
      const data = await response.json() as { offer?: OfferView; conflicts?: Conflict[]; error?: string };
      setConflicts(data.conflicts ?? []);
      if (!response.ok) throw new Error(data.error || 'Nabídku se nepodařilo uložit.');
      let offer = data.offer;
      if (initialOffer?.id && intent === 'send') {
        const sent = await fetch(`/api/offers/${initialOffer.id}/send`, { method: 'POST' });
        const sentData = await sent.json() as OfferView & { error?: string };
        if (!sent.ok) throw new Error(sentData.error || 'Nabídka je uložená, ale nepodařilo se ji odeslat.');
        offer = sentData;
      }
      setDirty(false); router.push(`/offers/${offer?.id ?? initialOffer?.id}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Nabídku se nepodařilo uložit.'); } finally { setSaving(false); }
  }

  const preview: OfferView = {
    id: initialOffer?.id, clientId, title, campaignName: campaignName || title, contactPerson, contactEmail, contactPhone, campaignGoal, budget, status: initialOffer?.status ?? 'DRAFT', validUntil, internalNote, clientMessage, currency: 'CZK', taxRate, subtotalBeforeDiscount: totals.before, subtotal: totals.subtotal, discountAmount: totals.discount, taxAmount: totals.tax, totalWithTax: totals.total, createdAt: initialOffer?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: initialOffer?.createdBy ?? { name: 'SeePOINT obchodní tým' }, client: { name: selectedClient?.name ?? 'Klient', companyId: selectedClient?.companyId, contactPerson, email: contactEmail, phone: contactPhone }, converted: false,
    items: items.map((item) => { const surface = surfaces.find((row) => row.id === item.surfaceId)!; const base = Math.round(cents(item.unitPrice) * hundredths(item.quantity) / 100); const reduction = Math.round(base * hundredths(item.discountPercent) / 10000) + cents(item.discountAmount); return { ...item, id: undefined, dateFrom: item.dateFrom, dateTo: item.dateTo, discountAmount: formatCents(reduction), subtotal: formatCents(base > reduction ? base - reduction : 0), surface: { name: surface?.name ?? '', mediaType: surface?.mediaType ?? item.groupLabel, status: surface?.status, carrier: surface?.carrier ?? { code: '', name: '', city: '' }, photos: surface?.photos.map((photo) => ({ ...photo, note: null, isPrimary: false })) ?? [] } }; }),
  };

  const canNext = step === 0 ? Boolean(clientId && title) : step === 1 ? Boolean(dateFrom && dateTo && dateFrom <= dateTo) : step === 2 ? items.length > 0 : step === 4 ? checked && !conflicts.some((conflict) => conflict.severity === 'block') && (!conflicts.some((conflict) => conflict.severity === 'warning') || confirmNegotiation) : true;
  return <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_300px]">
    <aside className="card h-fit xl:sticky xl:top-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Campaign wizard</p><ol className="mt-5 space-y-1">{steps.map((label, index) => <li key={label}><button type="button" onClick={() => setStep(index)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${index === step ? 'bg-slate-950 text-white' : index < step ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${index < step ? 'bg-emerald-100 text-emerald-800' : 'bg-white/10'}`}>{index < step ? <Check size={14} /> : index + 1}</span>{label}</button></li>)}</ol></aside>
    <section className="min-w-0">
      <div className="card">
        <div className="mb-7"><p className="text-sm font-semibold text-emerald-700">Krok {step + 1} z {steps.length}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{steps[step]}</h1></div>
        {step === 0 && <div className="space-y-6"><div className="grid gap-4 lg:grid-cols-2"><Field label="Klient"><select className="input" value={clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Vyberte klienta</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></Field><Field label="Interní název nabídky"><input className="input" value={title} onChange={(event) => { setTitle(event.target.value); touch(); }} /></Field><Field label="Kontaktní osoba"><input className="input" value={contactPerson} onChange={(event) => { setContactPerson(event.target.value); touch(); }} /></Field><Field label="E-mail"><input className="input" type="email" value={contactEmail} onChange={(event) => { setContactEmail(event.target.value); touch(); }} /></Field><Field label="Telefon"><input className="input" value={contactPhone} onChange={(event) => { setContactPhone(event.target.value); touch(); }} /></Field><Field label="IČO"><input className="input" value={selectedClient?.companyId ?? ''} disabled /></Field></div><button className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700" type="button" onClick={() => setShowClientForm((open) => !open)}><Plus size={16} /> Založit nového klienta přes CRM</button>
          {showClientForm && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold">Nový klient</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{Object.entries(newClient).map(([key, value]) => <Field label={{ name: 'Název', contactPerson: 'Kontaktní osoba', email: 'E-mail', phone: 'Telefon', companyId: 'IČO', note: 'Poznámka' }[key] ?? key} key={key}><input className="input" value={value} onChange={(event) => setNewClient((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}</div><button className="btn-primary mt-4" type="button" onClick={() => void createClient()}>Vytvořit klienta</button></div>}</div>}
        {step === 1 && <div className="grid gap-4 lg:grid-cols-2"><Field label="Název kampaně"><input className="input" value={campaignName} onChange={(event) => { setCampaignName(event.target.value); touch(); }} /></Field><Field label="Platnost nabídky"><input className="input" type="date" value={validUntil} onChange={(event) => { setValidUntil(event.target.value); touch(); }} /></Field><Field label="Kampaň od"><input className="input" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setItems((rows) => rows.map((row) => ({ ...row, dateFrom: event.target.value }))); touch(); }} /></Field><Field label="Kampaň do"><input className="input" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setItems((rows) => rows.map((row) => ({ ...row, dateTo: event.target.value }))); touch(); }} /></Field><Field label="Rozpočet bez DPH"><input className="input" inputMode="decimal" value={budget} onChange={(event) => { setBudget(event.target.value); touch(); }} /></Field><Field label="DPH %"><input className="input" inputMode="decimal" value={taxRate} onChange={(event) => { setTaxRate(event.target.value); touch(); }} /></Field><Field label="Cíl kampaně" className="lg:col-span-2"><textarea className={inputClass('min-h-28')} value={campaignGoal} onChange={(event) => { setCampaignGoal(event.target.value); touch(); }} /></Field><Field label="Text pro klienta" className="lg:col-span-2"><textarea className={inputClass('min-h-28')} value={clientMessage} onChange={(event) => { setClientMessage(event.target.value); touch(); }} /></Field><Field label="Interní poznámka (klient ji neuvidí)" className="lg:col-span-2"><textarea className={inputClass('min-h-24')} value={internalNote} onChange={(event) => { setInternalNote(event.target.value); touch(); }} /></Field></div>}
        {step === 2 && <div><div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]"><label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input className="input pl-10" placeholder="Kód, město, ulice, lokalita…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select className="input" value={city} onChange={(event) => setCity(event.target.value)}><option value="">Všechna města</option>{cities.map((value) => <option key={value}>{value}</option>)}</select><select className="input" value={mediaType} onChange={(event) => setMediaType(event.target.value)}><option value="">Všechna média</option>{mediaTypes.map((value) => <option value={value} key={value}>{mediaLabel(value)}</option>)}</select><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold" type="button" onClick={() => setView((current) => current === 'cards' ? 'map' : 'cards')}>{view === 'cards' ? <Map size={17} /> : <ImageIcon size={17} />}{view === 'cards' ? 'Mapa' : 'Karty'}</button></div><p className="mt-4 text-sm text-slate-500">Vybráno {items.length} z {filtered.length} zobrazených ploch. Stav dostupnosti bude vždy ověřen serverem pro zvolený termín.</p>
          {view === 'map' ? <div className="mt-5"><OfferMap points={filtered.map((surface) => ({ id: surface.id, code: surface.carrier.code, city: surface.carrier.city, latitude: surface.carrier.latitude, longitude: surface.carrier.longitude, selected: items.some((item) => item.surfaceId === surface.id) }))} onPointClick={(id) => { const surface = surfaces.find((row) => row.id === id); if (surface) toggleSurface(surface); }} className="h-[520px]" /></div> : <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((surface) => { const selected = items.some((item) => item.surfaceId === surface.id); return <button className={`overflow-hidden rounded-2xl border text-left transition ${selected ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`} type="button" onClick={() => toggleSurface(surface)} key={surface.id}>{surface.photos[0] ? <Image src={surface.photos[0].url} alt={`Nosič ${surface.carrier.code}`} width={700} height={400} className="h-32 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-slate-100 text-slate-400"><ImageIcon /></div>}<div className="p-4"><div className="flex justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-emerald-700">{surface.carrier.code}</p><b>{surface.carrier.name} · {surface.name}</b></div><span className={`grid h-6 w-6 place-items-center rounded-full ${selected ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>{selected && <Check size={14} />}</span></div><p className="mt-2 text-sm text-slate-500">{surface.carrier.city} · {surface.carrier.locality || surface.carrier.street || 'lokalita neuvedena'}</p><div className="mt-3 flex justify-between text-xs"><span className="rounded-full bg-slate-100 px-2 py-1">{mediaLabel(surface.mediaType)}</span><b>{Number(surface.price).toLocaleString('cs-CZ')} Kč</b></div>{surface.currentClient && <p className="mt-2 text-xs text-amber-700">Aktuální klient: {surface.currentClient}</p>}</div></button>; })}</div>}</div>}
        {step === 3 && <div className="space-y-5">{items.map((item, index) => { const surface = surfaces.find((row) => row.id === item.surfaceId)!; return <article className="rounded-2xl border border-slate-200 p-5" key={item.surfaceId}><div className="mb-5 flex items-start justify-between gap-4"><div><p className="font-mono text-xs text-emerald-700">{surface?.carrier.code}</p><h2 className="font-semibold">{surface?.carrier.name} · {surface?.name}</h2><p className="text-sm text-slate-500">{mediaLabel(surface?.mediaType)}</p></div><button type="button" aria-label="Odstranit plochu" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => toggleSurface(surface)}><Trash2 size={18} /></button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Od"><input className="input" type="date" value={item.dateFrom} onChange={(event) => updateItem(index, 'dateFrom', event.target.value)} /></Field><Field label="Do"><input className="input" type="date" value={item.dateTo} onChange={(event) => updateItem(index, 'dateTo', event.target.value)} /></Field><Field label="Množství"><input className="input" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /></Field><Field label="Jednotka"><input className="input" value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} /></Field><Field label="Jednotková cena"><input className="input" inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} /></Field><Field label="Sleva %"><input className="input" inputMode="decimal" value={item.discountPercent} onChange={(event) => updateItem(index, 'discountPercent', event.target.value)} /></Field><Field label="Sleva Kč"><input className="input" inputMode="decimal" value={item.discountAmount} onChange={(event) => updateItem(index, 'discountAmount', event.target.value)} /></Field><Field label="Skupina"><input className="input" value={item.groupLabel} onChange={(event) => updateItem(index, 'groupLabel', event.target.value)} /></Field><Field label="Klientský titulek" className="md:col-span-2"><input className="input" value={item.customTitle} onChange={(event) => updateItem(index, 'customTitle', event.target.value)} /></Field><Field label="Klientský popis" className="md:col-span-2"><input className="input" value={item.clientDescription} onChange={(event) => updateItem(index, 'clientDescription', event.target.value)} /></Field></div></article>; })}<div className="ml-auto max-w-md rounded-2xl bg-slate-950 p-6 text-white"><div className="flex justify-between text-sm"><span>Mezisoučet</span><b>{Number(totals.before).toLocaleString('cs-CZ')} Kč</b></div><div className="mt-2 flex justify-between text-sm"><span>Slevy</span><b>− {Number(totals.discount).toLocaleString('cs-CZ')} Kč</b></div><div className="mt-2 flex justify-between text-sm"><span>DPH</span><b>{Number(totals.tax).toLocaleString('cs-CZ')} Kč</b></div><div className="mt-4 flex justify-between border-t border-white/20 pt-4 text-lg"><span>Celkem</span><b>{Number(totals.total).toLocaleString('cs-CZ')} Kč</b></div><p className="mt-3 text-xs text-slate-400">Náhled používá celočíselné haléře; server výsledek znovu autoritativně přepočítá pomocí Decimal.</p></div></div>}
        {step === 4 && <div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><Calculator className="text-emerald-700" /><h2 className="mt-3 text-xl font-semibold">Serverová kontrola všech {items.length} položek</h2><p className="mt-2 text-sm leading-6 text-slate-600">Obsazené a rezervované plochy blokují pokračování. Plochy v jednání vyžadují výslovné potvrzení.</p><button className="btn-primary mt-5" type="button" onClick={() => void checkAvailability()}>Zkontrolovat dostupnost</button></div>{conflicts.length > 0 && <div className="mt-5 space-y-3">{conflicts.map((conflict, index) => <div className={`rounded-2xl border p-4 ${conflict.severity === 'block' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`} key={`${conflict.surfaceId}-${index}`}><div className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} />{conflict.carrierCode} · {conflict.surfaceName}</div><p className="mt-1 text-sm">{conflict.status}: {conflict.clientName} / {conflict.campaignName}, {conflict.dateFrom}–{conflict.dateTo}</p></div>)}</div>}{conflicts.some((conflict) => conflict.severity === 'warning') && !conflicts.some((conflict) => conflict.severity === 'block') && <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"><input type="checkbox" className="mt-1" checked={confirmNegotiation} onChange={(event) => setConfirmNegotiation(event.target.checked)} /><span><b>Potvrzuji pokračování přes varování NEGOTIATION.</b><span className="mt-1 block text-sm text-amber-800">Toto potvrzení se uloží k nabídce.</span></span></label>}</div>}
        {step === 5 && <OfferProposal offer={toProposalOffer(preview)} variant="internal" />}
        {step === 6 && <div className="grid gap-6 lg:grid-cols-2"><div className="rounded-3xl border border-slate-200 p-6"><Users className="text-emerald-700" /><h2 className="mt-4 text-xl font-semibold">Uložit koncept</h2><p className="mt-2 text-sm leading-6 text-slate-600">Nabídka zůstane editovatelná a můžete se k ní později vrátit.</p><button className="mt-5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold" type="button" disabled={saving} onClick={() => void save('draft')}>{saving ? 'Ukládám…' : 'Uložit koncept'}</button></div><div className="rounded-3xl bg-slate-950 p-6 text-white"><Check className="text-emerald-300" /><h2 className="mt-4 text-xl font-semibold">Uložit a odeslat</h2><p className="mt-2 text-sm leading-6 text-slate-300">Server znovu ověří dostupnost, uloží autora ze session a nastaví stav SENT.</p><button className="mt-5 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" type="button" disabled={saving} onClick={() => void save('send')}>{saving ? 'Odesílám…' : 'Odeslat nabídku'}</button></div></div>}
        {message && <p className={`mt-6 rounded-xl p-4 text-sm ${message.includes('nepodařilo') || message.includes('Vybrané') ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'}`} aria-live="polite">{message}</p>}
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5"><button className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30" type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} /> Zpět</button>{step < steps.length - 1 && <button className="btn-primary inline-flex items-center gap-2 disabled:opacity-40" type="button" disabled={!canNext} onClick={() => setStep((current) => current + 1)}>Pokračovat <ArrowRight size={17} /></button>}</div>
      </div>
      {selectedSurfaces.length > 0 && step < 5 && <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">{selectedSurfaces.map((surface) => <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5" key={surface.id}>{surface.carrier.code} · {mediaLabel(surface.mediaType)}</span>)}</div>}
    </section>
    <aside className="h-fit xl:sticky xl:top-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Živý souhrn</p>
          <h2 className="mt-2 text-xl font-semibold">{campaignName || 'Nová kampaň'}</h2>
          <p className="mt-1 text-sm text-slate-300">{selectedClient?.name || 'Klient zatím není vybraný'}</p>
        </div>
        <dl className="divide-y divide-slate-100 p-5 text-sm">
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Termín</dt><dd className="text-right font-medium text-slate-900">{dateFrom || '—'}<br />{dateTo || '—'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Vybrané plochy</dt><dd className="font-semibold text-slate-900">{items.length}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Města</dt><dd className="text-right font-medium text-slate-900">{[...new Set(selectedSurfaces.map((surface) => surface.carrier.city))].join(', ') || '—'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Cena bez DPH</dt><dd className="font-semibold text-slate-900">{Number(totals.subtotal).toLocaleString('cs-CZ')} Kč</dd></div>
          <div className="flex justify-between gap-3 pt-4 text-base"><dt className="font-semibold text-slate-900">Celkem</dt><dd className="font-semibold text-emerald-700">{Number(totals.total).toLocaleString('cs-CZ')} Kč</dd></div>
        </dl>
        <div className="border-t border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500">Souhrn se průběžně aktualizuje. Finální cenu a dostupnost vždy znovu ověří server.</div>
      </div>
    </aside>
  </div>;
}
