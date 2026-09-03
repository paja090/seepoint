'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, LayoutGrid,
  List, MapPin, Megaphone, Plus, Sparkles, Store, Tag, Target, TrendingUp,
  Users, Wand2,
} from 'lucide-react';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { MEDIA_TYPE_META, toProposalOffer, type ProposalMediaTypeKey } from '@/lib/offers/presentation';
import { selectMediaPackageSurfaces } from '@/lib/offers/media-packages';
import type { MediaPackageOption, OfferClientOption, OfferPriceRuleOption, OfferSurfaceOption, OfferView } from '@/lib/offers/view-model';
import { OfferItemEditor, type EditableOfferItem } from './OfferItemEditor';
import { OfferSurfaceBrowser } from './OfferSurfaceBrowser';
import { countSurfacesForPriceRule } from '@/lib/offers/domain';

type DraftItem = EditableOfferItem;
type Conflict = { surfaceId: string; surfaceName: string; carrierCode: string; status: string; clientName: string; campaignName: string; dateFrom: string; dateTo: string; severity: 'block' | 'warning' };
type MediaMode = 'map' | 'list' | 'package' | 'auto';

const wizardSteps = [
  { key: 'client', label: 'Klient', description: 'Pro koho kampaň připravujeme' },
  { key: 'objective', label: 'Cíl kampaně', description: 'Čeho chce klient dosáhnout' },
  { key: 'budget', label: 'Rozpočet', description: 'Orientační investice' },
  { key: 'dates', label: 'Termín', description: 'Období kampaně' },
  { key: 'region', label: 'Region', description: 'Kde chceme být vidět' },
  { key: 'audience', label: 'Cílová skupina', description: 'Koho oslovujeme' },
  { key: 'media', label: 'Výběr médií', description: 'Skladba nosičů' },
];
const objectives = [
  { title: 'Budování povědomí', description: 'Maximální viditelnost značky v regionu.', Icon: Megaphone },
  { title: 'Otevření pobočky', description: 'Navigace a lokální podpora nové provozovny.', Icon: Store },
  { title: 'Podpora akce / slevy', description: 'Krátkodobá kampaň k prodejní akci.', Icon: Tag },
  { title: 'Nábor zaměstnanců', description: 'Oslovení uchazečů v dojezdové vzdálenosti.', Icon: Users },
  { title: 'Uvedení produktu', description: 'Podpora uvedení nového produktu nebo služby.', Icon: TrendingUp },
  { title: 'Sezónní kampaň', description: 'Opakovaná sezónní komunikace.', Icon: CalendarDays },
];
const budgets = [
  { label: 'Lokální', range: 'do 40 000 Kč', value: '40000', surfaces: '10–20 ploch' },
  { label: 'Regionální', range: '40 000–90 000 Kč', value: '90000', surfaces: '20–45 ploch', recommended: true },
  { label: 'Krajská dominance', range: '90 000–180 000 Kč', value: '180000', surfaces: '45–80 ploch' },
  { label: 'Nadregionální', range: '180 000 Kč a více', value: '250000', surfaces: '80+ ploch' },
];
const audiences = [
  { id: 'drivers', label: 'Dojíždějící / řidiči', hint: 'Hlavní tahy a výpadovky' },
  { id: 'families', label: 'Rodiny s dětmi', hint: 'Obytné zóny a sídliště' },
  { id: 'shoppers', label: 'Nakupující', hint: 'Okolí prodejen a obchodních center' },
  { id: 'young', label: 'Mladí 18–34', hint: 'Centrum a univerzity' },
  { id: 'workers', label: 'Zaměstnanci', hint: 'Průmyslové zóny' },
];
const mediaModes: Array<{ key: MediaMode; label: string; Icon: typeof MapPin }> = [
  { key: 'map', label: 'Z mapy', Icon: MapPin }, { key: 'list', label: 'Ze seznamu', Icon: List },
  { key: 'package', label: 'Doporučený balíček', Icon: LayoutGrid }, { key: 'auto', label: 'Automatické návrhy', Icon: Wand2 },
];

