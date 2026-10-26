'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { agencyWorkCategories, workPriorityLabels, type WorkScope } from '@/lib/work';
import type { WorkCategory } from '@/lib/work-categories';
import { useQuickTaskVoice } from '@/components/tasks/useQuickTaskVoice';
import { WorkOrderLocationPicker } from '@/components/WorkOrderLocationPicker';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  MapPin,
  Upload,
  Hammer,
  Car,
  Mic,
  Loader2,
} from 'lucide-react';

type SavedPlaceItem = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contactName?: string;
  contactPhone?: string;
  openingHours?: string;
  website?: string;
  accessNote?: string;
};

type Option = { id: string; label: string };
type CarrierOption = Option & { code: string };
type EmployeeOption = { id: string; name: string };

type WorkOrderFormProps = {
  clients: Option[];
  carriers: CarrierOption[];
  employees?: EmployeeOption[];
  currentUserName?: string;
  initialCarrierCode?: string;
  initialClientName?: string;
  initialCampaignDateFrom?: string;
  initialCampaignDateTo?: string;
  categories?: WorkCategory[];
};

export function WorkOrderForm({
  clients,
  carriers,
  employees = [],
  currentUserName = '',
  initialCarrierCode = '',
  initialClientName = '',
  initialCampaignDateFrom = '',
  initialCampaignDateTo = '',
  categories,
}: WorkOrderFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [aiPlaceDetails, setAiPlaceDetails] = useState<{
    openingHours?: string;
    contactPhone?: string;
    contactName?: string;
    website?: string;
    accessNote?: string;
    locationAddress?: string;
  } | null>(null);

  const voice = useQuickTaskVoice(true, (transcript) => {
    setAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
    setAiSuccessMsg(null);
  });

  const handleAiParse = async () => {
    const p = aiPrompt.trim();
    if (!p) return;
    setAiLoading(true);
    setAiSuccessMsg(null);
    setAiPlaceDetails(null);
    setError('');
    try {
      const res = await fetch('/api/ai/parse-work-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'AI se nepodařilo zadání zpracovat.');

      const data = result.data;
      if (data.title) setTitle(data.title);
      if (data.scope) {
        setScope(data.scope);
        if (data.categoryKey) setActiveCategory(data.categoryKey);
      } else if (data.categoryKey) {
        setActiveCategory(data.categoryKey);
      }
      if (data.clientId) {
        setClientId(data.clientId);
        setIsInternal(false);
      } else if (data.clientName) {
        setCustomClientName(data.clientName);
        setClientId('');
        setIsInternal(false);
      } else if (data.isInternal) {
        setIsInternal(true);
      }
      if (data.scheduledAt) setScheduledAt(data.scheduledAt);
      if (data.deadlineAt) setDeadlineAt(data.deadlineAt);
      if (data.estimatedHours) setEstimatedHours(String(data.estimatedHours));
      if (data.priority) setPriority(data.priority);
      if (Array.isArray(data.workerNames) && data.workerNames.length > 0) {
        setSelectedWorkers(data.workerNames);
      }
      if (data.locationAddress) {
        setLocationAddress(data.locationAddress);
        if (data.scope === 'WORKSHOP') setShowWorkshopMap(true);
      }
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        setCoords({ latitude: data.latitude, longitude: data.longitude });
        if (data.scope === 'WORKSHOP') setShowWorkshopMap(true);
      }
      if (typeof data.contactName === 'string' && data.contactName.trim()) {
        setContactName(data.contactName.trim());
      }
      if (typeof data.contactPhone === 'string' && data.contactPhone.trim()) {
        setContactPhone(data.contactPhone.trim());
      }
      const noteParts: string[] = [];
      if (typeof data.openingHours === 'string' && data.openingHours.trim()) {
        noteParts.push(`Otevírací doba: ${data.openingHours.trim()}`);
      }
      if (typeof data.accessNote === 'string' && data.accessNote.trim()) {
        if (!noteParts.some((pt) => data.accessNote.includes(pt))) {
          noteParts.push(data.accessNote.trim());
        } else {
          noteParts.splice(0, noteParts.length, data.accessNote.trim());
        }
      }
      if (noteParts.length > 0) {
        setAccessNote(noteParts.join(' · '));
      }
      if (typeof data.quantity === 'number' && data.quantity > 0) {
        setQuantity(String(data.quantity));
      }
      if (data.description) setDescription(data.description);

      if (
        data.openingHours ||
        data.contactPhone ||
        data.contactName ||
        data.website ||
        data.accessNote
      ) {
        setAiPlaceDetails({
          openingHours: data.openingHours || undefined,
          contactPhone: data.contactPhone || undefined,
          contactName: data.contactName || undefined,
          website: data.website || undefined,
          accessNote: data.accessNote || undefined,
          locationAddress: data.locationAddress || undefined,
        });
      }

      const locSummary = data.locationAddress || (data.latitude && data.longitude ? 'zadána v mapě' : '');
      setAiSuccessMsg(
        `AI úspěšně předvyplnila formulář: „${data.title}“ (odhad: ${data.estimatedHours || 2} h${
          locSummary ? `, lokalita: ${locSummary}` : ''
        }).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI zpracování selhalo.');
    } finally {
      setAiLoading(false);
    }
  };

  const allCategories = categories && categories.length > 0 ? categories : agencyWorkCategories;

  // Primary Scope: Workshop (internal) vs Field (on-site / travel)
  const [scope, setScope] = useState<WorkScope>(initialCarrierCode ? 'FIELD' : 'WORKSHOP');

  // Active Category from Agency Catalog
  const defaultCategory =
    allCategories.find((c) => c.scope === (initialCarrierCode ? 'FIELD' : 'WORKSHOP'))?.key ||
    (initialCarrierCode ? 'FIELD_INSTALL' : 'PRINT');
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategory);

  // Form Fields
  const [title, setTitle] = useState(
    initialCarrierCode
      ? `Montáž nosiče ${initialCarrierCode}${initialClientName ? ` — ${initialClientName}` : ''}`
      : ''
  );
  const [clientId, setClientId] = useState('');
  const [customClientName, setCustomClientName] = useState(initialClientName || '');
  const [isInternal, setIsInternal] = useState(false);

  // Date and Priority
  const todayDate = new Date().toISOString().slice(0, 10);
  const [scheduledAt, setScheduledAt] = useState(
    initialCampaignDateFrom ? `${initialCampaignDateFrom.slice(0, 10)}T08:00` : `${todayDate}T08:00`
  );
  const [deadlineAt, setDeadlineAt] = useState(
    initialCampaignDateTo ? `${initialCampaignDateTo.slice(0, 10)}T16:00` : ''
  );
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');

  // People & Assignment
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [requestedBy, setRequestedBy] = useState(currentUserName || (employees[0]?.name ?? 'Dispečink'));

  // Description & Time
  const [estimatedHours, setEstimatedHours] = useState('2');
  const [description, setDescription] = useState('');

  // Field Specifics & Map Coordinates
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showWorkshopMap, setShowWorkshopMap] = useState(false);
  const [locationAddress, setLocationAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [accessNote, setAccessNote] = useState('');
  const [selectedCarrierCode, setSelectedCarrierCode] = useState(initialCarrierCode || '');

  // Saved Frequent Places
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>([]);
  const [savingPlace, setSavingPlace] = useState(false);
  const [savedPlaceFeedback, setSavedPlaceFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/work/saved-places')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.places)) {
          setSavedPlaces(data.places);
        }
      })
      .catch(() => {
        // Silent fallback
      });
  }, []);

  const handleSaveCurrentPlace = async () => {
    const selectedClientLabel = clients.find((c) => c.id === clientId)?.label || '';
    const defaultName =
      customClientName.trim() ||
      selectedClientLabel.trim() ||
      contactName.trim() ||
      locationAddress.split(',')[0]?.trim() ||
      title.trim();
    const promptedName = window.prompt(
      'Pojmenujte toto časté místo (např. „Půjčovna ČEVAS Sviadnov“, „Sklad Frýdek“, „Tiskárna Ostrava“):',
      defaultName
    );
    if (!promptedName || !promptedName.trim()) return;

    setSavingPlace(true);
    setSavedPlaceFeedback(null);
    try {
      const res = await fetch('/api/work/saved-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: promptedName.trim(),
          address: locationAddress.trim(),
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          contactName: contactName.trim() || aiPlaceDetails?.contactName || undefined,
          contactPhone: contactPhone.trim() || aiPlaceDetails?.contactPhone || undefined,
          openingHours: aiPlaceDetails?.openingHours || undefined,
          website: aiPlaceDetails?.website || undefined,
          accessNote: accessNote.trim() || aiPlaceDetails?.accessNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení místa selhalo.');
      if (Array.isArray(data.places)) {
        setSavedPlaces(data.places);
      }
      setSavedPlaceFeedback(`Místo „${promptedName.trim()}“ bylo uloženo mezi častá místa (AI ho příště automaticky pozná).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Uložení místa selhalo.');
    } finally {
      setSavingPlace(false);
    }
  };

  const handleSelectSavedPlace = (place: SavedPlaceItem) => {
    if (place.address) setLocationAddress(place.address);
    if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
      setCoords({ latitude: place.latitude, longitude: place.longitude });
    }
    if (place.contactName) setContactName(place.contactName);
    if (place.contactPhone) setContactPhone(place.contactPhone);
    const noteParts: string[] = [];
    if (place.openingHours) noteParts.push(`Otevírací doba: ${place.openingHours}`);
    if (place.accessNote) {
      if (!noteParts.some((pt) => place.accessNote?.includes(pt))) {
        noteParts.push(place.accessNote);
      } else {
        noteParts.splice(0, noteParts.length, place.accessNote);
      }
    }
    if (noteParts.length > 0) setAccessNote(noteParts.join(' · '));
    if (!clientId && !customClientName) {
      setCustomClientName(place.name);
    }
    if (scope === 'WORKSHOP') {
      setShowWorkshopMap(true);
    }
    setAiPlaceDetails({
      openingHours: place.openingHours,
      contactPhone: place.contactPhone,
      contactName: place.contactName || place.name,
      website: place.website,
      accessNote: place.accessNote,
      locationAddress: place.address,
    });
    setSavedPlaceFeedback(`Načteno uložené místo: „${place.name}“ (${place.address || 'včetně GPS polohy'}).`);
  };

  const handleDeleteSavedPlace = async (id: string, name: string) => {
    if (!window.confirm(`Opravdu odebrat „${name}“ z častých míst?`)) return;
    try {
      const res = await fetch(`/api/work/saved-places?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.places)) {
        setSavedPlaces(data.places);
      }
    } catch {
      // Ignore
    }
  };

  // Pricing Model
  const [priceType, setPriceType] = useState<'HOURLY' | 'FIXED' | 'PIECE_RATE'>('HOURLY');
  const [fixedPrice, setFixedPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitRate, setUnitRate] = useState('150');

  // Attachments
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [ftdUrl, setFtdUrl] = useState('');

  const availableCategories = allCategories.filter((c) => c.scope === scope);

  const selectCategory = (catKey: string) => {
    setActiveCategory(catKey);
    const cat = allCategories.find((c) => c.key === catKey);
    if (!cat) return;
    if (!title || allCategories.some((c) => title.startsWith(c.label.slice(0, 8)))) {
      setTitle(`${cat.label}`);
    }
  };

  const switchScope = (newScope: WorkScope) => {
    setScope(newScope);
    const firstCat = allCategories.find((c) => c.scope === newScope);
    if (firstCat) {
      setActiveCategory(firstCat.key);
      if (!title || allCategories.some((c) => title.startsWith(c.label.slice(0, 8)))) {
        setTitle(firstCat.label);
      }
    }
  };

  const toggleWorker = (name: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(name) ? prev.filter((w) => w !== name) : [...prev, name]
    );
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/work-orders/pdf-upload', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json()) as { url?: string; fileName?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Nahrání selhalo');
      setPdfUrl(data.url);
      setPdfFileName(file.name);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Nahrání PDF selhalo.');
    } finally {
      setPdfUploading(false);
    }
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!title.trim()) {
      setError('Vyplňte prosím název práce / zakázky.');
      setSubmitting(false);
      return;
    }

    if (!description.trim()) {
      setError('Vyplňte podrobnější zadání nebo instrukce pro pracovníky.');
      setSubmitting(false);
      return;
    }

    // Determine Client Name
    let resolvedClientName = 'Interní zakázka';
    if (!isInternal) {
      if (clientId) {
        const found = clients.find((c) => c.id === clientId);
        resolvedClientName = found ? found.label : customClientName.trim() || 'Bez klienta';
      } else if (customClientName.trim()) {
        resolvedClientName = customClientName.trim();
      }
    }

    // Calculate Final Price
    let computedPrice: string | undefined;
    if (priceType === 'FIXED' && fixedPrice.trim()) {
      computedPrice = fixedPrice.trim();
    } else if (priceType === 'PIECE_RATE') {
      const q = parseInt(quantity, 10) || 1;
      const r = parseFloat(unitRate) || 0;
      computedPrice = String(q * r);
    }

    // Find category info
    const cat = allCategories.find((c) => c.key === activeCategory);
    const workType = cat?.defaultWorkType ?? 'INSTALLATION';

    // Build location note
    let fullLocationNote = locationAddress.trim();
    if (accessNote.trim()) {
      fullLocationNote = fullLocationNote
        ? `${fullLocationNote} (Pozn: ${accessNote.trim()})`
        : accessNote.trim();
    }
    if (scope === 'WORKSHOP' && !fullLocationNote) {
      fullLocationNote = 'Dílna / Výroba';
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      scope,
      scheduledAt: new Date(scheduledAt).toISOString(),
      deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : undefined,
      priority,
      workType,
      clientId: isInternal ? undefined : clientId || undefined,
      clientName: resolvedClientName,
      requestedBy: requestedBy.trim(),
      workerNames: selectedWorkers.join(', '),
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      locationNote: fullLocationNote || undefined,
      locationAddress: locationAddress.trim() || undefined,
      latitude: coords?.latitude ?? undefined,
      longitude: coords?.longitude ?? undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      carrierCode: scope === 'FIELD' && selectedCarrierCode ? selectedCarrierCode : undefined,
      mediaLabel: cat?.label ?? (scope === 'WORKSHOP' ? 'Dílna' : 'Výjezd'),
      quantity: priceType === 'PIECE_RATE' ? parseInt(quantity, 10) || 1 : undefined,
      price: computedPrice,
      pdfUrl: pdfUrl || undefined,
      ftdUrl: ftdUrl.trim() || undefined,
    };

    try {
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        setError(result?.error || 'Pracovní zakázku se nepodařilo uložit.');
        setSubmitting(false);
        return;
      }

      router.push(`/work/${result.id}`);
      router.refresh();
    } catch {
      setError('Chyba při komunikaci se serverem.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 0. AI SMART ASSISTANT BANNER */}
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-sky-600 p-2 text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                AI Rychlé zadání zakázky (textem nebo hlasem)
              </h3>
              <p className="text-xs text-slate-500">
                Napište nebo nadiktujte zadání – AI rozpozná druh práce, klienta, termín a automaticky odhadne potřebný čas.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
            Gemini AI
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAiParse();
                }
              }}
              placeholder="Např.: Tisk 4 ks bannerů 3×1 m pro firmu Louda na pátek od 9:00, dílna, přiřadit Jana Nováka…"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              disabled={aiLoading}
            />
            <button
              type="button"
              onClick={() => {
                if (voice.state === 'recording') {
                  voice.stop();
                } else {
                  voice.start();
                }
              }}
              disabled={voice.state === 'transcribing' || aiLoading}
              className={`absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors text-xs font-semibold ${
                voice.state === 'recording'
                  ? 'bg-red-500 text-white animate-pulse'
                  : voice.state === 'transcribing'
                  ? 'bg-amber-100 text-amber-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title={
                voice.state === 'recording'
                  ? 'Klikněte pro zastavení nahrávání a přepis'
                  : 'Diktovat hlasem (přepis přes Gemini AI)'
              }
            >
              {voice.state === 'recording' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>{voice.seconds}s (Hotovo)</span>
                </>
              ) : voice.state === 'transcribing' ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Přepisuji…</span>
                </>
              ) : (
                <>
                  <Mic size={16} />
                  <span className="hidden sm:inline">Diktovat</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleAiParse}
            disabled={aiLoading || !aiPrompt.trim() || voice.busy}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 font-bold text-xs sm:text-sm text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50"
          >
            {aiLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Analyzuji…</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Předvyplnit pomocí AI</span>
              </>
            )}
          </button>
        </div>

        {voice.error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-center gap-2 font-medium">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <span>{voice.error}</span>
          </div>
        )}

        {aiSuccessMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
            <span>{aiSuccessMsg}</span>
          </div>
        )}

        {aiPlaceDetails && (
          <div className="rounded-2xl bg-white/90 border border-sky-200 p-3 text-xs text-slate-700 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-sky-900 flex items-center gap-1.5">
                <MapPin size={14} className="text-sky-600 shrink-0" />
                <span>AI dohledala podrobnosti o provozovně / místě (automaticky propsáno do formuláře):</span>
              </div>
              <button
                type="button"
                onClick={handleSaveCurrentPlace}
                disabled={savingPlace}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 text-[11px] font-bold text-amber-900 transition cursor-pointer disabled:opacity-50"
                title="Uložit toto místo včetně adresy, GPS, telefonu a otevírací doby pro příští zakázky"
              >
                <Bookmark size={12} className="text-amber-600" />
                <span>{savingPlace ? 'Ukládám…' : '⭐ Uložit mezi častá místa'}</span>
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 pt-0.5">
              {aiPlaceDetails.openingHours && (
                <div className="flex items-start gap-1.5 bg-amber-50/80 border border-amber-200/80 rounded-xl px-2.5 py-1.5 text-amber-950">
                  <span className="font-bold shrink-0">🕒 Otevírací doba:</span>
                  <span className="font-semibold">{aiPlaceDetails.openingHours}</span>
                </div>
              )}
              {aiPlaceDetails.contactPhone && (
                <div className="flex items-start gap-1.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 text-emerald-950">
                  <span className="font-bold shrink-0">📞 Telefon:</span>
                  <a
                    href={`tel:${aiPlaceDetails.contactPhone}`}
                    className="font-semibold underline hover:text-emerald-700"
                  >
                    {aiPlaceDetails.contactPhone}
                  </a>
                </div>
              )}
              {aiPlaceDetails.contactName && (
                <div className="flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <span className="font-bold shrink-0">👤 Kontakt / provozovna:</span>
                  <span>{aiPlaceDetails.contactName}</span>
                </div>
              )}
              {aiPlaceDetails.website && (
                <div className="flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <span className="font-bold shrink-0">🌐 Web:</span>
                  <a
                    href={aiPlaceDetails.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 underline truncate hover:text-sky-900"
                  >
                    {aiPlaceDetails.website}
                  </a>
                </div>
              )}
              {aiPlaceDetails.accessNote && (
                <div className="sm:col-span-2 flex items-start gap-1.5 bg-sky-50/60 border border-sky-200/60 rounded-xl px-2.5 py-1.5 text-slate-800">
                  <span className="font-bold shrink-0">ℹ️ Poznámka pro posádku:</span>
                  <span>{aiPlaceDetails.accessNote}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {savedPlaceFeedback && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center gap-2 font-medium">
            <Bookmark size={14} className="text-amber-600 flex-shrink-0" />
            <span>{savedPlaceFeedback}</span>
          </div>
        )}
      </div>

      {/* 1. TOP SEGMENTED CONTROL: WORKSHOP VS FIELD */}
      <div className="rounded-3xl bg-slate-100 p-1.5 shadow-inner flex items-center">
        <button
          type="button"
          onClick={() => switchScope('WORKSHOP')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200 ${
            scope === 'WORKSHOP'
              ? 'bg-white text-slate-900 shadow-md ring-2 ring-sky-500/20 scale-[1.01]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Hammer size={18} className={scope === 'WORKSHOP' ? 'text-sky-600' : 'text-slate-400'} />
          <span>🏭 Práce na firmě (Dílna / Tisk / DTP)</span>
        </button>

        <button
          type="button"
          onClick={() => switchScope('FIELD')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200 ${
            scope === 'FIELD'
              ? 'bg-white text-slate-900 shadow-md ring-2 ring-emerald-500/20 scale-[1.01]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car size={18} className={scope === 'FIELD' ? 'text-emerald-600' : 'text-slate-400'} />
          <span>🚗 Výjezd / Montáž u klienta</span>
        </button>
      </div>

      {/* 2. CATEGORY QUICK CHIPS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Vyberte typ činnosti:
          </label>
          <a
            href="/settings/work"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
            title="Upravit nebo přidat činnosti firmy v Nastavení"
          >
            ⚙️ Upravit činnosti firmy
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((cat) => {
            const isSelected = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => selectCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  isSelected
                    ? scope === 'WORKSHOP'
                      ? 'border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-300'
                      : 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-slate-800 block mb-1">
            Název zakázky / úkolu *
          </label>
          <input
            className="input w-full font-bold text-base"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              scope === 'WORKSHOP'
                ? 'Např. Tisk 10 ks velkoformátových plachet s očky...'
                : 'Např. Polep výlohy lékárny Dr. Max, Montáž světelného loga...'
            }
          />
        </div>

        {/* Client Selection */}
        <div className="space-y-1 sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 block">Zákazník / Klient</label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Interní práce pro vlastní firmu (bez zákazníka)</span>
            </label>
          </div>

          {!isInternal && (
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div>
                <select
                  className="input w-full text-xs font-semibold"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    if (e.target.value) setCustomClientName('');
                  }}
                >
                  <option value="">Vyberte ze stávajících klientů…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  className="input w-full text-xs font-medium"
                  placeholder="Nebo vepište jméno / firmu nového zákazníka..."
                  value={customClientName}
                  onChange={(e) => {
                    setCustomClientName(e.target.value);
                    if (e.target.value) setClientId('');
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* WORKSHOP OPTIONAL LOCATION: For pickups, supplier stops, deliveries */}
        {scope === 'WORKSHOP' && (
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                <MapPin size={15} className="text-slate-500" />
                <span>Místo expedice, vyzvednutí nebo dodání (volitelné pro dílnu)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkshopMap((prev) => !prev)}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline cursor-pointer"
              >
                {showWorkshopMap ? 'Skrýt mapu' : coords ? 'Zobrazit zadanou polohu v mapě' : 'Označit místo na mapě'}
              </button>
            </div>

            {savedPlaces.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 block">
                  ⭐ Častá místa firmy (kliknutím vyplníte adresu, GPS i otevírací dobu):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {savedPlaces.map((sp) => (
                    <div
                      key={sp.id}
                      className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50/70 text-xs font-semibold text-slate-800 shadow-2xs overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSavedPlace(sp)}
                        className="px-2.5 py-1 hover:bg-amber-100/80 transition flex items-center gap-1.5 text-left cursor-pointer"
                        title={[sp.address, sp.openingHours ? `Otevírací doba: ${sp.openingHours}` : '', sp.contactPhone]
                          .filter(Boolean)
                          .join(' · ')}
                      >
                        <span>📍 {sp.name}</span>
                        {sp.openingHours && (
                          <span className="text-[10px] font-medium text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-md">
                            {sp.openingHours}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedPlace(sp.id, sp.name)}
                        className="px-1.5 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Odebrat z častých míst"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showWorkshopMap && (
              <div className="pt-2 space-y-2">
                <WorkOrderLocationPicker
                  locationAddress={locationAddress}
                  onAddressChange={(newAddr) => setLocationAddress(newAddr)}
                  coords={coords}
                  onCoordsChange={(newCoords) => setCoords(newCoords)}
                  scope={scope}
                />
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="text-xs font-bold text-slate-700 block">
                        Adresa nebo poznámka k místu
                      </label>
                      {(locationAddress.trim() || coords) && (
                        <button
                          type="button"
                          onClick={handleSaveCurrentPlace}
                          disabled={savingPlace}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg px-2 py-0.5 transition cursor-pointer"
                        >
                          <Bookmark size={11} />
                          <span>{savingPlace ? 'Ukládám…' : '⭐ Uložit do častých míst'}</span>
                        </button>
                      )}
                    </div>
                    <input
                      className="input w-full text-xs font-semibold"
                      placeholder="Např. Vyzvednutí materiálu v půjčovně..."
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Telefon / Kontakt na místě
                    </label>
                    <input
                      className="input w-full text-xs font-medium"
                      placeholder="+420..."
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Otevírací doba / Přístupová poznámka
                    </label>
                    <input
                      className="input w-full text-xs font-medium"
                      placeholder="Např. Po–Pá 6:30–16:00"
                      value={accessNote}
                      onChange={(e) => setAccessNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FIELD SPECIFICS: Address, Contact & Carrier */}
        {scope === 'FIELD' && (
          <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs uppercase tracking-wider">
                <MapPin size={16} className="text-emerald-600" />
                <span>Lokalita realizace & Montážní informace</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                🛰️ Letecká mapa & GPS cíl
              </span>
            </div>

            {savedPlaces.length > 0 && (
              <div className="rounded-xl bg-white/80 border border-emerald-200/80 p-2.5 space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-950 block">
                  ⭐ Častá / uložená místa firmy (kliknutím předvyplníte adresu, GPS, kontakt i otevírací dobu):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {savedPlaces.map((sp) => (
                    <div
                      key={sp.id}
                      className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50/80 text-xs font-semibold text-slate-800 shadow-2xs overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSavedPlace(sp)}
                        className="px-2.5 py-1 hover:bg-amber-100 transition flex items-center gap-1.5 text-left cursor-pointer"
                        title={[sp.address, sp.openingHours ? `Otevírací doba: ${sp.openingHours}` : '', sp.contactPhone]
                          .filter(Boolean)
                          .join(' · ')}
                      >
                        <span>📍 {sp.name}</span>
                        {sp.openingHours && (
                          <span className="text-[10px] font-medium text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded-md">
                            {sp.openingHours}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedPlace(sp.id, sp.name)}
                        className="px-1.5 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        title="Odebrat z častých míst"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Aerial/Satellite Location Picker Map */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-700 block">
                Zadání místa v mapě (vyhledat adresu nebo zakliknout bod do letecké mapy pro navigaci posádky):
              </label>
              <WorkOrderLocationPicker
                locationAddress={locationAddress}
                onAddressChange={(newAddr) => setLocationAddress(newAddr)}
                coords={coords}
                onCoordsChange={(newCoords) => setCoords(newCoords)}
                scope={scope}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Adresa místa montáže / výjezdu (kam posádka jede)
                  </label>
                  {(locationAddress.trim() || coords) && (
                    <button
                      type="button"
                      onClick={handleSaveCurrentPlace}
                      disabled={savingPlace}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-0.5 transition cursor-pointer"
                    >
                      <Bookmark size={11} className="text-amber-600" />
                      <span>{savingPlace ? 'Ukládám…' : '⭐ Uložit toto místo mezi častá'}</span>
                    </button>
                  )}
                </div>
                <input
                  className="input w-full text-xs font-semibold"
                  placeholder="Např. Ostravská 51, Sviadnov nebo Nádražní 45, Ostrava"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 Vyplní se automaticky z mapy, vyhledávání, uložených míst nebo AI zadání. Pokud přesnou adresu nemáte, stačí slovní popis – neblokuje vytvoření zakázky.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kontaktní osoba na místě
                </label>
                <input
                  className="input w-full text-xs font-medium"
                  placeholder="Např. pan Novák (vedoucí prodejny)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Telefon na kontakt
                </label>
                <input
                  className="input w-full text-xs font-medium"
                  placeholder="+420 777 123 456"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Přístupové instrukce a poznámka k montáži
                </label>
                <input
                  className="input w-full text-xs font-medium"
                  placeholder="Např. Žebřík 3m nutný, klíče vyzvednout na recepci budovy B..."
                  value={accessNote}
                  onChange={(e) => setAccessNote(e.target.value)}
                />
              </div>

              {carriers.length > 0 && (
                <div className="sm:col-span-2 pt-1 border-t border-emerald-200/60">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Volitelné: Přiřadit k evidovanému nosiči (billboard / CLV)
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={selectedCarrierCode}
                    onChange={(e) => setSelectedCarrierCode(e.target.value)}
                  >
                    <option value="">Bez pevného nosiče (montáž na adrese klienta)</option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} · {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1">
            Plánovaný termín a čas zahájení *
          </label>
          <input
            type="datetime-local"
            className="input w-full text-xs font-semibold"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1">
            Deadline dokončení (volitelné)
          </label>
          <input
            type="datetime-local"
            className="input w-full text-xs font-semibold"
            value={deadlineAt}
            onChange={(e) => setDeadlineAt(e.target.value)}
          />
        </div>

        {/* Priority */}
        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1">Priorita</label>
          <select
            className="input w-full text-xs font-semibold"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT')}
          >
            {Object.entries(workPriorityLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Estimated Duration */}
        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1">
            Odhadovaný čas (v hodinách)
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            className="input w-full text-xs font-semibold"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="Např. 1.5"
          />
        </div>

        {/* Assigned Workers */}
        <div className="sm:col-span-2 space-y-2">
          <label className="text-xs font-bold text-slate-800 block">
            {scope === 'WORKSHOP' ? 'Zodpovědný pracovník na dílně' : 'Přiřazení montéři / Posádka'}
          </label>
          {employees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {employees.map((emp) => {
                const isSelected = selectedWorkers.includes(emp.name);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleWorker(emp.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck size={14} className={isSelected ? 'text-white' : 'text-slate-400'} />
                    <span>{emp.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Zatím nejsou zaevidováni žádní zaměstnanci.</p>
          )}
        </div>

        {/* Requester */}
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-slate-800 block mb-1">Zadal / Odpovídá *</label>
          <input
            className="input w-full text-xs font-medium"
            required
            value={requestedBy}
            onChange={(e) => setRequestedBy(e.target.value)}
            placeholder="Jméno zadavatele"
          />
        </div>

        {/* Pricing / Remuneration Model */}
        <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Kalkulace a odměna
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPriceType('HOURLY')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  priceType === 'HOURLY'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ⏱️ Hodinovka
              </button>
              <button
                type="button"
                onClick={() => setPriceType('FIXED')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  priceType === 'FIXED'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                💰 Paušál
              </button>
              <button
                type="button"
                onClick={() => setPriceType('PIECE_RATE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  priceType === 'PIECE_RATE'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                🔢 Úkolově (ks)
              </button>
            </div>
          </div>

          {priceType === 'FIXED' && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Pevná cena za úkol (v Kč)
              </label>
              <input
                type="number"
                min="0"
                className="input w-full text-xs font-bold"
                placeholder="Např. 1500"
                value={fixedPrice}
                onChange={(e) => setFixedPrice(e.target.value)}
              />
            </div>
          )}

          {priceType === 'PIECE_RATE' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Počet kusů</label>
                <input
                  type="number"
                  min="1"
                  className="input w-full text-xs font-semibold"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Sazba za kus (Kč)
                </label>
                <input
                  type="number"
                  min="0"
                  className="input w-full text-xs font-semibold"
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                />
              </div>
              <p className="sm:col-span-2 text-xs font-bold text-slate-600">
                Celkem: {(parseInt(quantity, 10) || 1) * (parseFloat(unitRate) || 0)} Kč
              </p>
            </div>
          )}

          {priceType === 'HOURLY' && (
            <p className="text-xs text-slate-500">
              Odměna se dopočítá podle skutečně odpracovaných hodin a hodinové sazby pracovníka.
            </p>
          )}
        </div>

        {/* Attachments & Documentation */}
        <div className="sm:col-span-2 space-y-3">
          <label className="text-xs font-bold text-slate-800 block">
            Podklady pro realizaci (Tisková data / PDF vizualizace)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs">
              <Upload size={14} />
              <span>{pdfUploading ? 'Nahrávám…' : 'Nahrát PDF náhled / vizualizaci'}</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handlePdfUpload}
                disabled={pdfUploading}
              />
            </label>
            {pdfFileName && (
              <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={14} /> {pdfFileName}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Odkaz na fotodokumentaci / cloud tisková data
            </label>
            <input
              type="url"
              className="input w-full text-xs font-semibold"
              placeholder="https://..."
              value={ftdUrl}
              onChange={(e) => setFtdUrl(e.target.value)}
            />
          </div>
        </div>

        {/* Detailed Description */}
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-slate-800 block mb-1">
            Podrobné zadání a pokyny *
          </label>
          <textarea
            className="input w-full min-h-24 font-medium text-xs"
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              scope === 'WORKSHOP'
                ? 'Popište tiskový materiál, formát, laminaci, očkování nebo pokyny pro výrobu...'
                : 'Instrukce pro montážníky, stav na místě, specifika uchycení...'
            }
          />
        </div>

        {error && (
          <div className="sm:col-span-2 flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200">
            <ShieldAlert size={18} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="sm:col-span-2 pt-2">
          <button
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3.5 font-black text-white shadow-lg hover:bg-slate-800 active:scale-[0.99] transition disabled:opacity-50 text-sm"
            disabled={submitting}
            type="submit"
          >
            {submitting
              ? 'Ukládám a zadávám zakázku...'
              : scope === 'WORKSHOP'
              ? '🏭 Zadat úkol do dílny / výroby'
              : '🚗 Vytvořit výjezd pro montéry'}
          </button>
        </div>
      </form>
    </div>
  );
}
