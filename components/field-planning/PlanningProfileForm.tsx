'use client';
import { useState } from 'react';
import type { PlanningProfile, WarehousePlace } from '@/lib/field-planning/contracts';
import { X, Settings2, Clock, MapPin, Gauge, Package, Plus, Trash2, Building2 } from 'lucide-react';

export function PlanningProfileForm({
  initial,
  onSaved,
  onClose,
  country,
  navigation = false,
}: {
  navigation?: boolean;
  initial: PlanningProfile | null;
  onSaved: () => void;
  onClose?: () => void;
  country: string | null;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [lat, setLat] = useState(initial ? String(initial.depot.latitude) : '');
  const [lng, setLng] = useState(initial ? String(initial.depot.longitude) : '');
  const [endLat, setEndLat] = useState(initial ? String(initial.endLocation.latitude) : '');
  const [endLng, setEndLng] = useState(initial ? String(initial.endLocation.longitude) : '');

  // Warehouses state
  const [warehouses, setWarehouses] = useState<WarehousePlace[]>(() => initial?.warehouses ?? []);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [newWhName, setNewWhName] = useState('');
  const [newWhAddress, setNewWhAddress] = useState('');
  const [newWhLat, setNewWhLat] = useState('');
  const [newWhLng, setNewWhLng] = useState('');

  function handleAddWarehouse() {
    if (!newWhName.trim()) {
      setError('Zadejte název skladu.');
      return;
    }
    const wLat = Number(newWhLat);
    const wLng = Number(newWhLng);
    if (isNaN(wLat) || isNaN(wLng) || wLat < -90 || wLat > 90 || wLng < -180 || wLng > 180) {
      setError('Zadejte platné GPS souřadnice skladu (např. 49.8270, 18.2618).');
      return;
    }
    const newWarehouse: WarehousePlace = {
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newWhName.trim(),
      address: newWhAddress.trim() || undefined,
      location: { latitude: wLat, longitude: wLng },
      isMain: warehouses.length === 0,
    };
    setWarehouses(prev => [...prev, newWarehouse]);
    setNewWhName('');
    setNewWhAddress('');
    setNewWhLat('');
    setNewWhLng('');
    setShowAddWarehouse(false);
    setError('');
  }

  function handleRemoveWarehouse(id: string) {
    setWarehouses(prev => prev.filter(w => w.id !== id));
  }

  async function save(form: FormData) {
    setBusy(true);
    setError('');

    const start = String(form.get('start') || '08:00');
    const end = String(form.get('end') || '16:30');
    const breakMins = Number(form.get('break')) || 30;
    const defaultDuration = Number(form.get('defaultDuration')) || 45;
    const strategy = (String(form.get('strategy')) || 'BALANCED') as PlanningProfile['strategy'];
    const flexibleHours = form.has('flexibleHours');

    const profile: PlanningProfile = {
      timezone: initial?.timezone ?? 'Europe/Prague',
      country: initial?.country ?? country ?? 'CZ',
      depot: { latitude: Number(lat), longitude: Number(lng) },
      endLocation: { latitude: Number(endLat), longitude: Number(endLng) },
      workdayStart: start,
      workdayEnd: end,
      breakMinutes: breakMins,
      flexibleHours,
      overtimeMinutes: flexibleHours ? Math.max(initial?.overtimeMinutes ?? 60, 480) : (initial?.overtimeMinutes ?? 60),
      maximumJobsPerRoute: initial?.maximumJobsPerRoute ?? 25,
      fallbackSpeedKph: initial?.fallbackSpeedKph ?? 50,
      fallbackDistanceFactor: initial?.fallbackDistanceFactor ?? 1.25,
      strategy,
      navigationPointMinutes: initial?.navigationPointMinutes,
      serviceMinutes: {
        INSTALLATION: defaultDuration,
        NAVIGATION_INSTALLATION: 30,
        REINSTALLATION: defaultDuration,
        DEINSTALLATION: 30,
        REPAIR: defaultDuration,
        CHECK: 20,
        TRANSPORT: 60,
        OTHER: defaultDuration,
        ...(initial?.serviceMinutes ?? {}),
      },
      vehicleRequired: form.has('vehicle'),
      requireHumanApproval: true,
      enabled: true,
      warehouses,
    };

    try {
      const response = await fetch('/api/work/route', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile', profile }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení nastavení selhalo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Settings2 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Nastavení dispečinku</h2>
              <p className="text-xs text-slate-500">Výchozí parametry pro automatický výpočet tras</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Zavřít"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <form action={save} className="mt-5 space-y-5">
          {/* Výjezdní místo / Depo */}
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <MapPin size={14} className="text-sky-600" />
              <span>Sídlo firmy / Hlavní depo</span>
            </div>
            <p className="text-xs text-slate-500">Základna firmy, odkud posádky ráno vyjíždějí a kam se na konci směny vrací.</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-700">Šířka výjezdu (Lat)<input className="input mt-1 w-full" type="number" step="any" min={-90} max={90} required value={lat} onChange={e => setLat(e.target.value)} /></label>
              <label className="text-xs font-medium text-slate-700">Délka výjezdu (Lng)<input className="input mt-1 w-full" type="number" step="any" min={-180} max={180} required value={lng} onChange={e => setLng(e.target.value)} /></label>
              <label className="text-xs font-medium text-slate-700">Šířka návratu (Lat)<input className="input mt-1 w-full" type="number" step="any" min={-90} max={90} required value={endLat} onChange={e => setEndLat(e.target.value)} /></label>
              <label className="text-xs font-medium text-slate-700">Délka návratu (Lng)<input className="input mt-1 w-full" type="number" step="any" min={-180} max={180} required value={endLng} onChange={e => setEndLng(e.target.value)} /></label>
            </div>
            <button type="button" className="text-xs text-sky-700 underline font-semibold mt-1" onClick={() => { setEndLat(lat); setEndLng(lng); }}>Návrat na stejné místo jako výjezd (sídlo)</button>
            <p className="text-[11px] text-slate-500">Zadejte GPS souřadnice sídla firmy. Zde se vykreslí ikona 🏢 Sídlo firmy & Depo.</p>
          </div>

          {/* Sklady & Výdejní místa */}
          <div className="space-y-3 rounded-2xl border border-amber-200/70 bg-amber-50/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                <Package size={15} className="text-amber-700" />
                <span>Sklady materiálu ({warehouses.length})</span>
              </div>
              {!showAddWarehouse && (
                <button
                  type="button"
                  onClick={() => setShowAddWarehouse(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                >
                  <Plus size={13} />
                  <span>Přidat sklad</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Místa, kde má firma uskladněný materiál (bannery, desky, konstrukce). Zobrazují se ikonou 📦 na mapě dispečinku.
            </p>

            {/* Seznam skladů */}
            {warehouses.length > 0 ? (
              <div className="divide-y divide-amber-100 rounded-xl border border-amber-200/60 bg-white">
                {warehouses.map((wh) => (
                  <div key={wh.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{wh.name}</span>
                        {wh.isMain && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            Hlavní
                          </span>
                        )}
                      </div>
                      {wh.address && <p className="text-[11px] text-slate-500 truncate">{wh.address}</p>}
                      <p className="text-[10px] text-slate-400 font-mono">
                        GPS: {wh.location.latitude.toFixed(5)}, {wh.location.longitude.toFixed(5)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveWarehouse(wh.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Smazat sklad"
                      aria-label={`Smazat sklad ${wh.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-200 p-4 text-center text-xs text-slate-500">
                Zatím nemáte zadaný žádný další sklad. Klikněte na <strong>Přidat sklad</strong>.
              </div>
            )}

            {/* Formulář pro nový sklad */}
            {showAddWarehouse && (
              <div className="space-y-3 rounded-xl border border-amber-300 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">Nový sklad</span>
                  <button
                    type="button"
                    onClick={() => setShowAddWarehouse(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Zrušit
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-700">Název skladu *</label>
                    <input
                      type="text"
                      placeholder="např. Centrální sklad Mariánské Hory"
                      value={newWhName}
                      onChange={(e) => setNewWhName(e.target.value)}
                      className="input mt-1 w-full text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-700">Adresa (orientační)</label>
                    <input
                      type="text"
                      placeholder="např. Fráni Šrámka 5, Ostrava"
                      value={newWhAddress}
                      onChange={(e) => setNewWhAddress(e.target.value)}
                      className="input mt-1 w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">Zeměpisná šířka (Lat) *</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="49.8270"
                      value={newWhLat}
                      onChange={(e) => setNewWhLat(e.target.value)}
                      className="input mt-1 w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">Zeměpisná délka (Lng) *</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="18.2618"
                      value={newWhLng}
                      onChange={(e) => setNewWhLng(e.target.value)}
                      className="input mt-1 w-full text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNewWhLat(lat);
                      setNewWhLng(lng);
                    }}
                    className="text-[11px] text-sky-700 underline"
                  >
                    Předvyplnit GPS ze sídla
                  </button>
                  <button
                    type="button"
                    onClick={handleAddWarehouse}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
                  >
                    Vložit do seznamu
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Pracovní doba a přestávka */}
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Clock size={14} className="text-sky-600" />
              <span>Pracovní doba a časy</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Začátek směny</label>
                <input
                  name="start"
                  type="time"
                  className="input mt-1 w-full text-sm font-medium"
                  required
                  defaultValue={initial?.workdayStart ?? '08:00'}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Konec směny</label>
                <input
                  name="end"
                  type="time"
                  className="input mt-1 w-full text-sm font-medium"
                  required
                  defaultValue={initial?.workdayEnd ?? '16:30'}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs font-semibold text-slate-700">Oběd / Přestávka</label>
                <div className="relative mt-1">
                  <input
                    name="break"
                    type="number"
                    min={0}
                    max={120}
                    className="input w-full pr-12 text-sm font-medium"
                    defaultValue={initial?.breakMinutes ?? 30}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  name="flexibleHours"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  defaultChecked={initial?.flexibleHours ?? false}
                />
                <div>
                  <span className="font-semibold text-slate-900 block">
                    Pružná pracovní doba (individuální směny)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Povolí posádkám delší pobyt v terénu bez odmítnutí bodů z důvodu pevného konce směny.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Doba trvání a strategie */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Clock size={14} className="text-sky-600" />
                <span>Běžná montáž</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">Orientační čas na 1 zastávce</p>
              <div className="relative mt-2">
                <input
                  name="defaultDuration"
                  type="number"
                  min={5}
                  max={480}
                  className="input w-full pr-12 text-sm font-medium"
                  defaultValue={initial?.serviceMinutes?.INSTALLATION ?? 45}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Gauge size={14} className="text-sky-600" />
                <span>Styl plánování</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">Cíl optimalizačního algoritmu</p>
              <select
                name="strategy"
                className="input mt-2 w-full text-xs font-semibold"
                defaultValue={initial?.strategy ?? 'BALANCED'}
              >
                <option value="BALANCED">Rovnoměrné vytížení posádek</option>
                <option value="DISTANCE">Minimální kilometry a přejezdy</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                name="vehicle"
                type="checkbox"
                className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                defaultChecked={initial?.vehicleRequired ?? false}
              />
              <span>Každá posádka musí mít přiřazeno vozidlo</span>
            </label>

            <div className="flex gap-2">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Zrušit
                </button>
              )}
              <button
                disabled={busy}
                className="rounded-xl bg-sky-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50 transition"
              >
                {busy ? 'Ukládám…' : 'Uložit nastavení'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
