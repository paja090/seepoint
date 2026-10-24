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
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Send,
  FileEdit,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import type { OfferView } from '@/lib/offers/view-model';

type StageKey = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

interface StageDef {
  key: StageKey;
  label: string;
  shortLabel: string;
  description: string;
  tone: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
  isClosed: boolean;
}

const STAGES: StageDef[] = [
  {
    key: 'DRAFT',
    label: 'Koncepty',
    shortLabel: 'Koncept',
    description: 'V přípravě u obchodníka',
    tone: 'bg-amber-500',
    bgLight: 'bg-amber-50/80',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-300',
    isClosed: false,
  },
  {
    key: 'SENT',
    label: 'Odeslané',
    shortLabel: 'Odesláno',
    description: 'Čeká na první otevření klientem',
    tone: 'bg-sky-500',
    bgLight: 'bg-sky-50/80',
    textColor: 'text-sky-800',
    borderColor: 'border-sky-300',
    isClosed: false,
  },
  {
    key: 'VIEWED',
    label: 'Zobrazené',
    shortLabel: 'Zobrazeno',
    description: 'Klient nabídku aktivně otevřel',
    tone: 'bg-indigo-500',
    bgLight: 'bg-indigo-50/80',
    textColor: 'text-indigo-800',
    borderColor: 'border-indigo-300',
    isClosed: false,
  },
  {
    key: 'ACCEPTED',
    label: 'Přijaté',
    shortLabel: 'Schváleno',
    description: 'Klient schválil, připraveno k realizaci',
    tone: 'bg-emerald-500',
    bgLight: 'bg-emerald-50/80',
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-300',
    isClosed: false,
  },
  {
    key: 'REJECTED',
    label: 'Odmítnuté',
    shortLabel: 'Odmítnuto',
    description: 'Odmítnuto klientem',
    tone: 'bg-red-500',
    bgLight: 'bg-red-50/80',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    isClosed: true,
  },
  {
    key: 'EXPIRED',
    label: 'Expirované',
    shortLabel: 'Expirováno',
    description: 'Po termínu platnosti',
    tone: 'bg-slate-400',
    bgLight: 'bg-slate-100/80',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    isClosed: true,
  },
];

