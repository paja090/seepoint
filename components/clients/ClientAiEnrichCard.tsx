'use client';

import { useState } from 'react';
import { Sparkles, Building2, ShieldCheck, MapPin, Target, Lightbulb, RefreshCw, CheckCircle2, ArrowRight, FileText, UserCheck, Mail, Phone, Users, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

type ContactPersonFound = {
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
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
        setSavedSuccess(true);
        // Refresh server components & client header with updated Name/IČO/DIČ/Address/Contacts
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
            <h3 className="font-black text-slate-900 text-base">AI Profil Klienta, Presný Název & ARES Rejstřík</h3>
            <p className="text-xs text-slate-500">Automatická korekce názvu, dohledání IČO/DIČ, sídla, kontaktních osob a strategie</p>
          </div>
        </div>

        <button
          onClick={() => handleEnrich()}
          disabled={loading}
          className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700 active:scale-95 transition shadow-md disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'AI Výběr presné firmy v ARES...' : '✨ AI Dohledat & Opravit název'}</span>
        </button>
      </div>

      {/* Manual Search Query Refinement */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl bg-white p-2 border border-sky-100 shadow-2xs">
        <div className="flex items-center gap-2 px-2 text-slate-400 shrink-0">
          <Search size={15} />
          <span className="text-xs font-bold text-slate-600">Upřesnit hledaný název nebo IČO:</span>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Např. "${clientName} Safety" nebo "25877698"`}
          className="flex-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-900 border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-medium"
        />
        <button
          onClick={() => handleEnrich(searchQuery)}
          disabled={loading || !searchQuery.trim()}
          className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition disabled:opacity-40 shrink-0"
        >
          Vyhledat
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
              Oficiální název ({ares?.name || enrichData?.selectedOfficialName || clientName}), IČO, DIČ, Sídlo a Obor byly zapsány do profilu!
            </span>
          </div>
          {createdContactsCount > 0 && (
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white">
              +{createdContactsCount} KONTAKT V ZÁLOŽCE KONTAKTY
            </span>
          )}
        </div>
      )}

      {/* Initial State Hint */}
      {!enrichData && !ares && !loading && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3.5 border border-sky-100 text-xs text-slate-600">
          <Building2 size={20} className="text-sky-500 shrink-0" />
          <p>
            Klikněte na tlačítko výše. AI vyhledá firmu <strong>{clientName}</strong> v rejstříku ARES, vybere přesnou shodu (např. <em>CANIS SAFETY a.s.</em>), **opraví oficiální název klienta, doplní IČO/DIČ, kontakty** a vygeneruje reklamní strategii.
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
          {/* Verified Legal Name & IČO Pill */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong>Právní název:</strong> {ares?.name || enrichData?.selectedOfficialName || clientName}
              </span>
              <span>
                <strong>IČO:</strong> {ares?.ico || enrichData?.foundIco || companyId || 'Nenalezeno'}
              </span>
              <span>
                <strong>DIČ:</strong> {ares?.dic || enrichData?.foundDic || dic || 'Neuvedeno'}
              </span>
              {(ares?.address || enrichData?.foundCity) && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-emerald-700" />
                  {ares?.address || `${enrichData?.foundStreet || ''}, ${enrichData?.foundCity || ''}`}
                </span>
              )}
            </div>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white uppercase">
              OVRĚNO V ARES
            </span>
          </div>

          {/* Contact Persons Found */}
          {enrichData?.contactPersons && enrichData.contactPersons.length > 0 && (
            <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-sky-600" />
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                    Nalezené kontaktní osoby (uloženy v záložce Kontakty)
                  </h4>
                </div>
                <a
                  href={`/clients/${clientId}?tab=contacts`}
                  className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1"
                >
                  <span>Zobrazit v Kontaktech</span>
                  <ArrowRight size={12} />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {enrichData.contactPersons.map((cp, i) => (
                  <div key={i} className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">{cp.firstName} {cp.lastName}</span>
                      {cp.title && (
                        <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                          {cp.title}
                        </span>
                      )}
                    </div>
                    {cp.email && (
                      <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                        <Mail size={12} className="text-sky-600 shrink-0" />
                        <a href={`mailto:${cp.email}`} className="hover:underline">{cp.email}</a>
                      </div>
                    )}
                    {cp.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                        <Phone size={12} className="text-sky-600 shrink-0" />
                        <a href={`tel:${cp.phone}`} className="hover:underline">{cp.phone}</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
                    <strong>Statutární orgány / Vedení:</strong> {enrichData.executives}
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
