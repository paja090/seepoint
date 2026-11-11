'use client';
import Link from 'next/link';
import { CalendarCheck2 } from 'lucide-react';
import type { PlannerItem, PlannerTask } from '@/lib/planner/domain';
import { dateInZone, dayRange, plusDays } from '@/lib/planner/time';
import { overlaps } from '@/lib/planner/scheduling';
import { Timeline } from './Timeline';

export function WeekView({
  date,
  timezone,
  items,
  tasks,
  onEdit,
}: {
  date: string;
  timezone: string;
  items: PlannerItem[];
  tasks: PlannerTask[];
  onEdit: (item: PlannerItem) => void;
}) {
  const realToday = dateInZone(new Date(), timezone);

  return (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-7">
      {Array.from({ length: 7 }, (_, n) => plusDays(date, n)).map((day) => {
        const range = dayRange(day, timezone);
        const events = items.filter((item) =>
          overlaps(item, { startAt: range.start.toISOString(), endAt: range.end.toISOString() })
        );
        const deadlines = tasks.filter(
          (task) => task.dueAt && dateInZone(new Date(task.dueAt), timezone) === day
        );
        const isToday = day === realToday;
        const dayObj = new Date(`${day}T12:00Z`);
        const weekday = dayObj.toLocaleDateString('cs-CZ', { weekday: 'short', timeZone: 'UTC' });
        const dateLabel = dayObj.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

        return (
          <section
            key={day}
            className={`flex min-w-0 flex-col rounded-3xl border p-3.5 shadow-sm transition ${
              isToday
                ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/70 via-white to-white ring-1 ring-emerald-200/80'
                : 'border-slate-200/90 bg-white'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-black uppercase ${
                    isToday ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {weekday}
                </span>
                <h2 className="text-sm font-black text-slate-900">{dateLabel}</h2>
              </div>
              {events.length + deadlines.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {events.length + deadlines.length}
                </span>
              )}
            </div>

            <Timeline items={events} timezone={timezone} onEdit={onEdit} compact />

            {deadlines.length > 0 && (
              <div className="mt-3.5 border-t border-slate-100 pt-3">
                <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                  <CalendarCheck2 className="h-3 w-3" />
                  <span>Úkoly v plánu ({deadlines.length})</span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {deadlines.map((task) => (
                    <li key={`${task.sourceKind}:${task.id}`}>
                      <Link
                        href={task.href}
                        className="block break-words rounded-xl border border-amber-200/70 bg-amber-50/70 px-2.5 py-2 text-xs font-semibold text-slate-800 transition hover:border-amber-300 hover:bg-amber-100/70"
                      >
                        {task.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
