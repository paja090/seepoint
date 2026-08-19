'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Loader2, X, CheckCircle2, Sparkles, Volume2 } from 'lucide-react';

export function WarehouseVoiceInputModal({ workOrders = [], employees = [], triggerClassName }: {
  workOrders?: { id: string; title: string; clientName: string }[];
  employees?: { id: string; firstName: string; lastName: string }[];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [listening, setListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [workOrderId, setWorkOrderId] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');

  const quickVoicePresets = [
    '2 balení pásek a 1 lepidlo',
    '1 balení velkých pásek',
    '1 žebřík a vrtačku',
    '10 ks hmoždinky M10',
  ];

  useEffect(() => {
    let recognition: any = null;
    if (listening) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'cs-CZ';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          setSpeechText(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech error:', event.error);
          setListening(false);
        };

        recognition.onend = () => {
          setListening(false);
        };

        recognition.start();
      } else {
        setError('Váš prohlížeč nepodporuje přímý hlasový vstup mikrofonem. Můžete hlasový příkaz napsat rukou.');
        setListening(false);
      }
    }

    return () => {
      if (recognition) recognition.stop();
    };
  }, [listening]);

  async function handleVoiceSubmit(textToSubmit?: string) {
    const text = textToSubmit || speechText;
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/warehouse/voice-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speechText: text,
          workOrderId: workOrderId || undefined,
          assignedEmployeeId: assignedEmployeeId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Zpracování selhalo.');
      }

      setSuccessMessage(data.message);
      setSpeechText('');
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při zpracování příkazu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ||
          'flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-purple-500 hover:to-indigo-500 transition'
        }
      >
        <Sparkles size={16} className="shrink-0" />
        <span className="truncate">AI Hlasový výdej</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span>🎙️ AI Hlasový výdej ze skladu</span>
                </h3>
                <p className="text-xs text-slate-500">Vyslovte nebo napište, co si berete na výjezd</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">
                ⚠️ {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Microphone Listening Interface */}
            <div className="my-6 text-center">
              <button
                type="button"
                onClick={() => setListening(!listening)}
                className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-full transition shadow-xl ${listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                {listening ? <MicOff size={32} /> : <Mic size={32} />}
              </button>

              <span className="mt-3 block text-xs font-bold text-slate-600">
                {listening ? '🔴 Poslouchám... Mluvte teď!' : 'Stiskněte mikrofon a řekněte např. "Beru 2 pásky a žebřík"'}
              </span>
            </div>

            {/* Speech Output Box */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rozpoznaný hlasový text:
              </label>
              <textarea
                rows={2}
                className="input w-full text-xs font-medium"
                placeholder="Řekněte nebo napište: 'Beru si 2 balení pásek a lepidlo'..."
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
              />
            </div>

            {/* Quick Presets */}
            <div className="mb-4">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1.5">Rychlé šablony hlasu:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickVoicePresets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSpeechText(p);
                      handleVoiceSubmit(p);
                    }}
                    className="rounded-lg bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-900 border border-purple-200 hover:bg-purple-100 transition"
                  >
                    💬 {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Assignment */}
            <div className="space-y-3 border-t border-slate-100 pt-3 text-xs">
              {employees.length > 0 && (
                <label className="block font-bold text-slate-700">
                  Komu se vydává (volitelné)
                  <select
                    className="input mt-1 w-full text-xs font-normal"
                    value={assignedEmployeeId}
                    onChange={(e) => setAssignedEmployeeId(e.target.value)}
                  >
                    <option value="">-- Vyberte montážníka --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        👤 {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Zavřít
              </button>
              <button
                type="button"
                onClick={() => handleVoiceSubmit()}
                disabled={loading || isPending || !speechText.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-black text-white hover:bg-purple-800 transition shadow-md disabled:opacity-50"
              >
                {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Zpracovat a vydat ze skladu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
