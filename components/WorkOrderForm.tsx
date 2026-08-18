'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { workPriorityLabels, workTypeLabels } from '@/lib/work';
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
  HelpCircle,
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

// Ceník úkolové práce (pro automatický výpočet ceny dle zadaných sazeb)
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
  'Montáž cedule plástve': 450,
  'Reinstalace navigace': 550,
  'Servis / oprava stojanového sloupku': 600,
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
  const [workType, setWorkType] = useState('INSTALLATION');
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [ftdUrl, setFtdUrl] = useState('');
  const [noPhotoRequired, setNoPhotoRequired] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [pieceRateType, setPieceRateType] = useState(Object.keys(pieceRateCatalog)[0]);
  const [price, setPrice] = useState('');
  const [isCalculatedPrice, setIsCalculatedPrice] = useState(false);

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

  const handleWorkTypeChange = (newType: string) => {
    setWorkType(newType);
    if (newType === 'CITY_GALLERY') {
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
  const applyTemplate = (preset: 'MEETING' | 'POSTERS' | 'TOWER' | 'REPAIR') => {
    if (preset === 'MEETING') {
      setTitle('Porada týmu & Plánování výjezdů');
      setWorkType('OTHER');
      setNoPhotoRequired(true);
      setLocationNote('Kancelář Ostrava');
      setPrice('0');
      setIsCalculatedPrice(false);
    } else if (preset === 'POSTERS') {
      setTitle('Výměna plakátů / laviček');
      setWorkType('PIECE_RATE');
      setPieceRateType('Lavička — instalace (výměna grafiky)');
      setQuantity('10');
      setPrice(String(10 * 40));
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'TOWER') {
      setTitle('Dovoz a plachtování Tower');
      setWorkType('PIECE_RATE');
      setPieceRateType('Tower — dovoz / odvoz (vč. plachtování)');
      setQuantity('1');
      setPrice('1000');
      setIsCalculatedPrice(true);
      setNoPhotoRequired(false);
    } else if (preset === 'REPAIR') {
      setTitle('Oprava a servis nosiče');
      setWorkType('REPAIR');
      setNoPhotoRequired(false);
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
      setError('⚠️ Pro úkoly Galerie venku je nutné zadat ručně platnou cenu.');
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles size={16} className="text-amber-500" /> Rychlé šablony úkolů:
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
            🪧 Lavičky / Plakáty
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('TOWER')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🚚 Dovoz & Plachtování Tower
          </button>
          <button
            type="button"
            onClick={() => applyTemplate('REPAIR')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
          >
            🔧 Servis nosiče
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
            placeholder="Např. Výměna grafiky laviček, Porada týmu Ostrava..."
          />
        </label>

        {/* Dates */}
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

        {/* Work Type & Priority */}
        <label className="font-bold text-slate-800 text-sm">
          Typ práce *
          <select
            className="input mt-1 w-full font-semibold"
            name="workType"
            value={workType}
            onChange={(e) => handleWorkTypeChange(e.target.value)}
          >
            {Object.entries(workTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="CITY_GALLERY">Galerie venku (Ruční stanovení ceny)</option>
            <option value="PIECE_RATE">Úkolová práce (Výpočet z ceníku úkonů)</option>
          </select>
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
              placeholder="Např. Kancelář Ostrava, Městský úřad, Sklad..."
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

        {/* Google Drive Photo Folder (Optional or Required via checkbox) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FolderPlus size={18} className="text-emerald-600" />
              Odkaz na složku pro fotky na Google Disku
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
            <div>
              <input
                className="input w-full bg-white font-mono text-xs border-slate-300 focus:border-emerald-600 focus:ring-emerald-500"
                name="ftdUrl"
                type="url"
                value={ftdUrl}
                onChange={(e) => setFtdUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <span className="mt-1 block text-xs font-semibold text-slate-500">
                💡 Zadejte odkaz na složku Google Disku pro ukládání fotodokumentace z terénu.
              </span>
            </div>
          )}
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

        {/* Price & Rate Logic */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
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
              placeholder={workType === 'CITY_GALLERY' ? 'Zadejte cenu pro Galerie venku...' : 'Neuvedena (hodinová sazba)'}
            />
          </label>

          {workType === 'PIECE_RATE' && (
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700">
                Úkolová položka z ceníku úkonů:
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
              <span className="text-[11px] font-bold text-emerald-700 block">
                ✨ Výpočet: {quantity} ks × {pieceRateCatalog[pieceRateType]} Kč = {price} Kč.
              </span>
            </div>
          )}
        </div>

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
          Počet kusů
          <input
            className="input mt-1 w-full font-bold"
            min="1"
            name="quantity"
            type="number"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              handleQuantityOrRateChange(e.target.value, pieceRateType, workType);
            }}
          />
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
