'use client';
import { useState } from 'react';
import type { PlanningProfile } from '@/lib/field-planning/contracts';
import { X, Settings2, Clock, MapPin, Gauge } from 'lucide-react';

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

  // Friendly presets for depot city
  const [cityPreset, setCityPreset] = useState<'OSTRAVA' | 'PRAHA' | 'BRNO' | 'CUSTOM'>('OSTRAVA');
  const [lat, setLat] = useState(initial?.depot.latitude ?? 49.8346);
  const [lng, setLng] = useState(initial?.depot.longitude ?? 18.2820);

  const applyPreset = (preset: 'OSTRAVA' | 'PRAHA' | 'BRNO') => {
    setCityPreset(preset);
    if (preset === 'OSTRAVA') {
      setLat(49.8346);
      setLng(18.2820);
    } else if (preset === 'PRAHA') {
      setLat(50.0755);
      setLng(14.4378);
    } else if (preset === 'BRNO') {
      setLat(49.1951);
      setLng(16.6068);
    }
  };

  async function save(form: FormData) {
    setBusy(true);
    setError('');

    const start = String(form.get('start') || '08:00');
    const end = String(form.get('end') || '16:30');
    const breakMins = Number(form.get('break')) || 30;
    const defaultDuration = Number(form.get('defaultDuration')) || 45;
    const strategy = (String(form.get('strategy')) || 'BALANCED') as PlanningProfile['strategy'];

    const profile: PlanningProfile = {
      timezone: initial?.timezone ?? 'Europe/Prague',
      country: initial?.country ?? country ?? 'CZ',
      depot: { latitude: Number(lat), longitude: Number(lng) },
      endLocation: { latitude: Number(lat), longitude: Number(lng) },
      workdayStart: start,
      workdayEnd: end,
      breakMinutes: breakMins,
      overtimeMinutes: initial?.overtimeMinutes ?? 60,
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
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
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
              <span>Základna / Depo pro výjezd</span>
            </div>
            <p className="text-xs text-slate-500">Odkud posádky ráno vyjíždějí a kam se vrací.</p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => applyPreset('OSTRAVA')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  cityPreset === 'OSTRAVA'
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Ostrava (Základna)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('PRAHA')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  cityPreset === 'PRAHA'
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Praha
              </button>
              <button
                type="button"
                onClick={() => applyPreset('BRNO')}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  cityPreset === 'BRNO'
                    ? 'bg-sky-700 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Brno
              </button>
            </div>
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
