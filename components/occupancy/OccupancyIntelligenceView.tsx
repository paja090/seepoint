'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Search,
  ChevronRight,
  TrendingUp,
  Boxes,
  CalendarRange,
} from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { ProjectSubNav } from '@/components/navigation/ProjectSubNav';
import { OccupancyInsightDetailModal, type InsightItem } from './OccupancyInsightDetailModal';
import { OccupancySettingsModal } from './OccupancySettingsModal';
import { OccupancyAssistantChat } from './OccupancyAssistantChat';
import type { OrganizationOccupancyAIProfileData } from '@/lib/occupancy/intelligence-profile';

const inventoryNavItems = [
  { href: '/projects/city-inventory', label: '📊 Přehled & Nástěnka' },
  { href: '/carriers', label: '🪧 Evidence nosičů' },
  { href: '/occupancy', label: '📅 Obsazenost ploch' },
  { href: '/occupancy/ai', label: '🤖 AI Obsazenost' },
  { href: '/map', label: '🗺️ Mapa nosičů' },
];

interface Props {
  initialInsights: InsightItem[];
  initialProfile: OrganizationOccupancyAIProfileData;
  organizationName: string;
}

const TYPE_LABELS: Record<string, string> = {
  ALL: 'Všechny typy',
  DOUBLE_BOOKING: 'Kritická kolize / Dvojitá rezervace',
  STATUS_MISMATCH: 'Nesoulad stavu plochy a kalendáře',
  EXPIRED_OCCUPANCY: 'Prošlá neukončená obsazenost',
  OFFER_CONFLICT: 'Kolize rezervace s nabídkou',
  EXPIRING_CAMPAIGN: 'Končící kampaň k prodloužení',
  UNDERUTILIZED_MEDIA: 'Ležák / Dlouhodobě neobsazeno',
  CALENDAR_GAP: 'Mezera v kalendáři',
  MISSING_DATA: 'Chybějící data',
};

const SEVERITY_LABELS: Record<string, string> = {
  ALL: 'Všechny závažnosti',
  CRITICAL: 'Kritické (Kolize)',
  HIGH: 'Vysoké (Neshody stavu)',
  MEDIUM: 'Střední (Expirace & Nabídky)',
  LOW: 'Nízké (Ležáky & Okna)',
};

