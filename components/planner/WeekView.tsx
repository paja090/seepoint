'use client';
import Link from 'next/link';
import type { PlannerItem, PlannerTask } from '@/lib/planner/domain';
import { dateInZone, dayRange, plusDays } from '@/lib/planner/time';
import { overlaps } from '@/lib/planner/scheduling';
import { Timeline } from './Timeline';

export function WeekView({ date, timezone, items, tasks, onEdit }: { date: string; timezone: string; items: PlannerItem[]; tasks: PlannerTask[]; onEdit: (item: PlannerItem) => void }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
    {Array.from({ length: 7 }, (_, n) => plusDays(date, n)).map(day => {
      const range = dayRange(day, timezone);
      const events = items.filter(item => overlaps(item, { startAt: range.start.toISOString(), endAt: range.end.toISOString() }));
      const deadlines = tasks.filter(task => task.dueAt && dateInZone(new Date(task.dueAt), timezone) === day);
      return <section key={day} className="min-w-0 rounded-2xl border bg-white p-3">
        <h2 className="mb-3 font-bold">{new Date(`${day}T12:00Z`).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' })}</h2>
        <Timeline items={events} timezone={timezone} onEdit={onEdit} />
        {deadlines.length > 0 && <div className="mt-4 border-t pt-3"><h3 className="text-xs font-bold uppercase text-amber-800">Termíny úkolů</h3><ul className="mt-2 space-y-2">{deadlines.map(task => <li key={`${task.sourceKind}:${task.id}`}><Link href={task.href} className="block break-words rounded-lg bg-amber-50 p-2 text-sm hover:underline">{task.title}</Link></li>)}</ul></div>}
      </section>;
    })}
  </div>;
}
