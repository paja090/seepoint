'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  List,
  LayoutGrid,
  Printer,
  ChevronRight,
  ArrowLeft,
  Search,
  Filter,
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
};

export type InstallerOption = {
  id: string;
  name: string;
  email: string;
};

export function InstallationPlanningView({
  initialPoints,
  installers,
}: {
  initialPoints: PlanningPointItem[];
  installers: InstallerOption[];
}) {
  const [points, setPoints] = useState<PlanningPointItem[]>(initialPoints);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [selectedInstallerFilter, setSelectedInstallerFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'map'>('list');

  // Bulk Edit Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedInstallerId, setAssignedInstallerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const filteredPoints = points.filter((p) => {
    const matchesQuery =
      !query ||
      p.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
      p.clientName.toLowerCase().includes(query.toLowerCase()) ||
      p.targetName.toLowerCase().includes(query.toLowerCase()) ||
      p.label.toLowerCase().includes(query.toLowerCase());

    const matchesInstaller =
      !selectedInstallerFilter || p.installerUserId === selectedInstallerFilter;

    return matchesQuery && matchesInstaller;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPoints.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPoints.map((p) => p.id));
    }
  };

  const toggleSelectPoint = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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
            <p className="text-xs text-slate-500">Přiřazujte termíny, montážní pracovníky a určujte pořadí trasy pro terénní týmy.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <CalendarIcon size={15} /> Naplánovat vybrané ({selectedIds.length})
            </button>
          )}

          <button
            onClick={handlePrintSheet}
            className="btn border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5"
          >
            <Printer size={15} /> Vytisknout montážní list
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 ${
                viewMode === 'list' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
              }`}
            >
              <List size={14} /> Seznam
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`rounded-lg p-1.5 text-xs font-bold flex items-center gap-1 ${
                viewMode === 'calendar' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
              }`}
            >
              <CalendarIcon size={14} /> Kalendář
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
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

        <span className="text-xs font-semibold text-slate-500">
          Zobrazeno {filteredPoints.length} bodů
        </span>
      </div>

      {msg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          ✅ {msg}
        </div>
      )}

      {/* View: List */}
      {viewMode === 'list' && (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredPoints.length}
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
                <th className="p-3.5 text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPoints.map((p) => {
                const isSelected = selectedIds.includes(p.id);

                return (
                  <tr key={p.id} className={`hover:bg-slate-50/70 transition-all ${isSelected ? 'bg-sky-50/50' : ''}`}>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectPoint(p.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="p-3.5">
                      <span className="font-black text-sky-800">{p.orderNumber}</span>
                      <div className="font-semibold text-slate-800">{p.clientName}</div>
                    </td>
                    <td className="p-3.5">
                      <b className="text-slate-900">{p.targetName}</b>
                      {p.targetAddress && <div className="text-[11px] text-slate-500">{p.targetAddress}</div>}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{p.label}</td>
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
                        <span className="text-slate-900">
                          {new Date(p.plannedInstallationAt).toLocaleDateString('cs-CZ')}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">
                          Nenaplánováno
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {p.installerName || <span className="text-slate-400">Nepřiřazen</span>}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setSelectedIds([p.id]);
                          setShowBulkModal(true);
                        }}
                        className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        Naplánovat <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
