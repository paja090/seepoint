'use client';

import { useState } from 'react';
import { Sparkles, X, Link, Text, Check, AlertCircle } from 'lucide-react';
import type { OpportunityEventType } from '@prisma/client';

export function ManualOpportunityModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'prompt' | 'url'>('prompt');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState<{
    companyName: string;
    companyId?: string;
    website?: string;
    eventType: OpportunityEventType;
    title: string;
    summary: string;
    city: string;
    region?: string;
    address?: string;
    eventDate?: string;
    sourceUrl: string;
    sourceTitle: string;
    suggestedMediaTypes?: string[];
  } | null>(null);

  if (!isOpen) return null;

  async function handleAiParse() {
    if (!inputText.trim() && !inputUrl.trim()) {
      setError('Vložte text zprávy nebo URL odkazu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sales/opportunities/parse-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText, url: inputUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analýza podkladů selhala.');
      setParsedData(data.parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analýzu se nepodařilo dokončit.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSave() {
    if (!parsedData) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sales/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Příležitost se nepodařilo uložit.');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-black text-white">+ Nová AI obchodní příležitost</h2>
          </div>
          <button
            type="button"
            className="rounded-xl p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-2xl border border-rose-800/80 bg-rose-950/80 p-3.5 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!parsedData ? (
            <div className="space-y-4">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('prompt')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mode === 'prompt' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Text className="w-3.5 h-3.5 inline mr-1.5" />
                  Text zprávy / inzerátu
                </button>
                <button
                  type="button"
                  onClick={() => setMode('url')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mode === 'url' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Link className="w-3.5 h-3.5 inline mr-1.5" />
                  URL adresa článku
                </button>
              </div>

              {mode === 'prompt' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Vložte text zprávy, článek nebo poznámku od obchodníka
                  </label>
                  <textarea
                    className="input min-h-32 w-full text-xs text-white"
                    placeholder="Např. Nová prodejna Kaufland se otevírá v Ostravě-Porubě v říjnu 2026..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    URL odkaz na web nebo tiskovou zprávu
                  </label>
                  <input
                    type="url"
                    className="input w-full text-xs text-white"
                    placeholder="https://ostrava.cz/clanek-nova-pobocka..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                  />
                </div>
              )}

              <button
                type="button"
                disabled={loading || (!inputText.trim() && !inputUrl.trim())}
                onClick={handleAiParse}
                className="btn-primary w-full py-3 text-xs font-bold"
              >
                {loading ? 'AI analyzuje podklady…' : '✨ Spustit AI analýzu příležitosti'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-800/80 bg-purple-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-800/60 pb-2">
                  <span className="text-xs font-extrabold text-purple-300 uppercase tracking-wider">
                    AI Výsledek analýzy
                  </span>
                  <span className="text-xs text-purple-400 font-bold">{parsedData.eventType}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="font-bold text-slate-400">Firma / Značka:</label>
                    <input
                      type="text"
                      className="input mt-1 text-xs py-1.5 w-full"
                      value={parsedData.companyName}
                      onChange={(e) => setParsedData({ ...parsedData, companyName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-400">Titulek příležitosti:</label>
                    <input
                      type="text"
                      className="input mt-1 text-xs py-1.5 w-full"
                      value={parsedData.title}
                      onChange={(e) => setParsedData({ ...parsedData, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-400">Shrnutí události:</label>
                    <textarea
                      className="input mt-1 text-xs min-h-16 w-full"
                      value={parsedData.summary}
                      onChange={(e) => setParsedData({ ...parsedData, summary: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-400">Město:</label>
                      <input
                        type="text"
                        className="input mt-1 text-xs py-1.5 w-full"
                        value={parsedData.city}
                        onChange={(e) => setParsedData({ ...parsedData, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-400">Datum události:</label>
                      <input
                        type="date"
                        className="input mt-1 text-xs py-1.5 w-full"
                        value={parsedData.eventDate || ''}
                        onChange={(e) => setParsedData({ ...parsedData, eventDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setParsedData(null)}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Upravit vstup
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmSave}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold"
                >
                  {loading ? 'Ukládám…' : '✅ Uložit do Obchodního radaru'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