const money = (value: string | number | null) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export function OfferPipeline({ offers }: { offers: OfferView[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stageScope, setStageScope] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  // Default to compact if there are more than 6 offers for maximum readability
  const [viewDensity, setViewDensity] = useState<'CARDS' | 'COMPACT'>(
    offers.length > 6 ? 'COMPACT' : 'CARDS'
  );
  const [sortBy, setSortBy] = useState<'UPDATED' | 'PRICE_DESC' | 'EXPIRING'>('UPDATED');
  const [selectedStageFocus, setSelectedStageFocus] = useState<StageKey | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'NAVIGATION' | 'STANDARD' | 'EXPIRING'>('ALL');
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  const toggleCollapse = (stageKey: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageKey]: !prev[stageKey] }));
  };

  // Funnel Stage Metrics calculation (across all unfiltered offers)
  const funnelMetrics = useMemo(() => {
    const drafts = offers.filter((o) => o.status === 'DRAFT');
    const sent = offers.filter((o) => o.status === 'SENT' && !o.events?.some((e) => e.type === 'VIEWED'));
    const viewed = offers.filter((o) => o.status === 'SENT' && o.events?.some((e) => e.type === 'VIEWED'));
    const accepted = offers.filter((o) => o.status === 'ACCEPTED');
    const rejected = offers.filter((o) => o.status === 'REJECTED');
    const expired = offers.filter((o) => o.status === 'EXPIRED');

    const sumVal = (list: OfferView[]) =>
      list.reduce((sum, o) => sum + Number(o.totalWithTax ?? 0), 0);

    const draftsVal = sumVal(drafts);
    const sentVal = sumVal(sent);
    const viewedVal = sumVal(viewed);
    const acceptedVal = sumVal(accepted);

    const totalActiveVal = draftsVal + sentVal + viewedVal + acceptedVal;
    const clientFacingTotal = sent.length + viewed.length + accepted.length;
    const winRate = clientFacingTotal > 0 ? Math.round((accepted.length / clientFacingTotal) * 100) : 0;
    const viewRate = clientFacingTotal > 0 ? Math.round(((viewed.length + accepted.length) / clientFacingTotal) * 100) : 0;

    return {
      drafts: { count: drafts.length, value: draftsVal },
      sent: { count: sent.length, value: sentVal },
      viewed: { count: viewed.length, value: viewedVal },
      accepted: { count: accepted.length, value: acceptedVal },
      rejected: { count: rejected.length, value: sumVal(rejected) },
      expired: { count: expired.length, value: sumVal(expired) },
      totalActiveVal,
      winRate,
      viewRate,
    };
  }, [offers]);

  // Filter offers by text search, type filter, and stage focus
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          o.client?.name?.toLowerCase().includes(q) ||
          o.campaignName?.toLowerCase().includes(q) ||
          o.title?.toLowerCase().includes(q) ||
          o.createdBy?.name?.toLowerCase().includes(q) ||
          (o.navigation?.targetName && o.navigation.targetName.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Type filter
      if (typeFilter === 'NAVIGATION' && o.offerType !== 'NAVIGATION') return false;
      if (typeFilter === 'STANDARD' && o.offerType === 'NAVIGATION') return false;
      if (typeFilter === 'EXPIRING') {
        if (!o.validUntil) return false;
        const days = Math.ceil((new Date(`${o.validUntil}T23:59:59Z`).getTime() - Date.now()) / 86_400_000);
        if (days < 0 || days > 5) return false;
      }

      // Focus on specific stage
      if (selectedStageFocus) {
        if (selectedStageFocus === 'VIEWED') {
          return o.status === 'SENT' && o.events?.some((e) => e.type === 'VIEWED');
        }
        if (selectedStageFocus === 'SENT') {
          return o.status === 'SENT' && !o.events?.some((e) => e.type === 'VIEWED');
        }
        return o.status === selectedStageFocus;
      }

      return true;
    });
  }, [offers, searchQuery, typeFilter, selectedStageFocus]);

  // Stages to show based on scope
  const visibleStages = useMemo(() => {
    if (selectedStageFocus) {
      return STAGES.filter((s) => s.key === selectedStageFocus);
    }
    if (stageScope === 'ACTIVE') {
      return STAGES.filter((s) => !s.isClosed);
    }
    return STAGES;
  }, [stageScope, selectedStageFocus]);

  const hasActiveFilters = Boolean(searchQuery.trim() || typeFilter !== 'ALL' || selectedStageFocus);

  const resetAllFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setSelectedStageFocus(null);
  };

  return (
    <div className="space-y-4">
      {/* =====================================================================
          1. VIZUÁLNÍ KONVERZNÍ TRYCHTÝŘ (VISUAL FUNNEL BAR)
      ===================================================================== */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-950">Vizuální konverzní trychtýř</h3>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {offers.length} celkem
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kliknutím na fázi rychle zafiltrujete sloupce níže. Přepínejte mezi kompaktním seznamem a kartami.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold self-start md:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-slate-400">Aktivní hodnota:</span>{' '}
              <strong className="text-slate-950 font-black">{money(funnelMetrics.totalActiveVal)}</strong>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400">Míra otevření:</span>{' '}
              <strong className="text-indigo-600 font-black">{funnelMetrics.viewRate} %</strong>
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400">Úspěšnost (Win-Rate):</span>{' '}
              <strong className="text-emerald-600 font-black">{funnelMetrics.winRate} %</strong>
            </div>
          </div>
        </div>

        {/* 4 Interactive Funnel Conversion Steps */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Step 1: Koncepty */}
          <button
            type="button"
            onClick={() => setSelectedStageFocus(selectedStageFocus === 'DRAFT' ? null : 'DRAFT')}
            className={`group text-left p-3.5 rounded-2xl border transition relative ${
              selectedStageFocus === 'DRAFT'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                : 'bg-white border-slate-200/90 hover:border-amber-300 hover:bg-amber-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-800">
                <FileEdit size={13} className="text-amber-600" />
                1. Koncepty
              </span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-100 px-1 text-[11px] font-extrabold text-amber-900">
                {funnelMetrics.drafts.count}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-slate-900 group-hover:text-amber-950 transition">
              {money(funnelMetrics.drafts.value)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">V přípravě u obchodníka</p>
            {selectedStageFocus === 'DRAFT' && (
              <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded-md">
                Aktivní filtr
              </span>
            )}
          </button>

          {/* Step 2: Odeslané */}
          <button
            type="button"
            onClick={() => setSelectedStageFocus(selectedStageFocus === 'SENT' ? null : 'SENT')}
            className={`group text-left p-3.5 rounded-2xl border transition relative ${
              selectedStageFocus === 'SENT'
                ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/40 shadow-xs'
                : 'bg-white border-slate-200/90 hover:border-sky-300 hover:bg-sky-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-sky-800">
                <Send size={13} className="text-sky-600" />
                2. Odeslané
              </span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky-100 px-1 text-[11px] font-extrabold text-sky-900">
                {funnelMetrics.sent.count}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-slate-900 group-hover:text-sky-950 transition">
              {money(funnelMetrics.sent.value)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">Čekají na první otevření</p>
            {selectedStageFocus === 'SENT' && (
              <span className="absolute top-2 right-2 text-[10px] font-bold text-sky-700 bg-sky-200/60 px-1.5 py-0.5 rounded-md">
                Aktivní filtr
              </span>
            )}
          </button>

          {/* Step 3: Zobrazené */}
          <button
            type="button"
            onClick={() => setSelectedStageFocus(selectedStageFocus === 'VIEWED' ? null : 'VIEWED')}
            className={`group text-left p-3.5 rounded-2xl border transition relative ${
              selectedStageFocus === 'VIEWED'
                ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/40 shadow-xs'
                : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:bg-indigo-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-800">
                <Eye size={13} className="text-indigo-600" />
                3. Zobrazené
              </span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-100 px-1 text-[11px] font-extrabold text-indigo-900">
                {funnelMetrics.viewed.count}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-slate-900 group-hover:text-indigo-950 transition">
              {money(funnelMetrics.viewed.value)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">Klient aktivně prochází</p>
            {selectedStageFocus === 'VIEWED' && (
              <span className="absolute top-2 right-2 text-[10px] font-bold text-indigo-700 bg-indigo-200/60 px-1.5 py-0.5 rounded-md">
                Aktivní filtr
              </span>
            )}
          </button>

          {/* Step 4: Přijaté */}
          <button
            type="button"
            onClick={() => setSelectedStageFocus(selectedStageFocus === 'ACCEPTED' ? null : 'ACCEPTED')}
            className={`group text-left p-3.5 rounded-2xl border transition relative ${
              selectedStageFocus === 'ACCEPTED'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/40 shadow-xs'
                : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:bg-emerald-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-800">
                <CheckCircle2 size={13} className="text-emerald-600" />
                4. Přijaté (Vyhráno)
              </span>
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-100 px-1 text-[11px] font-extrabold text-emerald-900">
                {funnelMetrics.accepted.count}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-emerald-600 group-hover:text-emerald-700 transition">
              {money(funnelMetrics.accepted.value)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">Připraveno na realizaci</p>
            {selectedStageFocus === 'ACCEPTED' && (
              <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-700 bg-emerald-200/60 px-1.5 py-0.5 rounded-md">
                Aktivní filtr
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. OVLÁDACÍ PANEL: VYHLEDÁVÁNÍ, PŘEPÍNAČ KARET / KOMPAKT, FILTRY
      ===================================================================== */}
      <div className="flex flex-col gap-3 bg-white p-3.5 rounded-3xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rychlé hledání klienta, kampaně, cíle nebo obchodníka..."
              className="w-full pl-10 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                type="button"
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                title="Vymazat hledání"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Prominent Density Switch (Kompaktní řádky vs Velké karty) */}
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewDensity('COMPACT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
                viewDensity === 'COMPACT'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kompaktní jednořádkový přehled pro vysoký počet nabídek"
            >
              <List className="h-3.5 w-3.5 text-sky-600" />
              <span>Kompaktní řádky</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-sky-50 text-sky-700 font-extrabold rounded-md border border-sky-200/80">
                Úsporné
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewDensity('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition ${
                viewDensity === 'CARDS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Detailní Kanban karty"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
              <span>Detailní karty</span>
            </button>
          </div>

          {/* Active (4) vs All (6) Pipeline Scope */}
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => {
                setStageScope('ACTIVE');
                setSelectedStageFocus(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                stageScope === 'ACTIVE' && !selectedStageFocus
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aktivní (4)
            </button>
            <button
              type="button"
              onClick={() => {
                setStageScope('ALL');
                setSelectedStageFocus(null);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                stageScope === 'ALL' && !selectedStageFocus
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vše (6)
            </button>
          </div>
        </div>

        {/* Quick Filter Chips & Sorter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-bold mr-1">Filtrovat:</span>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Všechny nabídky
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('NAVIGATION')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'NAVIGATION'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/60'
              }`}
            >
              <Compass size={12} />
              <span>Pouze Navigace</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('STANDARD')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'STANDARD'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60'
              }`}
            >
              Běžná média
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('EXPIRING')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'EXPIRING'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
              }`}
            >
              <Clock size={12} />
              <span>Expirující (≤ 5 dní)</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition ml-1"
                title="Obnovit všechny filtry"
              >
                <RotateCcw size={12} />
                <span>Zrušit filtry</span>
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'UPDATED' | 'PRICE_DESC' | 'EXPIRING')}
              aria-label="Řazení nabídek v trychtýři"
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="UPDATED">Nejnovější změny</option>
              <option value="PRICE_DESC">Nejvyšší hodnota Kč</option>
              <option value="EXPIRING">Blížící se termín</option>
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. SLOUPCE FÁZÍ TRYCHTÝŘE (KANBAN S NEZÁVISLÝM SCROLLEM)
      ===================================================================== */}
      <div className="overflow-x-auto pb-3">
        <div
          className={`grid gap-3.5 transition-all ${
            visibleStages.length === 1
              ? 'grid-cols-1 max-w-2xl mx-auto'
              : visibleStages.length === 4
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
                  className="flex flex-col items-center justify-between py-4 px-2 rounded-2xl border border-slate-200 bg-slate-100/70 hover:bg-slate-200/60 transition cursor-pointer select-none group min-h-[420px] w-14"
                  title={`Rozbalit sloupec: ${stage.label}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span aria-hidden="true" className={`size-3 rounded-full ${stage.tone} shadow-2xs`} />
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-black text-slate-700 border border-slate-200">
                      {rows.length}
                    </span>
                  </div>

                  <span className="rotate-90 origin-center whitespace-nowrap text-xs font-black text-slate-600 tracking-wide uppercase group-hover:text-slate-900 transition">
                    {stage.label}
                  </span>

                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition" />
                </div>
              );
            }

            return (
              <section
                key={stage.key}
                className="flex flex-col rounded-3xl border border-slate-200/90 bg-slate-50/70 shadow-2xs overflow-hidden"
              >
                {/* Sticky Header with Stage Info & Total CZK */}
                <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-xs p-3.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span aria-hidden="true" className={`size-3 rounded-full ${stage.tone} shrink-0`} />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 truncate">
                        {stage.label}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-100 px-1.5 text-[11px] font-black text-slate-800 border border-slate-200/80">
                        {rows.length}
                      </span>
                      {visibleStages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleCollapse(stage.key)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                          title="Sbalit sloupec"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate">{stage.description}</span>
                    <span className="font-black text-slate-900 shrink-0 ml-1">
                      {money(total)}
                    </span>
                  </div>
                </header>

                {/* Scrollable Column Body */}
                <div className="flex flex-1 flex-col gap-2 p-2.5 max-h-[580px] overflow-y-auto scrollbar-thin">
                  {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200/80 p-6 text-center text-xs text-slate-400">
                      {hasActiveFilters ? 'Žádné nabídky neodpovídají filtru' : 'Žádné nabídky v této fázi'}
                    </div>
                  ) : (
                    rows.map((offer) => {
                      const validDays = offer.validUntil
                        ? Math.ceil((new Date(`${offer.validUntil}T23:59:59Z`).getTime() - Date.now()) / 86_400_000)
                        : null;
                      const viewCount = offer.events?.filter((event) => event.type === 'VIEWED').length ?? 0;
                      const initials = offer.createdBy?.name
                        ? offer.createdBy.name
                            .split(/\s+/)
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : 'SP';
                      const isUrgent = validDays != null && validDays <= 5 && ['DRAFT', 'SENT', 'VIEWED'].includes(stage.key);

                      // -------------------------------------------------------------
                      // COMPACT ROW VIEW (Optimized for 50+ offers without clutter)
                      // -------------------------------------------------------------
                      if (viewDensity === 'COMPACT') {
                        return (
                          <Link
                            key={offer.id}
                            href={`/offers/${offer.id}`}
                            className={`group block rounded-2xl border p-2.5 transition shadow-2xs ${
                              isUrgent
                                ? 'border-red-200 bg-red-50/50 hover:bg-red-50/90'
                                : 'border-slate-200/90 bg-white hover:border-sky-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-extrabold text-slate-900 group-hover:text-sky-700 transition truncate">
                                {offer.client?.name || 'Neznámý klient'}
                              </span>
                              <span className="text-xs font-black text-slate-950 shrink-0">
                                {money(offer.totalWithTax)}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 gap-1.5">
                              <div className="flex items-center gap-1 min-w-0">
                                {offer.offerType === 'NAVIGATION' ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200 shrink-0">
                                    <Compass size={10} />
                                    Navigace
                                  </span>
                                ) : null}
                                <span className="truncate text-slate-600">
                                  {offer.campaignName || offer.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {viewCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600">
                                    <Eye size={11} />
                                    {viewCount}×
                                  </span>
                                )}
                                {validDays != null && ['DRAFT', 'SENT', 'VIEWED'].includes(stage.key) && (
                                  <span
                                    className={`text-[10px] font-bold ${
                                      validDays <= 5 ? 'text-red-600' : 'text-slate-400'
                                    }`}
                                  >
                                    {validDays} d
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      }

                      // -------------------------------------------------------------
                      // STANDARD CARD VIEW (Full details)
                      // -------------------------------------------------------------
                      return (
                        <Link
                          key={offer.id}
                          href={`/offers/${offer.id}`}
                          className={`group block rounded-2xl border p-3.5 transition shadow-2xs ${
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
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 font-medium">
                            {offer.campaignName || offer.title}
                          </p>

                          {/* Type badge if navigation */}
                          {offer.offerType === 'NAVIGATION' && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60 w-fit">
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
                                <span
                                  className="inline-flex items-center gap-0.5 font-bold text-indigo-600"
                                  title={`Klient nabídku otevřel ${viewCount}×`}
                                >
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
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
