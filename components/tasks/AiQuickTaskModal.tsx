'use client';

import { useState } from 'react';
import { Sparkles, Mic, MicOff, Check, X, User, AlertCircle, Loader2 } from 'lucide-react';

export type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
};

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
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<any[]>([]);

  if (!isOpen) return null;

  function toggleSpeechRecording() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Váš prohlížeč nepodporuje přímé rozpoznávání hlasu. Zadejte prosím text ručně.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'cs-CZ';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isRecording) {
      setIsRecording(true);
      recognition.start();
      recognition.onresult = (event: any) => {
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
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Zpracování selhalo.');

      setCreatedTasks(data.tasks || []);
      if (onTasksCreated) onTasksCreated();
    } catch (err: any) {
      setError(err.message);
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
              <p className="text-xs text-slate-500">Zadejte hlasem nebo textem rychlý pokyn pro dílnu</p>
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
                <span>Úspěšně vytvořeno {createdTasks.length} úkolů!</span>
              </div>
              <div className="space-y-2">
                {createdTasks.map((t) => (
                  <div key={t.id} className="rounded-xl bg-white p-3 border border-emerald-100 text-xs text-slate-800 space-y-1 shadow-2xs">
                    <strong className="block font-bold text-slate-900">{t.title}</strong>
                    {t.description && <p className="text-slate-500">{t.description}</p>}
                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                      <span className="font-semibold text-slate-700">
                        👤 {t.assignedToEmployee?.firstName} {t.assignedToEmployee?.lastName}
                      </span>
                      <span className="font-bold uppercase text-[10px] text-fuchsia-700 bg-fuchsia-50 px-2 py-0.5 rounded-md">
                        {t.priority}
                      </span>
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
                Zadat další úkol
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
              <label className="font-bold text-xs text-slate-700 block mb-1.5">
                Namluvte nebo napište pokyn vedoucího:
              </label>
              <div className="relative">
                <textarea
                  rows={4}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="např. Pavel zítra ráno než odjede zamete halu u vrat a odpoledne skočí do Hornbachu pro barvu..."
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
                💡 Tip: Můžete zmínit jméno zaměstnance (např. *Pavel*, *Petr*) a AI úkol automaticky spáruje s jeho profilem.
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
                    <span>AI Zpracovává úkoly...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Zpracovat & Vytvořit úkoly</span>
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
