'use client';
import { primaryButton } from './styles';
import { useState } from 'react';
import { AlertTriangle, CalendarSearch, Clock, Users } from 'lucide-react';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import type { Interval } from '@/lib/planner/domain';
import { dayRange, plusDays } from '@/lib/planner/time';
import { plannerRequest } from './api';

function memberInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function TeamAvailability({ data }: { data: PlannerReadModel }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(data.preferences.defaultMeetingDuration);
  const [slots, setSlots] = useState<Interval[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setError('');
    try {
      const result = await plannerRequest<{ slots: Interval[] }>('/availability', {
        userIds: selected,
        durationMinutes: duration,
        from: dayRange(data.date, data.preferences.timezone).start.toISOString(),
        to: dayRange(plusDays(data.date, 6), data.preferences.timezone).end.toISOString(),
      });
      setSlots(result.slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dostupnost se nepodařilo načíst.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <p className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600">
          <Users className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Kapacita vychází z evidovaných bloků, vybraných kalendářů, absencí a úkolů z Plánu práce.</span>
        </p>
        {selected.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            Vybráno: {selected.length}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.team.map((member) => {
          const isChecked = selected.includes(member.id);
          const util = Math.min(100, Math.max(0, member.today.utilization));
          const barTone =
            util >= 85 ? 'bg-rose-500' : util >= 55 ? 'bg-amber-500' : 'bg-emerald-500';
          const pillTone =
            util >= 85
              ? 'bg-rose-100 text-rose-800'
              : util >= 55
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800';

          return (
            <section
              key={member.id}
              className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
                isChecked
                  ? 'border-emerald-400 ring-2 ring-emerald-200/70 shadow-md'
                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked ? [...ids, member.id] : ids.filter((id) => id !== member.id)
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                    {memberInitials(member.name)}
                  </span>
                  <span className="truncate text-sm font-black text-slate-900">{member.name}</span>
                </label>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${pillTone}`}>
                  {member.today.utilization} %
                </span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Dnešní vytížení</span>
                  <span className="text-slate-700">{Math.round((member.today.freeMinutes / 60) * 10) / 10} h volno dnes</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Vytížení ${member.name}`}
                  aria-valuenow={util}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                >
                  <div className={`h-full rounded-full transition-all ${barTone}`} style={{ width: `${util}%` }} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Volno v týdnu</p>
                  <p className="mt-0.5 font-extrabold text-slate-800">{Math.round(member.weekFreeMinutes / 60)} h</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Priorita & termíny</p>
                  <p className="mt-0.5 font-extrabold text-slate-800">
                    {member.importantTasks} důl. · {member.deadlines} term.
                  </p>
                </div>
              </div>

              {typeof member.todayWorkCount === 'number' && (
                <div className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  <span>Plán práce</span>
                  <span>
                    {member.todayWorkCount} dnes · {member.weekWorkCount ?? 0} v týdnu
                  </span>
                </div>
              )}

              {member.overCapacity && (
                <p className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Odhad práce převyšuje volnou kapacitu.</span>
                </p>
              )}
            </section>
          );
        })}
      </div>

      <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <CalendarSearch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Najít společný termín</h2>
            <p className="text-xs text-slate-500">Vyberte kolegy výše a najděte první volný časový průnik.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Délka (min)</span>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 block w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
            />
          </label>
          <button disabled={loading || !selected.length} onClick={search} className={primaryButton}>
            <Clock className="h-4 w-4" />
            <span>{loading ? 'Hledám…' : 'Najít termín'}</span>
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        {slots && (
          <div className="mt-4 space-y-2">
            {!slots.length && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Nemáme společný volný termín. Zkuste jinou délku nebo týden.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((s) => (
                <p
                  key={s.startAt}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-sm font-bold text-emerald-900"
                >
                  {new Date(s.startAt).toLocaleString('cs-CZ', { timeZone: data.preferences.timezone })} · {duration} min
                </p>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Návrh nic nerezervuje ani neposílá pozvánky. Před domluvou ověřte aktuální dostupnost.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
