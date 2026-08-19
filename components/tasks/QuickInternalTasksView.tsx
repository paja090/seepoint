'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, User, AlertCircle, Sparkles, MessageSquare, Trash2, X, CheckSquare, Square } from 'lucide-react';

export type QuickTaskItem = {
  id: string;
  title: string;
  description: string | null;
  assignedToEmployeeId: string;
  createdByUserId: string;
  dueDate: string | null;
  priority: string;
  status: 'PENDING' | 'COMPLETED' | 'UNRESOLVED';
  unresolvedReason: string | null;
  completedAt: string | null;
  completionNote: string | null;
  createdAt: string;
  assignedToEmployee?: { id: string; firstName: string; lastName: string; position: string | null };
  createdByUser?: { id: string; name: string | null; email: string };
};

export function QuickInternalTasksView({
  tasks: initialTasks,
  currentUserId,
  userRole,
}: {
  tasks: QuickTaskItem[];
  currentUserId?: string;
  userRole?: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<QuickTaskItem[]>(initialTasks);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'UNRESOLVED'>('ALL');

  // Modal for Unresolved Reason
  const [unresolvedTaskId, setUnresolvedTaskId] = useState<string | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal for Completion Note
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(null);
  const [completionNoteInput, setCompletionNoteInput] = useState('');

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  async function updateTaskStatus(
    id: string,
    status: 'COMPLETED' | 'UNRESOLVED' | 'PENDING',
    extraData?: { unresolvedReason?: string; completionNote?: string }
  ) {
    setBusy(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/quick-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extraData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Změna stavu selhala.');

      // Update local state
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
      setUnresolvedTaskId(null);
      setReasonInput('');
      setCompletionTaskId(null);
      setCompletionNoteInput('');
      router.refresh();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm('Opravdu chcete smazat tento rychlý úkol?')) return;
    try {
      const res = await fetch(`/api/quick-tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        router.refresh();
      }
    } catch (e) {}
  }

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === 'ALL' ? 'bg-slate-900 text-white font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Všechny položky ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === 'PENDING' ? 'bg-amber-500 text-white font-black' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            K vyřízení ({tasks.filter((t) => t.status === 'PENDING').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === 'COMPLETED' ? 'bg-emerald-600 text-white font-black' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Splněno ({tasks.filter((t) => t.status === 'COMPLETED').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UNRESOLVED')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === 'UNRESOLVED' ? 'bg-rose-600 text-white font-black' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Nevyřízeno ({tasks.filter((t) => t.status === 'UNRESOLVED').length})
          </button>
        </div>
      </div>

      {/* Task Checklist Items */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 text-xs">
            Žádné úkoly v tomto seznamu.
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isPending = t.status === 'PENDING';
            const isCompleted = t.status === 'COMPLETED';
            const isUnresolved = t.status === 'UNRESOLVED';

            return (
              <div
                key={t.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border p-3.5 shadow-2xs transition gap-3 ${
                  isCompleted
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : isUnresolved
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Checkbox & Task details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCompleted) {
                        updateTaskStatus(t.id, 'PENDING');
                      } else {
                        setCompletionTaskId(t.id);
                        setCompletionNoteInput('');
                      }
                    }}
                    title={isCompleted ? 'Označit jako nedokončené' : 'Zaškrtnout jako splněné'}
                    className={`mt-0.5 shrink-0 rounded-lg transition p-0.5 ${
                      isCompleted
                        ? 'text-emerald-600 hover:text-emerald-700'
                        : isUnresolved
                        ? 'text-rose-500 hover:text-rose-600'
                        : 'text-slate-400 hover:text-emerald-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckSquare size={22} className="fill-emerald-100" />
                    ) : isUnresolved ? (
                      <XCircle size={22} />
                    ) : (
                      <Square size={22} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`font-bold text-sm leading-snug ${
                          isCompleted ? 'line-through text-slate-500 font-semibold' : 'text-slate-900'
                        }`}
                      >
                        {t.title}
                      </h4>

                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isUnresolved
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isCompleted ? '✓ Splněno' : isUnresolved ? '✕ Nevyřízeno' : '⏳ K vyřízení'}
                      </span>
                    </div>

                    {t.description && <p className="text-xs text-slate-500">{t.description}</p>}

                    {/* Reason if unresolved */}
                    {isUnresolved && t.unresolvedReason && (
                      <div className="mt-1.5 rounded-xl bg-rose-100/80 border border-rose-200 p-2 text-xs text-rose-900">
                        <b className="text-[10px] uppercase tracking-wider text-rose-700 block font-bold">
                          Důvod nevyřízení pro vedoucího:
                        </b>
                        <p className="font-semibold text-rose-950 mt-0.5">{t.unresolvedReason}</p>
                      </div>
                    )}

                    {/* Completion note */}
                    {isCompleted && t.completionNote && (
                      <div className="mt-1.5 rounded-xl bg-emerald-100/80 border border-emerald-200 p-2 text-xs text-emerald-900">
                        <b className="text-[10px] uppercase tracking-wider text-emerald-700 block font-bold">
                          Poznámka ke splnění:
                        </b>
                        <p className="font-semibold text-emerald-950 mt-0.5">{t.completionNote}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span className="font-semibold text-slate-700">
                        👤 {t.assignedToEmployee?.firstName} {t.assignedToEmployee?.lastName}
                      </span>
                      {t.dueDate && (
                        <span className="text-slate-400">Termín: {new Date(t.dueDate).toLocaleDateString('cs-CZ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompletionTaskId(t.id);
                        setCompletionNoteInput('');
                      }}
                      className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                    >
                      Splněno
                    </button>
                  )}

                  {!isUnresolved && (
                    <button
                      type="button"
                      onClick={() => {
                        setUnresolvedTaskId(t.id);
                        setReasonInput('');
                      }}
                      className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition"
                    >
                      Nevyřízeno
                    </button>
                  )}

                  {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Smazat položku"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL FOR UNRESOLVED REASON (MANDATORY) */}
      {unresolvedTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-black">
                <AlertCircle size={20} />
                <span>Důvod nevyřízení úkolu</span>
              </div>
              <button onClick={() => setUnresolvedTaskId(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-800 border border-rose-200">
                ⚠️ {modalError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateTaskStatus(unresolvedTaskId, 'UNRESOLVED', { unresolvedReason: reasonInput });
              }}
              className="space-y-3"
            >
              <div>
                <label className="font-bold text-xs text-slate-800 block mb-1">
                  Uveďte povinný důvod pro vedoucího (Proč úkol nebylo možné vyřídit?): *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="např. Hornbach měl vyprodáno / Na dílně chybělo nářadí..."
                  className="input w-full p-2.5 text-xs border-slate-300 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnresolvedTaskId(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={busy || !reasonInput.trim()}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
                >
                  {busy ? 'Ukládám...' : 'Odeslat důvod'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FOR COMPLETION NOTE (OPTIONAL) */}
      {completionTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-emerald-700 font-black">
                <CheckCircle2 size={20} />
                <span>Označit úkol jako Splněno</span>
              </div>
              <button onClick={() => setCompletionTaskId(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateTaskStatus(completionTaskId, 'COMPLETED', { completionNote: completionNoteInput });
              }}
              className="space-y-3"
            >
              <div>
                <label className="font-bold text-xs text-slate-800 block mb-1">
                  Volitelná poznámka ke splnění úkolu:
                </label>
                <textarea
                  rows={2}
                  value={completionNoteInput}
                  onChange={(e) => setCompletionNoteInput(e.target.value)}
                  placeholder="např. Zameteno vč. prostoru za vraty..."
                  className="input w-full p-2.5 text-xs border-slate-300 rounded-xl resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompletionTaskId(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? 'Ukládám...' : 'Potvrdit splnění'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
