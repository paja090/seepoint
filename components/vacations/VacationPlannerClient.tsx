'use client';

import { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Palmtree,
  Stethoscope,
  Home,
  Coffee,
  Trash2,
  CheckCircle2,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRole } from '@/lib/rbac';

interface EmployeeOption {
  id: string;
  name: string;
  position?: string | null;
}

interface AbsenceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  position?: string | null;
  type: 'VACATION' | 'SICK_LEAVE' | 'PERSONAL_LEAVE' | 'HOME_OFFICE';
  dateFrom: string;
  dateTo: string;
  note?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface VacationPlannerClientProps {
  currentUser: {
    id: string;
    employeeId?: string | null;
    role: AppRole;
  };
  employees: EmployeeOption[];
  initialAbsences: AbsenceItem[];
}

type AbsenceType = AbsenceItem['type'];

const absenceTypeLabels: Record<AbsenceType, { label: string; icon: LucideIcon; color: string; badgeBg: string }> = {
  VACATION: { label: '🌴 Dovolená', icon: Palmtree, color: 'text-emerald-700', badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  SICK_LEAVE: { label: '🤒 Nemoc / Lékař', icon: Stethoscope, color: 'text-rose-700', badgeBg: 'bg-rose-100 text-rose-900 border-rose-300' },
  HOME_OFFICE: { label: '🏠 Home Office', icon: Home, color: 'text-sky-700', badgeBg: 'bg-sky-100 text-sky-900 border-sky-300' },
  PERSONAL_LEAVE: { label: '☕ Náhradní volno', icon: Coffee, color: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-900 border-amber-300' },
};

const absenceStatusLabels: Record<AbsenceItem['status'], { label: string; className: string }> = {
  PENDING: { label: 'Čeká na schválení', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  APPROVED: { label: 'Schváleno', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  REJECTED: { label: 'Zamítnuto', className: 'bg-rose-100 text-rose-900 border-rose-300' },
};

export function VacationPlannerClient({ currentUser, employees, initialAbsences }: VacationPlannerClientProps) {
  const [absences, setAbsences] = useState<AbsenceItem[]>(initialAbsences);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    currentUser.employeeId || (canManage ? employees[0]?.id : '') || ''
  );
  const [absenceType, setAbsenceType] = useState<'VACATION' | 'SICK_LEAVE' | 'HOME_OFFICE' | 'PERSONAL_LEAVE'>('VACATION');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Currently absent today
  const absentToday = absences.filter((a) => {
    if (a.status !== 'APPROVED') return false;
    const from = a.dateFrom.split('T')[0];
    const to = a.dateTo.split('T')[0];
    return todayStr >= from && todayStr <= to;
  });

  async function handleAddAbsence(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployeeId || !dateFrom || !dateTo || loading) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          type: absenceType,
          dateFrom,
          dateTo,
          note,
        }),
      });

      const response = await res.json() as Partial<AbsenceItem> & { error?: string };
      if (res.ok) {
        const newAbsence = response as AbsenceItem;
        const emp = employees.find((e) => e.id === selectedEmployeeId);

        setAbsences((prev) => [
          ...prev,
          {
            id: newAbsence.id,
            employeeId: newAbsence.employeeId,
            employeeName: emp ? emp.name : 'Zaměstnanec',
            position: emp?.position || null,
            type: newAbsence.type,
            dateFrom: newAbsence.dateFrom,
            dateTo: newAbsence.dateTo,
            note: newAbsence.note,
            status: newAbsence.status,
          },
        ]);

        setShowAddModal(false);
        setNote('');
      } else {
        setError(response.error || 'Nepodařilo se uložit absenci.');
      }
    } catch {
      setError('Chyba při ukládání.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAbsence(id: string) {
    if (!confirm('Opravdu chcete zrušit tuto absenci?')) return;

    try {
      setError(null);
      const res = await fetch(`/api/absences?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAbsences((prev) => prev.filter((a) => a.id !== id));
      } else {
        const response = await res.json() as { error?: string };
        setError(response.error || 'Chyba při mazání.');
      }
    } catch {
      setError('Chyba spojení.');
    }
  }

  async function handleReviewAbsence(id: string, status: 'APPROVED' | 'REJECTED') {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/absences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const response = await res.json() as { error?: string; status?: AbsenceItem['status'] };
      if (!res.ok || !response.status) throw new Error(response.error || 'Rozhodnutí se nepodařilo uložit.');
      setAbsences((previous) => previous.map((absence) => (
        absence.id === id ? { ...absence, status: response.status as AbsenceItem['status'] } : absence
      )));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Rozhodnutí se nepodařilo uložit.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 🚀 Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
              <Sparkles size={14} />
              <span>SeePOINT Plánovač Volna & Dovolené</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white">
              Dovolená & Přítomnost Týmu 🌴
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Plánujte volno, dovolené, neschopenky a home office s přehledným kalendářem dostupnosti pracovníků.
            </p>
          </div>

          {/* Quick Action Button */}
          <button
            onClick={() => { setError(null); setShowAddModal(true); }}
            disabled={!selectedEmployeeId}
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition min-w-[200px] justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            <span>{canManage ? 'Naplánovat Volno / Dovolenou' : 'Požádat o Volno / Dovolenou'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" role="alert">
          {error}
        </div>
      )}

      {/* 📊 Absent Today Alert Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <Palmtree size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Dnes Nepřítomní v Práci</h2>
              <p className="text-xs text-slate-500">Pracovníci na dovolené, neschopence nebo home office</p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {absentToday.length} nepřítomných dnes
          </span>
        </div>

        {absentToday.length === 0 ? (
          <div className="py-6 text-center text-slate-500">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-1" />
            <p className="text-sm font-bold text-slate-800">Všichni pracovníci jsou dnes v práci!</p>
            <p className="text-xs text-slate-400">Žádné hlášené dovolené nebo neschopenky pro dnešní den.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {absentToday.map((item) => {
              const config = absenceTypeLabels[item.type] || absenceTypeLabels.VACATION;
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{item.employeeName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.position || 'Pracovník'}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      Do: <b>{new Date(item.dateTo).toLocaleDateString('cs-CZ')}</b>
                    </p>
                  </div>
                  <span className={`rounded-xl px-2.5 py-1 text-xs font-black border ${config.badgeBg}`}>
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 📅 Timeline of All Planned Absences */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <CalendarIcon size={20} className="text-indigo-600" />
              <span>Plán Naplánovaných Absencí & Dovolených</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Schválené absence týmu a vaše vlastní žádosti; vedoucí zde vyřizují čekající žádosti
            </p>
          </div>
        </div>

        {absences.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CalendarIcon className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Zatím nebyly vloženy žádné dovolené.</p>
            <p className="text-xs text-slate-400 mt-0.5">Vložte první žádost o volno tlačítkem nahoře.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 font-bold bg-slate-50 rounded-xl">
                <tr>
                  <th className="py-3 px-4">Pracovník</th>
                  <th className="py-3 px-4">Typ Volna</th>
                  <th className="py-3 px-4">Termín Od – Do</th>
                  <th className="py-3 px-4">Stav</th>
                  <th className="py-3 px-4">Poznámka</th>
                  <th className="py-3 px-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {absences.map((item) => {
                  const config = absenceTypeLabels[item.type] || absenceTypeLabels.VACATION;
                  const statusConfig = absenceStatusLabels[item.status];
                  const canDelete = canManage || (currentUser.employeeId === item.employeeId && item.status === 'PENDING');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.employeeName}
                        <span className="block text-xs text-slate-400 font-normal">{item.position || 'Pracovník'}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block rounded-xl px-2.5 py-1 text-xs font-bold border ${config.badgeBg}`}>
                          {config.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-semibold">
                        {new Date(item.dateFrom).toLocaleDateString('cs-CZ')} – {new Date(item.dateTo).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block rounded-xl border px-2.5 py-1 text-xs font-bold ${statusConfig.className}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs italic">
                        {item.note || 'Bez poznámky'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && item.status === 'PENDING' && (
                            <>
                              <button
                                disabled={loading}
                                onClick={() => handleReviewAbsence(item.id, 'APPROVED')}
                                className="rounded-xl p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                title="Schválit žádost"
                                aria-label={`Schválit žádost ${item.employeeName}`}
                              >
                                <CheckCircle2 size={17} />
                              </button>
                              <button
                                disabled={loading}
                                onClick={() => handleReviewAbsence(item.id, 'REJECTED')}
                                className="rounded-xl p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                title="Zamítnout žádost"
                                aria-label={`Zamítnout žádost ${item.employeeName}`}
                              >
                                <XCircle size={17} />
                              </button>
                            </>
                          )}
                          {canDelete && (
                          <button
                            onClick={() => handleDeleteAbsence(item.id)}
                            className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Zrušit volno"
                            aria-label={`Odstranit absenci ${item.employeeName}`}
                          >
                            <Trash2 size={16} />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ➕ Add Absence Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Palmtree className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-950">Naplánovat Volno / Dovolenou</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Zavřít formulář"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAbsence} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vyberte Pracovníka</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                  disabled={!canManage}
                  required
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.position ? `(${e.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Typ Volna</label>
                <select
                  value={absenceType}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'VACATION' || value === 'SICK_LEAVE' || value === 'HOME_OFFICE' || value === 'PERSONAL_LEAVE') setAbsenceType(value);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                >
                  <option value="VACATION">🌴 Dovolená</option>
                  <option value="SICK_LEAVE">🤒 Nemoc / Lékař</option>
                  <option value="HOME_OFFICE">🏠 Home Office</option>
                  <option value="PERSONAL_LEAVE">☕ Náhradní volno</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Datum Od*</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Datum Do*</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Poznámka (volitelné)</label>
                <input
                  type="text"
                  placeholder="Např. Rodinná dovolená..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900"
                  maxLength={500}
                />
                <p className="mt-1 text-[11px] text-slate-500">Nevkládejte diagnózu ani jiné zbytečné zdravotní údaje.</p>
              </div>

              {!canManage && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  Žádost se uloží jako čekající a musí ji schválit administrátor nebo manažer.
                </p>
              )}

              {error && <p className="text-xs font-semibold text-rose-700" role="alert">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Zrušit
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 shadow-md transition disabled:opacity-50"
                >
                  {canManage ? 'Uložit schválené volno' : 'Odeslat žádost'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
