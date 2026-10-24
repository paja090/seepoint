'use client';

import { useEffect, useState } from 'react';
import { useOpenAiQuickTask } from './AiQuickTaskContext';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Trash2,
  X,
  CheckSquare,
  Square,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  Archive,
  Check,
} from 'lucide-react';

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
  const openAiQuickTask = useOpenAiQuickTask();
  const [tasks, setTasks] = useState<QuickTaskItem[]>(initialTasks);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // Default to PENDING (active tasks only, hiding completed into history)
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'COMPLETED' | 'UNRESOLVED' | 'ALL'>('PENDING');
  const [showInlineHistory, setShowInlineHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; actionTab?: 'COMPLETED' | 'PENDING' } | null>(null);

  // Modal for Unresolved Reason
  const [unresolvedTaskId, setUnresolvedTaskId] = useState<string | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal for Completion Note
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(null);
  const [completionNoteInput, setCompletionNoteInput] = useState('');

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
  const unresolvedTasks = tasks.filter((t) => t.status === 'UNRESOLVED');

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'PENDING' && t.status !== 'PENDING') return false;
    if (statusFilter === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    if (statusFilter === 'UNRESOLVED' && t.status !== 'UNRESOLVED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = t.title.toLowerCase().includes(q);
      const descMatch = t.description?.toLowerCase().includes(q);
      const noteMatch = t.completionNote?.toLowerCase().includes(q);
      const personMatch = `${t.assignedToEmployee?.firstName ?? ''} ${t.assignedToEmployee?.lastName ?? ''}`.toLowerCase().includes(q);
      return titleMatch || descMatch || noteMatch || personMatch;
    }
    return true;
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

      // Show friendly confirmation toast
      if (status === 'COMPLETED') {
        setToastMessage({
          text: `Úkol "${data.task.title}" byl splněn a přesunut do historie.`,
          actionTab: 'COMPLETED',
        });
      } else if (status === 'PENDING') {
        setToastMessage({
          text: `Úkol "${data.task.title}" byl vrácen zpět mezi aktivní úkoly.`,
          actionTab: 'PENDING',
        });
      }

      router.refresh();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Úkol se nepodařilo aktualizovat.');
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

  function formatCompletedDate(iso: string | null) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Bar with AI Trigger & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {openAiQuickTask && (
          <button
            type="button"
            onClick={openAiQuickTask}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-fuchsia-700 transition"
          >
            <Sparkles size={18} /> AI Rychlý Úkolníček
          </button>
        )}

        {/* Quick search input if there are more than 3 tasks */}
        {tasks.length > 3 && (
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrovat úkoly..."
              className="input w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border-slate-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Toast after completion or restoration */}
      {toastMessage && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <div className="flex items-center gap-2">
            {toastMessage.actionTab && statusFilter !== toastMessage.actionTab && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(toastMessage.actionTab!);
                  setToastMessage(null);
                }}
                className="font-bold underline text-emerald-800 hover:text-emerald-950 text-xs"
              >
                {toastMessage.actionTab === 'COMPLETED' ? 'Zobrazit v historii ➔' : 'Přejít k aktivním ➔'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 text-emerald-700 hover:text-emerald-900 rounded-md"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs: Active tasks vs History of completed */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-1.5 bg-slate-100/80 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`rounded-xl px-3.5 py-1.5 transition flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Clock size={14} className={statusFilter === 'PENDING' ? 'text-slate-950' : 'text-amber-600'} />
            <span>K vyřízení ({pendingTasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`rounded-xl px-3.5 py-1.5 transition flex items-center gap-1.5 ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-xs font-black'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <History size={14} className={statusFilter === 'COMPLETED' ? 'text-white' : 'text-emerald-600'} />
            <span>Historie splněných ({completedTasks.length})</span>
          </button>

          {unresolvedTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('UNRESOLVED')}
              className={`rounded-xl px-3.5 py-1.5 transition flex items-center gap-1.5 ${
                statusFilter === 'UNRESOLVED'
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <XCircle size={14} className={statusFilter === 'UNRESOLVED' ? 'text-white' : 'text-rose-600'} />
              <span>Nevyřízeno ({unresolvedTasks.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`rounded-xl px-3.5 py-1.5 transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs font-black'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Vše ({tasks.length})
          </button>
        </div>

        {statusFilter === 'COMPLETED' && (
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Archive size={13} className="text-emerald-600" /> Archiv dokončených úkolů
          </span>
        )}
      </div>

      {/* Task Checklist Items */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
            {statusFilter === 'PENDING' ? (
              <>
                <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-1" />
                <h4 className="text-sm font-bold text-slate-900">Všechny úkoly z úkolníčku jsou hotové! 🎉</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Žádné čekající provozní úkoly na dílně. Splněné úkoly jsou bezpečně uloženy v historii.
                </p>
                {completedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('COMPLETED')}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    <History size={14} /> Zobrazit historii splněných úkolů ({completedTasks.length}) →
                  </button>
                )}
              </>
            ) : statusFilter === 'COMPLETED' ? (
              <>
                <Archive size={32} className="mx-auto text-slate-400 mb-1" />
                <h4 className="text-sm font-bold text-slate-700">V historii zatím nejsou žádné splněné úkoly</h4>
                <p className="text-xs text-slate-400">Po zaškrtnutí úkolu jako splněného se automaticky uloží sem.</p>
              </>
            ) : (
              <div className="text-xs text-slate-500">Žádné úkoly v tomto zobrazení.</div>
            )}
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
                    ? 'bg-emerald-50/40 border-emerald-200'
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
                    title={isCompleted ? 'Vrátit zpět mezi aktivní úkoly' : 'Zaškrtnout jako splněné'}
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
                      {t.assignedToEmployee && (
                        <span className="font-semibold text-slate-700">
                          👤 {t.assignedToEmployee.firstName} {t.assignedToEmployee.lastName}
                        </span>
                      )}
                      {t.dueDate && (
                        <span className="text-slate-400">Termín: {new Date(t.dueDate).toLocaleDateString('cs-CZ')}</span>
                      )}
                      {isCompleted && t.completedAt && (
                        <span className="text-emerald-700 font-medium">
                          Dokončeno: {formatCompletedDate(t.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={() => updateTaskStatus(t.id, 'PENDING')}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                      title="Vrátit úkol zpět mezi aktivní úkoly"
                    >
                      <RotateCcw size={13} className="text-slate-500" />
                      <span>Vrátit mezi aktivní</span>
                    </button>
                  ) : (
                    <>
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
                    </>
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

      {/* Collapsible History Section directly below Active Tasks when in PENDING view */}
      {statusFilter === 'PENDING' && completedTasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowInlineHistory(!showInlineHistory)}
            className="flex items-center justify-between w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition"
          >
            <span className="flex items-center gap-2">
              <History size={15} className="text-emerald-600" />
              <span>Historie splněných úkolů ({completedTasks.length})</span>
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
              {showInlineHistory ? (
                <>
                  Skrýt historii <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Zobrazit historii <ChevronDown size={14} />
                </>
              )}
            </span>
          </button>

          {showInlineHistory && (
            <div className="mt-3 space-y-2 pl-2 border-l-2 border-emerald-200 animate-in fade-in duration-200">
              {completedTasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl bg-white border border-slate-200 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="line-through text-slate-500 font-semibold truncate">{t.title}</span>
                    {t.completedAt && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({formatCompletedDate(t.completedAt)})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => updateTaskStatus(t.id, 'PENDING')}
                    className="ml-2 text-[11px] font-bold text-slate-600 hover:text-emerald-700 shrink-0 flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Vrátit
                  </button>
                </div>
              ))}
              {completedTasks.length > 10 && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('COMPLETED')}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    Zobrazit všech {completedTasks.length} splněných úkolů v plné historii →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL FOR UNRESOLVED REASON (MANDATORY) */}
      {unresolvedTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-black">
                <AlertCircle size={20} />
                <span>Důvod nevyřízení úkolu</span>
              </div>
              <button
                type="button"
                onClick={() => setUnresolvedTaskId(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
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
              <button
                type="button"
                onClick={() => setCompletionTaskId(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
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
