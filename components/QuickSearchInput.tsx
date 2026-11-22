'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Building2, User, Car, X, Loader2, ArrowRight, Store, Briefcase } from 'lucide-react';

interface CarrierResult {
  id: string;
  name: string;
  code: string;
  city: string;
  address?: string | null;
  status: string;
}

interface ClientResult {
  id: string;
  name: string;
  clientType?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  billingCity?: string | null;
}

interface BranchResult {
  id: string;
  clientId: string;
  name: string;
  code?: string | null;
  city?: string | null;
  street?: string | null;
  client: { id: string; name: string };
}

interface OrderResult {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  clientId: string;
  agencyName?: string | null;
  client: { id: string; name: string };
  agencyClient?: { id: string; name: string } | null;
  branch?: { id: string; name: string; city?: string | null } | null;
}

interface EmployeeResult {
  id: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  phone?: string | null;
}

interface VehicleResult {
  id: string;
  name: string;
  registrationNumber?: string | null;
  status: string;
}

interface SearchResults {
  carriers: CarrierResult[];
  clients: ClientResult[];
  branches?: BranchResult[];
  orders?: OrderResult[];
  employees: EmployeeResult[];
  vehicles: VehicleResult[];
}

export function QuickSearchInput() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch search results on input change (debounced)
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/quick-search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // Ignore errors
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(url: string) {
    setOpen(false);
    setQuery('');
    setResults(null);
    router.push(url);
  }

  const branches = results?.branches ?? [];
  const orders = results?.orders ?? [];

  const hasResults =
    results &&
    (results.carriers.length > 0 ||
      results.clients.length > 0 ||
      branches.length > 0 ||
      orders.length > 0 ||
      results.employees.length > 0 ||
      results.vehicles.length > 0);

  return (
    <div ref={containerRef} className="relative min-w-[160px] max-w-md flex-1">
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Hledat nosiče, klienty, agentury, pobočky, zakázky…"
          className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-14 text-xs xl:text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition shadow-2xs"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery('');
              setResults(null);
            }}
            className="absolute right-2.5 rounded-lg p-0.5 text-slate-400 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="absolute right-2.5 hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:inline-block shadow-2xs">
            Ctrl K
          </kbd>
        )}
      </div>

      {/* Results Dropdown */}
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-[32rem] overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl border border-slate-200 divide-y divide-slate-100 animate-in fade-in zoom-in-95">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs font-semibold text-slate-500 gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-600" />
              <span>Vyhledávám v systémové databázi…</span>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <p className="font-bold text-slate-700">Žádné výsledky pro „{query}“</p>
              <p className="mt-1">Zkuste zadat název klienta, agentury, pobočky, číslo zakázky nebo kód nosiče.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* CRM Klienti & Agentury */}
              {results.clients.length > 0 && (
                <div>
                  <p className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Building2 size={12} className="text-sky-600" />
                    <span>Klienti & Agentury ({results.clients.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {results.clients.map((cl) => {
                      const isAgency = cl.clientType === 'ADVERTISING_AGENCY' || cl.clientType === 'MEDIA_AGENCY';
                      return (
                        <button
                          key={cl.id}
                          onClick={() => handleSelect(`/clients/${cl.id}`)}
                          className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition group"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-sky-700 flex items-center gap-1.5 flex-wrap">
                              <span>{cl.name}</span>
                              {isAgency && (
                                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-200">
                                  Agentura
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {[cl.contactPerson ? `Kontakt: ${cl.contactPerson}` : null, cl.billingCity, cl.phone]
                                .filter(Boolean)
                                .join(' · ') || 'Otevřít profil klienta'}
                            </p>
                          </div>
                          <ArrowRight size={14} className="text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CRM Zakázky */}
              {orders.length > 0 && (
                <div className={results.clients.length > 0 ? 'pt-2 border-t border-slate-100' : ''}>
                  <p className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Briefcase size={12} className="text-violet-600" />
                    <span>CRM Zakázky ({orders.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {orders.map((o) => {
                      const agencyLabel = o.agencyClient?.name || o.agencyName;
                      return (
                        <button
                          key={o.id}
                          onClick={() => handleSelect(`/clients/${o.clientId}?tab=orders`)}
                          className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition group"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-violet-700 truncate">
                              <span className="font-mono text-[11px] text-slate-400 mr-1.5">{o.orderNumber}</span>
                              {o.title}
                            </p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span>Klient: <strong>{o.client.name}</strong></span>
                              {agencyLabel && <span className="text-violet-700 font-semibold">· Agentura: {agencyLabel}</span>}
                              {o.branch && <span className="text-indigo-700 font-semibold">· 🏬 {o.branch.name}</span>}
                            </p>
                          </div>
                          <ArrowRight size={14} className="text-slate-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pobočky klientů */}
              {branches.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Store size={12} className="text-indigo-600" />
                    <span>Pobočky klientů ({branches.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {branches.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => handleSelect(`/clients/${b.clientId}?tab=branches`)}
                        className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 group-hover:text-indigo-700 truncate">
                            {b.name} {b.code ? <span className="font-mono text-[11px] text-slate-400">({b.code})</span> : null}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {b.client.name} {b.city ? `· ${b.city}` : ''} {b.street ? `· ${b.street}` : ''}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nosiče & Plochy */}
              {results.carriers.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin size={12} className="text-emerald-600" />
                    <span>Nosiče & Plochy ({results.carriers.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {results.carriers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(`/carriers/${c.id}`)}
                        className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition group"
                      >
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-emerald-700">
                            {c.name} <span className="font-mono text-slate-400 text-[11px]">({c.code})</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {c.city} {c.address ? `· ${c.address}` : ''}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tým & Zaměstnanci */}
              {results.employees.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <User size={12} className="text-amber-600" />
                    <span>Tým & Pracovníci ({results.employees.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {results.employees.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => handleSelect(`/team`)}
                        className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition group"
                      >
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-amber-700">
                            {e.firstName} {e.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {e.position || 'Pracovník'} {e.phone ? `· ${e.phone}` : ''}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vozidla & Vozíky */}
              {results.vehicles.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Car size={12} className="text-purple-600" />
                    <span>Vozidla & Vozíky ({results.vehicles.length})</span>
                  </p>
                  <div className="space-y-0.5">
                    {results.vehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSelect(`/vehicles`)}
                        className="w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs hover:bg-slate-50 transition group"
                      >
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-purple-700">{v.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {v.registrationNumber || 'Bez RZ'}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
                      </button>
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
