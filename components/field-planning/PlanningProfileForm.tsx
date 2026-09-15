'use client';
import { useState } from 'react';
import type { PlanningProfile } from '@/lib/field-planning/contracts';
const allTypes = ['INSTALLATION', 'NAVIGATION_INSTALLATION', 'REINSTALLATION', 'DEINSTALLATION', 'REPAIR', 'CHECK', 'TRANSPORT', 'OTHER'];
export function PlanningProfileForm({ initial, onSaved, country, navigation = false }: { navigation?: boolean; initial: PlanningProfile | null; onSaved: () => void; country: string | null }) {
  const types = allTypes.filter(t => navigation || t !== 'NAVIGATION_INSTALLATION');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    setBusy(true); setError('');
    const number = (name: string) => Number(form.get(name));
    const value = (name: string) => String(form.get(name) ?? '');
    const profile: PlanningProfile = { timezone: value('timezone'), country: value('country') || null,
      depot: { latitude: number('lat'), longitude: number('lng') }, endLocation: { latitude: number('endLat'), longitude: number('endLng') },
      workdayStart: value('start'), workdayEnd: value('end'), breakMinutes: number('break'), overtimeMinutes: number('overtime'),
      maximumJobsPerRoute: number('max'), fallbackSpeedKph: number('speed'), fallbackDistanceFactor: number('factor'),
      strategy: value('strategy') as PlanningProfile['strategy'], navigationPointMinutes: initial?.navigationPointMinutes, serviceMinutes: Object.fromEntries(types.map(t => [t, number(t)])),
      vehicleRequired: form.has('vehicle'), requireHumanApproval: true, enabled: form.has('enabled') };
    try {
      for (const line of value('carrierDurations').split('\n').filter(l => l.trim())) { const [key, minutes] = line.split('='); if (!key?.includes(':') || !Number.isFinite(Number(minutes))) throw new Error('Použijte formát INSTALLATION:BILLBOARD=30.'); profile.serviceMinutes[key.trim()] = Number(minutes); }
      const response = await fetch('/api/work/route', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'profile', profile }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Uložení selhalo.'); } finally { setBusy(false); }
  }
  const numeric = (name: string, label: string, value: number | undefined, min: number, max: number) => <label className="text-sm" key={name}>{label}<input name={name} className="input mt-1" type="number" step="any" min={min} max={max} required defaultValue={value} /></label>;
  return <form action={save} className="card space-y-4"><h2 className="text-xl font-bold">Provozní nastavení organizace</h2><p className="text-sm text-slate-500">Vyplňte vlastní pracovní dobu, místa a délky práce. Schválení člověkem je vždy povinné. Odhad rychlosti a koeficient slouží pouze při výpadku trasování.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Časová zóna<input name="timezone" className="input mt-1" defaultValue={initial?.timezone ?? 'Europe/Prague'} required /></label><label className="text-sm">Země (ISO, volitelné)<input name="country" className="input mt-1" maxLength={2} defaultValue={initial?.country ?? country ?? ''} /></label><label className="text-sm">Strategie<select name="strategy" className="input mt-1" defaultValue={initial?.strategy ?? 'BALANCED'}><option value="BALANCED">Rovnoměrné vytížení</option><option value="DISTANCE">Minimum přejezdů</option></select></label>
      <label className="text-sm">Začátek směny<input name="start" type="time" className="input mt-1" required defaultValue={initial?.workdayStart} /></label><label className="text-sm">Konec směny<input name="end" type="time" className="input mt-1" required defaultValue={initial?.workdayEnd} /></label>
      {numeric('break', 'Přestávka před návratem (min)', initial?.breakMinutes, 0, 240)}{numeric('overtime', 'Povolený přesčas (min)', initial?.overtimeMinutes, 0, 240)}
      {numeric('lat', 'Výjezd: zeměpisná šířka', initial?.depot.latitude, -90, 90)}{numeric('lng', 'Výjezd: zeměpisná délka', initial?.depot.longitude, -180, 180)}
      {numeric('endLat', 'Návrat: zeměpisná šířka', initial?.endLocation.latitude, -90, 90)}{numeric('endLng', 'Návrat: zeměpisná délka', initial?.endLocation.longitude, -180, 180)}
      {numeric('speed', 'Odhad rychlosti při výpadku (km/h)', initial?.fallbackSpeedKph, 1, 130)}{numeric('factor', 'Koeficient vzdálenosti při výpadku', initial?.fallbackDistanceFactor, 1, 5)}{numeric('max', 'Maximum zastávek v trase', initial?.maximumJobsPerRoute, 1, 100)}
      {types.map(t => numeric(t, `${t} (min)`, initial?.serviceMinutes[t], 1, 1440))}
    </div><label className="block text-sm">Délky podle typu práce a nosiče (TYP_PRÁCE:TYP_NOSIČE=minuty, jeden řádek na pravidlo)<textarea name="carrierDurations" className="input" defaultValue={Object.entries(initial?.serviceMinutes ?? {}).filter(([key]) => key.includes(':')).map(([key, value]) => `${key}=${value}`).join('\n')} /></label><div className="flex flex-wrap gap-5 text-sm"><label><input name="vehicle" type="checkbox" defaultChecked={initial?.vehicleRequired} /> Práce standardně vyžaduje vozidlo</label><label><input name="enabled" type="checkbox" defaultChecked={initial?.enabled ?? true} /> Plánování aktivní</label></div>
    <button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white">{busy ? 'Ukládám…' : 'Uložit nastavení'}</button></form>;
}
