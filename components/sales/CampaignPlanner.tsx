'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Eye, Layers, MapPin, Repeat, Users } from 'lucide-react';
import { TONE_CLASSES } from '@/lib/mock-offer-data';
import {
  availabilityMatrix,
  formatNumber,
  plannerConflicts,
  plannerReach,
  plannerTracks,
  plannerWeeks,
} from '@/lib/mock-sales-data';
import { WorkflowStepper } from './WorkflowStepper';
import { Chip, MiniStat, ToneDot, WorkflowFooter } from './ui';

const CELL_STATUS: Record<string, { class: string; label: string }> = {
  free: { class: 'bg-emerald-100 text-emerald-700', label: 'Volné' },
  selected: { class: 'bg-slate-950 text-white', label: 'Vybráno' },
  booked: { class: 'bg-slate-200 text-slate-500', label: 'Obsazeno' },
  conflict: { class: 'bg-red-100 text-red-700 ring-1 ring-red-300', label: 'Kolize' },
};

export function CampaignPlanner() {
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-6">
      <WorkflowStepper current="planner" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Čistý zásah" value={formatNumber(plannerReach.netReach)} hint="unikátních osob" />
        <MiniStat label="Frekvence" value={`${plannerReach.frequency}×`} hint="průměrný kontakt" />
        <MiniStat label="Odhad zobrazení" value={formatNumber(plannerReach.impressions)} hint={`${plannerReach.surfaces} ploch`} />
        <MiniStat label="Pokrytí měst" value={plannerReach.cities} hint="Moravskoslezský kraj" />
      </div>

      {/* Gantt timeline */}
      <section className="card">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock aria-hidden className="text-slate-500" size={18} />
          <h2 className="text-base font-semibold text-slate-950">Časová osa kampaně</h2>
          <Chip className="ml-auto" tone="blue">Srpen 2026</Chip>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-[160px_1fr] gap-3">
            <span />
            <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-medium text-slate-500">
              {plannerWeeks.map((week) => (
                <span key={week}>{week}</span>
              ))}
            </div>
          </div>
          {plannerTracks.map((track) => (
            <div className="grid grid-cols-[160px_1fr] items-center gap-3" key={track.id}>
              <div className="flex items-center gap-2">
                <ToneDot tone={track.tone} />
                <span className="text-sm font-medium text-slate-800">{track.mediaType}</span>
                <span className="text-xs text-slate-400">{track.surfaces}×</span>
              </div>
              <div className="relative h-8 rounded-lg bg-slate-100">
                <div
                  className={`absolute inset-y-0 flex items-center rounded-lg px-2 text-[11px] font-semibold text-white ${TONE_CLASSES[track.tone].bg}`}
                  style={{ left: `${track.start}%`, width: `${track.width}%` }}
                >
                  {track.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Availability matrix */}
      <section className="card">
        <div className="mb-4 flex items-center gap-2">
          <Layers aria-hidden className="text-slate-500" size={18} />
          <h2 className="text-base font-semibold text-slate-950">Dostupnost ploch po týdnech</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-2 text-left font-medium">Plocha</th>
                {plannerWeeks.map((week) => (
                  <th className="px-2 text-center font-medium" key={week}>{week.replace('Týden ', 'T')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availabilityMatrix.map((row) => (
                <tr key={row.surface}>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <ToneDot tone={row.tone} />
                      <div>
                        <p className="font-medium leading-tight text-slate-800">{row.surface}</p>
                        <p className="text-xs leading-tight text-slate-400">{row.city}</p>
                      </div>
                    </div>
                  </td>
                  {row.weeks.map((state, index) => (
                    <td className="px-1" key={`${row.surface}-${index}`}>
                      <div className={`grid h-9 place-items-center rounded-lg text-[11px] font-semibold ${CELL_STATUS[state].class}`}>
                        {state === 'selected' && <Check aria-hidden size={14} />}
                        {state === 'conflict' && <AlertTriangle aria-hidden size={14} />}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          {Object.entries(CELL_STATUS).map(([key, value]) => (
            <span className="flex items-center gap-1.5" key={key}>
              <span className={`inline-block h-3 w-3 rounded ${value.class}`} />
              {value.label}
            </span>
          ))}
        </div>
      </section>

      {/* Conflicts */}
      <section className="card">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle aria-hidden className="text-amber-500" size={18} />
          <h2 className="text-base font-semibold text-slate-950">Detekce kolizí</h2>
          <Chip className="ml-auto" tone={plannerConflicts.length - resolved.size > 0 ? 'orange' : 'green'}>
            {plannerConflicts.length - resolved.size} k vyřešení
          </Chip>
        </div>
        <div className="space-y-3">
          {plannerConflicts.map((conflict) => {
            const isResolved = resolved.has(conflict.id);
            return (
              <div
                className={`rounded-xl border p-4 transition ${isResolved ? 'border-emerald-200 bg-emerald-50/60' : conflict.severity === 'hard' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}
                key={conflict.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-950">{conflict.surface} · {conflict.city}</p>
                      <Chip tone={conflict.severity === 'hard' ? 'red' : 'orange'}>
                        {conflict.severity === 'hard' ? 'Tvrdá kolize' : 'Měkká kolize'}
                      </Chip>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Obsazeno klientem <strong>{conflict.client}</strong> · {conflict.period}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <Repeat aria-hidden size={14} /> {conflict.suggestion}
                    </p>
                  </div>
                  <button
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${isResolved ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    onClick={() =>
                      setResolved((prev) => {
                        const next = new Set(prev);
                        if (next.has(conflict.id)) next.delete(conflict.id);
                        else next.add(conflict.id);
                        return next;
                      })
                    }
                    type="button"
                  >
                    {isResolved ? <><Check aria-hidden size={15} /> Vyřešeno</> : 'Použít návrh'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <a className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" href="/offers/preview" target="_blank" rel="noreferrer">
          <Eye aria-hidden size={16} /> Náhled klientské nabídky
        </a>
        <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">
          <Users aria-hidden size={16} /> Zásah přepočítán dle výběru
        </span>
        <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">
          <MapPin aria-hidden size={16} /> {plannerReach.surfaces} ploch v {plannerReach.cities} městech
        </span>
      </div>

      <WorkflowFooter current="planner" />
    </div>
  );
}
