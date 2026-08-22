'use client';

import { Search, Filter, RefreshCw } from 'lucide-react';
import type { OpportunityEventType, OpportunityStatus } from '@prisma/client';

export type FilterState = {
  search: string;
  city: string;
  eventType: string;
  status: string;
  minScore: string;
};

const eventTypeOptions: Array<{ value: OpportunityEventType | ''; label: string }> = [
  { value: '', label: 'Všechny typy událostí' },
  { value: 'NEW_BRANCH', label: '🏬 Nová pobočka / prodejna' },
  { value: 'RESTAURANT_OPENING', label: '🍔 Nová restaurace / Gastro' },
  { value: 'CAR_DEALERSHIP', label: '🚗 Nový autosalon' },
  { value: 'RETAIL_PARK', label: '🏛️ Nový retail park' },
  { value: 'RETAIL_PARK_TENANT', label: '🏬 Nájemce v retail parku' },
  { value: 'EXPANSION', label: '📈 Expanze firmy do regionu' },
  { value: 'RELOCATION', label: '🚚 Stěhování provozovny' },
  { value: 'REOPENING', label: '🛠️ Znovuotevření po rekonstrukci' },
  { value: 'MARKETING_EVENT', label: '📣 Výrazná marketingová akce' },
  { value: 'SEASONAL_CAMPAIGN', label: '❄️ Sezónní kampaň' },
  { value: 'MASS_RECRUITMENT', label: '👷 Nábor velkého počtu zaměstnanců' },
  { value: 'OTHER', label: '📍 Jiný obchodní signál' },
];

const statusOptions: Array<{ value: OpportunityStatus | ''; label: string }> = [
  { value: '', label: 'Všechny stavy' },
  { value: 'NEW', label: '✨ Nové příležitosti' },
  { value: 'REVIEWED', label: '👁️ Přezkoumáno' },
  { value: 'CONTACT_PLANNED', label: '📅 Plánované oslovení' },
  { value: 'CONTACTED', label: '📞 Kontaktováno' },
  { value: 'PROPOSAL_CREATED', label: '📄 Vytvořen návrh' },
  { value: 'CONVERTED', label: '✅ Konvertováno' },
  { value: 'DISMISSED', label: '🚫 Ignorováno' },
];

export function OpportunityFiltersBar({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState;
  onChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-md">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Filter className="w-4 h-4 text-purple-400" />
          <span>Filtrovat příležitosti</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Vynulovat filtry</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            className="input pl-9 text-xs py-2 w-full"
            placeholder="Hledat firmu, titulek..."
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
          />
        </div>

        {/* City input */}
        <div>
          <input
            type="text"
            className="input text-xs py-2 w-full"
            placeholder="Město (Ostrava, Opava...)"
            value={filters.city}
            onChange={(e) => onChange('city', e.target.value)}
          />
        </div>

        {/* Event Type Select */}
        <div>
          <select
            className="input text-xs py-2 w-full"
            value={filters.eventType}
            onChange={(e) => onChange('eventType', e.target.value)}
          >
            {eventTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Select */}
        <div>
          <select
            className="input text-xs py-2 w-full"
            value={filters.status}
            onChange={(e) => onChange('status', e.target.value)}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Min Score Select */}
        <div>
          <select
            className="input text-xs py-2 w-full"
            value={filters.minScore}
            onChange={(e) => onChange('minScore', e.target.value)}
          >
            <option value="">Všechny Opportunity Score</option>
            <option value="80">🔥 Silné (Score 80+)</option>
            <option value="60">⚡ Střední (Score 60+)</option>
            <option value="40">📍 Základní (Score 40+)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
