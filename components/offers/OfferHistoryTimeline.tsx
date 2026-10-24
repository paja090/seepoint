'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  ChevronDown,
  ChevronUp,
  Eye,
  Send,
  Pencil,
  Sparkles,
  HelpCircle,
  XCircle,
  Archive,
  History,
  Copy,
  Globe,
} from 'lucide-react';
import { Card } from '@/components/ui';

interface OfferEventItem {
  id: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  message?: string | null;
  createdAt: string;
}

interface Props {
  events?: OfferEventItem[];
}

const EVENT_CONFIG: Record<
  string,
  { label: string; dotColor: string; badgeBg: string; textColor: string; icon: typeof CheckCircle2 }
> = {
  CREATED: {
    label: 'Nabídka vytvořena',
    dotColor: 'bg-sky-500',
    badgeBg: 'bg-sky-50',
    textColor: 'text-sky-700',
    icon: Sparkles,
  },
  UPDATED: {
    label: 'Nabídka upravena',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-50',
    textColor: 'text-amber-800',
    icon: Pencil,
  },
  DUPLICATED: {
    label: 'Nabídka duplikována',
    dotColor: 'bg-slate-500',
    badgeBg: 'bg-slate-100',
    textColor: 'text-slate-700',
    icon: Copy,
  },
  PUBLISHED: {
    label: 'Veřejný odkaz vytvořen',
    dotColor: 'bg-indigo-500',
    badgeBg: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    icon: Globe,
  },
  SENT: {
    label: 'Nabídka odeslána',
    dotColor: 'bg-violet-500',
    badgeBg: 'bg-violet-50',
    textColor: 'text-violet-700',
    icon: Send,
  },
  VIEWED: {
    label: 'Nabídka zobrazena klientem',
    dotColor: 'bg-blue-500',
    badgeBg: 'bg-blue-50',
    textColor: 'text-blue-700',
    icon: Eye,
  },
  ACCEPTED: {
    label: 'Nabídka přijata klientem',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Nabídka zamítnuta',
    dotColor: 'bg-rose-500',
    badgeBg: 'bg-rose-50',
    textColor: 'text-rose-700',
    icon: XCircle,
  },
  EXPIRED: {
    label: 'Platnost ukončena',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-100',
    textColor: 'text-slate-600',
    icon: Clock3,
  },
  QUESTION: {
    label: 'Klient položil dotaz / požadavek',
    dotColor: 'bg-teal-500',
    badgeBg: 'bg-teal-50',
    textColor: 'text-teal-700',
    icon: HelpCircle,
  },
  CONVERTED: {
    label: 'Převedeno na zakázku',
    dotColor: 'bg-emerald-600',
    badgeBg: 'bg-emerald-100',
    textColor: 'text-emerald-900',
    icon: CheckCircle2,
  },
  ARCHIVED: {
    label: 'Nabídka archivována',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-100',
    textColor: 'text-slate-600',
    icon: Archive,
  },
};

const DEFAULT_CONFIG = {
  label: 'Změna stavu',
  dotColor: 'bg-slate-400',
  badgeBg: 'bg-slate-50',
  textColor: 'text-slate-700',
  icon: History,
};

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Dnes v ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Včera v ${timeStr}`;
    }

    return `${d.toLocaleDateString('cs-CZ')} v ${timeStr}`;
  } catch {
    return dateStr;
  }
}

export function OfferHistoryTimeline({ events = [] }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'CLIENT' | 'EDITS'>('ALL');

  if (!events || events.length === 0) {
    return (
      <Card>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktivita</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Historie nabídky</h2>
        </div>
        <p className="mt-5 text-sm text-slate-500">Zatím bez zaznamenané aktivity.</p>
      </Card>
    );
  }

  // Filter events
  const filteredEvents = events.filter((ev) => {
    if (filter === 'CLIENT') {
      return ['VIEWED', 'ACCEPTED', 'REJECTED', 'QUESTION', 'SENT'].includes(ev.type);
    }
    if (filter === 'EDITS') {
      return ['UPDATED', 'CREATED', 'DUPLICATED', 'CONVERTED', 'ARCHIVED'].includes(ev.type);
    }
    return true;
  });

  const INITIAL_LIMIT = 4;
  const hasMore = filteredEvents.length > INITIAL_LIMIT;
  const displayedEvents = isExpanded ? filteredEvents : filteredEvents.slice(0, INITIAL_LIMIT);

  const clientEventCount = events.filter((ev) =>
    ['VIEWED', 'ACCEPTED', 'REJECTED', 'QUESTION', 'SENT'].includes(ev.type)
  ).length;

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Aktivita</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Historie nabídky</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {events.length}
            </span>
          </div>
        </div>

        {events.length > 3 && (
          <div className="flex items-center gap-1 self-start rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`rounded-lg px-2 py-1 transition ${
                filter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vše ({events.length})
            </button>
            {clientEventCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('CLIENT')}
                className={`rounded-lg px-2 py-1 transition ${
                  filter === 'CLIENT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Klient ({clientEventCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilter('EDITS')}
              className={`rounded-lg px-2 py-1 transition ${
                filter === 'EDITS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Úpravy
            </button>
          </div>
        )}
      </div>

      <div className={`mt-5 ${isExpanded ? 'max-h-96 overflow-y-auto pr-1' : ''}`}>
        <ol className="relative space-y-4 border-l border-slate-200 ml-2">
          {displayedEvents.map((event) => {
            const conf = EVENT_CONFIG[event.type] || DEFAULT_CONFIG;
            const Icon = conf.icon;
            const isClientActor = event.actorName?.toLowerCase().includes('klient') || event.type === 'VIEWED';

            return (
              <li className="relative pl-5 text-sm" key={event.id}>
                {/* Timeline dot */}
                <span
                  aria-hidden="true"
                  className={`absolute -left-1.5 top-1 size-3 rounded-full border-2 border-white ${conf.dotColor} shadow-2xs`}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${conf.badgeBg} ${conf.textColor}`}
                  >
                    <Icon className="size-3" />
                    {conf.label}
                  </span>

                  {event.fromStatus && event.toStatus && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      ({event.fromStatus} → {event.toStatus})
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Clock3 aria-hidden="true" className="size-3 text-slate-400" />
                    {formatEventDate(event.createdAt)}
                  </span>
                  <span>·</span>
                  <span
                    className={`rounded-sm px-1 py-0.2 text-[10px] font-semibold ${
                      isClientActor
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {event.actorName || 'Systém'}
                  </span>
                </div>

                {event.message && (
                  <p className="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {event.message}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {hasMore && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 hover:bg-sky-50 px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3.5" />
                Sbalit historii na {INITIAL_LIMIT} nejnovější
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                Zobrazit celou historii (+{filteredEvents.length - INITIAL_LIMIT} dalších záznamů)
              </>
            )}
          </button>
        </div>
      )}
    </Card>
  );
}
