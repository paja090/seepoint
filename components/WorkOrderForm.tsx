'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { workPriorityLabels } from '@/lib/work';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  FolderPlus,
  UserCheck,
  Phone,
  MapPin,
  FileText,
  Clock,
  Paperclip,
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
};

// Aktualizovaný přesný ceník úkolových sazeb
const pieceRateCatalog: Record<string, number> = {
  'Lavička — instalace (výměna grafiky)': 40,
  'City poster grafika — výměna': 60,
  'Minitower — výměna banneru': 150,
  'Tower — výměna banneru': 200,
  'Horizont — instalace': 30,
  'Horizont — deinstalace': 30,
  'CLV (City Light) — instalace': 60,
  'Billboardy — lepení': 500,
  'Navigace — instalace': 200,
  'Navigace — deinstalace': 150,
  'City poster — dovoz': 260,
  'City poster — odvoz': 260,
  'Minitower — instalace & dovoz (vč. plachtování)': 600,
  'Tower — dovoz / odvoz (vč. plachtování)': 1000,
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
}: WorkOrderFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [workType, setWorkType] = useState<'HOURLY' | 'PIECE_RATE' | 'CITY_GALLERY'>('PIECE_RATE');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [ftdUrl, setFtdUrl] = useState('');
  const [noPhotoRequired, setNoPhotoRequired] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [pieceRateType, setPieceRateType] = useState(Object.keys(pieceRateCatalog)[0]);
  const [price, setPrice] = useState('40');
  const [isCalculatedPrice, setIsCalculatedPrice] = useState(true);
  const [estimatedHours, setEstimatedHours] = useState('1');

  const [title, setTitle] = useState(
    initialCarrierCode
      ? `Montáž nosiče ${initialCarrierCode}${initialClientName ? ` — ${initialClientName}` : ''}`
      : ''
  );
  const [locationNote, setLocationNote] = useState('');

  // Auto calculate price for piece-rate work
  const handleQuantityOrRateChange = (newQty: string, newRateType: string, currentWorkType: string) => {
    if (currentWorkType === 'PIECE_RATE') {
      const qtyNum = parseInt(newQty, 10) || 1;
      const rateVal = pieceRateCatalog[newRateType] || 40;
      setPrice(String(qtyNum * rateVal));
      setIsCalculatedPrice(true);
    }
  };

  const handleWorkTypeChange = (newType: 'HOURLY' | 'PIECE_RATE' | 'CITY_GALLERY') => {
    setWorkType(newType);
    if (newType === 'HOURLY') {
      setIsCalculatedPrice(false);
      setPrice('');
    } else if (newType === 'CITY_GALLERY') {
      setIsCalculatedPrice(false);
      setPrice('');
    } else if (newType === 'PIECE_RATE') {
      handleQuantityOrRateChange(quantity, pieceRateType, 'PIECE_RATE');
    }
  };

  const toggleWorker = (workerName: string) => {
    if (selectedWorkers.includes(workerName)) {
      setSelectedWorkers(selectedWorkers.filter((w) => w !== workerName));
    } else {
      setSelectedWorkers([...selectedWorkers, workerName]);
    }
  };

  // Preset Template Quick Fill
  const applyTemplate = (
    preset: 'MEETING' | 'POSTERS' | 'CITY_POSTER_TRANSPORT' | 'BILLBOARD' | 'NAVIGATION' | 'TOWER_DELIVERY' | 'EXPRESS'
  ) => {
    if (preset === 'MEETING') {
      setTitle('Porada týmu & Plánování výjezdů');
      setWorkType('HOURLY');
      setNoPhotoRequired(true);
      setLocationNote('Kancelář Ostrava');
      setPrice('0');
      setEstimatedHours('1.5');
      setIsCalculatedPrice(false);
    } else if (preset === 'POSTERS') {
      setTitle('Výměna plakátů / laviček');
      setWorkType('PIECE_RATE');
      setPieceRateType('Lavička — instalace (výměna grafiky)');
      setQuantity('10');
      setPrice(String(10 * 40));
      setEstimatedHours('2');
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'CITY_POSTER_TRANSPORT') {
      setTitle('Dovoz / Odvoz City poster');
      setWorkType('PIECE_RATE');
      setPieceRateType('City poster — dovoz');
      setQuantity('1');
      setPrice('260');
      setEstimatedHours('1');
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'BILLBOARD') {
      setTitle('Polep billboardu');
      setWorkType('PIECE_RATE');
      setPieceRateType('Billboardy — lepení');
      setQuantity('1');
      setPrice('500');
      setEstimatedHours('1.5');
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'NAVIGATION') {
      setTitle('Instalace navigace');
      setWorkType('PIECE_RATE');
      setPieceRateType('Navigace — instalace');
      setQuantity('1');
      setPrice('200');
      setEstimatedHours('1');
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'TOWER_DELIVERY') {
      setTitle('Dovoz a plachtování Tower');
      setWorkType('PIECE_RATE');
      setPieceRateType('Tower — dovoz / odvoz (vč. plachtování)');
      setQuantity('1');
      setPrice('1000');
      setEstimatedHours('3');
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'EXPRESS') {
      setTitle('Expresní servisní výjezd');
      setWorkType('HOURLY');
      setNoPhotoRequired(false);
      setEstimatedHours('2');
      setIsCalculatedPrice(false);
      setPrice('');
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError('');

    // Photo folder validation only if required and provided
    if (!noPhotoRequired && ftdUrl.trim()) {
      if (!ftdUrl.includes('google.com') && !ftdUrl.includes('drive.google.com')) {
        setError('⚠️ Odkaz na fotodokumentaci musí být platná adresa složky na Google Disku (drive.google.com).');
        setSubmitting(false);
        return;
      }
    }

    if (workType === 'CITY_GALLERY' && (!price || parseFloat(price) <= 0)) {
      setError('⚠️ Pro Galerie venku je nutné zadat ručně platnou cenu.');
      setSubmitting(false);
      return;
    }

    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());

    // Worker names
    payload.workerNames = selectedWorkers.join(', ');

    if (noPhotoRequired) {
      delete payload.ftdUrl;
    }

    for (const field of ['scheduledAt', 'deadlineAt']) {
      const value = payload[field];
      if (typeof value === 'string' && value) payload[field] = new Date(value).toISOString();
    }

    try {
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok || !result?.id) {
        setError(result?.error || 'Pracovní úkol se nepodařilo uložit.');
        setSubmitting(false);
        return;
      }

      formElement.reset();
      router.push(`/work/${result.id}`);
      router.refresh();
    } catch {
      setError('Chyba při komunikaci se serverem.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* QUICK TEMPLATES HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
        <span className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={16} className="text-amber-500" /> Rychlé šablony zadání úkolu:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyTemplate('MEETING')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            💼 Porada / Schůzka
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('POSTERS')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🪧 Lavičky / Plakáty (40/60 Kč)
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('CITY_POSTER_TRANSPORT')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🚚 Dovoz/Odvoz Poster (260 Kč)
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('BILLBOARD')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🎯 Polep billboardu (500 Kč)
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('NAVIGATION')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🧭 Instalace navigace (200 Kč)
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('TOWER_DELIVERY')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🚚 Dovoz & Plachtování Tower (1000 Kč)
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('EXPRESS')}
            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-800 hover:bg-rose-100 transition shadow-2xs"
          >
            🚀 Expresní servis
          </button>
        </div>
      </div>

      <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
        {/* Title */}
        <label className="lg:col-span-2 font-bold text-slate-800 text-sm">
          Název pracovní zakázky *
          <input
            className="input mt-1 w-full font-bold"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Např. Výměna grafiky laviček Koupelny, Dovoz City poster..."
          />
        </label>

        {/* Dates & Duration */}
        <label className="font-bold text-slate-800 text-sm">
          Datum a čas práce *
          <input
            className="input mt-1 w-full"
            name="scheduledAt"
            required
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
          />
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Dokončit nejpozději (Termín)
          <input className="input mt-1 w-full" name="deadlineAt" type="datetime-local" />
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Předpokládaná doba trvání úkolu (v hodinách)
          <div className="relative mt-1">
            <Clock className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              className="input w-full pl-10 font-bold"
              name="estimatedHours"
              type="number"
              step="0.5"
              min="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="Např. 1.5 nebo 2"
            />
          </div>
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Priorita
          <select className="input mt-1 w-full font-semibold" name="priority" defaultValue="NORMAL">
            {Object.entries(workPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {/* Work Type Selection */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
          <label className="block font-bold text-slate-900 text-sm">
            Typ způsobu odměňování / práce *
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleWorkTypeChange('PIECE_RATE')}
              className={`rounded-xl border p-3 text-left font-extrabold text-xs transition ${
                workType === 'PIECE_RATE'
                  ? 'border-sky-600 bg-sky-50 text-sky-950 ring-2 ring-sky-500/30'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block text-sm">📊 Úkolová sazba</span>
              <span className="text-[11px] font-medium text-slate-500">Automatický výpočet dle ceníku úkonů</span>
            </button>

            <button
              type="button"
              onClick={() => handleWorkTypeChange('HOURLY')}
              className={`rounded-xl border p-3 text-left font-extrabold text-xs transition ${
                workType === 'HOURLY'
                  ? 'border-sky-600 bg-sky-50 text-sky-950 ring-2 ring-sky-500/30'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block text-sm">⏱️ Hodinová sazba</span>
              <span className="text-[11px] font-medium text-slate-500">Účtováno hodinovou sazbou montážníka</span>
            </button>

            <button
              type="button"
              onClick={() => handleWorkTypeChange('CITY_GALLERY')}
              className={`rounded-xl border p-3 text-left font-extrabold text-xs transition ${
                workType === 'CITY_GALLERY'
                  ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/30'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="block text-sm">🎨 Galerie venku</span>
              <span className="text-[11px] font-medium text-slate-500">Manuálně zadaná pevná cena</span>
            </button>
          </div>
          <input type="hidden" name="workType" value={workType} />
        </div>

        {/* Price & Rate Logic */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <label className="block font-bold text-slate-900 text-sm">
            Cena za úkol (Kč bez DPH)
            <input
              className={`input mt-1 w-full font-black text-base ${
                isCalculatedPrice ? 'bg-emerald-50 text-emerald-950 border-emerald-300' : ''
              }`}
              name="price"
              min="0"
              step="0.01"
              type="number"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setIsCalculatedPrice(false);
              }}
              placeholder={
                workType === 'HOURLY'
                  ? 'Ponechte prázdné pro hodinovou sazbu...'
                  : 'Zadejte celkovou cenu úkolu v Kč...'
              }
            />
          </label>

          {workType === 'PIECE_RATE' && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Položka z úkolového ceníku:
                  <select
                    className="input mt-1 w-full text-xs font-semibold"
                    value={pieceRateType}
                    onChange={(e) => {
                      setPieceRateType(e.target.value);
                      handleQuantityOrRateChange(quantity, e.target.value, 'PIECE_RATE');
                    }}
                  >
                    {Object.entries(pieceRateCatalog).map(([name, rate]) => (
                      <option key={name} value={name}>
                        {name} — {rate} Kč/ks
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  Počet kusů:
                  <input
                    className="input mt-1 w-full text-xs font-bold"
                    type="number"
                    min="1"
                    name="quantity"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      handleQuantityOrRateChange(e.target.value, pieceRateType, 'PIECE_RATE');
                    }}
                  />
                </label>
              </div>

              <span className="text-xs font-bold text-emerald-800 block bg-emerald-100/60 p-2.5 rounded-xl border border-emerald-200">
                ✨ Automatický výpočet: {quantity} ks × {pieceRateCatalog[pieceRateType]} Kč = <strong>{price} Kč bez DPH</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Location & Client Phone */}
        <label className="font-bold text-slate-800 text-sm">
          Místo plnění / Lokace / Adresa
          <div className="relative mt-1">
            <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              className="input w-full pl-10"
              name="locationNote"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              placeholder="Např. Kancelář Ostrava, Městský úřad, Nosič..."
            />
          </div>
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Telefon na klienta / kontakt (nepovinné)
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
            <input className="input w-full pl-10" name="contactPhone" placeholder="+420 777 123 456" />
          </div>
        </label>

        {/* Google Drive Photo Folder & PDF Attachments */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FolderPlus size={18} className="text-emerald-600" />
              Složka pro fotky z terénu (Google Disk)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-slate-700 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs hover:bg-slate-50">
              <input
                type="checkbox"
                checked={noPhotoRequired}
                onChange={(e) => setNoPhotoRequired(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span>Fotodokumentace není vyžadována (porada, vnitřní úkol)</span>
            </label>
          </div>

          {!noPhotoRequired && (
            <input
              className="input w-full bg-white font-mono text-xs border-slate-300 focus:border-emerald-600 focus:ring-emerald-500"
              name="ftdUrl"
              type="url"
              value={ftdUrl}
              onChange={(e) => setFtdUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          )}

          <div className="pt-2 border-t border-slate-200">
            <label className="block font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
              <Paperclip size={18} className="text-sky-600" />
              Odkaz na PDF podklady / přílohy ke stažení (nepovinné)
            </label>
            <input
              className="input w-full bg-white text-xs border-slate-300"
              name="pdfUrl"
              type="url"
              placeholder="https://.../tiskovy-nahled.pdf nebo odkaz na PDF podklady"
            />
          </div>
        </div>

        {/* Auto pre-filled Requester */}
        <label className="font-bold text-slate-800 text-sm">
          Úkol zadal/a *
          <input
            className="input mt-1 w-full bg-slate-100 font-bold text-slate-700"
            name="requestedBy"
            readOnly
            value={currentUserName || 'Přihlášený zadavatel'}
          />
        </label>

        {/* Worker Selection Checklist */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <label className="block font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>👥 Přiřazení pracovníci ze systému</span>
            <span className="text-xs text-sky-700 font-semibold">Vybráno ({selectedWorkers.length})</span>
          </label>

          {employees.length === 0 ? (
            <input
              className="input w-full text-xs"
              name="workerNames"
              placeholder="Jména pracovníků oddělená čárkou (např. Pavel, Mirek)"
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-40 overflow-y-auto pr-1">
              {employees.map((emp) => {
                const checked = selectedWorkers.includes(emp.name);
                return (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer transition ${
                      checked
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleWorker(emp.name)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span>{emp.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Client & Media Details */}
        <label className="font-bold text-slate-800 text-sm">
          Klient
          <select className="input mt-1 w-full" name="clientId" defaultValue="">
            <option value="">Bez vybraného klienta</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </select>
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Název klienta (pokud není v seznamu)
          <input className="input mt-1 w-full" name="clientName" defaultValue={initialClientName} placeholder="Název klienta" />
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Typ média
          <input className="input mt-1 w-full" name="mediaLabel" placeholder="Lavičky, billboard, city poster..." />
        </label>

        {/* Carrier list */}
        <label className="lg:col-span-2 font-bold text-slate-800 text-sm">
          Propojený nosič VO
          <input
            className="input mt-1 w-full font-bold text-sky-900 bg-sky-50"
            list="work-carriers"
            name="carrierCode"
            defaultValue={initialCarrierCode}
            onChange={(e) => {
              const code = e.target.value;
              const found = carriers.find((c) => c.code === code);
              if (found && !locationNote) {
                setLocationNote(found.label);
              }
            }}
            placeholder="Začněte psát kód, město nebo název nosiče"
          />
          <datalist id="work-carriers">
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.code}>
                {carrier.label}
              </option>
            ))}
          </datalist>
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Platnost kampaně od
          <input className="input mt-1 w-full" name="campaignDateFrom" type="date" defaultValue={initialCampaignDateFrom} />
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Platnost kampaně do
          <input className="input mt-1 w-full" name="campaignDateTo" type="date" defaultValue={initialCampaignDateTo} />
        </label>

        <label className="lg:col-span-2 font-bold text-slate-800 text-sm">
          Podrobné zadání úkolu *
          <textarea
            className="input mt-1 w-full min-h-24 font-medium"
            name="description"
            required
            placeholder="Popis požadovaných prací, instrukce pro montážníky..."
          />
        </label>

        {error && (
          <div className="lg:col-span-2 flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-800 border border-rose-200">
            <ShieldAlert size={18} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="lg:col-span-2">
          <button
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-black text-white shadow-lg hover:bg-slate-800 active:scale-98 transition disabled:opacity-50 text-base"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Ukládám a notifikuji pracovníky...' : '💾 Vytvořit a uložit pracovní úkol'}
          </button>
        </div>
      </form>
    </div>
  );
}
