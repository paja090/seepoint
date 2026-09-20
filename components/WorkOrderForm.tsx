'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { agencyWorkCategories, workPriorityLabels, type WorkScope, type WorkPriority } from '@/lib/work';
import type { WorkCategory } from '@/lib/work-categories';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Phone,
  MapPin,
  FileText,
  Clock,
  Paperclip,
  Upload,
  Layers,
  Wrench,
  Printer,
  Palette,
  Hammer,
  Package,
  Car,
  Calendar,
} from 'lucide-react';

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

  // Field Specifics
  const [locationAddress, setLocationAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [accessNote, setAccessNote] = useState('');
  const [selectedCarrierCode, setSelectedCarrierCode] = useState(initialCarrierCode || '');

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

        {/* FIELD SPECIFICS: Address, Contact & Carrier */}
        {scope === 'FIELD' && (
          <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs uppercase tracking-wider">
              <MapPin size={16} className="text-emerald-600" />
              <span>Lokalita realizace & Montážní informace</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Adresa místa montáže (kam posádka jede) *
                </label>
                <input
                  className="input w-full text-xs font-semibold"
                  placeholder="Např. Nádražní 45, Ostrava nebo Obchodní centrum Galerie"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  required
                />
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
