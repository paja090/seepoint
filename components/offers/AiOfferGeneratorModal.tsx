'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  X,
  Building2,
  MapPin,
  Coins,
  Calendar,
  Send,
  FileText,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

export type ClientOption = {
  id: string;
  name: string;
};

export function AiOfferGeneratorModal({
  isOpen,
  onClose,
  clients = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  clients?: ClientOption[];
}) {
  const router = useRouter();
  const [clientList, setClientList] = useState<ClientOption[]>(clients);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');
  const [durationMonths, setDurationMonths] = useState(12);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (clients.length > 0) {
      setClientList(clients);
    } else if (isOpen) {
      fetch('/api/clients?take=100')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.clients || data)) {
            setClientList(data.clients || data);
          }
        })
        .catch(() => null);
    }
  }, [isOpen, clients]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const applyPreset = (presetText: string, presetCity: string, presetBudget: number) => {
    setPrompt(presetText);
    if (presetCity) setCity(presetCity);
    if (presetBudget) setBudget(String(presetBudget));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return setError('Zadejte požadavek pro AI.');

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/offers/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          clientId: selectedClientId || undefined,
          clientName: clientName.trim() || undefined,
          city: city.trim() || undefined,
          budget: budget ? Number(budget) : undefined,
          durationMonths: Number(durationMonths),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generování nabídky selhalo.');

      setSuccessMsg(data.message || 'Nabídka byla úspěšně vytvořena!');

      setTimeout(() => {
        onClose();
        router.push(data.redirectUrl || `/offers/${data.offerId}`);
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při generování.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 font-black text-slate-950 shadow-md">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                ✨ AI Obchodní Copilot pro Nabídky
              </h2>
              <p className="text-xs font-bold text-slate-400">
                Generování kompletních nabídek nosičů a rozpočtů během sekund
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGenerate} className="flex-1 overflow-y-auto p-5 space-y-5 overscroll-contain touch-pan-y">
          {error && (
            <div className="rounded-2xl border border-rose-800 bg-rose-950/90 p-3.5 text-xs font-extrabold text-rose-200">
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-800 bg-emerald-950/90 p-3.5 text-xs font-extrabold text-emerald-200">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>{successMsg} Přesměrovávám na detail nabídky...</span>
            </div>
          )}

          {/* Prompt textarea */}
          <div>
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              1. Zadejte požadavek klienta slovy *
            </label>
            <textarea
              rows={3}
              placeholder="Např. Potřebujeme 6 navigačních cedulí u prodejny Kaufland ve Frýdku-Místku s rozpočtem do 40 000 Kč na 1 rok..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3.5 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
              required
            />

            {/* Quick Presets */}
            <div className="mt-2.5 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                💡 Rychlé vzory požadavků:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    applyPreset(
                      'Potřebujeme 6 navigačních cedulí v okruhu 5 km pro Kaufland ve Frýdku-Místku do 40 000 Kč na 12 měsíců.',
                      'Frýdek-Místek',
                      40000
                    )
                  }
                  className="rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-slate-800 transition"
                >
                  🛒 6 navigačních cedulí Frýdek-Místek (40 000 Kč)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyPreset(
                      'Kampaň pro autosalón: 3 prémiové billboardy a Citylighty na hlavním tahu s ročním nájmem.',
                      'Praha',
                      120000
                    )
                  }
                  className="rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:bg-slate-800 transition"
                >
                  🚗 3 prémiové dálniční billboardy
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyPreset(
                      'Kompletní pokrytí nového sídla společnosti 4 navigačními cedulemi s rozpočtem 30 000 Kč.',
                      'Brno',
                      30000
                    )
                  }
                  className="rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-slate-800 transition"
                >
                  🏢 Pokrytí pobočky navigačními body
                </button>
              </div>
            </div>
          </div>

          {/* Client Selection / Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5 flex items-center gap-1">
                <Building2 size={13} /> Vybrat stávajícího klienta
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  if (e.target.value) setClientName('');
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500"
              >
                <option value="">-- Vybrat klienta ze seznamu --</option>
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
                Nebo nový název klienta
              </label>
              <input
                type="text"
                placeholder="Např. Kaufland Česká republika"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  if (e.target.value) setSelectedClientId('');
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* City, Budget & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5 flex items-center gap-1">
                <MapPin size={13} /> Město / Lokalita
              </label>
              <input
                type="text"
                placeholder="Např. Frýdek-Místek"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5 flex items-center gap-1">
                <Coins size={13} /> Cílový rozpočet (Kč)
              </label>
              <input
                type="number"
                placeholder="Např. 40000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5 flex items-center gap-1">
                <Calendar size={13} /> Délka pronájmu
              </label>
              <select
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
              >
                <option value={1}>1 měsíc</option>
                <option value={3}>3 měsíce</option>
                <option value={6}>6 měsíců</option>
                <option value={12}>12 měsíců (1 rok)</option>
                <option value={24}>24 měsíců (2 roky)</option>
              </select>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 py-3.5 text-xs font-black text-slate-950 shadow-xl hover:brightness-110 active:scale-98 transition disabled:opacity-50 mt-2"
          >
            <Sparkles size={18} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'AI sestavuje nabídku & vybírá nosiče...' : '✨ VYGENEROVAT NABÍDKU POMOCÍ AI'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
