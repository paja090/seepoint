'use client';
import { primaryButton } from './styles';
import { useState } from 'react';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import type { Interval } from '@/lib/planner/domain';
import { dayRange, plusDays } from '@/lib/planner/time';
import { plannerRequest } from './api';
export function TeamAvailability({ data }: { data: PlannerReadModel }) {
  const [selected, setSelected] = useState<string[]>([]), [duration, setDuration] = useState(data.preferences.defaultMeetingDuration);
  const [slots, setSlots] = useState<Interval[] | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  async function search() {
    setLoading(true); setError('');
    try { const result = await plannerRequest<{ slots: Interval[] }>('/availability', { userIds: selected, durationMinutes: duration, from: dayRange(data.date, data.preferences.timezone).start.toISOString(), to: dayRange(plusDays(data.date, 6), data.preferences.timezone).end.toISOString() }); setSlots(result.slots); }
    catch (e) { setError(e instanceof Error ? e.message : 'Dostupnost se nepodařilo načíst.'); } finally { setLoading(false); }
  }
  return <div className="space-y-5"><p className="text-sm text-slate-600">Kapacita vychází z evidovaných bloků, vybraných kalendářů a absencí. Chybějící nebo zastaralý kalendář může výsledek ovlivnit.</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.team.map(member => <section key={member.id} className="card space-y-3"><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={selected.includes(member.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} />{member.name}</label><div className="flex justify-between text-sm"><span>Dnešní vytížení</span><strong>{member.today.utilization} %</strong></div><progress aria-label={`Vytížení ${member.name}`} value={member.today.utilization} max={100} className="w-full accent-emerald-600" /><p className="text-sm text-slate-600">{Math.round(member.today.freeMinutes / 60 * 10) / 10} h dnes · {Math.round(member.weekFreeMinutes / 60)} h v týdnu volných</p><p className="text-xs text-slate-600">{member.importantTasks} důležitých úkolů · {member.deadlines} termínů</p>{member.overCapacity && <p className="text-sm text-amber-700">Odhad práce převyšuje volnou kapacitu.</p>}</section>)}</div>
    <section className="card"><h2 className="text-lg font-bold">Najít společný termín</h2><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm">Délka (min)<input type="number" min={15} max={480} step={15} value={duration} onChange={e => setDuration(Number(e.target.value))} className="ml-2 w-24 rounded-xl border p-2" /></label><button disabled={loading || !selected.length} onClick={search} className={primaryButton}>{loading ? 'Hledám…' : 'Najít termín'}</button></div>{error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}{slots && <div className="mt-4 space-y-2">{!slots.length && <p>Nemáme společný volný termín. Zkuste jinou délku nebo týden.</p>}{slots.map(s => <p key={s.startAt} className="rounded-xl bg-emerald-50 p-3 text-sm">{new Date(s.startAt).toLocaleString('cs-CZ', { timeZone: data.preferences.timezone })} · {duration} minut</p>)}<p className="text-xs text-slate-500">Návrh nic nerezervuje ani neposílá pozvánky. Před domluvou ověřte aktuální dostupnost.</p></div>}</section>
  </div>;
}
