'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Calendar,
  MapPin,
  Folder,
  CheckCircle2,
  Play,
  Clock,
  UserCheck,
  AlertTriangle,
  Camera,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  History,
  ShieldCheck,
} from 'lucide-react';
import { WorkOrderAcknowledgeButton } from './WorkOrderAcknowledgeButton';

export type MyTaskItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  workType: string;
  scheduledAt: string;
  deadlineAt?: string | null;
  clientName: string;
  contactName?: string | null;
  contactPhone?: string | null;
  locationNote?: string | null;
  mediaLabel?: string | null;
  quantity?: number | null;
  price?: string | null;
  requestedBy?: string | null;
  ftdUrl?: string | null;
  referenceUrl?: string | null;
  assignments: Array<{
    id: string;
    workerName: string;
    acknowledgedAt?: string | null;
  }>;
  carrier?: {
    id: string;
    code: string;
    name: string;
    city?: string | null;
  } | null;
};

export function MyTasksView({
  tasks,
  currentUserId,
  currentUserName,
}: {
  tasks: MyTaskItem[];
  currentUserId: string;
  currentUserName: string;
}) {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING_ACK' | 'IN_PROGRESS' | 'DONE'>('ALL');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [showDoneModal, setShowDoneModal] = useState<MyTaskItem | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === 'PENDING_ACK') {
      return t.assignments.some((a) => !a.acknowledgedAt) && t.status !== 'DONE';
    }
    if (activeFilter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
    if (activeFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  const handleUpdateStatus = async (task: MyTaskItem, newStatus: string) => {
    setUpdatingTaskId(task.id);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/work-orders/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note: completionNote }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při aktualizaci stavu úkolu');

      setSuccessMsg(`Zakázka "${task.title}" byla označena jako HOTOVÁ a zapsána do Odvedené práce.`);
      setShowDoneModal(null);
      setCompletionNote('');
      window.location.reload();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při aktualizaci stavu');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stats & Filter Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Moje pracovní úkoly</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Osobní rozpis a správa montáží pro {currentUserName}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-slate-200/70 p-1 text-xs font-bold">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`rounded-xl px-3 py-1.5 transition ${activeFilter === 'ALL' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'}`}
          >
            Všechny ({tasks.length})
          </button>
          <button
            onClick={() => setActiveFilter('PENDING_ACK')}
            className={`rounded-xl px-3 py-1.5 transition ${activeFilter === 'PENDING_ACK' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-700 hover:text-slate-900'}`}
          >
            K převzetí ({tasks.filter((t) => t.assignments.some((a) => !a.acknowledgedAt) && t.status !== 'DONE').length})
          </button>
          <button
            onClick={() => setActiveFilter('IN_PROGRESS')}
            className={`rounded-xl px-3 py-1.5 transition ${activeFilter === 'IN_PROGRESS' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'}`}
          >
            Probíhá ({tasks.filter((t) => t.status === 'IN_PROGRESS').length})
          </button>
          <button
            onClick={() => setActiveFilter('DONE')}
            className={`rounded-xl px-3 py-1.5 transition ${activeFilter === 'DONE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:text-slate-900'}`}
          >
            Dokončené ({tasks.filter((t) => t.status === 'DONE').length})
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Task Cards List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
          <h3 className="text-base font-bold text-slate-800">Žádné úkoly v tomto přehledu</h3>
          <p className="text-xs text-slate-500 mt-1">Všechny úkoly v této záložce jsou vyřízené nebo nebyla přiřazena nová zakázka.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((t) => {
            const isAcknowledged = t.assignments.some((a) => Boolean(a.acknowledgedAt));
            const isExpanded = expandedTaskId === t.id;
            const isDone = t.status === 'DONE';
            const isInProgress = t.status === 'IN_PROGRESS';

            return (
              <div
                key={t.id}
                className={`rounded-3xl border bg-white p-5 transition-all shadow-sm ${
                  isDone
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isInProgress
                    ? 'border-sky-300 ring-2 ring-sky-100'
                    : !isAcknowledged
                    ? 'border-amber-300 bg-amber-50/30 ring-2 ring-amber-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                        isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : isInProgress
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {isDone ? '✓ Dokončeno' : isInProgress ? '▶ Probíhá' : '📋 Plánováno'}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {t.workType}
                    </span>

                    {!isAcknowledged && !isDone && (
                      <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-slate-950 animate-pulse">
                        ⚠️ Čeká na vaše odsouhlasení
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{new Date(t.scheduledAt).toLocaleDateString('cs-CZ')}</span>
                    {t.deadlineAt && (
                      <span className="text-rose-600 font-bold ml-1">
                        (Do: {new Date(t.deadlineAt).toLocaleDateString('cs-CZ')})
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Card Content */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-black text-slate-950">{t.title}</h2>
                      <p className="text-xs font-bold text-slate-600 mt-0.5">
                        Klient: <span className="text-slate-900">{t.clientName}</span> · Zadal: <span className="text-slate-700">{t.requestedBy || 'Neuveden'}</span>
                      </p>
                    </div>
                    {t.price && (
                      <span className="text-sm font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                        {Number(t.price).toLocaleString('cs-CZ')} Kč
                      </span>
                    )}
                  </div>

                  {/* PROMINENT CLIENT CALL BUTTON (Mobile Field Quick Action) */}
                  {t.contactPhone && (
                    <div className="pt-2">
                      <a
                        href={`tel:${t.contactPhone}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:brightness-110 active:scale-95 transition"
                      >
                        <Phone size={16} className="animate-bounce" />
                        <span>ZAVOLAT KLIENTOVI: {t.contactName ? `${t.contactName} (${t.contactPhone})` : t.contactPhone}</span>
                      </a>
                    </div>
                  )}

                  {/* Location & Instructions */}
                  {t.locationNote && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-800 flex items-start gap-2">
                      <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Místo a pokyny:</strong>
                        <span>{t.locationNote}</span>
                      </div>
                    </div>
                  )}

                  {/* Google Drive Folder Link */}
                  {t.ftdUrl && (
                    <div className="pt-1">
                      <a
                        href={t.ftdUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition"
                      >
                        <Folder size={15} />
                        <span>Otevřít složku fotek na Google Disku ↗</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Worker Acknowledgment & Status Action Buttons */}
                <div className="mt-4 border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Worker Acknowledgment Button */}
                    {!isDone && (
                      <WorkOrderAcknowledgeButton
                        workOrderId={t.id}
                        initialAcknowledged={isAcknowledged}
                      />
                    )}

                    {/* Start Task Button */}
                    {!isDone && !isInProgress && (
                      <button
                        onClick={() => handleUpdateStatus(t, 'IN_PROGRESS')}
                        disabled={updatingTaskId === t.id}
                        className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 active:scale-95 transition"
                      >
                        <Play size={14} />
                        <span>Zahájit práci</span>
                      </button>
                    )}

                    {/* Mark Done Button */}
                    {!isDone && (
                      <button
                        onClick={() => setShowDoneModal(t)}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-emerald-500 active:scale-95 transition"
                      >
                        <CheckCircle2 size={16} />
                        <span>🎉 Označit zakázku jako HOTOVO</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 ml-auto"
                  >
                    <span>{isExpanded ? 'Skrýt detail' : 'Podrobnosti zadání'}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Expanded Details & History */}
                {isExpanded && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-3 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 mb-1">Podrobné zadání:</h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 border border-slate-200">
                        {t.description}
                      </p>
                    </div>

                    {/* History Audit Log */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 mb-1.5 flex items-center gap-1">
                        <History size={14} className="text-slate-500" />
                        <span>Historie a průběh zakázky:</span>
                      </h4>
                      <div className="space-y-1 text-[11px] text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">📅 Vytvořeno:</span> {new Date(t.scheduledAt).toLocaleDateString('cs-CZ')} zadavatelem {t.requestedBy || 'neuveden'}
                        </div>
                        {isAcknowledged && (
                          <div className="flex items-center gap-2 text-emerald-700 font-bold">
                            <span>✅ Odsouhlaseno převzetí pracovníkem</span>
                          </div>
                        )}
                        {isDone && (
                          <div className="flex items-center gap-2 text-emerald-800 font-bold">
                            <span>🎉 Dokončeno & zapsáno do Odvedené práce</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Done Confirmation Modal */}
      {showDoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                Dokončení zakázky
              </h3>
              <button onClick={() => setShowDoneModal(null)} className="text-xs font-bold text-slate-400 hover:text-slate-700">
                Zavřít
              </button>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Označujete zakázku <strong className="text-slate-900">&quot;{showDoneModal.title}&quot;</strong> jako dokončenou.
              Po potvrzení se zakázka automaticky zapiše do **Odvedené práce** a zadavatel ({showDoneModal.requestedBy || 'Zadavatel'}) dostane notifikaci o dokončení.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Poznámka k odvedené práci (volitelné):
              </label>
              <textarea
                className="input w-full min-h-20 text-xs"
                placeholder="Napište případné poznámky z montáže..."
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDoneModal(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Zrušit
              </button>
              <button
                onClick={() => handleUpdateStatus(showDoneModal, 'DONE')}
                disabled={updatingTaskId === showDoneModal.id}
                className="flex-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white hover:bg-emerald-500 shadow-md active:scale-95 transition"
              >
                {updatingTaskId === showDoneModal.id ? 'Ukládám...' : 'Potvrdit dokončení zakázky'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
