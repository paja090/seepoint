'use client';

import { useState } from 'react';
import { Sparkles, Mic, MicOff, Check, X, User, AlertCircle, Loader2, ListChecks } from 'lucide-react';

export type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
};

type CreatedQuickTask = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  assignedToEmployee?: { firstName: string; lastName: string } | null;
};
type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function AiQuickTaskModal({
  isOpen,
  onClose,
  employees,
  onTasksCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeOption[];
  onTasksCreated?: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [targetAssigneeId, setTargetAssigneeId] = useState<string>('AUTO');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<CreatedQuickTask[]>([]);

  if (!isOpen) return null;

  function toggleSpeechRecording() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Váš prohlížeč nepodporuje přímé rozpoznávání hlasu. Zadejte prosím text ručně.');
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'cs-CZ';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isRecording) {
      setIsRecording(true);
      recognition.start();
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
    } else {
      setIsRecording(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setCreatedTasks([]);

    try {
      const res = await fetch('/api/ai/parse-quick-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          defaultAssigneeId: targetAssigneeId !== 'AUTO' ? targetAssigneeId : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Zpracování selhalo.');

      setCreatedTasks(data.tasks || []);
      if (onTasksCreated) onTasksCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI úkoly se nepodařilo zpracovat.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="card w-full max-w-lg bg-white shadow-2xl rounded-3xl p-6 relative space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-700 font-bold border border-fuchsia-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">AI Rychlý Úkolníček</h3>
              <p className="text-xs text-slate-500">Zadejte hlasem nebo textem rychlý Check-list pro dílnu</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {createdTasks.length > 0 ? (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <Check size={18} className="text-emerald-600" />
                <span>Vytvořen Check-list o {createdTasks.length} položkách!</span>
              </div>
              <div className="space-y-2">
                {createdTasks.map((t, idx) => (
                  <div key={t.id} className="rounded-xl bg-white p-3 border border-emerald-100 text-xs text-slate-800 space-y-1 shadow-2xs flex items-start gap-2.5">
                    <div className="h-5 w-5 rounded-md border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5 font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <strong className="block font-bold text-slate-900 leading-snug">{t.title}</strong>
                      {t.description && <p className="text-slate-500 text-[11px]">{t.description}</p>}
                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                        <span className="font-semibold text-slate-700">
                          👤 {t.assignedToEmployee?.firstName} {t.assignedToEmployee?.lastName}
                        </span>
                        <span className="font-bold uppercase text-[10px] text-fuchsia-700 bg-fuchsia-50 px-2 py-0.5 rounded-md">
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCreatedTasks([]);
                  setPrompt('');
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Zadat další Check-list
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white shadow-sm"
              >
                Hotovo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-bold text-xs text-slate-700 block mb-1">
                Přiřadit úkoly:
              </label>
              <select
                value={targetAssigneeId}
                onChange={(e) => setTargetAssigneeId(e.target.value)}
                className="input w-full p-2.5 text-xs border-slate-300 rounded-xl mb-3 font-semibold text-slate-800"
              >
                <option value="AUTO">🤖 AI Automaticky (podle jména v pokynu nebo „sám sobě“)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    👤 {e.firstName} {e.lastName} ({e.position || 'Pracovník'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-xs text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Namluvte nebo napište pokyn (AI vytvoří Check-list):</span>
                <span className="text-[11px] text-fuchsia-700 font-bold">🎙️ Hlasové zadávání</span>
              </label>
              <div className="relative">
                <textarea
                  rows={4}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="např. Zamést halu u vrat, uklidit ponk u pily a zajet do Hornbachu pro barvu..."
                  className="input w-full p-3 text-xs border-slate-300 rounded-2xl resize-none"
                />

                <button
                  type="button"
                  onClick={toggleSpeechRecording}
                  title="Spustit nahrávání hlasem"
                  className={`absolute right-3 bottom-3 rounded-full p-2 text-xs font-bold transition shadow-sm ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                💡 Tip: Můžete říct <i>„Sám sobě“</i> nebo napsat seznam úkolů oddělený čárkami.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700"
              >
                Zrušit
              </button>

              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-fuchsia-500 hover:to-pink-500 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>AI Vytváří Check-list...</span>
                  </>
                ) : (
                  <>
                    <ListChecks size={16} />
                    <span>Vytvořit Check-list</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