export function OccupancyIntelligenceView({ initialInsights, initialProfile, organizationName }: Props) {
  const [insights, setInsights] = useState<InsightItem[]>(initialInsights);
  const [profile, setProfile] = useState<OrganizationOccupancyAIProfileData>(initialProfile);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'IGNORED' | 'ALL'>('OPEN');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<InsightItem | null>(null);

  // KPI calculations
  const kpiStats = useMemo(() => {
    const openItems = insights.filter((i) => i.status === 'OPEN');
    return {
      totalOpen: openItems.length,
      criticalCount: openItems.filter((i) => i.severity === 'CRITICAL').length,
      mismatchCount: openItems.filter((i) => i.type === 'STATUS_MISMATCH').length,
      expiredCount: openItems.filter((i) => i.type === 'EXPIRED_OCCUPANCY').length,
      expiringCount: openItems.filter((i) => i.type === 'EXPIRING_CAMPAIGN').length,
      underutilizedCount: openItems.filter((i) => i.type === 'UNDERUTILIZED_MEDIA').length,
      gapCount: openItems.filter((i) => i.type === 'CALENDAR_GAP').length,
    };
  }, [insights]);

  // Filtered insights list
  const filteredInsights = useMemo(() => {
    return insights.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = (item.deterministicReason || item.description || '').toLowerCase().includes(q);
        const matchSurface = item.surface?.name.toLowerCase().includes(q);
        const matchCarrier =
          item.carrier?.code.toLowerCase().includes(q) ||
          item.carrier?.name.toLowerCase().includes(q) ||
          item.surface?.carrier?.code.toLowerCase().includes(q) ||
          item.surface?.carrier?.name.toLowerCase().includes(q);
        const matchCity = (item.carrier?.city || item.surface?.carrier?.city || '').toLowerCase().includes(q);
        const matchClient = item.client?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSurface && !matchCarrier && !matchCity && !matchClient) {
          return false;
        }
      }

      return true;
    });
  }, [insights, statusFilter, typeFilter, severityFilter, searchQuery]);

  // Trigger manual audit scan
  const handleRunScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/occupancy/intelligence/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichWithAi: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při auditu obsazenosti.');

      // Refresh insights list & profile
      const [listRes, profRes] = await Promise.all([
        fetch('/api/occupancy/intelligence/insights?status=ALL'),
        fetch('/api/occupancy/intelligence/profile'),
      ]);
      const listData = await listRes.json();
      if (listRes.ok && listData.insights) {
        setInsights(listData.insights);
      }
      const profData = await profRes.json();
      if (profRes.ok && profData.profile) {
        setProfile(profData.profile);
      }

      setScanMessage(
        `Audit dokončen: zkontrolováno ${data.summary?.surfacesCount || 0} ploch. Vytvořeno ${data.summary?.createdCount || 0} nových nálezů, automaticky vyřešeno ${data.summary?.autoResolvedCount || 0}.`,
      );
    } catch (err) {
      setScanMessage(`Chyba: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 1-Click resolve action
  const handleExecuteAction = async (insightId: string, actionType: string) => {
    const res = await fetch('/api/occupancy/intelligence/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightId, actionType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Akci se nepodařilo provést.');

    // Update local state
    setInsights((prev) =>
      prev.map((item) => {
        if (item.id !== insightId) return item;
        return {
          ...item,
          status: data.insight?.status || (actionType === 'IGNORE' ? 'IGNORED' : 'RESOLVED'),
          resolvedAt: new Date().toISOString(),
        };
      }),
    );

    if (selectedInsight?.id === insightId) {
      setSelectedInsight((prev) => (prev ? { ...prev, status: data.insight?.status || 'RESOLVED' } : null));
    }
  };

  return (
    <div className="space-y-6">
      <ProjectSubNav items={inventoryNavItems} />

      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles size={16} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AI Obsazenost & Intelligence
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centrální dohled nad obsazeností ploch pro firmu {organizationName}. Automatická detekce kolizí, neshod stavů a proaktivní obchodní doporučení.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-xl"
          >
            <SlidersHorizontal size={15} className="mr-1.5" />
            Nastavení pravidel
          </Button>

          <Button
            variant="primary"
            onClick={handleRunScan}
            disabled={isScanning}
            className="rounded-xl shadow-xs"
          >
            <RefreshCw size={15} className={`mr-1.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Probíhá audit...' : 'Spustit audit obsazenosti'}
          </Button>

          <Button
            href="/occupancy"
            variant="secondary"
            className="rounded-xl text-slate-700"
          >
            <Calendar size={15} className="mr-1.5" />
            Kalendář
          </Button>
        </div>
      </div>

      {/* Scan alert banner */}
      {scanMessage && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600 shrink-0" />
            <span>{scanMessage}</span>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-950"
          >
            Zavřít
          </button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-semibold uppercase">Kolize termínů</span>
            <AlertTriangle size={17} />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-950">{kpiStats.criticalCount}</div>
          <p className="text-[11px] text-rose-600 mt-0.5">Dvojité rezervace v kalendáři</p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-orange-700">
            <span className="text-xs font-semibold uppercase">Neshody stavu</span>
            <ShieldAlert size={17} />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-950">{kpiStats.mismatchCount}</div>
          <p className="text-[11px] text-orange-600 mt-0.5">Plocha vs. kalendář nesouhlasí</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase">Expirované</span>
            <Clock size={17} />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-950">{kpiStats.expiredCount}</div>
          <p className="text-[11px] text-amber-600 mt-0.5">Skončené neuzavřené kampaně</p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold uppercase">Končí brzy</span>
            <CalendarRange size={17} />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-950">{kpiStats.expiringCount}</div>
          <p className="text-[11px] text-blue-600 mt-0.5">Příležitost k prodloužení</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold uppercase">Ležáky</span>
            <Boxes size={17} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{kpiStats.underutilizedCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">&gt; {profile.underutilizedAfterDays} dní bez kampaně</p>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-semibold uppercase">Okna & Mezery</span>
            <TrendingUp size={17} />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-950">{kpiStats.gapCount}</div>
          <p className="text-[11px] text-purple-600 mt-0.5">Krátká okna mezi kampaněmi</p>
        </div>
      </div>

      {/* Main Grid: Left = Insights List (2/3), Right = AI Assistant Chat (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter and Insights */}
        <div className="lg:col-span-8 space-y-4">
          {/* Status Tabs Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1.5">
              {(['OPEN', 'RESOLVED', 'IGNORED', 'ALL'] as const).map((st) => {
                const count =
                  st === 'ALL'
                    ? insights.length
                    : insights.filter((i) => i.status === st).length;
                const label =
                  st === 'OPEN'
                    ? 'K řešení'
                    : st === 'RESOLVED'
                    ? 'Vyřešeno'
                    : st === 'IGNORED'
                    ? 'Ignorováno'
                    : 'Vše';

                return (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      statusFilter === st
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        statusFilter === st ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-500">
              Zobrazeno <strong>{filteredInsights.length}</strong> z {insights.length} nálezů
            </span>
          </div>

          {/* Filter dropdowns & search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat plochu, nosič, město..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(SEVERITY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Insights Cards List */}
          {filteredInsights.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <EmptyState
                title="Žádné nálezy neodpovídají filtrům"
                description={
                  statusFilter === 'OPEN'
                    ? 'Skvělá práce! Všechny detekované nesrovnalosti v obsazenosti jsou vyřešené nebo ignorované.'
                    : 'Zkuste změnit filtry nebo vyhledávací text.'
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInsights.map((insight) => {
                const isCritical = insight.severity === 'CRITICAL';
                const isHigh = insight.severity === 'HIGH';
                const isMedium = insight.severity === 'MEDIUM';
                const meta = (insight.metadata || {}) as Record<string, unknown>;
                const diffDays =
                  typeof insight.differenceInDays === 'number'
                    ? insight.differenceInDays
                    : typeof meta.differenceInDays === 'number'
                    ? meta.differenceInDays
                    : null;

                return (
                  <div
                    key={insight.id}
                    onClick={() => setSelectedInsight(insight)}
                    className={`group cursor-pointer rounded-2xl border bg-white p-4.5 shadow-xs transition hover:shadow-md ${
                      isCritical
                        ? 'border-rose-200 hover:border-rose-400'
                        : isHigh
                        ? 'border-orange-200 hover:border-orange-400'
                        : isMedium
                        ? 'border-amber-200 hover:border-amber-400'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800'
                                : isHigh
                                ? 'bg-orange-100 text-orange-800'
                                : isMedium
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isCritical && <AlertTriangle size={11} />}
                            {isHigh && <ShieldAlert size={11} />}
                            {isMedium && <Clock size={11} />}
                            {TYPE_LABELS[insight.type] || insight.type}
                          </span>

                          <span className="text-xs font-semibold text-slate-700">
                            {insight.surface?.name || 'Plocha'}
                          </span>

                          {(insight.carrier?.city || insight.surface?.carrier?.city) && (
                            <span className="text-xs text-slate-400 font-medium">
                              • {insight.carrier?.city || insight.surface?.carrier?.city}
                            </span>
                          )}

                          {diffDays !== null && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                              {diffDays} dní
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                          {insight.title}
                        </h3>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {insight.deterministicReason || insight.description}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {new Date(insight.createdAt).toLocaleDateString('cs-CZ')}
                        </span>
                        <ChevronRight
                          size={18}
                          className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition"
                        />
                      </div>
                    </div>

                    {/* AI Recommendation hint */}
                    {(insight.aiRecommendation || insight.actionRecommendation) && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50/60 px-3 py-2 text-xs text-indigo-950 border border-indigo-100">
                        <Sparkles size={13} className="text-indigo-600 shrink-0" />
                        <span className="font-semibold shrink-0">Doporučení:</span>
                        <span className="truncate">{insight.aiRecommendation || insight.actionRecommendation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: AI Assistant Chat */}
        <div className="lg:col-span-4 sticky top-6">
          <OccupancyAssistantChat />
        </div>
      </div>

      {/* Detail Modal */}
      <OccupancyInsightDetailModal
        isOpen={Boolean(selectedInsight)}
        onClose={() => setSelectedInsight(null)}
        insight={selectedInsight}
        onExecuteAction={handleExecuteAction}
      />

      {/* Settings Modal */}
      <OccupancySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={handleRunScan}
      />
    </div>
  );
}