const cents = (raw: string) => { const normalized = raw.replace(',', '.').trim(); if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return 0; const [whole, fraction = ''] = normalized.split('.'); return Number(whole) * 100 + Number((fraction + '00').slice(0, 2)); };
const formatCents = (raw: number) => `${Math.trunc(raw / 100)}.${String(Math.abs(raw % 100)).padStart(2, '0')}`;
const money = (raw: string | number) => `${Number(raw).toLocaleString('cs-CZ')} Kč`;
const mediaLabel = (value: string) => MEDIA_TYPE_META[(value in MEDIA_TYPE_META ? value : 'OTHER') as ProposalMediaTypeKey].label;

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) { return <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>; }
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) { return <label className={className}><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium text-slate-900">{value}</dd></div>; }

export function OfferWizard({ clients: initialClients, surfaces, priceRules, mediaPackages, priceListItems = [], initialOffer, initialClientId }: { clients: OfferClientOption[]; surfaces: OfferSurfaceOption[]; priceRules: OfferPriceRuleOption[]; mediaPackages: MediaPackageOption[]; priceListItems?: Array<{ id: string; name: string; mediaType: string | null; carrierType: string | null; rentalPrice: string }>; initialOffer?: OfferView; initialClientId?: string }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const requestedClientId = initialOffer?.clientId ?? initialClientId;
  const defaultClientId = requestedClientId && initialClients.some((client) => client.id === requestedClientId)
    ? requestedClientId
    : initialClients[0]?.id ?? '';
  const [clientId, setClientId] = useState(defaultClientId);
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
  const [pricingTier, setPricingTier] = useState<'komerce' | 'kultura'>(() => (initialOffer?.pricingTier === 'kultura' ? 'kultura' : 'komerce'));
  const [dateFrom, setDateFrom] = useState(initialOffer?.items[0]?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(initialOffer?.items[0]?.dateTo ?? '');
  const [items, setItems] = useState<DraftItem[]>(() => initialOffer?.items.map((item) => ({ surfaceId: item.surfaceId!, dateFrom: item.dateFrom ?? '', dateTo: item.dateTo ?? '', quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice ?? '0', discountPercent: item.discountPercent ?? '0', discountAmount: item.fixedDiscountAmount ?? '0', note: item.note ?? '', groupLabel: item.groupLabel, customTitle: item.customTitle ?? '', clientDescription: item.clientDescription ?? '' })) ?? []);
  const [query, setQuery] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkDiscount, setBulkDiscount] = useState('');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(() => new Set(initialOffer?.items.map((item) => item.surface.carrier.city) ?? []));
  const [selectedAudiences, setSelectedAudiences] = useState<Set<string>>(new Set());
  const [mediaMode, setMediaMode] = useState<MediaMode>('package');
  const [selectedPackageId, setSelectedPackageId] = useState(initialOffer?.packageSelections?.[0]?.packageId ?? '');
  const setSelectedPackageLimit = (...args: [number | null]) => { void args; setSelectedPackageId(''); };
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [checked, setChecked] = useState(false);
  const [confirmNegotiation, setConfirmNegotiation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contactPerson: '', email: '', phone: '', companyId: '', note: '' });

  const getCatalogPrice = useCallback((surface: OfferSurfaceOption, tier: 'komerce' | 'kultura') => {
    const candidates = priceListItems.filter(
      (item) => item.mediaType === surface.mediaType || item.carrierType === surface.carrier.type
    );
    if (candidates.length === 0) return 0;
    const tierMatch = candidates.find((item) =>
      item.name.toLowerCase().includes(tier)
    );
    if (tierMatch) return parseFloat(tierMatch.rentalPrice);
    const generalMatch = candidates.find(
      (item) =>
        !item.name.toLowerCase().includes('komerce') &&
        !item.name.toLowerCase().includes('kultura')
    );
    if (generalMatch) return parseFloat(generalMatch.rentalPrice);
    return parseFloat(candidates[0].rentalPrice);
  }, [priceListItems]);

  const resolvedSurfaces = useMemo(() => {
    return surfaces.map((surface) => {
      const catalogPrice = getCatalogPrice(surface, pricingTier);
      const price = surface.priceSource === 'SURFACE' ? surface.price : catalogPrice.toFixed(2);
      return { ...surface, price };
    });
  }, [surfaces, pricingTier, getCatalogPrice]);

  useEffect(() => { const listener = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', listener); return () => window.removeEventListener('beforeunload', listener); }, [dirty]);
  const cityOptions = useMemo(() => [...new Set(resolvedSurfaces.map((surface) => surface.carrier.city))].sort(), [resolvedSurfaces]);
  const availableSurfaces = resolvedSurfaces.filter((surface) => (selectedCities.size === 0 || selectedCities.has(surface.carrier.city)) && (!query || `${surface.carrier.code} ${surface.carrier.name} ${surface.name} ${surface.carrier.city} ${surface.carrier.locality ?? ''}`.toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs'))));
  const selectedSurfaceIds = useMemo(() => new Set(items.map((item) => item.surfaceId)), [items]);
  const totals = useMemo(() => {
    let before = 0; let discount = 0; let subtotal = 0;
    for (const item of items) { const base = Math.round(cents(item.unitPrice) * cents(item.quantity) / 100); const reduction = Math.round(base * cents(item.discountPercent) / 10000) + cents(item.discountAmount); before += base; discount += reduction; subtotal += Math.max(0, base - reduction); }
    const automaticCharges = initialOffer?.charges.length
      ? initialOffer.charges.reduce((sum, charge) => sum + cents(charge.subtotal), 0)
      : priceRules.filter((rule) => rule.category !== 'RENTAL' && rule.defaultSelected).reduce((sum, rule) => { const quantity = rule.calculation === 'FLAT' ? 1 : rule.mediaType ? items.filter((item) => item.groupLabel === rule.mediaType).length : items.length; return sum + cents(rule.unitPrice) * quantity; }, 0);
    before += automaticCharges; subtotal += automaticCharges;
    const tax = Math.round(subtotal * cents(taxRate) / 10000);
    return { before: formatCents(before), discount: formatCents(discount), subtotal: formatCents(subtotal), tax: formatCents(tax), total: formatCents(subtotal + tax) };
  }, [initialOffer?.charges, items, priceRules, taxRate]);
  const days = useMemo(() => { const diff = new Date(dateTo).getTime() - new Date(dateFrom).getTime(); return Number.isFinite(diff) && diff >= 0 ? Math.round(diff / 86_400_000) + 1 : 0; }, [dateFrom, dateTo]);

  function touch() { setDirty(true); setChecked(false); setConflicts([]); }
  function selectClient(id: string) { setClientId(id); const client = clients.find((row) => row.id === id); setContactPerson(client?.contactPerson ?? ''); setContactEmail(client?.email ?? ''); setContactPhone(client?.phone ?? ''); touch(); }
  function toggleSet(current: Set<string>, setter: (next: Set<string>) => void, value: string) { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); setter(next); touch(); }
  function toggleSurface(surface: OfferSurfaceOption) { setSelectedPackageLimit(null); touch(); setItems((current) => current.some((item) => item.surfaceId === surface.id) ? current.filter((item) => item.surfaceId !== surface.id) : [...current, { surfaceId: surface.id, dateFrom, dateTo, quantity: '1', unit: 'plocha', unitPrice: surface.price || '0', discountPercent: '0', discountAmount: '0', note: '', groupLabel: surface.mediaType, customTitle: '', clientDescription: surface.carrier.description ?? '' }]); }
  function bulkToggleSurfaces(rows: OfferSurfaceOption[], select: boolean) {
    setSelectedPackageLimit(null);
    touch();
    setItems((current) => {
      const rowIds = new Set(rows.map((surface) => surface.id));
      if (!select) return current.filter((item) => !rowIds.has(item.surfaceId));
      const existing = new Set(current.map((item) => item.surfaceId));
      const additions = rows.filter((surface) => !existing.has(surface.id)).map((surface) => ({ surfaceId: surface.id, dateFrom, dateTo, quantity: '1', unit: 'plocha', unitPrice: surface.price || '0', discountPercent: '0', discountAmount: '0', note: '', groupLabel: surface.mediaType, customTitle: '', clientDescription: surface.carrier.description ?? '' }));
      return [...current, ...additions];
    });
  }
  function updateItem(index: number, key: keyof DraftItem, value: string) { touch(); setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  function applyBulkPricing() {
    if (!bulkPrice && !bulkDiscount) return;
    touch();
    setItems((current) => current.map((item) => ({
      ...item,
      unitPrice: bulkPrice || item.unitPrice,
      discountPercent: bulkDiscount || item.discountPercent,
    })));
    setBulkPrice('');
    setBulkDiscount('');
  }
  const chargeSelections = useMemo(() => {
    if (initialOffer?.charges.length) return initialOffer.charges.filter((charge) => charge.priceRuleId).map((charge) => ({ priceRuleId: charge.priceRuleId!, quantity: charge.quantity }));
    return priceRules.filter((rule) => rule.category !== 'RENTAL' && rule.defaultSelected).map((rule) => {
      const count = countSurfacesForPriceRule(rule, items.map((item) => {
        const s = resolvedSurfaces.find((row) => row.id === item.surfaceId);
        return { groupLabel: item.groupLabel, surface: s };
      }));
      return { priceRuleId: rule.id, quantity: String(count) };
    }).filter((selection) => Number(selection.quantity) > 0);
  }, [initialOffer?.charges, items, priceRules, resolvedSurfaces]);
  const draftPayload = useMemo(() => {
    const payloadItems = items.map((item) => {
      const surface = resolvedSurfaces.find((s) => s.id === item.surfaceId);
      return {
        ...item,
        unitPrice: surface?.price || '0',
      };
    });
    return {
      clientId,
      title,
      campaignName,
      contactPerson,
      contactEmail,
      contactPhone,
      campaignGoal,
      budget,
      validUntil,
      internalNote,
      clientMessage,
      taxRate,
      confirmNegotiation,
      packageId: selectedPackageId || undefined,
      pricingTier,
      items: payloadItems,
      chargeSelections,
    };
  }, [
    clientId,
    title,
    campaignName,
    contactPerson,
    contactEmail,
    contactPhone,
    campaignGoal,
    budget,
    validUntil,
    internalNote,
    clientMessage,
    taxRate,
    confirmNegotiation,
    selectedPackageId,
    pricingTier,
    items,
    resolvedSurfaces,
    chargeSelections,
  ]);
  const availabilityKey = useMemo(() => items.map((item) => `${item.surfaceId}:${item.dateFrom}:${item.dateTo}`).sort().join('|'), [items]);
  function payload() { return draftPayload; }
  function selectConfiguredPackage(pkg: MediaPackageOption) { const result = selectMediaPackageSurfaces(pkg, availableSurfaces); if (result.missing.length) { setMessage(`Balíček nelze sestavit: chybí ${result.missing.map((row) => `${row.quantity - row.available}× ${mediaLabel(row.mediaType)}`).join(', ')}.`); return; } setMessage(''); setSelectedPackageId(pkg.id); setItems(result.surfaces.map((surface) => ({ surfaceId: surface.id, dateFrom, dateTo, quantity: '1', unit: 'plocha', unitPrice: surface.price || '0', discountPercent: '0', discountAmount: '0', note: '', groupLabel: surface.mediaType, customTitle: '', clientDescription: surface.carrier.description ?? '' }))); touch(); }

  useEffect(() => {
    if (!initialOffer?.id || !dirty || saving || !clientId || !title || items.length === 0) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAutosaveState('saving');
      try {
        const response = await fetch(`/api/offers/${initialOffer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...draftPayload, intent: 'draft' }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Autosave failed');
        setDirty(false);
        setAutosaveState('saved');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAutosaveState('error');
      }
    }, 1500);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [clientId, dirty, draftPayload, initialOffer?.id, items.length, saving, title]);

  useEffect(() => {
    if (step !== 6 || !availabilityKey || items.some((item) => !item.dateFrom || !item.dateTo || item.dateFrom > item.dateTo)) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/offers/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayload),
          signal: controller.signal,
        });
        const data = await response.json() as { conflicts?: Conflict[] };
        if (!response.ok) return;
        setConflicts(data.conflicts ?? []);
        setChecked(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }, 650);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [availabilityKey, draftPayload, items, step]);

  async function createClient() { setMessage(''); const response = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newClient) }); const data = await response.json() as OfferClientOption & { error?: string }; if (!response.ok) return setMessage(data.error || 'Klienta se nepodařilo vytvořit.'); setClients((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name, 'cs'))); selectClient(data.id); setShowClientForm(false); setNewClient({ name: '', contactPerson: '', email: '', phone: '', companyId: '', note: '' }); }
  async function checkAvailability() { setMessage('Kontroluji dostupnost…'); setChecked(false); const response = await fetch('/api/offers/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) }); const data = await response.json() as { conflicts?: Conflict[]; error?: string }; setConflicts(data.conflicts ?? []); if (!response.ok) return setMessage(data.error || 'Kontrolu se nepodařilo provést.'); setChecked(true); setMessage(data.conflicts?.length ? 'Kontrola našla kolize nebo varování.' : 'Všechny plochy jsou v termínu dostupné.'); }
  async function save(intent: 'draft' | 'send') { setSaving(true); setMessage(''); try { const response = await fetch(initialOffer?.id ? `/api/offers/${initialOffer.id}` : '/api/offers', { method: initialOffer?.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload(), intent }) }); const data = await response.json() as { offer?: OfferView; conflicts?: Conflict[]; error?: string }; setConflicts(data.conflicts ?? []); if (!response.ok) throw new Error(data.error || 'Nabídku se nepodařilo uložit.'); let offer = data.offer; if (initialOffer?.id && intent === 'send') { const sent = await fetch(`/api/offers/${initialOffer.id}/send`, { method: 'POST' }); const sentData = await sent.json() as OfferView & { error?: string }; if (!sent.ok) throw new Error(sentData.error || 'Nabídka je uložená, ale nepodařilo se ji odeslat.'); offer = sentData; } const offerId = offer?.id ?? initialOffer?.id; setDirty(false); router.push(intent === 'draft' ? `/offers/${offerId}/planner` : `/offers/${offerId}/preview`); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Nabídku se nepodařilo uložit.'); } finally { setSaving(false); } }

  const previewCharges = initialOffer?.charges.length ? initialOffer.charges : chargeSelections.map((selection) => { const rule = priceRules.find((candidate) => candidate.id === selection.priceRuleId)!; return { priceRuleId: rule.id, category: rule.category, code: rule.code, label: rule.label, description: rule.description, quantity: selection.quantity, unit: rule.unit, unitPrice: rule.unitPrice, subtotal: formatCents(cents(rule.unitPrice) * Number(selection.quantity)) }; });
  const preview: OfferView = { id: initialOffer?.id, clientId, title, campaignName: campaignName || title, contactPerson, contactEmail, contactPhone, campaignGoal, budget, status: initialOffer?.status ?? 'DRAFT', pricingTier, validUntil, internalNote, clientMessage, currency: 'CZK', taxRate, subtotalBeforeDiscount: totals.before, subtotal: totals.subtotal, discountAmount: totals.discount, taxAmount: totals.tax, totalWithTax: totals.total, createdAt: initialOffer?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: initialOffer?.createdBy ?? { name: 'SeePOINT obchodní tým' }, client: { name: selectedClient?.name ?? 'Klient', logoUrl: selectedClient?.logoUrl, companyId: selectedClient?.companyId, contactPerson, email: contactEmail, phone: contactPhone }, converted: false, charges: previewCharges, items: items.map((item) => { const surface = resolvedSurfaces.find((row) => row.id === item.surfaceId)!; const base = Math.round(cents(item.unitPrice) * cents(item.quantity) / 100); const reduction = Math.round(base * cents(item.discountPercent) / 10000) + cents(item.discountAmount); return { ...item, id: undefined, discountAmount: formatCents(reduction), subtotal: formatCents(Math.max(0, base - reduction)), surface: { name: surface?.name ?? '', mediaType: surface?.mediaType ?? item.groupLabel, status: surface?.status, carrier: surface?.carrier ?? { code: '', name: '', city: '' }, photos: surface?.photos.map((photo) => ({ ...photo, note: null, isPrimary: false })) ?? [] } }; }) };
  const canNext = step === 0 ? Boolean(clientId && title) : step === 1 ? Boolean(campaignGoal) : step === 2 ? Boolean(budget) : step === 3 ? Boolean(campaignName && dateFrom && dateTo && dateFrom <= dateTo) : true;
  const stepReady = [
    Boolean(clientId && title),
    Boolean(campaignGoal),
    Boolean(budget),
    Boolean(campaignName && dateFrom && dateTo && dateFrom <= dateTo),
    true,
    true,
    items.length > 0,
  ];
  const canOpenStep = (index: number) => index <= step || stepReady.slice(0, index).every(Boolean);

  return <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
    <aside className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:self-start lg:overflow-visible lg:px-0"><ol className="flex gap-2 pb-1 lg:block lg:space-y-1 lg:pb-0">{wizardSteps.map((item, index) => { const done = index < step; const active = index === step; const enabled = canOpenStep(index); return <li className="shrink-0 lg:shrink" key={item.key}><button aria-current={active ? 'step' : undefined} className={`flex min-w-44 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 lg:w-full lg:min-w-0 ${active ? 'bg-slate-950 text-white' : done ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-500 hover:bg-slate-100'}`} disabled={!enabled} onClick={() => setStep(index)} type="button"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? 'bg-white text-slate-950' : done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{done ? <Check aria-hidden="true" size={13} /> : index + 1}</span><span className="min-w-0"><span className="block text-sm font-semibold leading-tight">{item.label}</span><span className={`block text-[11px] leading-tight ${active ? 'text-slate-300' : 'text-slate-400'}`}>{item.description}</span></span></button></li>; })}</ol></aside>

    <section className="card min-h-[420px] min-w-0">
      {step === 0 && <div>
        <StepTitle title="Pro koho kampaň připravujeme?" subtitle="Vyberte klienta z CRM nebo založte nového." />
        <div className="space-y-3">
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 space-y-1">
            <div className="grid gap-2 sm:grid-cols-2">
              {clients.map((client) => (
                <button
                  className={`rounded-xl border p-3 text-left transition ${
                    clientId === client.id
                      ? 'border-slate-950 bg-slate-950 text-white ring-1 ring-slate-950 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                  key={client.id}
                  onClick={() => selectClient(client.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-sm truncate">{client.name}</p>
                    {clientId === client.id && <Check size={16} className="text-emerald-400 shrink-0" />}
                  </div>
                  <p className={`mt-0.5 text-xs truncate ${clientId === client.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {client.contactPerson || 'Bez kontaktu'}{client.companyId ? ` · IČO ${client.companyId}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <button className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900" onClick={() => setShowClientForm((open) => !open)} type="button">
            <Plus size={15} /> Založit nového klienta
          </button>
        </div>
        {showClientForm && <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">{Object.entries(newClient).map(([key, current]) => <Field key={key} label={{ name: 'Název', contactPerson: 'Kontaktní osoba', email: 'E-mail', phone: 'Telefon', companyId: 'IČO', note: 'Poznámka' }[key] ?? key}><input className="input" onChange={(event) => setNewClient((value) => ({ ...value, [key]: event.target.value }))} value={current} /></Field>)}<button className="btn-primary sm:col-span-2" onClick={() => void createClient()} type="button">Vytvořit klienta</button></div>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Interní název nabídky"><input className="input" onChange={(event) => { setTitle(event.target.value); touch(); }} value={title} /></Field><Field label="Typ ceníku / kampaně"><select className="input" onChange={(event) => { setPricingTier(event.target.value as 'komerce' | 'kultura'); touch(); }} value={pricingTier}><option value="komerce">Komerční ceník (standardní ceny)</option><option value="kultura">Kulturní / sportovní ceník (zvýhodněné ceny)</option></select></Field><Field label="Kontaktní osoba"><input className="input" onChange={(event) => { setContactPerson(event.target.value); touch(); }} value={contactPerson} /></Field><Field label="E-mail"><input className="input" onChange={(event) => { setContactEmail(event.target.value); touch(); }} type="email" value={contactEmail} /></Field><Field label="Telefon"><input className="input" onChange={(event) => { setContactPhone(event.target.value); touch(); }} value={contactPhone} /></Field></div>
      </div>}

      {step === 1 && <div><StepTitle title="Jaký je cíl kampaně?" subtitle="Cíl ovlivní doporučenou skladbu médií a lokalit." /><div className="grid gap-3 sm:grid-cols-2">{objectives.map(({ title: option, description, Icon }) => <button className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${campaignGoal === option ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`} key={option} onClick={() => { setCampaignGoal(option); touch(); }} type="button"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${campaignGoal === option ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={20} /></span><span><span className="block font-semibold text-slate-950">{option}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span></button>)}</div><Field className="mt-4 block" label="Upřesnění cíle"><textarea className="input min-h-24" onChange={(event) => { setCampaignGoal(event.target.value); touch(); }} value={campaignGoal} /></Field></div>}

      {step === 2 && <div><StepTitle title="Jaký je orientační rozpočet?" subtitle="Slouží k doporučení počtu ploch a médií." /><div className="grid gap-3 sm:grid-cols-2">{budgets.map((tier) => <button className={`rounded-xl border p-4 text-left transition ${budget === tier.value ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`} key={tier.label} onClick={() => { setBudget(tier.value); touch(); }} type="button"><div className="flex items-center justify-between"><p className="font-semibold text-slate-950">{tier.label}</p>{tier.recommended && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"><Sparkles size={12} /> Doporučeno</span>}</div><p className="mt-1 text-sm font-medium text-slate-700">{tier.range}</p><p className="mt-0.5 text-xs text-slate-500">{tier.surfaces}</p></button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Vlastní rozpočet bez DPH"><input className="input" inputMode="decimal" onChange={(event) => { setBudget(event.target.value); touch(); }} value={budget} /></Field><Field label="DPH %"><input className="input" inputMode="decimal" onChange={(event) => { setTaxRate(event.target.value); touch(); }} value={taxRate} /></Field></div></div>}

      {step === 3 && <div><StepTitle title="Kdy má kampaň běžet?" subtitle="Termín ovlivní dostupnost ploch a kontrolu kolizí." /><div className="grid gap-4 sm:grid-cols-2"><Field label="Název kampaně"><input className="input" onChange={(event) => { setCampaignName(event.target.value); touch(); }} value={campaignName} /></Field><Field label="Platnost nabídky"><input className="input" onChange={(event) => { setValidUntil(event.target.value); touch(); }} type="date" value={validUntil} /></Field><Field label="Začátek kampaně"><input className="input" onChange={(event) => { setDateFrom(event.target.value); setItems((rows) => rows.map((row) => ({ ...row, dateFrom: event.target.value }))); touch(); }} type="date" value={dateFrom} /></Field><Field label="Konec kampaně"><input className="input" onChange={(event) => { setDateTo(event.target.value); setItems((rows) => rows.map((row) => ({ ...row, dateTo: event.target.value }))); touch(); }} type="date" value={dateTo} /></Field></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-800 ring-1 ring-sky-200"><CalendarDays size={16} /> Délka kampaně: <strong>{days} dní</strong></div></div>}

      {step === 4 && <div><StepTitle title="Kde chceme být vidět?" subtitle="Vyberte města a lokality pro kampaň." /><div className="grid gap-3 sm:grid-cols-2">{cityOptions.map((city) => { const selected = selectedCities.has(city); const count = resolvedSurfaces.filter((surface) => surface.carrier.city === city).length; return <button className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${selected ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`} key={city} onClick={() => toggleSet(selectedCities, setSelectedCities, city)} type="button"><span><span className="block font-semibold text-slate-950">{city}</span><span className="text-xs text-slate-500">{count} evidovaných ploch</span></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300'}`}>{selected && <Check size={14} />}</span></button>; })}</div></div>}

      {step === 5 && <div><StepTitle title="Koho chceme oslovit?" subtitle="Cílovou skupinu zohledněte v klientském textu nabídky." /><div className="flex flex-wrap gap-2">{audiences.map((audience) => { const selected = selectedAudiences.has(audience.id); return <button className={`rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`} key={audience.id} onClick={() => toggleSet(selectedAudiences, setSelectedAudiences, audience.id)} type="button"><span className="flex items-center gap-2 font-semibold text-slate-950">{selected && <Check size={15} />}{audience.label}</span><span className="mt-0.5 block text-xs text-slate-500">{audience.hint}</span></button>; })}</div><Field className="mt-5 block" label="Text pro klienta"><textarea className="input min-h-28" onChange={(event) => { setClientMessage(event.target.value); touch(); }} value={clientMessage} /></Field><Field className="mt-4 block" label="Interní poznámka (klient ji neuvidí)"><textarea className="input min-h-20" onChange={(event) => { setInternalNote(event.target.value); touch(); }} value={internalNote} /></Field></div>}

      {step === 6 && <div><StepTitle title="Výběr médií" subtitle="Vyberte konkrétní plochy podle preferovaného způsobu." /><div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600">{mediaModes.map(({ key, label, Icon }) => <button className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${mediaMode === key ? 'bg-slate-950 text-white' : 'hover:bg-slate-100'}`} key={key} onClick={() => setMediaMode(key)} type="button"><Icon size={16} />{label}</button>)}</div>
        {(mediaMode === 'map' || mediaMode === 'list') && <OfferSurfaceBrowser conflicts={conflicts} mode={mediaMode} onBulkToggle={bulkToggleSurfaces} onQueryChange={setQuery} onToggle={toggleSurface} query={query} selectedIds={selectedSurfaceIds} surfaces={resolvedSurfaces.filter((surface) => selectedCities.size === 0 || selectedCities.has(surface.carrier.city))} />}
        {mediaMode === 'package' && (mediaPackages.length ? <div className="grid gap-3 md:grid-cols-3">{mediaPackages.map((pkg) => { const selection = selectMediaPackageSurfaces(pkg, availableSurfaces); const selected = selectedPackageId === pkg.id; return <button aria-pressed={selected} className={`flex flex-col rounded-xl border p-4 text-left transition ${selected ? 'border-slate-950 bg-slate-50 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-950'}`} key={pkg.id} onClick={() => selectConfiguredPackage(pkg)} type="button"><div className="flex items-center justify-between gap-2"><p className="font-semibold text-slate-950">{pkg.name}</p>{selected && <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1 text-xs font-semibold text-white"><Check aria-hidden="true" size={12} /> Vybráno</span>}</div><p className="mt-1 text-xs text-slate-500">{pkg.description || pkg.rules.map((rule) => `${rule.quantity}× ${mediaLabel(rule.mediaType)}`).join(' + ')}</p><p className="mt-3 text-2xl font-semibold text-slate-950">{money(pkg.packagePrice ?? selection.surfaces.reduce((sum, surface) => sum + Number(surface.price), 0))}</p><p className={`text-xs ${selection.missing.length ? 'text-amber-700' : 'text-slate-500'}`}>{selection.missing.length ? 'Nelze kompletně sestavit z aktuálního výběru' : `${selection.surfaces.length} konkrétních dostupných ploch`}</p></button>; })}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">V systému zatím není vytvořen žádný aktivní balíček. Plochy lze vybrat z mapy nebo seznamu.</div>)}
        {mediaMode === 'auto' && <div><div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800 ring-1 ring-indigo-200"><Sparkles size={16} />Návrhy vycházejí z vybraných měst, ceny a aktuálně evidovaných ploch.</div><div className="space-y-2">{availableSurfaces.slice(0, 12).map((surface) => { const selected = items.some((item) => item.surfaceId === surface.id); return <div className={`flex items-center gap-3 rounded-xl border p-3 ${selected ? 'border-slate-950 bg-slate-50' : 'border-slate-200'}`} key={surface.id}><span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white"><MapPin size={16} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{surface.carrier.code} · {mediaLabel(surface.mediaType)}</p><p className="truncate text-xs text-slate-500">{surface.carrier.city}, {surface.carrier.locality || surface.carrier.street || surface.name} · {money(surface.price)}</p></div><button className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${selected ? 'bg-slate-950 text-white' : 'border border-slate-200'}`} onClick={() => toggleSurface(surface)} type="button">{selected ? 'Přidáno' : 'Přidat'}</button></div>; })}</div></div>}

        {items.length > 0 && <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">Vybrané plochy</h3><span className="text-sm text-slate-500">{items.length} {items.length === 1 ? 'položka' : items.length < 5 ? 'položky' : 'položek'}</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const surface = resolvedSurfaces.find((row) => row.id === item.surfaceId);
              return (
                <div key={item.surfaceId} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-950 truncate">{surface?.carrier.code} · {surface?.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{surface?.carrier.city} · {surface ? mediaLabel(surface.mediaType) : ''}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.dateFrom ? new Date(item.dateFrom).toLocaleDateString('cs-CZ') : 'bez termínu'} – {item.dateTo ? new Date(item.dateTo).toLocaleDateString('cs-CZ') : 'bez termínu'}</p>
                  </div>
                  <div className="text-right flex flex-col items-end justify-between h-full gap-3 self-stretch">
                    <span className="text-xs font-semibold text-slate-950">{surface ? money(surface.price) : '—'}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 hover:text-red-800 transition"
                      onClick={() => surface && toggleSurface(surface)}
                    >
                      Odebrat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 flex items-center justify-between">
            <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={() => void checkAvailability()} type="button">Zkontrolovat dostupnost</button>
          </div>
          {conflicts.map((conflict) => <div className={`rounded-xl border p-3 text-sm ${conflict.severity === 'block' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`} key={`${conflict.surfaceId}-${conflict.dateFrom}-${conflict.dateTo}-${conflict.status}`}><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} />{conflict.carrierCode} · {conflict.surfaceName}</p><p className="mt-1">{conflict.clientName} / {conflict.campaignName}, {conflict.dateFrom}–{conflict.dateTo}</p></div>)}
          {conflicts.some((conflict) => conflict.severity === 'warning') && !conflicts.some((conflict) => conflict.severity === 'block') && <label className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm"><input checked={confirmNegotiation} onChange={(event) => setConfirmNegotiation(event.target.checked)} type="checkbox" />Potvrzuji pokračování přes varování.</label>}
          <details className="rounded-xl border border-slate-200"><summary className="cursor-pointer p-4 text-sm font-semibold">Náhled nabídky ve v0 designu</summary><div className="border-t border-slate-200"><OfferProposal offer={toProposalOffer(preview)} variant="internal" /></div></details>
          <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40" disabled={saving || !checked || conflicts.some((conflict) => conflict.severity === 'block') || (conflicts.some((conflict) => conflict.severity === 'warning') && !confirmNegotiation)} onClick={() => void save('draft')} type="button">{saving ? 'Ukládám…' : 'Uložit koncept a pokračovat na plánování'}</button>
        </div>}
      </div>}

      {message && <p aria-live="polite" className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{message}</p>}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button"><ArrowLeft size={16} /> Zpět</button>{step < wizardSteps.length - 1 && <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={!canNext} onClick={() => setStep((current) => Math.min(wizardSteps.length - 1, current + 1))} type="button">Pokračovat <ArrowRight size={16} /></button>}</div>
    </section>

    <aside className="lg:sticky lg:top-24 lg:self-start"><div className="card"><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Target aria-hidden="true" className="text-sky-600" size={16} /> Souhrn návrhu</h3>{initialOffer?.id && <span aria-live="polite" className={`text-[11px] font-medium ${autosaveState === 'error' ? 'text-red-600' : autosaveState === 'saved' ? 'text-emerald-600' : 'text-slate-400'}`}>{autosaveState === 'saving' ? 'Uklám…' : autosaveState === 'saved' ? 'Koncept uložen' : autosaveState === 'error' ? 'Automatické uložení selhalo' : dirty ? 'Neuložené změny' : 'Koncept uložen'}</span>}</div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${((step + 1) / wizardSteps.length) * 100}%` }} /></div><p className="mt-2 text-[11px] font-medium text-slate-400">Krok {step + 1} z {wizardSteps.length}</p><dl className="mt-4 space-y-3 text-sm"><SummaryRow label="Klient" value={selectedClient?.name ?? '—'} /><SummaryRow label="Typ ceníku" value={pricingTier === 'kultura' ? 'Kultura / Sport' : 'Komerční'} /><SummaryRow label="Cíl" value={campaignGoal || '—'} /><SummaryRow label="Rozpočet" value={budget ? money(budget) : '—'} /><SummaryRow label="Termín" value={`${days} dní`} /><SummaryRow label="Regiony" value={`${selectedCities.size} měst`} /><SummaryRow label="Cílové skupiny" value={`${selectedAudiences.size}`} /></dl><div className="mt-4 space-y-2 border-t border-slate-100 pt-4"><div className="flex justify-between text-sm"><span className="text-slate-500">Vybrané plochy</span><span className="font-semibold">{items.length}</span></div><div className="flex justify-between"><span className="text-sm text-slate-500">Cena bez DPH</span><span className="text-lg font-bold">{money(totals.subtotal)}</span></div><div className="flex justify-between text-sm"><span className="text-slate-500">Včetně DPH</span><span className="font-semibold text-slate-800">{money(totals.total)}</span></div><p className="text-[11px] text-slate-400">Server cenu i dostupnost před uložením znovu ověří.</p></div></div></aside>
  </div>;
}
