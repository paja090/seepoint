import type { PlannerItem } from '@/lib/planner/domain';
export function Timeline({ items, timezone, onEdit }: { items: PlannerItem[]; timezone: string; onEdit: (item: PlannerItem) => void }) {
  const time = (value: string) => new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  return <div className="space-y-3">{!items.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Zatím tu nejsou žádné schůzky ani pracovní bloky.</p>}{items.map(item => <article key={`${item.source}:${item.id}`} className={`rounded-xl border-l-4 p-3 ${item.source === 'GOOGLE' ? 'border-sky-400 bg-sky-50' : item.source === 'ABSENCE' ? 'border-slate-400 bg-slate-100' : 'border-emerald-400 bg-emerald-50'}`}>
    <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600"><span>{item.allDay ? 'Celý den' : `${time(item.startAt)}–${time(item.endAt)}`}</span><span>{item.source === 'GOOGLE' ? 'Google' : item.source === 'ABSENCE' ? 'Absence' : 'SeePoint'}</span></div>
    <p className="mt-1 break-words font-semibold text-slate-900">{item.title}</p>{item.location && <p className="mt-1 text-xs text-slate-600">{item.location}</p>}{item.editable && <button onClick={() => onEdit(item)} className="mt-2 min-h-9 text-xs font-bold text-emerald-800">Upravit čas →</button>}
  </article>)}</div>;
}
