'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  GitMerge,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { DuplicateGroup } from '@/lib/crm/duplicates-service';

export function ClientDuplicatesModalButton({
  initialGroups = [],
  totalDuplicates = 0,
}: {
  initialGroups?: DuplicateGroup[];
  totalDuplicates?: number;
}) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>(initialGroups);
  const [loading, setLoading] = useState(false);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [autoMerging, setAutoMerging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const router = useRouter();

  const fetchDuplicates = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/crm/clients/duplicates');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (e) {
      console.error('Fetch duplicates error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    void fetchDuplicates();
  };

  const handleMergePair = async (targetClientId: string, sourceClientId: string, key: string) => {
    if (!confirm('Opravdu chcete sloučit tohoto duplicitního klienta do hlavního profilu? Všechny zakázky, nabídky a plochy budou převedeny.')) {
      return;
    }

    setMergingKey(key);
    setFeedback(null);
    try {
      const res = await fetch('/api/crm/clients/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_pair',
          targetClientId,
          sourceClientId,
        }),
      });

      if (res.ok) {
        setFeedback('✅ Klient byl úspěšně sloučen do hlavního profilu.');
        await fetchDuplicates();
        router.refresh();
      } else {
        const err = await res.json();
        setFeedback(`❌ Chyba: ${err.error || 'Sloučení se nezdařilo.'}`);
      }
    } catch {
      setFeedback('❌ Nastala neočekávaná chyba při komunikaci se serverem.');
    } finally {
      setMergingKey(null);
    }
  };

  const handleAutoMergeAll = async () => {
    const autoMergeEligibleCount = groups
      .filter((g) => g.canAutoMerge)
      .reduce((sum, g) => sum + g.duplicates.length, 0);

    if (autoMergeEligibleCount === 0) {
      alert('Nebyly nalezeny žádné jednoznačné duplicity k automatickému sloučení.');
      return;
    }

    if (
      !confirm(
        `Opravdu chcete sloučit všech ${autoMergeEligibleCount} jednoznačných duplicitních záznamů? Všechny vazby budou bezpečně zachovány pod hlavními profily firem.`
      )
    ) {
      return;
    }

    setAutoMerging(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/crm/clients/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_merge_all' }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback(
          `🎉 Úspěšně sloučeno ${data.summary?.totalMerged || autoMergeEligibleCount} duplicitních klientů.`
        );
        await fetchDuplicates();
        router.refresh();
      } else {
        const err = await res.json();
        setFeedback(`❌ Chyba: ${err.error || 'Automatické sloučení selhalo.'}`);
      }
    } catch {
      setFeedback('❌ Nastala chyba při automatickém slučování.');
    } finally {
      setAutoMerging(false);
    }
  };

  const autoMergeEligibleCount = groups
    .filter((g) => g.canAutoMerge)
    .reduce((sum, g) => sum + g.duplicates.length, 0);

  const displayCount = totalDuplicates || groups.reduce((acc, g) => acc + g.duplicates.length, 0);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
          displayCount > 0
            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 animate-pulse'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
        }`}
      >
        <GitMerge size={14} className={displayCount > 0 ? 'text-amber-700' : 'text-slate-500'} />
        <span>Sjednotit duplicity</span>
        {displayCount > 0 && (
          <span className="ml-1 bg-amber-600 text-white rounded-full px-1.5 py-0.2 text-[10px] font-black">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 text-slate-900 animate-in fade-in duration-150">
          <div className="card max-w-4xl w-full bg-white max-h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <GitMerge size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Sjednocení a deduplikace klientů v CRM
                  </h3>
                  <p className="text-xs text-slate-500">
                    Nalezené duplicitní účty téže firmy. Sloučením se převedou všechny zakázky, nabídky, plochy i kontakty pod hlavní profil.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 rounded-lg p-1.5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-toolbar */}
            <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-950">
                  Celkem nalezeno: {groups.length} skupin ({groups.reduce((acc, g) => acc + g.duplicates.length, 0)} duplicitních záznamů)
                </span>
                {loading && <Loader2 size={14} className="animate-spin text-amber-700" />}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={fetchDuplicates}
                  disabled={loading}
                  className="text-xs flex items-center gap-1"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  <span>Obnovit</span>
                </Button>

                {autoMergeEligibleCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAutoMergeAll}
                    disabled={autoMerging || loading}
                    className="!bg-purple-600 hover:!bg-purple-700 !text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    {autoMerging ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span>Sloučit všech {autoMergeEligibleCount} jednoznačných duplicit</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Notification / Feedback */}
            {feedback && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-slate-100 border text-xs font-semibold flex items-center justify-between">
                <span>{feedback}</span>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Content list */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {groups.length === 0 && !loading ? (
                <div className="text-center py-12 space-y-3">
                  <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">Vše je čisté a sjednocené!</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    V databázi nebyly nalezeny žádné duplicitní profily klientů podle IČO ani shodných názvů.
                  </p>
                </div>
              ) : (
                groups.map((group) => {
                  const target = group.canonicalClient;
                  return (
                    <div
                      key={group.key}
                      className="border rounded-2xl p-4 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${
                              group.matchType === 'ICO'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : group.canAutoMerge
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {group.matchType === 'ICO' ? 'IČO Shoda' : 'Podobný název'}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {group.matchReason}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {group.totalRecordsInGroup} záznamy
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                        {/* Canonical (Target) Profile */}
                        <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                                🌟 Hlavní profil (zůstane zachován)
                              </span>
                              <span className="font-mono text-[10px] text-emerald-900 bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                                {target.id.slice(-8)}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-sm text-slate-900 mt-1">
                              {target.name}
                            </h4>
                            <div className="text-xs text-slate-600 space-y-0.5 mt-1 font-medium">
                              <div>IČO: <strong className="text-slate-800">{target.companyId || 'neuvedeno'}</strong></div>
                              {target.email && <div>E-mail: {target.email}</div>}
                              {target.billingCity && <div>Město: {target.billingCity}</div>}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-emerald-200 text-[11px] flex flex-wrap gap-2 text-emerald-950 font-bold">
                            <span>📦 Zakázky: {target.ordersCount}</span>
                            <span>📄 Nabídky: {target.offersCount}</span>
                            <span>🎯 Plochy: {target.occupanciesCount}</span>
                            <span>🏗️ Nosiče: {target.surfacesCount}</span>
                            <span>🧾 Faktury: {target.invoicesCount}</span>
                          </div>
                        </div>

                        {/* Duplicates to Merge */}
                        <div className="space-y-2">
                          {group.duplicates.map((dup) => {
                            const isMergingThis = mergingKey === `${target.id}-${dup.id}`;
                            return (
                              <div
                                key={dup.id}
                                className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold uppercase text-slate-500">
                                    Duplicitní záznam k převedení
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {dup.id.slice(-8)}
                                  </span>
                                </div>
                                <h4 className="font-bold text-sm text-slate-800">
                                  {dup.name}
                                </h4>
                                <div className="text-xs text-slate-500 space-y-0.5 font-medium">
                                  <div>IČO: {dup.companyId || 'neuvedeno'}</div>
                                  {dup.email && <div>E-mail: {dup.email}</div>}
                                </div>

                                <div className="pt-1.5 border-t text-[11px] flex items-center justify-between gap-2">
                                  <div className="flex flex-wrap gap-1.5 text-slate-600 font-semibold">
                                    {dup.ordersCount > 0 && <span>📦 {dup.ordersCount}</span>}
                                    {dup.offersCount > 0 && <span>📄 {dup.offersCount}</span>}
                                    {dup.occupanciesCount > 0 && <span>🎯 {dup.occupanciesCount}</span>}
                                    {dup.surfacesCount > 0 && <span>🏗️ {dup.surfacesCount}</span>}
                                    {dup.invoicesCount > 0 && <span>🧾 {dup.invoicesCount}</span>}
                                    {dup.ordersCount === 0 && dup.offersCount === 0 && dup.occupanciesCount === 0 && (
                                      <span className="text-slate-400 italic">žádná data</span>
                                    )}
                                  </div>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleMergePair(target.id, dup.id, `${target.id}-${dup.id}`)}
                                    disabled={Boolean(mergingKey)}
                                    className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 px-2.5 py-1"
                                  >
                                    {isMergingThis ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <ArrowRight size={12} />
                                    )}
                                    <span>Sloučit sem</span>
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-6 py-3 bg-slate-50 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600" />
                <span>Při sloučení zůstává historie zakázek i dokladů 100% zachována.</span>
              </div>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Zavřít
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
