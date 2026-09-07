'use client';

import { useState } from 'react';
import { Sparkles, Building2, ShieldCheck, MapPin, Target, Lightbulb, RefreshCw, CheckCircle2, Search, Store, Save, Plus, Users } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrichData, setEnrichData] = useState<AiEnrichmentData | null>(null);
  const [ares, setAres] = useState<AresData | null>(null);
  const [proposalReady, setProposalReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saving states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfileMsg, setSavedProfileMsg] = useState<string | null>(null);

  const [savingBranches, setSavingBranches] = useState(false);
  const [savedBranchIndices, setSavedBranchIndices] = useState<number[]>([]);
  const [branchesMsg, setBranchesMsg] = useState<string | null>(null);

  const [savingContacts, setSavingContacts] = useState(false);
  const [savedContactIndices, setSavedContactIndices] = useState<number[]>([]);
  const [contactsMsg, setContactsMsg] = useState<string | null>(null);

  const handleEnrich = async (overrideQuery?: string) => {
    setLoading(true);
    setError(null);
    setProposalReady(false);
    setSavedProfileMsg(null);
    setBranchesMsg(null);
    setContactsMsg(null);
    setSavedBranchIndices([]);
    setSavedContactIndices([]);
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
        setProposalReady(true);
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Chyba spojení.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToProfile = async () => {
    setSavingProfile(true);
    setSavedProfileMsg(null);
    try {
      let normWeb = enrichData?.foundWebsite || website || undefined;
      if (normWeb && !normWeb.startsWith('http://') && !normWeb.startsWith('https://')) {
        normWeb = 'https://' + normWeb;
      }

      const res = await fetch(`/api/crm/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: enrichData?.selectedOfficialName || ares?.name || clientName,
          tradingName: enrichData?.tradingName || undefined,
          companyId: (ares?.ico || enrichData?.foundIco || companyId || '').replace(/\s+/g, '') || undefined,
          dic: (ares?.dic || enrichData?.foundDic || dic || '').replace(/\s+/g, '') || undefined,
          billingStreet: enrichData?.foundStreet || undefined,
          billingCity: enrichData?.foundCity || undefined,
          billingZip: enrichData?.foundZip || undefined,
          website: normWeb,
          email: enrichData?.foundEmail || undefined,
          phone: enrichData?.foundPhone || undefined,
          note: enrichData?.companySummary ? enrichData.companySummary : undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'Chyba při ukládání do profilu klienta.');
      } else {
        setSavedProfileMsg('✅ Údaje byly úspěšně uloženy do profilu klienta v CRM.');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch {
      alert('Chyba při komunikaci se serverem.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSingleBranch = async (b: BranchFound, idx: number) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: b.name,
          street: b.street || undefined,
          city: b.city || undefined,
          zip: b.zip || undefined,
          country: 'CZ',
          note: b.note || 'Dohledáno AI v MS kraji',
        }),
      });
      if (res.ok) {
        setSavedBranchIndices((prev) => [...prev, idx]);
      } else {
        const err = await res.json();
        alert(err.error || 'Chyba při ukládání pobočky.');
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    }
  };

  const handleSaveAllBranches = async () => {
    if (!enrichData?.msRegionBranches?.length) return;
    setSavingBranches(true);
    setBranchesMsg(null);
    let count = 0;
    try {
      for (let i = 0; i < enrichData.msRegionBranches.length; i++) {
        if (savedBranchIndices.includes(i)) continue;
        const b = enrichData.msRegionBranches[i];
        const res = await fetch(`/api/crm/clients/${clientId}/branches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: b.name,
            street: b.street || undefined,
            city: b.city || undefined,
            zip: b.zip || undefined,
            country: 'CZ',
            note: b.note || 'Dohledáno AI v MS kraji',
          }),
        });
        if (res.ok) {
          count++;
          setSavedBranchIndices((prev) => [...prev, i]);
        }
      }
      setBranchesMsg(`✅ Uloženo ${count} poboček do záložky Pobočky v CRM.`);
    } catch {
      alert('Chyba při ukládání poboček.');
    } finally {
      setSavingBranches(false);
    }
  };

  const handleSaveSingleContact = async (c: ContactPersonFound, idx: number) => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: c.firstName || 'Kontakt',
          lastName: c.lastName || 'Klienta',
          title: c.title || undefined,
          email: c.email || undefined,
          phone: c.phone || undefined,
          isCommercial: true,
        }),
      });
      if (res.ok) {
        setSavedContactIndices((prev) => [...prev, idx]);
      } else {
        const err = await res.json();
        alert(err.error || 'Chyba při ukládání kontaktu.');
      }
    } catch {
      alert('Chyba komunikace se serverem.');
    }
  };

  const handleSaveAllContacts = async () => {
    if (!enrichData?.contactPersons?.length) return;
    setSavingContacts(true);
    setContactsMsg(null);
    let count = 0;
    try {
      for (let i = 0; i < enrichData.contactPersons.length; i++) {
        if (savedContactIndices.includes(i)) continue;
        const c = enrichData.contactPersons[i];
        const res = await fetch(`/api/crm/clients/${clientId}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: c.firstName || 'Kontakt',
            lastName: c.lastName || 'Klienta',
            title: c.title || undefined,
            email: c.email || undefined,
            phone: c.phone || undefined,
            isCommercial: true,
          }),
        });
        if (res.ok) {
          count++;
          setSavedContactIndices((prev) => [...prev, i]);
        }
      }
      setContactsMsg(`✅ Uloženo ${count} kontaktů do záložky Kontakty v CRM.`);
    } catch {
      alert('Chyba při ukládání kontaktů.');
    } finally {
      setSavingContacts(false);
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
              <h3 className="font-black text-slate-900 text-base">ARES údaje a AI návrhy pro obchodníka</h3>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-900 uppercase">
                🔎 NÁVRH K RUČNÍMU OVĚŘENÍ
              </span>
            </div>
            <p className="text-xs text-slate-500">ARES poskytne rejstříkové údaje; webové kontakty, pobočky a doporučení AI je nutné před použitím ověřit.</p>
          </div>
        </div>

        <button
          onClick={() => handleEnrich()}
          disabled={loading}
          className="flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-700 active:scale-95 transition shadow-md disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Načítám ARES a připravuji návrhy...' : '🔍 Načíst návrhy bez změny klienta'}</span>
        </button>
      </div>

      {/* Manual Search Query Refinement */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl bg-white p-2 border border-sky-100 shadow-2xs">
        <div className="flex items-center gap-2 px-2 text-slate-400 shrink-0">
          <Search size={15} />
          <span className="text-xs font-bold text-slate-600">Zadat název nebo přesné IČO:</span>
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

      {proposalReady && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 font-bold animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>Návrhy pro {ares?.name || enrichData?.selectedOfficialName || clientName} jsou připravené. Do CRM nebylo nic automaticky uloženo.</span>
            </div>
          </div>

          {/* Action Bar: Save verified data directly into client profile */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-emerald-200 shadow-sm">
            <div className="text-xs text-slate-700">
              <span className="font-bold text-slate-900">Chcete tyto ověřené údaje zapsat do klienta?</span>
              <p className="text-[11px] text-slate-500">Uloží se název, IČO, DIČ, sídlo, web, e-mail, telefon a profil do CRM.</p>
            </div>
            <button
              onClick={handleSaveToProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save size={15} />
              <span>{savingProfile ? 'Ukládám do profilu...' : '💾 Uložit ověřené údaje do profilu'}</span>
            </button>
          </div>

          {savedProfileMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-100 p-3 text-xs text-emerald-950 font-bold">
              <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
              <span>{savedProfileMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Initial State Hint */}
      {!enrichData && !ares && !loading && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3.5 border border-sky-100 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <Building2 size={20} className="text-sky-500 shrink-0" />
            <p>
              Kliknutím na <strong>„Načíst návrhy bez změny klienta“</strong> získáte rejstříkové údaje z ARES a pomocné AI návrhy. Kontakty ani pobočky se bez lidské kontroly nezapisují.
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
                  Nalezeno ve státním rejstříku ARES
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
                  {enrichData.foundEmail && (
                    <p><strong>E-mail:</strong> {enrichData.foundEmail}</p>
                  )}
                  {enrichData.foundPhone && (
                    <p><strong>Telefon:</strong> {enrichData.foundPhone}</p>
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      NÁVRH – NEULOŽENO
                    </span>
                    {enrichData.msRegionBranches && enrichData.msRegionBranches.length > 0 && (
                      <button
                        onClick={handleSaveAllBranches}
                        disabled={savingBranches || savedBranchIndices.length === enrichData.msRegionBranches.length}
                        className="flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>{savedBranchIndices.length === enrichData.msRegionBranches.length ? '✓ Vše uloženo' : savingBranches ? 'Ukládám...' : 'Uložit vše'}</span>
                      </button>
                    )}
                  </div>
                </div>
                {branchesMsg && (
                  <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100 p-2 rounded-xl">
                    {branchesMsg}
                  </div>
                )}
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
                        <button
                          onClick={() => handleSaveSingleBranch(b, idx)}
                          disabled={savedBranchIndices.includes(idx)}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-bold hover:bg-amber-200 transition disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {savedBranchIndices.includes(idx) ? '✓ Uloženo' : '+ Uložit'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Žádné krajské pobočky nedohledány.</p>
                )}
              </div>

              {/* Contact Persons Found */}
              {enrichData.contactPersons && enrichData.contactPersons.length > 0 && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-2 col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                    <div className="flex items-center gap-2 text-sky-950">
                      <Users size={15} className="text-sky-600" />
                      <h4 className="font-bold text-xs uppercase">Dohledané kontaktní osoby ({enrichData.contactPersons.length})</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                        NÁVRH – NEULOŽENO
                      </span>
                      <button
                        onClick={handleSaveAllContacts}
                        disabled={savingContacts || savedContactIndices.length === enrichData.contactPersons.length}
                        className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-sky-700 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Plus size={11} />
                        <span>{savedContactIndices.length === enrichData.contactPersons.length ? '✓ Vše uloženo' : savingContacts ? 'Ukládám...' : 'Uložit kontakty do CRM'}</span>
                      </button>
                    </div>
                  </div>
                  {contactsMsg && (
                    <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100 p-2 rounded-xl">
                      {contactsMsg}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {enrichData.contactPersons.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white border border-sky-200/70 flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-slate-900">{c.firstName} {c.lastName}</strong>
                          {c.title && <span className="text-slate-500 text-[11px] ml-1.5">({c.title})</span>}
                          <div className="text-[11px] text-slate-600 space-y-0.5 mt-1">
                            {c.email && <div>✉️ {c.email}</div>}
                            {c.phone && <div>📞 {c.phone}</div>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveSingleContact(c, idx)}
                          disabled={savedContactIndices.includes(idx)}
                          className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 text-[10px] font-bold hover:bg-sky-200 transition disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {savedContactIndices.includes(idx) ? '✓ Uloženo' : '+ Uložit'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sales Advice & Tips for Salesperson */}
              {enrichData.salesAdvice && enrichData.salesAdvice.length > 0 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2 col-span-1 md:col-span-2">
                  <div className="flex items-center gap-2 text-indigo-950 border-b border-indigo-200/80 pb-2">
                    <Lightbulb size={16} className="text-indigo-600" />
                    <h4 className="font-bold text-xs uppercase">💡 Tipy pro obchodníka (Zacílení MS kraj)</h4>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-800 font-medium">
                    {enrichData.salesAdvice.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                        <span className="text-indigo-600 font-bold shrink-0">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended SeePoint Advertising Strategy */}
              {enrichData.recommendedCarriers && enrichData.recommendedCarriers.length > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2 col-span-1 md:col-span-2">
                  <div className="flex items-center gap-2 text-emerald-950 border-b border-emerald-200/80 pb-2">
                    <Target size={16} className="text-emerald-600" />
                    <h4 className="font-bold text-xs uppercase">🎯 Doporučená reklamní strategie SeePoint (Ostrava & MS kraj)</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {enrichData.recommendedCarriers.map((rec, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white border border-emerald-200/70 space-y-1 flex flex-col justify-between">
                        <div className="font-extrabold text-xs text-emerald-950">{rec.type}</div>
                        <p className="text-[11px] text-slate-600 leading-snug">{rec.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
