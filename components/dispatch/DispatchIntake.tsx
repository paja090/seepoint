'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LocationPickerMap } from '@/components/election-removal/LocationPickerMap';
import { type ElectionRemovalMediaType } from '@/lib/election-removal/constants';
import { dispositions, type Operation, type Disposition, operations } from '@/lib/election-removal/task-spec';
import {
  User,
  Truck,
  Calendar,
  Plus,
  Trash2,
  Clock,
  Briefcase,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wand2,
  Mic,
  MicOff,
  CheckCircle2,
} from 'lucide-react';

export interface PortfolioItem {
  id: string;
  name: string;
  category: string;
  dbMediaType: ElectionRemovalMediaType;
  defaultMinutes: number;
}

export const PORTFOLIO_OBJECT_TYPES: PortfolioItem[] = [
  // 1. OOH Velkoformát & Plochy
  { id: 'BILLBOARD', name: 'Billboard (Euroformát 5,1 × 2,4 m)', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'BANNER', defaultMinutes: 25 },
  { id: 'BIGBOARD', name: 'Bigboard / Megaboard (9,6 × 3,6 m)', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'BANNER', defaultMinutes: 45 },
  { id: 'CITYLIGHT', name: 'Citylight / CLV vitrína (118,5 × 175 cm)', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'CITY_POSTER', defaultMinutes: 15 },
  { id: 'BANNER', name: 'Reklamní plachta / Banner', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'BANNER', defaultMinutes: 20 },
  { id: 'FACADE', name: 'Fasáda / Štítová stěna domu', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'BANNER', defaultMinutes: 30 },
  { id: 'LED_SCREEN', name: 'LED obrazovka / Digitální panel', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'OTHER', defaultMinutes: 20 },
  { id: 'PLOT', name: 'Plotová reklama / Oplocení stavby', category: 'Velkoformátové plochy (OOH)', dbMediaType: 'PLOT', defaultMinutes: 15 },

  // 2. Mobiliář & Vlastní sítě SeePoint
  { id: 'BENCH', name: 'Lavička (Promo Bench)', category: 'Městský mobiliář & Sítě', dbMediaType: 'BENCH', defaultMinutes: 10 },
  { id: 'CITY_POSTER', name: 'Plakátovací plocha / City Poster', category: 'Městský mobiliář & Sítě', dbMediaType: 'CITY_POSTER', defaultMinutes: 15 },
  { id: 'TOWER', name: 'Tower (reklamní věž 3stranná)', category: 'Městský mobiliář & Sítě', dbMediaType: 'TOWER', defaultMinutes: 25 },
  { id: 'MINI_TOWER', name: 'Mini Tower (reklamní věž)', category: 'Městský mobiliář & Sítě', dbMediaType: 'MINI_TOWER', defaultMinutes: 20 },
  { id: 'ACKO', name: 'Áčko (mobilní poutač / stojan)', category: 'Městský mobiliář & Sítě', dbMediaType: 'ACKO', defaultMinutes: 10 },
  { id: 'PROMO_HORIZON', name: 'Promo Horizon', category: 'Městský mobiliář & Sítě', dbMediaType: 'OTHER', defaultMinutes: 15 },

  // 3. Navigace
  { id: 'NAVIGATION', name: 'Navigační směrovka (sloup VO)', category: 'Navigace & Označení', dbMediaType: 'OTHER', defaultMinutes: 20 },
  { id: 'NAVIGATION_SIGN', name: 'Navigační tabule / Pylon', category: 'Navigace & Označení', dbMediaType: 'OTHER', defaultMinutes: 25 },

  // 4. Ostatní
  { id: 'OTHER', name: 'Jiné médium / nestandardní objekt', category: 'Ostatní', dbMediaType: 'OTHER', defaultMinutes: 15 },
];

interface EmployeeResource {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  position?: string | null;
}

interface VehicleResource {
  id: string;
  name: string;
  registrationNumber?: string | null;
  type: string;
}

interface WarehouseResource {
  id: string;
  name: string;
  address?: string;
  location: { latitude: number; longitude: number };
}

interface StopEntry {
  id: string;
  operation: Operation;
  label: string;
  objectType: string;
  customObjectType?: string;
  mediaType: ElectionRemovalMediaType;
  quantity: number;
  latitude: number | null;
  longitude: number | null;
  description: string;
  disposition: Disposition;
  serviceMinutes?: number;
  destinationName?: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  referenceUrl?: string;
}

