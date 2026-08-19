'use client';

import { useState } from 'react';
import { Sparkles, Building2, ShieldCheck, MapPin, Target, Lightbulb, RefreshCw, CheckCircle2, ArrowRight, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

type AiEnrichmentData = {
  businessField?: string;
  companySummary?: string;
  executives?: string;
  recommendedCarriers?: Array<{ type: string; reason: string }>;
  salesAdvice?: string[];
};

type AresData = {
  ico?: string;
  dic?: string;
  name?: string;
  address?: string;
};

export function ClientAiEnrichCard({
  clientId,
  clientName,
  companyId,
  dic,
  website,
}: {
  clientId: string;
  clientName: string;
  companyId?: string | null;
  dic?: string | null;
  website?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [enrichData, setEnrichData] = useState<AiEnrichmentData | null>(null);
  const [ares, setAres] = useState<AresData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnrich = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/ai-enrich`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Chyba při dohledávání klienta.');
      } else {
        setEnrichData(data.aiEnrichment || null);
        setAres(data.aresData || null);
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || 'Chyba spojení.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50/80 via-indigo-50/40 to-white p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base">AI Profil Klienta & ARES Rejstřík</h3>
            <p className="text-xs text-slate-500">Automatické dohledání firemních dat, jednatelů a reklamní strategie</p>
          </div>
        </div>

        <button
          onClick={handleEnrich}
          disabled={loading}
          className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700 active:scale-95 transition shadow-md disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'AI Dohledává v rejstříku...' : '✨ AI Dohledat & Doplnit profil'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {/* Initial State Hint */}
      {!enrichData && !ares && !loading && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3.5 border border-sky-100 text-xs text-slate-600">
          <Building2 size={20} className="text-sky-500 shrink-0" />
          <p>
            Klikněte na tlačítko výše. AI ověří firmu <strong>{clientName}</strong> v rejstříku ARES (IČO/DIČ, sídlo) a vygeneruje <strong>doporučenou strategii nosičů SeePoint</strong> na míru oboru podnikání.
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-2 animate-pulse py-2">
          <div className="h-4 bg-sky-200/60 rounded-full w-3/4"></div>
          <div className="h-3 bg-sky-100 rounded-full w-1/2"></div>
          <div className="h-16 bg-white/70 rounded-2xl"></div>
        </div>
      )}

      {/* Results Display */}
      {(enrichData || ares) && (
        <div className="space-y-4 pt-1">
          {/* ARES Verified Pill */}
          {ares && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
              <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
              <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  <strong>IČO:</strong> {ares.ico || companyId || 'Nenalezeno'}
                </span>
                <span>
                  <strong>DIČ:</strong> {ares.dic || dic || 'Neuvedeno'}
                </span>
                {ares.address && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-emerald-700" />
                    {ares.address}
                  </span>
                )}
              </div>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                VERIFIKOVÁNO ARES
              </span>
            </div>
          )}

          {/* AI Company Summary & Business Field */}
          {enrichData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Business Profile */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Obor činnosti</span>
                  {enrichData.businessField && (
                    <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-[11px] font-black text-sky-800">
                      {enrichData.businessField}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{enrichData.companySummary}</p>
                {enrichData.executives && (
                  <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-100 mt-2">
                    <strong>Statutární orgány / Jednatelé:</strong> {enrichData.executives}
                  </div>
                )}
              </div>

              {/* Sales Tips */}
              <div className="rounded-2xl bg-amber-50/80 p-4 border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-900 uppercase tracking-wider">
                  <Lightbulb size={14} className="text-amber-600" />
                  <span>Tipy pro obchodníka</span>
                </div>
                <ul className="space-y-1.5 text-xs text-amber-950">
                  {enrichData.salesAdvice?.map((tip, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Recommended Ad Strategy */}
          {enrichData?.recommendedCarriers && enrichData.recommendedCarriers.length > 0 && (
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-sky-600" />
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Doporučená reklamní strategie SeePoint
                  </h4>
                </div>
                <a
                  href={`/offers/new?clientId=${clientId}`}
                  className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-800 hover:underline"
                >
                  <FileText size={13} />
                  <span>Vytvořit AI Nabídku na míru</span>
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {enrichData.recommendedCarriers.map((rec, i) => (
                  <div key={i} className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 space-y-1">
                    <span className="font-extrabold text-xs text-sky-950 block">{rec.type}</span>
                    <p className="text-[11px] text-slate-600 leading-snug">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
