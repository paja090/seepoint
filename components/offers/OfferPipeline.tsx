'use client';

import { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  Clock,
  Eye,
  MapPin,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  Layers,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { OfferView } from '@/lib/offers/view-model';

type StageKey = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

interface StageDef {
  key: StageKey;
  label: string;
  description: string;
  tone: string;
  bgBadge: string;
  isClosed: boolean;
}

const STAGES: StageDef[] = [
  { key: 'DRAFT', label: 'Koncepty', description: 'Rozpracované nabídky', tone: 'bg-amber-500', bgBadge: 'bg-amber-50 text-amber-700 border-amber-200', isClosed: false },
  { key: 'SENT', label: 'Odeslané', description: 'Zatím neotevřené', tone: 'bg-sky-500', bgBadge: 'bg-sky-50 text-sky-700 border-sky-200', isClosed: false },
  { key: 'VIEWED', label: 'Zobrazené', description: 'Klient otevřel nabídku', tone: 'bg-indigo-500', bgBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200', isClosed: false },
  { key: 'ACCEPTED', label: 'Přijaté', description: 'Schváleno klientem', tone: 'bg-emerald-500', bgBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200', isClosed: false },
  { key: 'REJECTED', label: 'Odmítnuté', description: 'Odmítnuto klientem', tone: 'bg-red-500', bgBadge: 'bg-red-50 text-red-700 border-red-200', isClosed: true },
  { key: 'EXPIRED', label: 'Expirované', description: 'Po termínu platnosti', tone: 'bg-slate-400', bgBadge: 'bg-slate-100 text-slate-700 border-slate-200', isClosed: true },
];

const money = (value: string | number | null) => new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
}).format(Number(value ?? 0));

export function OfferPipeline({ offers }: { offers: OfferView[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageScope, setStageScope] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [viewDensity, setViewDensity] = useState<'CARDS' | 'COMPACT'>('CARDS');
  const [sortBy, setSortBy] = useState<'UPDATED' | 'PRICE_DESC' | 'EXPIRING'>('UPDATED');
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  const toggleCollapse = (stageKey: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageKey]: !prev[stageKey] }));
  };

  // Filter offers by text search
  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) return offers;
    const q = searchQuery.toLowerCase().trim();
    return offers.filter((o) =>
      o.client?.name?.toLowerCase().includes(q) ||
      o.campaignName?.toLowerCase().includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.createdBy?.name?.toLowerCase().includes(q) ||
      (o.navigation?.targetName && o.navigation.targetName.toLowerCase().includes(q))
    );
  }, [offers, searchQuery]);

  // Stages to show based on scope
  const visibleStages = useMemo(() => {
    if (stageScope === 'ACTIVE') {
      return STAGES.filter((s) => !s.isClosed);
    }
    return STAGES;
  }, [stageScope]);

  return (
    <div className="space-y-3.5">
      {/* Interactive Toolbar for High Volume Management */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rychlé hledání klienta, kampaně nebo cíle..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              type="button"
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              title="Vymazat filtr"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View Controls & Filters */}
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          {/* Active vs All Pipeline Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setStageScope('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                stageScope === 'ACTIVE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aktivní pipeline (4)
            </button>
            <button
              type="button"
              onClick={() => setStageScope('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                stageScope === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Všechny stavy (6)
            </button>
          </div>

          {/* Density Toggle (Cards vs Compact) */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setViewDensity('CARDS')}
              className={`p-1 rounded-lg transition ${
                viewDensity === 'CARDS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Přepnout na detailní karty"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewDensity('COMPACT')}
              className={`p-1 rounded-lg transition ${
                viewDensity === 'COMPACT'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Přepnout na kompaktní řádky (pro hodně nabídek)"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'UPDATED' | 'PRICE_DESC' | 'EXPIRING')}
              aria-label="Řazení nabídek v trychtýři"
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-2 py-1 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="UPDATED">Nejnovější</option>
              <option value="PRICE_DESC">Nejvyšší hodnota</option>
              <option value="EXPIRING">Blížící se termín</option>
            </select>
          </div>
        </div>
      </div>

      {/* Funnel Columns Container */}
      <div className="overflow-x-auto pb-3">
        <div
          className={`grid gap-3.5 transition-all ${
            visibleStages.length === 4
              ? 'min-w-[960px] grid-cols-4'
              : 'min-w-[1240px] grid-cols-6'
          }`}
        >
          {visibleStages.map((stage) => {
            const isCollapsed = Boolean(collapsedStages[stage.key]);

            let rows = filteredOffers.filter((offer) =>
              stage.key === 'VIEWED'
                ? offer.status === 'SENT' && offer.events?.some((event) => event.type === 'VIEWED')
                : stage.key === 'SENT'
                  ? offer.status === 'SENT' && !offer.events?.some((event) => event.type === 'VIEWED')
                  : offer.status === stage.key
            );

            // Sort rows
            if (sortBy === 'PRICE_DESC') {
              rows = [...rows].sort((a, b) => Number(b.totalWithTax ?? 0) - Number(a.totalWithTax ?? 0));
            } else if (sortBy === 'EXPIRING') {
              rows = [...rows].sort((a, b) => {
                if (!a.validUntil) return 1;
                if (!b.validUntil) return -1;
                return new Date(`${a.validUntil}T00:00:00Z`).getTime() - new Date(`${b.validUntil}T00:00:00Z`).getTime();
              });
            } else {
              // UPDATED
              rows = [...rows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            }

            const total = rows.reduce((sum, offer) => sum + Number(offer.totalWithTax ?? 0), 0);

            // Collapsed Stage Column (vertical slim pill)
            if (isCollapsed) {
              return (
                <div
                  key={stage.key}
                  onClick={() => toggleCollapse(stage.key)}
                  className="flex flex-col items-center justify-between py-4 px-2 rounded-2xl border border-slate-200 bg-slate-100/70 hover:bg-slate-200/60 transition cursor-pointer select-none group min-h-[400px] w-14"
                  title={`Rozbalit sloupec: ${stage.label}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span aria-hidden="true" className={`size-3 rounded-full ${stage.tone} shadow-2xs`} />
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-slate-700 border border-slate-200">
                      {rows.length}
                    </span>
                  </div>

                  <span className="rotate-90 origin-center whitespace-nowrap text-xs font-bold text-slate-600 tracking-wide uppercase group-hover:text-slate-900 transition">
                    {stage.label}
                  </span>

                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition" />
                </div>
              );
            }

            return (
              <section
                key={stage.key}
                className="flex flex-col rounded-2xl border border-slate-200/90 bg-slate-50/70 shadow-2xs overflow-hidden"
              >
                {/* Sticky Header with Stage Info & Total CZK */}
                <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-xs p-3">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span aria-hidden="true" className={`size-2.5 rounded-full ${stage.tone} shrink-0`} />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 truncate">
                        {stage.label}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-100 px-1.5 text-[11px] font-extrabold text-slate-700 border border-slate-200/80">
                        {rows.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCollapse(stage.key)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                        title="Sbalit sloupec"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{stage.description}</span>
                    <span className="font-extrabold text-slate-800 shrink-0 ml-1">
                      {money(total)}
                    </span>
                  </div>
                </header>

                {/* Scrollable Column Body */}
                <div className="flex flex-1 flex-col gap-2 p-2.5 max-h-[580px] overflow-y-auto scrollbar-thin">
                  {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200/80 p-5 text-center text-xs text-slate-400">
                      Žádné nabídky
                    </div>
                  ) : rows.map((offer) => {
                    const validDays = offer.validUntil
                      ? Math.ceil((new Date(`${offer.validUntil}T23:59:59Z`).getTime() - Date.now()) / 86_400_000)
                      : null;
                    const viewCount = offer.events?.filter((event) => event.type === 'VIEWED').length ?? 0;
                    const initials = offer.createdBy?.name
                      ? offer.createdBy.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
                      : 'SP';
                    const isUrgent = validDays != null && validDays <= 5 && ['DRAFT', 'SENT', 'VIEWED'].includes(stage.key);

                    // COMPACT ROW VIEW
                    if (viewDensity === 'COMPACT') {
                      return (
                        <Link
                          key={offer.id}
                          href={`/offers/${offer.id}`}
                          className={`group block rounded-xl border p-2.5 transition shadow-2xs ${
                            isUrgent
                              ? 'border-red-200 bg-red-50/40 hover:bg-red-50/80'
                              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-sky-700 transition truncate">
                              {offer.client?.name}
                            </span>
                            <span className="text-xs font-black text-slate-900 shrink-0">
                              {money(offer.totalWithTax)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="truncate pr-1">
                              {offer.campaignName || offer.title}
                            </span>
                            {validDays != null && ['DRAFT', 'SENT', 'VIEWED'].includes(stage.key) && (
                              <span className={`shrink-0 font-bold ${validDays <= 5 ? 'text-red-600' : 'text-slate-400'}`}>
                                {validDays} d
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    }

                    // STANDARD CARD VIEW
                    return (
                      <Link
                        key={offer.id}
                        href={`/offers/${offer.id}`}
                        className={`group block rounded-xl border p-3 transition shadow-2xs ${
                          isUrgent
                            ? 'border-red-200/90 bg-red-50/30 hover:border-red-300 hover:bg-red-50/60'
                            : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        {/* Client Name & External Link Arrow */}
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold leading-tight text-slate-900 group-hover:text-sky-700 transition truncate">
                            {offer.client?.name}
                          </p>
                          <ArrowUpRight className="shrink-0 h-3.5 w-3.5 text-slate-300 transition group-hover:text-sky-600" />
                        </div>

                        {/* Campaign Name */}
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600">
                          {offer.campaignName || offer.title}
                        </p>

                        {/* Type badge if navigation or exhibition */}
                        {offer.offerType === 'NAVIGATION' && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60 w-fit">
                            <Compass className="h-3 w-3" />
                            <span>Navigace {offer.navigation?.targetName ? `· ${offer.navigation.targetName}` : ''}</span>
                          </div>
                        )}

                        {/* Price & Units */}
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-black tracking-tight text-slate-950">
                            {money(offer.totalWithTax)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {offer.offerType === 'NAVIGATION'
                              ? `${offer.navigation?.points?.length ?? 0} cedulí`
                              : `${offer.items?.length ?? 0} ploch`}
                          </span>
                        </div>

                        {/* Footer with Creator, Views and Expiration */}
                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="grid size-4 place-items-center rounded-full bg-slate-900 text-[8px] font-bold text-white shrink-0">
                              {initials}
                            </span>
                            <span className="truncate">
                              {new Date(offer.updatedAt).toLocaleDateString('cs-CZ')}
                            </span>
                          </span>

                          <span className="flex items-center gap-1.5 shrink-0">
                            {viewCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-bold text-indigo-600" title={`Klient nabídku otevřel ${viewCount}×`}>
                                <Eye className="h-3 w-3" />
                                {viewCount}×
                              </span>
                            )}
                            {validDays != null && ['DRAFT', 'SENT', 'VIEWED'].includes(stage.key) && (
                              <span
                                className={`inline-flex items-center gap-0.5 font-bold ${
                                  validDays <= 5 ? 'text-red-600' : 'text-slate-500'
                                }`}
                                title={`Platnost nabídky: ${validDays} dní`}
                              >
                                <Clock className="h-3 w-3" />
                                {Math.max(0, validDays)} d
                              </span>
                            )}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
