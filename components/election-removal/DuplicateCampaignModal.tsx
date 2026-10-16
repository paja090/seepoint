'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, X, Sparkles, Calendar, Layers, CheckCircle2 } from 'lucide-react';
import type { Operation } from '@/lib/election-removal/task-spec';

interface DuplicateCampaignModalProps {
  campaignId: string;
  campaignName: string;
  clientName?: string | null;
  totalPoints: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DuplicateCampaignModal({
  campaignId,
  campaignName,
  clientName,
  totalPoints,
  isOpen,
  onClose,
}: DuplicateCampaignModalProps) {
  const router = useRouter();
  const [targetOp, setTargetOp] = useState<Operation | 'KEEP'>('REMOVE_OBJECT');
  const [name, setName] = useState(`${campaignName} – Deinstalace`);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleOpChange = (newOp: Operation | 'KEEP') => {
    setTargetOp(newOp);
    let suffix = 'Kopie';
    if (newOp.startsWith('INSTALL')) suffix = 'Instalace';
    else if (newOp.startsWith('REMOVE')) suffix = 'Deinstalace';
    else if (newOp === 'RELOCATION') suffix = 'Převoz';
    setName(`${campaignName} – ${suffix}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/election-removal/campaigns/${encodeURIComponent(campaignId)}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          clientName: clientName || undefined,
          targetDate: targetDate || undefined,
          description: description.trim() || undefined,
          targetOperation: targetOp,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Duplikace selhala.');

      onClose();
      router.push(`/election-removal/${data.campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při duplikaci.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
              <Copy className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Duplikovat zakázku / akci</h3>
              <p className="text-xs text-slate-500">
                Vytvoří novou zakázku se stejnými {totalPoints} lokalitami.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Operation Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Co se má v nové zakázce dělat? *
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleOpChange('REMOVE_OBJECT')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  targetOp === 'REMOVE_OBJECT'
                    ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold ring-1 ring-sky-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-sm">🗑️ Deinstalace</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Demontáž nosičů a odvoz do skladu
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOpChange('INSTALL_AD')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  targetOp === 'INSTALL_AD'
                    ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold ring-1 ring-sky-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-sm">🛠️ Instalace</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Instalace nové reklamy / plachty
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOpChange('RELOCATION')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  targetOp === 'RELOCATION'
                    ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold ring-1 ring-sky-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-sm">🚚 Převozy</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Přemístění na jiné místo / sklad
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOpChange('KEEP')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  targetOp === 'KEEP'
                    ? 'border-sky-600 bg-sky-50/70 text-sky-900 font-semibold ring-1 ring-sky-600'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="text-sm">🔄 Původní operace</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Ponechat dosavadní nastavení bodů
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Název nové zakázky *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Termín realizace
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Klient
              </label>
              <input
                type="text"
                disabled
                value={clientName || 'Neuveden'}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Poznámka / doplňující instrukce pro novou zakázku
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Např. demontovat konstrukce po skončení voleb a vrátit na centrální sklad…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Zrušit
            </button>

            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="px-5 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{busy ? 'Vytvářím duplikát…' : `Duplikovat (${totalPoints} bodů)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
