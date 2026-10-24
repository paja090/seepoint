'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { LocationPickerMap } from '@/components/election-removal/LocationPickerMap';
import { ELECTION_REMOVAL_MEDIA_LABELS, type ElectionRemovalMediaType } from '@/lib/election-removal/constants';
import { dispositions, type Operation, type Disposition, operations } from '@/lib/election-removal/task-spec';
import {
  User,
  Truck,
  Calendar,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Briefcase,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

interface StopEntry {
  id: string;
  operation: Operation;
  label: string;
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

function createEmptyStop(index: number, defaultOp: Operation = 'REPLACE_AD'): StopEntry {
  return {
    id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    operation: defaultOp,
    label: '',
    mediaType: 'OTHER',
    quantity: 1,
    latitude: null,
    longitude: null,
    description: '',
    disposition: defaultOp === 'RELOCATION' ? 'TRANSFER' : 'LEAVE',
    serviceMinutes: 15,
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
  const [resourcesLoading, setResourcesLoading] = useState(true);

  // Common Trip / Assignment Fields
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employeeId, setEmployeeId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  // Stops list
  const [stops, setStops] = useState<StopEntry[]>([createEmptyStop(1)]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);

  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    const newStop = createEmptyStop(stops.length + 1, nextOp);
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
      return {
        label: s.label.trim() || `Zastávka ${idx + 1}: ${operations[s.operation]}`,
        description: s.description.trim() || operations[s.operation],
        operationType: s.operation,
        mediaType: s.mediaType,
        objectType: s.mediaType,
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
        serviceMinutes: s.serviceMinutes ? Number(s.serviceMinutes) : undefined,
        requiredWorkers: 1,
      };
    });

    try {
      const response = await fetch('/api/work/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestKey,
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
            Přiřaďte pracovníka, auto a zadejte jednu nebo více zastávek s libovolnou činností.
          </p>
        </div>
        {!embedded && (
          <button type="button" onClick={onClose} disabled={busy} className="btn">
            Zavřít
          </button>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-6">
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

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
              {stops.map((stop, i) => (
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
                  {stop.latitude && stop.longitude && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Stop Cards */}
          <div className="space-y-4">
            {stops.map((stop, index) => {
              const isExpanded = stops.length === 1 || activeStopIndex === index;
              const isTransport = ['WAREHOUSE', 'TRANSFER', 'CLIENT'].includes(stop.disposition);

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
                          {stop.label || `Zastávka #${index + 1}: ${operations[stop.operation]}`}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {operations[stop.operation]} · {ELECTION_REMOVAL_MEDIA_LABELS[stop.mediaType]} · {stop.quantity} ks
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

                      {/* Title & Media */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Název / označení místa
                          </label>
                          <input
                            required
                            maxLength={200}
                            value={stop.label}
                            onChange={(e) => updateStop(index, { label: e.target.value })}
                            placeholder={`Např. ${operations[stop.operation]} u nádraží...`}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Typ objektu
                            </label>
                            <select
                              value={stop.mediaType}
                              onChange={(e) =>
                                updateStop(index, {
                                  mediaType: e.target.value as ElectionRemovalMediaType,
                                })
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                            >
                              {Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Počet (ks)
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
                        </div>
                      </div>

                      {/* Map Location Picker with Search */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-800">
                          Poloha zastávky #{index + 1}
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Vyhledejte adresu nebo klikněte kamkoliv do mapy.
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
                      <div className="grid gap-3 sm:grid-cols-2">
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
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Odhad času (minut)
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
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-sky-600 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Transport destination if relocation */}
                      {isTransport && (
                        <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
                          <label className="block text-xs font-bold text-slate-800">
                            Cílové místo předání / sklad
                          </label>
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
        <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
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
      </form>
    </section>
  );
}
