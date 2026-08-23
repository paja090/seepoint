'use client';

import { useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSDemoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [surfaceCount, setSurfaceCount] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/leads/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          phone,
          surfaceCount,
          analyticsEvents: ['demo_form_submitted'],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Došlo k chybě při odesílání.');
      }

      trackSaaSEvent('demo_form_submitted', { email, company, surfaceCount });
      setSuccessMessage(data.message || 'Děkujeme! Vaše žádost byla přijata.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Došlo k neznámé chybě.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-2xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          aria-label="Zavřít"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950 text-purple-300 text-[11px] font-black uppercase tracking-wider border border-purple-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SEEPOINT OS UKÁZKA</span>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">Domluvit ukázku systému</h3>
          <p className="text-xs text-slate-400 font-medium">
            Projdeme s vámi reálné workflow SeePoint OS a možný převod vašich nosičů a klientů.
          </p>
        </div>

        {/* Success Banner */}
        {successMessage ? (
          <div className="rounded-2xl border border-emerald-800 bg-emerald-950/80 p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="font-black text-lg text-white">Žádost byla odeslána!</h4>
            <p className="text-xs text-emerald-200 font-medium leading-relaxed">{successMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Zavřít okno
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950 border border-rose-800 text-rose-200 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-300">Jméno a příjmení *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  if (!name) trackSaaSEvent('demo_form_started');
                  setName(e.target.value);
                }}
                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-medium focus:border-purple-600 focus:outline-none"
                placeholder="Jan Novák"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">Firemní e-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-medium focus:border-purple-600 focus:outline-none"
                  placeholder="jan@reklamka.cz"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">Firma / Agentura *</label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-medium focus:border-purple-600 focus:outline-none"
                  placeholder="Moje Reklamka s.r.o."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">Telefonní číslo</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-medium focus:border-purple-600 focus:outline-none"
                  placeholder="+420 777 000 000"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">Počet reklamních ploch</label>
                <select
                  value={surfaceCount}
                  onChange={(e) => setSurfaceCount(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-medium focus:border-purple-600 focus:outline-none"
                >
                  <option value="">Vyberte počet nosičů...</option>
                  <option value="Do 50 nosičů">Do 50 nosičů</option>
                  <option value="50–300 nosičů">50 – 300 nosičů</option>
                  <option value="300–1000 nosičů">300 – 1 000 nosičů</option>
                  <option value="1000+ nosičů">Více než 1 000 nosičů</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl transition cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                  <span>Odesílám žádost...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Domluvit ukázku</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
