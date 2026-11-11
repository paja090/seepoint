import Link from 'next/link';
import { ArrowUpRight, Briefcase, Calendar, Clock, MapPin, Pencil, Route, UserX } from 'lucide-react';
import type { PlannerItem } from '@/lib/planner/domain';

export function Timeline({
  items,
  timezone,
  onEdit,
  compact = false,
}: {
  items: PlannerItem[];
  timezone: string;
  onEdit: (item: PlannerItem) => void;
  compact?: boolean;
}) {
  const time = (value: string) =>
    new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));

  return (
    <div className="space-y-2.5">
      {!items.length && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-7 text-center">
          <Calendar className="mb-2 h-6 w-6 text-slate-300" />
          <p className="text-xs font-semibold text-slate-500">
            Zatím tu nejsou žádné schůzky ani naplánované bloky.
          </p>
        </div>
      )}
      {items.map((item) => {
        const isField = item.source === 'FIELD_TRIP';
        const isGoogle = item.source === 'GOOGLE';
        const isAbsence = item.source === 'ABSENCE';
        const isWorkPlan = item.source === 'WORK_PLAN';

        const sourceLabel = isField
          ? item.isDraft
            ? 'Návrh výjezdu'
            : 'Terénní výjezd'
          : isWorkPlan
          ? 'Plán práce'
          : isGoogle
          ? 'Google'
          : isAbsence
          ? 'Absence'
          : 'SeePoint';

        const cardClasses = isField
          ? item.isDraft
            ? 'border-purple-200/90 border-l-purple-300 bg-gradient-to-r from-purple-50/60 to-white'
            : 'border-purple-200/90 border-l-purple-500 bg-gradient-to-r from-purple-50/90 to-white'
          : isWorkPlan
          ? 'border-amber-200/90 border-l-amber-500 bg-gradient-to-r from-amber-50/80 to-white'
          : isGoogle
          ? 'border-sky-200/90 border-l-sky-500 bg-gradient-to-r from-sky-50/80 to-white'
          : isAbsence
          ? 'border-slate-200 border-l-slate-400 bg-slate-50'
          : 'border-emerald-200/90 border-l-emerald-500 bg-gradient-to-r from-emerald-50/80 to-white';

        const badgeClasses = isField
          ? 'bg-purple-100 text-purple-800'
          : isWorkPlan
          ? 'bg-amber-100 text-amber-900'
          : isGoogle
          ? 'bg-sky-100 text-sky-800'
          : isAbsence
          ? 'bg-slate-200 text-slate-700'
          : 'bg-emerald-100 text-emerald-800';

        const Icon = isField ? Route : isWorkPlan ? Briefcase : isGoogle ? Calendar : isAbsence ? UserX : Clock;

        return (
          <article
            key={`${item.source}:${item.id}`}
            className={`group rounded-2xl border border-l-4 ${compact ? 'p-2.5' : 'p-3.5'} shadow-sm transition hover:shadow-md ${cardClasses}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                <span>{item.allDay ? (isWorkPlan ? 'V plánu dne' : 'Celý den') : `${time(item.startAt)}–${time(item.endAt)}`}</span>
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClasses}`}>
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span>{sourceLabel}</span>
              </span>
            </div>

            <p className={`mt-1.5 break-words font-bold leading-snug text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
              {item.title}
            </p>

            {item.location && (
              <p className="mt-1.5 flex items-start gap-1 text-xs text-slate-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="break-words">{item.location}</span>
              </p>
            )}

            {(item.href || item.editable) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                {item.href && (
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-1 text-xs font-bold hover:underline ${
                      isWorkPlan ? 'text-amber-800 hover:text-amber-950' : 'text-purple-700 hover:text-purple-900'
                    }`}
                  >
                    <span>{isWorkPlan ? 'Otevřít zakázku' : 'Otevřít trasu'}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
                {item.editable && (
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/70 px-2.5 py-1 text-xs font-bold text-emerald-900 transition hover:bg-emerald-200/80"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Upravit čas</span>
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
