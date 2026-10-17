import Link from 'next/link';
import type { PlannerItem } from '@/lib/planner/domain';

export function Timeline({ items, timezone, onEdit }: { items: PlannerItem[]; timezone: string; onEdit: (item: PlannerItem) => void }) {
  const time = (value: string) => new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  return <div className="space-y-3">
    {!items.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Zatím tu nejsou žádné schůzky ani pracovní bloky.</p>}
    {items.map(item => {
      const isField = item.source === 'FIELD_TRIP';
      const isGoogle = item.source === 'GOOGLE';
      const isAbsence = item.source === 'ABSENCE';
      const sourceLabel = isField ? 'Terénní výjezd' : isGoogle ? 'Google' : isAbsence ? 'Absence' : 'SeePoint';
      const colorClasses = isField
        ? 'border-purple-500 bg-purple-50/90 text-purple-950'
        : isGoogle
        ? 'border-sky-400 bg-sky-50'
        : isAbsence
        ? 'border-slate-400 bg-slate-100'
        : 'border-emerald-400 bg-emerald-50';

      return <article key={`${item.source}:${item.id}`} className={`rounded-xl border-l-4 p-3 transition shadow-sm ${colorClasses}`}>
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
          <span>{item.allDay ? 'Celý den' : `${time(item.startAt)}–${time(item.endAt)}`}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isField ? 'bg-purple-200/80 text-purple-800' : 'bg-white/80'}`}>{sourceLabel}</span>
        </div>
        <p className="mt-1 break-words font-semibold text-slate-900">{item.title}</p>
        {item.location && <p className="mt-1 text-xs text-slate-600">{item.location}</p>}
        {item.href && <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline">Otevřít trasu →</Link>}
        {item.editable && <button onClick={() => onEdit(item)} className="mt-2 min-h-9 text-xs font-bold text-emerald-800">Upravit čas →</button>}
      </article>;
    })}
  </div>;
}
