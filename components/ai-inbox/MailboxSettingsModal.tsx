'use client';

import React, { useState } from 'react';
import { Settings, X, Save, AlertCircle, CheckCircle2, Filter, Clock, Hash, UserX } from 'lucide-react';

export type MailboxSettingsData = {
  syncFilter?: 'INBOX_ONLY' | 'ORDERS_ONLY' | 'LABEL_ONLY';
  syncLabel?: string;
  batchSize?: number;
  autoSyncIntervalMinutes?: number;
  ignoredSenders?: string[];
};

export function MailboxSettingsModal({
  isOpen,
  onClose,
  connectionId,
  accountEmail,
  initialSettings,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  accountEmail: string | null;
  initialSettings?: MailboxSettingsData | null;
  onSaved?: (updatedSettings: MailboxSettingsData) => void;
}) {
  const [syncFilter, setSyncFilter] = useState<'INBOX_ONLY' | 'ORDERS_ONLY' | 'LABEL_ONLY'>(
    initialSettings?.syncFilter || 'INBOX_ONLY'
  );
  const [syncLabel, setSyncLabel] = useState<string>(initialSettings?.syncLabel || 'SeePoint AI');
  const [batchSize, setBatchSize] = useState<number>(initialSettings?.batchSize || 25);
  const [autoSyncIntervalMinutes, setAutoSyncIntervalMinutes] = useState<number>(
    initialSettings?.autoSyncIntervalMinutes !== undefined ? initialSettings.autoSyncIntervalMinutes : 15
  );
  const [ignoredSendersInput, setIgnoredSendersInput] = useState<string>(
    (initialSettings?.ignoredSenders || []).join('\n')
  );

  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    const ignoredSenders = ignoredSendersInput
      .split('\n')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const payload: MailboxSettingsData = {
      syncFilter,
      syncLabel: syncLabel.trim() || 'SeePoint AI',
      batchSize,
      autoSyncIntervalMinutes,
      ignoredSenders,
    };

    try {
      const res = await fetch('/api/ai-inbox/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          settings: payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení nastavení selhalo.');

      setStatusMsg({ type: 'success', text: 'Nastavení schránky bylo úspěšně uloženo.' });
      if (onSaved) onSaved(payload);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Chyba při ukládání' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Nastavení schránky</h3>
              <p className="text-xs text-slate-500 font-mono truncate max-w-xs sm:max-w-md">{accountEmail || 'Gmail'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 text-sm">
          {/* Režim výběru e-mailů */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-bold text-slate-800">
              <Filter size={16} className="text-indigo-600" />
              <span>Které e-maily stahovat do SeePointu</span>
            </label>
            <div className="grid gap-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${syncFilter === 'ORDERS_ONLY' ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="syncFilter"
                  value="ORDERS_ONLY"
                  checked={syncFilter === 'ORDERS_ONLY'}
                  onChange={() => setSyncFilter('ORDERS_ONLY')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Chytrý filtr zakázek a poptávek (Doporučeno)</span>
                  <span className="text-xs text-slate-500">Stahuje pouze e-maily s poptávkami, nabídkami, objednávkami, fakturami a kódy zakázek. Čistý inbox bez balastu.</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${syncFilter === 'INBOX_ONLY' ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="syncFilter"
                  value="INBOX_ONLY"
                  checked={syncFilter === 'INBOX_ONLY'}
                  onChange={() => setSyncFilter('INBOX_ONLY')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Všechny doručené e-maily (INBOX)</span>
                  <span className="text-xs text-slate-500">Stahuje veškerou novou poštu ze složky Doručená pošta (kromě koše a spamu).</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${syncFilter === 'LABEL_ONLY' ? 'border-indigo-600 bg-indigo-50/40' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="syncFilter"
                  value="LABEL_ONLY"
                  checked={syncFilter === 'LABEL_ONLY'}
                  onChange={() => setSyncFilter('LABEL_ONLY')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-900 block">Pouze označené štítkem v Gmailu</span>
                  <span className="text-xs text-slate-500">Do SeePointu se dostanou jen e-maily, kterým v Gmailu přidáte štítek.</span>
                </div>
              </label>
            </div>

            {syncFilter === 'LABEL_ONLY' && (
              <div className="mt-2 pl-6">
                <label className="text-xs font-semibold text-slate-700 block mb-1">Název štítku v Gmailu:</label>
                <input
                  type="text"
                  value={syncLabel}
                  onChange={(e) => setSyncLabel(e.target.value)}
                  placeholder="SeePoint AI"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Frekvence automatické synchronizace */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 font-bold text-slate-800">
              <Clock size={16} className="text-indigo-600" />
              <span>Automatická synchronizace na pozadí (Cron)</span>
            </label>
            <select
              value={autoSyncIntervalMinutes}
              onChange={(e) => setAutoSyncIntervalMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none bg-white"
            >
              <option value={15}>Každých 15 minut (Doporučeno)</option>
              <option value={30}>Každých 30 minut</option>
              <option value={60}>Každou 1 hodinu</option>
              <option value={0}>Vypnuto (pouze ruční synchronizace na tlačítko)</option>
            </select>
          </div>

          {/* Velikost dávky */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 font-bold text-slate-800">
              <Hash size={16} className="text-indigo-600" />
              <span>Počet e-mailů na jednu dávku (rychlost)</span>
            </label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none bg-white"
            >
              <option value={15}>15 nejnovějších e-mailů (Bleskové, vhodné pro mobilní telefony)</option>
              <option value={25}>25 nejnovějších e-mailů (Standard)</option>
              <option value={50}>50 nejnovějších e-mailů (Důkladné)</option>
            </select>
          </div>

          {/* Seznam ignorovaných odesílatelů */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 font-bold text-slate-800">
              <UserX size={16} className="text-rose-600" />
              <span>Ignorovaní odesílatelé a newslettery (Blacklist)</span>
            </label>
            <p className="text-xs text-slate-500">
              Zadejte e-mailové adresy nebo celé domény (každou na nový řádek), které chcete při stahování automaticky přeskočit (např. <code className="text-slate-700">newsletter@firma.cz</code> nebo <code className="text-slate-700">notifikace@banka.cz</code>).
            </p>
            <textarea
              rows={3}
              value={ignoredSendersInput}
              onChange={(e) => setIgnoredSendersInput(e.target.value)}
              placeholder="newsletter@firma.cz&#10;info@reklamniobchod.cz"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 active:scale-95 disabled:opacity-50 transition"
            >
              <Save size={14} />
              <span>{isSaving ? 'Ukládám…' : 'Uložit nastavení'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