const templates: Array<[Operation, string]> = [
  ['REPLACE_AD', 'Výměna reklamy / plakátu'],
  ['INSTALL_OBJECT', 'Instalace objektu / konstrukce'],
  ['REMOVE_OBJECT', 'Demontáž'],
  ['REPAIR', 'Oprava'],
  ['INSPECTION', 'Kontrola'],
  ['RELOCATION', 'Přesun objektu'],
  ['OTHER', 'Jiná práce'],
];

function createEmptyStop(index: number, defaultOp: Operation = 'REPLACE_AD', defaultObj: string = 'BILLBOARD'): StopEntry {
  const portfolioObj = PORTFOLIO_OBJECT_TYPES.find((p) => p.id === defaultObj) || PORTFOLIO_OBJECT_TYPES[0];
  return {
    id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    operation: defaultOp,
    label: '',
    objectType: defaultObj,
    customObjectType: '',
    mediaType: portfolioObj.dbMediaType,
    quantity: 1,
    latitude: null,
    longitude: null,
    description: '',
    disposition: defaultOp === 'RELOCATION' ? 'TRANSFER' : 'LEAVE',
    serviceMinutes: portfolioObj.defaultMinutes,
  };
}

export function DispatchIntake({
  onClose,
  embedded = false,
  onBusyChange,
}: {
  onClose: () => void;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();

  // Resource options from API
  const [employees, setEmployees] = useState<EmployeeResource[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResource[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseResource[]>([]);
  const [depot, setDepot] = useState<{ latitude: number; longitude: number } | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(true);

  // Common Trip / Assignment Fields
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  // AI Assistant States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  // Stops list
  const [stops, setStops] = useState<StopEntry[]>([createEmptyStop(1)]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);

  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleRecording = () => {
    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      return;
    }
    type SpeechRecog = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onstart: (() => void) | null;
      onresult: ((event: { results?: Array<Array<{ transcript?: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    type WindowWithSpeechRecog = Window & {
      SpeechRecognition?: new () => SpeechRecog;
      webkitSpeechRecognition?: new () => SpeechRecog;
    };
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as unknown as WindowWithSpeechRecog).SpeechRecognition ||
          (window as unknown as WindowWithSpeechRecog).webkitSpeechRecognition
        : null;
    if (!SpeechRecognition) {
      alert('Váš prohlížeč nepodporuje přímé diktování hlasem v tomto okně. Napište prosím zadání do textového pole.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'cs-CZ';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const handleAiParse = async () => {
    const p = aiPrompt.trim();
    if (!p) return;
    setAiLoading(true);
    setAiSuccessMsg(null);
    setError('');
    try {
      const res = await fetch('/api/ai/parse-dispatch-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI se nepodařilo zadání zpracovat.');

      const parsed = data.parsed;
      if (parsed.date) setDate(parsed.date);
      if (parsed.employeeId) setEmployeeId(parsed.employeeId);
      if (parsed.vehicleId) setVehicleId(parsed.vehicleId);
      if (parsed.clientName) setClientName(parsed.clientName);
      if (parsed.title) setTitle(parsed.title);

      type ParsedStopInput = {
        operation?: string;
        objectType?: string;
        label?: string;
        quantity?: number;
        latitude?: number | null;
        longitude?: number | null;
        description?: string;
        serviceMinutes?: number;
      };

      if (Array.isArray(parsed.stops) && parsed.stops.length > 0) {
        const newStops: StopEntry[] = parsed.stops.map((s: ParsedStopInput, idx: number) => {
          const portfolioObj =
            PORTFOLIO_OBJECT_TYPES.find((po) => po.id === s.objectType) || PORTFOLIO_OBJECT_TYPES[0];
          return {
            id: `stop-ai-${Date.now()}-${idx}`,
            operation: (s.operation as Operation) || 'REPLACE_AD',
            label: s.label || `Zastávka ${idx + 1}`,
            objectType: portfolioObj.id,
            mediaType: portfolioObj.dbMediaType,
            quantity: Number(s.quantity) || 1,
            latitude: s.latitude ?? null,
            longitude: s.longitude ?? null,
            description: s.description || '',
            disposition: 'LEAVE',
            serviceMinutes: Number(s.serviceMinutes) || portfolioObj.defaultMinutes,
          };
        });
        setStops(newStops);
        setActiveStopIndex(0);
      }

      setAiSuccessMsg(
        `AI úspěšně předvyplnila formulář: „${parsed.title || 'Zadání práce'}“. Zkontrolujte prosím polohu v mapě.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI zpracování selhalo.');
    } finally {
      setAiLoading(false);
    }
  };

  // Load active employees and vehicles for dropdowns
  useEffect(() => {
    let isMounted = true;
    async function loadResources() {
      try {
        const res = await fetch('/api/work/dispatch');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setEmployees(data.employees || []);
            setVehicles(data.vehicles || []);
            setWarehouses(data.warehouses || []);
            setDepot(data.depot || null);
          }
        }
      } catch {
        // Silently continue if unavailable; fields will remain optional
      } finally {
        if (isMounted) setResourcesLoading(false);
      }
    }
    loadResources();
    return () => {
      isMounted = false;
    };
  }, []);

  const addStop = () => {
    const nextOp = stops[stops.length - 1]?.operation || 'REPLACE_AD';
    const nextObj = stops[stops.length - 1]?.objectType || 'BILLBOARD';
    const newStop = createEmptyStop(stops.length + 1, nextOp, nextObj);
    setStops((prev) => [...prev, newStop]);
    setActiveStopIndex(stops.length);
  };

  const removeStop = (index: number) => {
    if (stops.length <= 1) return;
    setStops((prev) => prev.filter((_, i) => i !== index));
    if (activeStopIndex >= index) {
      setActiveStopIndex(Math.max(0, activeStopIndex - 1));
    }
  };

  const updateStop = (index: number, updates: Partial<StopEntry>) => {
    setStops((prev) =>
      prev.map((stop, i) => (i === index ? { ...stop, ...updates } : stop))
    );
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    // Validate GPS on all stops
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      if (stop.latitude == null || stop.longitude == null) {
        setError(`U zastávky #${i + 1} (${stop.label || operations[stop.operation]}) vyberte polohu v mapě nebo vyhledejte adresu.`);
        setActiveStopIndex(i);
        return;
      }
      const isTransport = ['WAREHOUSE', 'TRANSFER', 'CLIENT'].includes(stop.disposition);
      if (isTransport && (stop.destinationLatitude == null || stop.destinationLongitude == null)) {
        setError(`U zastávky #${i + 1} vyberte cílové místo předání v mapě.`);
        setActiveStopIndex(i);
        return;
      }
    }

    setBusy(true);
    onBusyChange?.(true);
    setError('');

    const formattedTasks = stops.map((s, idx) => {
      const isTransport = ['WAREHOUSE', 'TRANSFER', 'CLIENT'].includes(s.disposition);
      const portfolioObj = PORTFOLIO_OBJECT_TYPES.find((p) => p.id === s.objectType);
      const resolvedObjectName =
        s.objectType === 'OTHER' && s.customObjectType?.trim()
          ? s.customObjectType.trim()
          : portfolioObj?.name || s.objectType;

      return {
        label: s.label.trim() || `Zastávka ${idx + 1}: ${operations[s.operation]} (${resolvedObjectName})`,
        description: s.description.trim() || `${operations[s.operation]} – ${resolvedObjectName}`,
        operationType: s.operation,
        mediaType: portfolioObj?.dbMediaType || 'OTHER',
        objectType: resolvedObjectName,
        quantity: Number(s.quantity) || 1,
        latitude: s.latitude!,
        longitude: s.longitude!,
        gpsConfirmed: true,
        materialDisposition: s.disposition,
        materialInstructions: '',
        destinationName: isTransport ? s.destinationName || '' : '',
        destinationLatitude: isTransport ? s.destinationLatitude || null : null,
        destinationLongitude: isTransport ? s.destinationLongitude || null : null,
        destinationGpsConfirmed: isTransport,
        referenceUrl: s.referenceUrl || null,
        contact: '',
        accessInstructions: '',
        serviceMinutes: s.serviceMinutes ? Number(s.serviceMinutes) : portfolioObj?.defaultMinutes || 15,
        requiredWorkers: 1,
      };
    });

    try {
      const response = await fetch('/api/work/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestKey,
          title: title.trim() || undefined,
          clientName: clientName.trim(),
          date: date || null,
          employeeId: employeeId || null,
          vehicleId: vehicleId || null,
          tasks: formattedTasks,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Uložení práce se nezdařilo.');

      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení práce se nezdařilo.');
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <section className={embedded ? 'bg-white' : 'rounded-2xl border bg-white p-5 shadow-sm'} aria-labelledby="intake-title">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 id="intake-title" className="text-xl font-bold text-slate-900">
            Zadat práci do dispečinku
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Přiřaďte pracovníka, auto a zadejte zastávky pro libovolný objekt z portfolia firmy.
          </p>
        </div>
        {!embedded && (
          <button type="button" onClick={onClose} disabled={busy} className="btn">
            Zavřít
          </button>
        )}
      </div>

      <form
        onSubmit={submit}
        noValidate
        onKeyDown={(e) => {
          // Prevent accidental form submit when hitting Enter inside regular text inputs
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            const inputType = (e.target as HTMLInputElement).type;
            if (inputType !== 'submit') {
              e.preventDefault();
            }
          }
        }}
        className="mt-4 space-y-6"
      >
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* AI QUICK INPUT BANNER */}
        <div className="rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50/90 via-white to-sky-50/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-fuchsia-100 text-fuchsia-700">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                ✨ AI Rychlé zadání (textem nebo hlasem)
              </h3>
            </div>
            <span className="text-[10px] font-bold text-fuchsia-800 bg-fuchsia-100/80 px-2.5 py-0.5 rounded-full">
              Gemini 3.6 Flash
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Napište nebo nadiktujte zadání jednou větou. AI sama rozpozná typ média, počet kusů, termín i montážníka.
          </p>
          <div className="flex gap-2">
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
                placeholder="Např. Zítra polepit 4 billboardy u Mustang Arény v Ostravě, pojede Milan dodávkou..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-200 focus:outline-none shadow-2xs pr-10"
              />
              <button
                type="button"
                onClick={toggleRecording}
                className={`absolute right-2 top-2 p-1 rounded-lg transition ${
                  isRecording ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title={isRecording ? 'Zastavit nahrávání' : 'Diktovat hlasem'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleAiParse}
              disabled={aiLoading || !aiPrompt.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-700 hover:to-indigo-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition disabled:opacity-50 shrink-0"
            >
              <Wand2 className="w-4 h-4" />
              <span>{aiLoading ? 'Rozpoznávám…' : 'Vyplnit pomocí AI'}</span>
            </button>
          </div>
          {aiSuccessMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-medium text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{aiSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* 1. SELECTION: Date, Worker, Vehicle & Client */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Kdy, kdo a čím výjezd provede
            </span>
            <span className="text-[11px] text-slate-500">Volitelné parametry</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Termín výjezdu
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-sky-600 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                  className="text-sky-700 hover:underline"
                >
                  Dnes
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date(Date.now() + 86400000);
                    setDate(t.toISOString().slice(0, 10));
                  }}
                  className="text-sky-700 hover:underline"
                >
                  Zítra
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setDate('')}
                  className="text-slate-500 hover:underline"
                >
                  Bez termínu
                </button>
              </div>
            </div>

            {/* Worker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Pracovník / technik
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={resourcesLoading}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-sky-600 focus:outline-none"
              >
                <option value="">Nechat ve frontě (nepřiřazeno)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.lastName} {emp.firstName} {emp.position ? `(${emp.position})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Vozidlo
              </label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                disabled={resourcesLoading}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-sky-600 focus:outline-none"
              >
                <option value="">Bez vozidla / vybrat později</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.registrationNumber ? `(${v.registrationNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Klient (volitelné)
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                maxLength={200}
                placeholder="Např. ACME s.r.o., Komerční Banka..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-sky-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                Výstižný název zakázky (volitelné)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Automaticky, např. Výlep 4× Billboard – Mustang Aréna"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-sky-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. STOPS / POINTS LIST */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-700" />
              <h3 className="font-bold text-sm text-slate-900">
                Zastávky a body práce ({stops.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={addStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-800 text-white text-xs font-bold hover:bg-sky-900 shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Přidat další bod</span>
            </button>
          </div>

          {/* Quick tab switcher when multiple stops */}
          {stops.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {stops.map((stop, i) => {
                const pObj = PORTFOLIO_OBJECT_TYPES.find((p) => p.id === stop.objectType);
                return (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => setActiveStopIndex(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
                      activeStopIndex === i
                        ? 'bg-sky-800 text-white border-sky-800 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="opacity-80">#{i + 1}</span>
                    <span>{operations[stop.operation] || 'Zastávka'}</span>
                    <span className="text-[10px] opacity-70">({pObj?.name.split(' ')[0] || 'Objekt'})</span>
                    {stop.latitude && stop.longitude && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Stop Cards */}
          <div className="space-y-4">
            {stops.map((stop, index) => {
              const isExpanded = stops.length === 1 || activeStopIndex === index;
              const isTransport = ['WAREHOUSE', 'TRANSFER', 'CLIENT'].includes(stop.disposition);
              const portfolioObj = PORTFOLIO_OBJECT_TYPES.find((p) => p.id === stop.objectType);

              return (
                <article
                  key={stop.id}
                  className={`rounded-2xl border transition ${
                    isExpanded
                      ? 'border-sky-300 bg-white p-4 shadow-sm'
                      : 'border-slate-200 bg-slate-50/50 p-3 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveStopIndex(isExpanded && stops.length > 1 ? -1 : index)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-sky-100 text-sky-800 text-xs font-black shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {stop.label || `Zastávka #${index + 1}: ${operations[stop.operation]} · ${portfolioObj?.name || stop.objectType}`}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {operations[stop.operation]} · {portfolioObj?.name || stop.objectType} · {stop.quantity} ks
                          {stop.latitude && stop.longitude ? ' · 📍 GPS vybrána' : ' · ⚠️ Chybí GPS'}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {stops.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStop(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Odstranit tuto zastávku"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {stops.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setActiveStopIndex(isExpanded ? -1 : index)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                      {/* Operation Selector Buttons */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Činnost na tomto bodě
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {templates.map(([key, label]) => (
                            <button
                              type="button"
                              key={key}
                              onClick={() => {
                                updateStop(index, {
                                  operation: key,
                                  disposition: key === 'RELOCATION' ? 'TRANSFER' : stop.disposition,
                                });
                              }}
                              className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition border ${
                                stop.operation === key
                                  ? 'bg-sky-800 text-white border-sky-800 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Portfolio Object Selection & Quantity */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Typ objektu z portfolia
                          </label>
                          <select
                            value={stop.objectType}
                            onChange={(e) => {
                              const val = e.target.value;
                              const found = PORTFOLIO_OBJECT_TYPES.find((p) => p.id === val);
                              updateStop(index, {
                                objectType: val,
                                mediaType: found?.dbMediaType || 'OTHER',
                                serviceMinutes: found?.defaultMinutes || stop.serviceMinutes || 15,
                              });
                            }}
                            className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium focus:ring-2 focus:ring-sky-600 focus:outline-none"
                          >
                            {Object.entries(
                              PORTFOLIO_OBJECT_TYPES.reduce((acc, item) => {
                                acc[item.category] = acc[item.category] || [];
                                acc[item.category].push(item);
                                return acc;
                              }, {} as Record<string, typeof PORTFOLIO_OBJECT_TYPES>)
                            ).map(([category, items]) => (
                              <optgroup key={category} label={category}>
                                {items.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          {stop.objectType === 'OTHER' && (
                            <input
                              type="text"
                              value={stop.customObjectType || ''}
                              onChange={(e) => updateStop(index, { customObjectType: e.target.value })}
                              placeholder="Upřesněte typ objektu (např. Výloha, Světelný box, Pylon...)"
                              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-sky-600 focus:outline-none"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Počet kusů
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={10000}
                              value={stop.quantity}
                              onChange={(e) =>
                                updateStop(index, { quantity: Number(e.target.value) || 1 })
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Odhad (min)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={1440}
                              value={stop.serviceMinutes || 15}
                              onChange={(e) =>
                                updateStop(index, {
                                  serviceMinutes: Number(e.target.value) || 15,
                                })
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Title / Label of this stop */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Název / označení zastávky (volitelné)
                        </label>
                        <input
                          maxLength={200}
                          value={stop.label}
                          onChange={(e) => updateStop(index, { label: e.target.value })}
                          placeholder={`Např. ${operations[stop.operation]} – ${portfolioObj?.name || 'místo'}...`}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                        />
                      </div>

                      {/* Map Location Picker with Search */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-800">
                          Poloha zastávky #{index + 1}
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Zadejte adresu do vyhledávače výše a stiskněte Hledat, nebo klikněte do mapy.
                        </p>
                        <LocationPickerMap
                          latitude={stop.latitude}
                          longitude={stop.longitude}
                          onChange={(coords) =>
                            updateStop(index, {
                              latitude: coords.latitude,
                              longitude: coords.longitude,
                            })
                          }
                          pinLabel={`Bod #${index + 1}`}
                          height="200px"
                        />
                      </div>

                      {/* Instruction for technician */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Pokyn pro technika na tomto místě
                        </label>
                        <textarea
                          rows={2}
                          maxLength={4000}
                          value={stop.description}
                          onChange={(e) => updateStop(index, { description: e.target.value })}
                          placeholder="Co přesně udělat, na co si dát pozor, stav klíčů nebo přístupu..."
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-sky-600 focus:outline-none"
                        />
                      </div>

                      {/* Material handling */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nakládání s materiálem
                        </label>
                        <select
                          value={stop.disposition}
                          onChange={(e) =>
                            updateStop(index, {
                              disposition: e.target.value as Disposition,
                            })
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                        >
                          {Object.entries(dispositions).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Transport destination if relocation or warehouse */}
                      {isTransport && (
                        <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
                          <label className="block text-xs font-bold text-slate-800">
                            Cílové místo předání / sklad
                          </label>

                          {/* Quick selection of configured warehouses & company headquarters */}
                          {(warehouses.length > 0 || depot) && (
                            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
                              <span className="block text-[11px] font-bold text-amber-900">
                                Rychlý výběr firemního skladu nebo sídla:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {depot && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateStop(index, {
                                        destinationName: 'Sídlo firmy / Hlavní depo',
                                        destinationLatitude: depot.latitude,
                                        destinationLongitude: depot.longitude,
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 shadow-xs hover:bg-sky-50 transition"
                                  >
                                    🏢 Sídlo firmy & Depo
                                  </button>
                                )}
                                {warehouses.map((wh) => (
                                  <button
                                    key={wh.id}
                                    type="button"
                                    onClick={() => {
                                      updateStop(index, {
                                        destinationName: wh.name,
                                        destinationLatitude: wh.location.latitude,
                                        destinationLongitude: wh.location.longitude,
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 shadow-xs hover:bg-amber-50 transition"
                                  >
                                    📦 {wh.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <input
                            required
                            maxLength={200}
                            value={stop.destinationName || ''}
                            onChange={(e) =>
                              updateStop(index, { destinationName: e.target.value })
                            }
                            placeholder="Název cílového skladu nebo odběrného místa"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                          />
                          <LocationPickerMap
                            latitude={stop.destinationLatitude || null}
                            longitude={stop.destinationLongitude || null}
                            onChange={(coords) =>
                              updateStop(index, {
                                destinationLatitude: coords.latitude,
                                destinationLongitude: coords.longitude,
                              })
                            }
                            pinLabel="Cíl převozu"
                            height="180px"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Add Stop Button Bar */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={addStop}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sky-300 bg-sky-50 text-sky-800 text-xs font-bold hover:bg-sky-100 transition shadow-2xs"
            >
              <Plus className="w-4 h-4 text-sky-700" />
              <span>+ Přidat další bod (zastávku) s jinou činností</span>
            </button>
          </div>
        </div>

        {/* 3. SUBMIT BAR */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 flex items-start gap-2 shadow-2xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              <span>
                {stops.length}{' '}
                {stops.length === 1
                  ? 'zastávka'
                  : stops.length < 5
                  ? 'zastávky'
                  : 'zastávek'}
              </span>
              {employeeId && employees.find((e) => e.id === employeeId) && (
                <span>
                  {' '}
                  · 👷 {employees.find((e) => e.id === employeeId)?.lastName}
                </span>
              )}
              {vehicleId && vehicles.find((v) => v.id === vehicleId) && (
                <span>
                  {' '}
                  · 🚗 {vehicles.find((v) => v.id === vehicleId)?.name}
                </span>
              )}
              {date && <span> · 📅 {date}</span>}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-sky-800 hover:bg-sky-900 px-6 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
            >
              {busy
                ? 'Ukládám do dispečinku…'
                : `Uložit práci (${stops.length} ${
                    stops.length === 1
                      ? 'bod'
                      : stops.length < 5
                      ? 'body'
                      : 'bodů'
                  })`}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
