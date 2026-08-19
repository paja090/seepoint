'use client';

import { useState } from 'react';
import { Sparkles, Building2, ShieldCheck, MapPin, Target, Lightbulb, RefreshCw, CheckCircle2, ArrowRight, FileText, UserCheck, Mail, Phone, Users, Search, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';

type ContactPersonFound = {
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
};

type BranchFound = {
  name: string;
  street?: string;
  city?: string;
  zip?: string;
  note?: string;
};

type AiEnrichmentData = {
  selectedOfficialName?: string;
  tradingName?: string;
  foundIco?: string;
  foundDic?: string;
  foundWebsite?: string;
  foundEmail?: string;
  foundPhone?: string;
  foundStreet?: string;
  foundCity?: string;
  foundZip?: string;
  businessField?: string;
  companySummary?: string;
  executives?: string;
  contactPersons?: ContactPersonFound[];
  msRegionBranches?: BranchFound[];
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
  const [searchQuery, setSearchQuery] = useState('');
  const [enrichData, setEnrichData] = useState<AiEnrichmentData | null>(null);
  const [ares, setAres] = useState<AresData | null>(null);
  const [createdContactsCount, setCreatedContactsCount] = useState(0);
  const [createdBranchesCount, setCreatedBranchesCount] = useState(0);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnrich = async (overrideQuery?: string) => {
    setLoading(true);
    setError(null);
    setSavedSuccess(false);
    try {
      const q = overrideQuery || searchQuery || clientName;
      const isIco = /^\d{8}$/.test(q.replace(/\s+/g, ''));

      const res = await fetch(`/api/crm/clients/${clientId}/ai-enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: q,
          overrideIco: isIco ? q.replace(/\s+/g, '') : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Chyba při dohledávání klienta.');
      } else {
        setEnrichData(data.aiEnrichment || null);
        setAres(data.aresData || null);
        setCreatedContactsCount(data.createdContactsCount || 0);
        setCreatedBranchesCount(data.createdBranchesCount || 0);
        setSavedSuccess(true);
        // Refresh server components & client header with updated Name/IČO/DIČ/Address/Contacts/Branches
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
      {/* Header & Refined Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-base">AI Profil, Pobočky v MS kraji & Živé ověření ARES/Google</h3>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-900 uppercase">
                🛡️ GOOGLE SEARCH GROUNDING + ARES
              </span>
            </div>
            <p className="text-xs text-slate-500">Živé ověření pravdivosti poboček v MS kraji, IČO z ARES a doporučení nosičů SeePoint v Ostravě</p>
          </div>
        </div>

        <button
          onClick={() => handleEnrich()}
          disabled={loading}
          className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-700 active:scale-95 transition shadow-md disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Ověřuji v ARES a živém vyhledávači Google...' : '🔍 Živě ověřit & aktualizovat údaje přes ARES a Google'}</span>
        </button>
      </div>

      {/* Manual Search Query Refinement */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl bg-white p-2 border border-sky-100 shadow-2xs">
        <div className="flex items-center gap-2 px-2 text-slate-400 shrink-0">
          <Search size={15} />
          <span className="text-xs font-bold text-slate-600">Zadat přesný název nebo IČO pro 100% ověření:</span>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Např. "${clientName} Ostrava" nebo IČO "25877698"`}
          className="flex-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-900 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
        />
        <button
          onClick={() => handleEnrich(searchQuery)}
          disabled={loading || !searchQuery.trim()}
          className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition disabled:opacity-40 shrink-0 cursor-pointer"
        >
          Spustit kontrolu
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
          {error}
        </div>
      )}

      {savedSuccess && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 font-bold animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              Údaje klienta ({ares?.name || enrichData?.selectedOfficialName || clientName}) byly živě prověřeny přes Google & ARES a uloženy!
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {createdBranchesCount > 0 && (
              <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                +{createdBranchesCount} POBOČEK V ZÁLOŽCE POBOČKY
              </span>
            )}
            {createdContactsCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                +{createdContactsCount} KONTAKT V KONTAKTECH
              </span>
            )}
          </div>
        </div>
      )}

      {/* Initial State Hint */}
      {!enrichData && !ares && !loading && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3.5 border border-sky-100 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <Building2 size={20} className="text-sky-500 shrink-0" />
            <p>
              Chcete zkontrolovat existující údaje? Klikněte na modré tlačítko <strong>"🔍 Živě ověřit & aktualizovat údaje přes ARES a Google"</strong>. Systém živě projde rejstřík ARES a vyhledávač Google, ověří pravdivost prodejen a aktualizuje data klienta.
            </p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3 p-4 bg-white/60 rounded-2xl animate-pulse border border-sky-100">
          <div className="h-4 w-1/3 bg-sky-200 rounded-md"></div>
          <div className="h-3 w-3/4 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-1/2 bg-slate-200 rounded-md"></div>
        </div>
      )}

      {/* Results View */}
      {(enrichData || ares) && !loading && (
        <div className="space-y-4 pt-2">
          {/* Official ARES Badge */}
          {ares && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider">
                  Ověřeno v Státním Rejstříku ARES (100% Právní Pravdivost)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700 pt-1 font-medium">
                <div>
                  <span className="text-slate-500 font-normal">Oficiální název:</span>{' '}
                  <strong className="text-slate-900">{ares.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-normal">IČO / DIČ:</span>{' '}
                  <strong className="font-mono text-slate-900">{ares.ico} / {ares.dic || 'Neuvedeno'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-normal">Sídlo:</span>{' '}
                  <strong className="text-slate-900">{ares.address}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Grid of Results */}
          {enrichData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profile Overview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Building2 size={15} className="text-sky-600" />
                  <h4 className="font-bold text-xs text-slate-900 uppercase">Profil & Kontakty klienta</h4>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  {enrichData.businessField && (
                    <p><strong>Obor:</strong> {enrichData.businessField}</p>
                  )}
                  {enrichData.companySummary && (
                    <p className="text-slate-600 leading-relaxed">{enrichData.companySummary}</p>
                  )}
                  {enrichData.executives && (
                    <p><strong>Jednatelé / Vedení:</strong> {enrichData.executives}</p>
                  )}
                  {enrichData.foundWebsite && (
                    <p><strong>Web:</strong> <a href={enrichData.foundWebsite} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">{enrichData.foundWebsite}</a></p>
                  )}
                </div>
              </div>

              {/* MS Region Branches Found */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <div className="flex items-center gap-2 text-amber-950">
                    <Store size={15} className="text-amber-600" />
                    <h4 className="font-bold text-xs uppercase">Pobočky v MS Kraji ({enrichData.msRegionBranches?.length || 0})</h4>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    ULOŽENO DO POBOČEK
                  </span>
                </div>
                {enrichData.msRegionBranches && enrichData.msRegionBranches.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {enrichData.msRegionBranches.map((b, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-white border border-amber-200/60 flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-slate-900">{b.name}</strong>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1">
                            <MapPin size={11} className="text-amber-600 shrink-0" />
                            <span>{b.street ? `${b.street}, ` : ''}{b.city}</span>
                          </div>
                        </div>
                        <a href={`/clients/${clientId}?tab=branches`} className="text-[11px] text-sky-600 font-bold hover:underline shrink-0">
                          ✏️ Upravit adresu
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Žádné krajské pobočky nedohledány.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
