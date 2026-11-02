'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  List,
  Printer,
  ChevronRight,
  ArrowLeft,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Wrench,
  Layers,
  Camera,
} from 'lucide-react';

export type PlanningPointItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  clientName: string;
  targetName: string;
  targetAddress?: string | null;
  label: string;
  navigationType: string;
  latitude: number;
  longitude: number;
  carrierCode?: string | null;
  surfaceName?: string | null;
  status: string;
  plannedInstallationAt?: string | null;
  installerUserId?: string | null;
  installerName?: string | null;
  routeOrder?: number;
  installedPhotoId?: string | null;
  installedPhotoUrl?: string | null;
  hasPhoto?: boolean;
  orderStatus?: string;
  orderTotalPoints?: number;
  orderPhotosCount?: number;
  isOrderComplete?: boolean;
};

export type InstallerOption = {
  id: string;
  name: string;
  email: string;
};

export type PlanningStatusFilter = 'active' | 'unplanned' | 'planned' | 'completed' | 'all';

export function InstallationPlanningView({
  initialPoints,
  installers,
  initialFilter = 'active',
}: {
  initialPoints: PlanningPointItem[];
  installers: InstallerOption[];
  initialFilter?: string;
}) {
  const [points, setPoints] = useState<PlanningPointItem[]>(initialPoints);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedInstallerFilter, setSelectedInstallerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlanningStatusFilter>(
    (initialFilter as PlanningStatusFilter) || 'active'
  );
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'map'>('list');

  // Bulk Edit Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedInstallerId, setAssignedInstallerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Summary statistics across all points (hotová zakázka je až po nahrání fotky!)
  const stats = useMemo(() => {
    // Points needing installation: hasPhoto is false AND isOrderComplete is false
    const activePoints = points.filter((p) => !p.hasPhoto && !p.isOrderComplete);
    const unplannedPoints = activePoints.filter((p) => !p.plannedInstallationAt);
    const plannedPoints = activePoints.filter((p) => Boolean(p.plannedInstallationAt));
    const completedPoints = points.filter((p) => p.hasPhoto || p.isOrderComplete);

    return {
      activeCount: activePoints.length,
      unplannedCount: unplannedPoints.length,
      plannedCount: plannedPoints.length,
      completedCount: completedPoints.length,
      totalCount: points.length,
    };
  }, [points]);

  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      // 1. Status Filter (Default 'active': zobrazí POUZE zakázky/body čekající na montáž bez fotodokumentace)
      if (statusFilter === 'active') {
        if (p.hasPhoto || p.isOrderComplete) return false;
      } else if (statusFilter === 'unplanned') {
        if (p.hasPhoto || p.isOrderComplete || p.plannedInstallationAt) return false;
      } else if (statusFilter === 'planned') {
        if (p.hasPhoto || p.isOrderComplete || !p.plannedInstallationAt) return false;
      } else if (statusFilter === 'completed') {
        if (!p.hasPhoto && !p.isOrderComplete) return false;
      }

      // 2. Query filter
      const matchesQuery =
        !query ||
        p.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
        p.clientName.toLowerCase().includes(query.toLowerCase()) ||
        p.targetName.toLowerCase().includes(query.toLowerCase()) ||
        p.label.toLowerCase().includes(query.toLowerCase());

      // 3. Installer filter
      const matchesInstaller =
        !selectedInstallerFilter || p.installerUserId === selectedInstallerFilter;

      return matchesQuery && matchesInstaller;
    });
  }, [points, statusFilter, query, selectedInstallerFilter]);

  const toggleSelectAll = () => {
    const selectable = filteredPoints.filter((p) => statusFilter === 'completed' || !p.hasPhoto);
    if (selectedIds.length === selectable.length && selectable.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable.map((p) => p.id));
    }
  };

  const toggleSelectPoint = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectWholeOrder = (orderId: string) => {
    // Pouze body dané zakázky, které ještě NEJSOU hotové (nemají nahranou fotku)
    const pendingOrderPoints = points.filter((p) => p.orderId === orderId && !p.hasPhoto);
    if (pendingOrderPoints.length === 0) {
      setMsg('ℹ️ Všechny body této zakázky již mají nahranou fotodokumentaci a jsou hotové.');
      return;
    }
    setSelectedIds(pendingOrderPoints.map((p) => p.id));
    setShowBulkModal(true);
  };

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setSubmitting(true);
    setMsg('');

    try {
      const res = await fetch('/api/navigation/installations/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointIds: selectedIds,
          installerUserId: assignedInstallerId || null,
          plannedInstallationAt: plannedDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se uložit montážní plán.');
      }

      const assignedInstallerName = installers.find((i) => i.id === assignedInstallerId)?.name || null;

      setPoints((prev) =>
        prev.map((p) =>
          selectedIds.includes(p.id)
            ? {
                ...p,
                plannedInstallationAt: plannedDate,
                installerUserId: assignedInstallerId || null,
                installerName: assignedInstallerName,
                status: 'PRIPRAVENO_K_INSTALACI',
              }
            : p
        )
      );

      setShowBulkModal(false);
      setSelectedIds([]);
      setMsg(`Úspěšně naplánována montáž pro ${data.updatedCount} bodů na datum ${plannedDate}.`);
    } catch (err: unknown) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : 'Chyba při ukládání.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header controls & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/navigation" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Plánování montáží v terénu</h1>
            <p className="text-xs text-slate-500">Přiřazujte termíny, montážní pracovníky a určujte pořadí trasy pro terénní týmy. Hotové zakázky mají nahrané fotky.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <CalendarIcon size={15} /> Naplánovat vybrané ({selectedIds.length})
            </button>
          )}

          <Link
            href="/work/dispatch"
            className="btn border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
            title="Otevřít denní trasy a dispečink výjezdů (mapa a rozvrh tras)"
          >
            <Truck size={15} className="text-sky-600" />
            <span>Denní trasy a výjezdy (Dispečink) ↗</span>
          </Link>

          <button
            onClick={handlePrintSheet}
            className="btn border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={15} /> Vytisknout montážní list
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer ${
                viewMode === 'list' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
              }`}
            >
              <List size={14} /> Seznam
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer ${
                viewMode === 'calendar' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
              }`}
            >
              <CalendarIcon size={14} /> Kalendář
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-sky-800">
            <span>K montáži (Chybí fotky)</span>
            <Wrench size={16} className="text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-950 mt-1.5">
            {stats.activeCount} <span className="text-xs font-semibold text-sky-700">bodů</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Čeká na montáž a fotodokumentaci</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('unplanned')}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            statusFilter === 'unplanned'
              ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>Nenaplánováno</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-1.5">
            {stats.unplannedCount} <span className="text-xs font-semibold text-amber-700">bodů</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Chybí termín nebo montér</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('planned')}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            statusFilter === 'planned'
              ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-indigo-800">
            <span>Naplánováno v terénu</span>
            <Truck size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-950 mt-1.5">
            {stats.plannedCount} <span className="text-xs font-semibold text-indigo-700">bodů</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Přiřazeno, čeká se na foto z místa</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            statusFilter === 'completed'
              ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-xs'
              : 'border-slate-200 bg-white hover:bg-slate-50 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Hotovo (Fotodokumentace)</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1.5">
            {stats.completedCount} <span className="text-xs font-semibold text-emerald-700">bodů</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Namontováno, fotky nahrány</div>
        </button>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        {/* Workflow Tabs */}
        <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'active'
                ? 'border-sky-600 text-sky-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench size={14} className={statusFilter === 'active' ? 'text-sky-600' : 'text-slate-400'} />
            <span>K montáži (Chybí fotky)</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === 'active' ? 'bg-sky-100 text-sky-800 font-black' : 'bg-slate-100 text-slate-600'
            }`}>
              {stats.activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('unplanned')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'unplanned'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock size={14} className={statusFilter === 'unplanned' ? 'text-amber-600' : 'text-slate-400'} />
            <span>Nenaplánované</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === 'unplanned' ? 'bg-amber-100 text-amber-800 font-black' : 'bg-slate-100 text-slate-600'
            }`}>
              {stats.unplannedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('planned')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'planned'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck size={14} className={statusFilter === 'planned' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>V terénu (Naplánované)</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === 'planned' ? 'bg-indigo-100 text-indigo-800 font-black' : 'bg-slate-100 text-slate-600'
            }`}>
              {stats.plannedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'border-emerald-600 text-emerald-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 size={14} className={statusFilter === 'completed' ? 'text-emerald-600' : 'text-slate-400'} />
            <span>Hotové (S fotodokumentací)</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              statusFilter === 'completed' ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-slate-100 text-slate-600'
            }`}>
              {stats.completedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'border-slate-800 text-slate-900 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} className={statusFilter === 'all' ? 'text-slate-800' : 'text-slate-400'} />
            <span>Všechny zakázky</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {stats.totalCount}
            </span>
          </button>
        </div>

        {/* Search & Montér selection */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Hledat zakázku, klienta, cíl nebo bod..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-1.5 text-xs font-medium focus:border-sky-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedInstallerFilter}
              onChange={(e) => setSelectedInstallerFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              <option value="">Všichni montéři</option>
              {installers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
            <span>Zobrazeno {filteredPoints.length} bodů</span>
            {statusFilter === 'active' && (
              <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                Výchozí: Pouze čekající na fotodokumentaci
              </span>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          ✅ {msg}
        </div>
      )}

      {/* View: List */}
      {viewMode === 'list' && (
        <div className="card !p-0 overflow-hidden">
          {filteredPoints.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {statusFilter === 'active'
                  ? 'Žádné zakázky nečekají na montáž!'
                  : statusFilter === 'unplanned'
                  ? 'Všechny aktivní body mají naplánovaný termín!'
                  : statusFilter === 'planned'
                  ? 'Žádné body nejsou v terénu k montáži.'
                  : 'Nebyly nalezeny žádné odpovídající body.'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {statusFilter === 'active'
                  ? 'Všechny navigační zakázky mají buď nahranou fotodokumentaci, nebo neodpovídají zadanému filtru.'
                  : 'Upravte vyhledávací dotaz nebo přepněte filtr zakázek výše.'}
              </p>
              {statusFilter === 'active' && stats.completedCount > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('completed')}
                    className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Zobrazit hotové zakázky s fotkami ({stats.completedCount} bodů)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length ===
                          filteredPoints.filter((p) => statusFilter === 'completed' || !p.hasPhoto).length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="p-3.5">Zakázka & Klient</th>
                  <th className="p-3.5">Cílová provozovna</th>
                  <th className="p-3.5">Označení navigačního bodu</th>
                  <th className="p-3.5">Fyzický nosič</th>
                  <th className="p-3.5">Plánovaný termín</th>
                  <th className="p-3.5">Přiřazený montér</th>
                  <th className="p-3.5">Fotodokumentace</th>
                  <th className="p-3.5 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPoints.map((p) => {
                  const isSelected = selectedIds.includes(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 transition-all ${
                        isSelected ? 'bg-sky-50/50' : p.hasPhoto ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPoint(p.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-sky-800">{p.orderNumber}</span>
                          {p.isOrderComplete ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                              ✅ Zakázka hotová ({p.orderPhotosCount}/{p.orderTotalPoints} fotek)
                            </span>
                          ) : (p.orderPhotosCount ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                              📷 {p.orderPhotosCount}/{p.orderTotalPoints} fotek
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              ⏳ 0/{p.orderTotalPoints} fotek
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-800">{p.clientName}</div>
                      </td>
                      <td className="p-3.5">
                        <b className="text-slate-900">{p.targetName}</b>
                        {p.targetAddress && <div className="text-[11px] text-slate-500">{p.targetAddress}</div>}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{p.label}</div>
                        <div className="mt-0.5">
                          {p.hasPhoto ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              ✅ Fotka po montáži nahrána
                            </span>
                          ) : p.plannedInstallationAt ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                              🛠️ Naplánováno na výjezd
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              ⏳ Čeká na naplánování
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {p.carrierCode ? (
                          <span className="inline-flex items-center text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                            {p.carrierCode} {p.surfaceName ? `(${p.surfaceName})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="p-3.5 font-semibold">
                        {p.plannedInstallationAt ? (
                          <span className="text-slate-900 font-bold">
                            {new Date(p.plannedInstallationAt).toLocaleDateString('cs-CZ')}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                            Nenaplánováno
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800">
                        {p.installerName || <span className="text-slate-400">Nepřiřazen</span>}
                      </td>
                      <td className="p-3.5">
                        {p.hasPhoto ? (
                          p.installedPhotoUrl ? (
                            <a
                              href={p.installedPhotoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg transition"
                              title="Otevřít fotografii po montáži v plném rozlišení"
                            >
                              <Camera size={13} /> Foto z montáže ↗
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                              <CheckCircle2 size={13} /> Foto nahráno
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <Clock size={12} /> Chybí foto
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                        {p.hasPhoto ? (
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg select-none">
                            Hotovo
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSelectWholeOrder(p.orderId)}
                              className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                              title="Vybrat zbývající nenamontované body této zakázky"
                            >
                              ⚡ Celá zakázka
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIds([p.id]);
                                setShowBulkModal(true);
                              }}
                              className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              Naplánovat bod <ChevronRight size={12} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* View: Calendar */}
      {viewMode === 'calendar' && (
        <div className="card space-y-4">
          <h3 className="text-base font-bold text-slate-900">Kalendářní přehled naplánovaných výjezdů</h3>
          <p className="text-xs text-slate-500">Zobrazení bodů seskupených podle naplánovaných dní montáže.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredPoints
              .filter((p) => p.plannedInstallationAt)
              .map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-sky-800">{p.orderNumber}</span>
                    <span className="font-bold text-slate-900">{new Date(p.plannedInstallationAt!).toLocaleDateString('cs-CZ')}</span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{p.label}</p>
                  <p className="text-xs text-slate-600">{p.clientName} | {p.targetName}</p>
                  <p className="text-xs font-semibold text-slate-700">Montér: {p.installerName || 'Nepřiřazen'}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Bulk Planning Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSavePlan} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Naplánovat montáž pro {selectedIds.length} bodů
            </h3>
            <p className="text-xs text-slate-500">
              Zadejte datum výjezdu v terénu a přiřaďte odpovědného montéra nebo montážní tým.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Datum montáže</label>
              <input
                type="date"
                required
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Přiřazený montážní pracovník</label>
              <select
                value={assignedInstallerId}
                onChange={(e) => setAssignedInstallerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold"
              >
                <option value="">Vyberte pracovníka...</option>
                {installers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {submitting ? 'Ukládám...' : 'Uložit plán montáží'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
