'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { workPriorityLabels, workTypeLabels } from '@/lib/work';
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, FolderPlus, UserCheck } from 'lucide-react';

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

// Ceník úkolové práce (pro automatický výpočet ceny)
const pieceRateCatalog: Record<string, number> = {
  'MONTÁŽ CEDULE PLÁSTEVE': 450,
  'REINSTALACE NAVIGACE': 550,
  'DEMONTÁŽ POPLASTOVANÉ VYKLÁPĚCÍ': 300,
  'VÝMĚNA GRAFIKY': 250,
  'SERVIS / OPRAVA STOJANOVÉHO SLOUPE': 600,
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
  const [quantity, setQuantity] = useState('1');
  const [pieceRateType, setPieceRateType] = useState(Object.keys(pieceRateCatalog)[0]);
  const [price, setPrice] = useState('');
  const [isCalculatedPrice, setIsCalculatedPrice] = useState(false);

  // Auto calculate price for piece-rate work
  const handleQuantityOrRateChange = (newQty: string, newRateType: string, currentWorkType: string) => {
    if (currentWorkType === 'PIECE_RATE') {
      const qtyNum = parseInt(newQty, 10) || 1;
      const rateVal = pieceRateCatalog[newRateType] || 450;
      setPrice(String(qtyNum * rateVal));
      setIsCalculatedPrice(true);
    }
  };

  const handleWorkTypeChange = (newType: string) => {
    setWorkType(newType);
    if (newType === 'CITY_GALLERY') {
      setIsCalculatedPrice(false);
      setPrice(''); // Must be entered manually for Galerie venku
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError('');

    // Strict validation: Google Drive photo folder requirement
    if (!ftdUrl.trim()) {
      setError('⚠️ Musíte vložit odkaz na vytvořenou složku pro fotky na Google Disku (nepustí bez vytvořené složky).');
      setSubmitting(false);
      return;
    }

    if (!ftdUrl.includes('google.com') && !ftdUrl.includes('drive.google.com')) {
      setError('⚠️ Odkaz na fotodokumentaci musí být platná adresa složky na Google Disku (drive.google.com).');
      setSubmitting(false);
      return;
    }

    if (workType === 'CITY_GALLERY' && (!price || parseFloat(price) <= 0)) {
      setError('⚠️ Pro úkoly Galerie venku je nutné zadat ručně platnou cenu.');
      setSubmitting(false);
      return;
    }

    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());

    // Include selected worker names
    payload.workerNames = selectedWorkers.join(', ');

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
    } catch (err) {
      setError('Chyba při komunikaci se serverem.');
      setSubmitting(false);
    }
  }

  return (
    <details className="card border-slate-300 shadow-md" open>
      <summary className="cursor-pointer text-xl font-black text-slate-900 flex items-center justify-between">
        <span>➕ Naplánovat nový pracovní úkol</span>
        <span className="text-xs text-sky-700 font-bold">Určeno pro Manažery & Obchodníky</span>
      </summary>

      <form className="mt-6 grid gap-5 lg:grid-cols-2" onSubmit={handleSubmit}>
        {/* Google Drive Photo Folder MUST be required */}
        <div className="lg:col-span-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 p-4 shadow-sm">
          <label className="block font-bold text-emerald-950 text-sm mb-1 flex items-center gap-2">
            <FolderPlus size={18} className="text-emerald-600" />
            Odkaz na složku pro fotodokumentaci na Google Disku <span className="text-rose-600">* Povinné</span>
          </label>
          <input
            className="input w-full bg-white font-mono text-xs border-emerald-300 focus:border-emerald-600 focus:ring-emerald-500"
            name="ftdUrl"
            type="url"
            required
            value={ftdUrl}
            onChange={(e) => setFtdUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
          />
          <span className="mt-1.5 block text-xs font-semibold text-emerald-800">
            🔒 Zadavatel musí předem vytvořit složku na Google Disku pro ukládání fotek z terénu. Bez odkazu nelze úkol uložit.
          </span>
        </div>

        {/* Title & Dates */}
        <label className="lg:col-span-2 font-bold text-slate-800 text-sm">
          Název pracovní zakázky *
          <input
            className="input mt-1 w-full font-bold"
            name="title"
            required
            defaultValue={
              initialCarrierCode
                ? `Montáž nosiče ${initialCarrierCode}${initialClientName ? ` — ${initialClientName}` : ''}`
                : ''
            }
            placeholder="Např. Montáž navigací Koupelny Ostrava"
          />
        </label>

        <label className="font-bold text-slate-800 text-sm">
          Datum a čas práce *
          <input className="input mt-1 w-full" name="scheduledAt" required type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
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
          <span className="mt-1 block text-xs text-slate-500 font-normal">Urgentní úkoly se v plánu zvýrazní červeně.</span>
        </label>

        {/* Auto pre-filled Requester */}
        <label className="font-bold text-slate-800 text-sm">
          Úkol zadal/a (Přihlášený uživatel) *
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
            Cena za úkol (Kč без DPH)
            <input
              className={`input mt-1 w-full font-black text-base ${isCalculatedPrice ? 'bg-emerald-50 text-emerald-950 border-emerald-300' : ''}`}
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
                Položka ceníku úkolové práce:
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
              <span className="text-[11px] font-semibold text-emerald-700 block">
                ✨ Cena spočítána automaticky: {quantity} ks × {pieceRateCatalog[pieceRateType]} Kč = {price} Kč.
              </span>
            </div>
          )}

          {workType === 'CITY_GALLERY' && (
            <span className="text-xs font-bold text-amber-800 block">
              🎨 Galerie venku: Cenu je nutné napsat manuálně.
            </span>
          )}
        </div>

        {/* Worker Selection Checklist */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <label className="block font-bold text-slate-900 text-sm flex items-center justify-between">
            <span>👥 Přiřazení pracovníci (Seznam zaměstanatelů)</span>
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
                      checked ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <UserCheck size={16} className="text-emerald-600 shrink-0" />
            <span>Přiřazení pracovníci dostanou upozornění a po přihlášení potvrdí převzetí úkolu.</span>
          </div>
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
          <input className="input mt-1 w-full" name="mediaLabel" placeholder="Navigace, billboard, city poster…" />
        </label>

        {/* Carrier list */}
        <label className="lg:col-span-2 font-bold text-slate-800 text-sm">
          Propojený nosič VO
          <input className="input mt-1 w-full font-bold text-sky-900 bg-sky-50" list="work-carriers" name="carrierCode" defaultValue={initialCarrierCode} placeholder="Začněte psát kód, město nebo název" />
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
          Místo a pokyny pro montážníky
          <input className="input mt-1 w-full" name="locationNote" placeholder="Adresa, sraz, kontakt na místě…" />
        </label>

        <label className="lg:col-span-2 font-bold text-slate-800 text-sm">
          Podrobné zadání úkolu *
          <textarea className="input mt-1 w-full min-h-24 font-medium" name="description" required placeholder="Popis požadovaných prací..." />
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
            {submitting ? 'Ukládám a notifikuji pracovníky...' : ' Vytvořit pracovní úkol s Google Drive složkou'}
          </button>
        </div>
      </form>
    </details>
  );
}
