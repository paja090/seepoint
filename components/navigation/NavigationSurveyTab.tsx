'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Compass,
  MapPin,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Edit3,
  Trash2,
  Send,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  FileText,
  Layers,
  ArrowRight,
} from 'lucide-react';

export function NavigationSurveyTab({ navigationOrderId }: { navigationOrderId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_RECHECK' | 'REJECTED'>('ALL');

  // New Route Form State
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeDesc, setRouteDesc] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);

  // Supervision Action State
  const [supervisionModalCandidate, setSupervisionModalCandidate] = useState<any>(null);
  const [supervisionAction, setSupervisionAction] = useState<'NEEDS_RECHECK' | 'REJECT' | null>(null);
  const [supervisionNote, setSupervisionNote] = useState('');
  const [submittingSupervision, setSubmittingSupervision] = useState(false);

  // Conversion State
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchSurvey = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/navigation/orders/${navigationOrderId}/survey`);
      if (res.ok) {
        const json = await res.json();
        setData(json.survey);
      }
    } catch (e) {
      console.error('Error fetching survey tab data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSurvey();
  }, [navigationOrderId]);

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeName.trim()) return;
    setSavingRoute(true);
    try {
      const res = await fetch(`/api/navigation/orders/${navigationOrderId}/survey/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: routeName.trim(), description: routeDesc.trim() }),
      });
      if (res.ok) {
        setShowRouteModal(false);
        setRouteName('');
        setRouteDesc('');
        fetchSurvey();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Chyba při zakládání trasy.');
      }
    } catch {
      alert('Chyba při ukládání trasy.');
    } finally {
      setSavingRoute(false);
    }
  };

  const handleSupervise = async (candidate: any, action: 'APPROVE' | 'NEEDS_RECHECK' | 'REJECT') => {
    if (action === 'APPROVE') {
      if (!confirm(`Opravdu chcete schválit kandidátní místo "${candidate.label}"?`)) return;
      try {
        const res = await fetch(`/api/navigation/orders/${navigationOrderId}/survey/candidates/${candidate.id}/supervise`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'APPROVE' }),
        });
        if (res.ok) fetchSurvey();
      } catch (e: any) {
        alert(e.message || 'Chyba při schvalování.');
      }
    } else {
      setSupervisionModalCandidate(candidate);
      setSupervisionAction(action);
      setSupervisionNote('');
    }
  };

  const submitSupervisionNote = async () => {
    if (!supervisionModalCandidate || !supervisionAction) return;
    if (!supervisionNote.trim()) {
      alert('Zadejte prosím poznámku nebo důvod.');
      return;
    }
    setSubmittingSupervision(true);
    try {
      const res = await fetch(`/api/navigation/orders/${navigationOrderId}/survey/candidates/${supervisionModalCandidate.id}/supervise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: supervisionAction,
          supervisionNote: supervisionNote.trim(),
        }),
      });
      if (res.ok) {
        setSupervisionModalCandidate(null);
        setSupervisionAction(null);
        fetchSurvey();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Chyba při ukládání supervize.');
      }
    } finally {
      setSubmittingSupervision(false);
    }
  };

  const handleConvert = async (candidateId: string) => {
    setConvertingId(candidateId);
    try {
      const res = await fetch(`/api/navigation/orders/${navigationOrderId}/survey/candidates/${candidateId}/convert`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('✓ Kandidátní místo bylo úspěšně převedeno do nabídky!');
        fetchSurvey();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Chyba při převodu do nabídky.');
      }
    } catch {
      alert('Chyba při převodu.');
    } finally {
      setConvertingId(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
        <RefreshCw size={24} className="animate-spin text-emerald-500" />
        <p className="text-xs font-bold">Načítám podklady průzkumu...</p>
      </div>
    );
  }

  const candidates = data.candidatePoints || [];
  const filteredCandidates = candidates.filter((c: any) => {
    if (activeFilter === 'ALL') return true;
    return c.supervisionStatus === activeFilter;
  });

  const totalCandidates = candidates.length;
  const pendingCount = candidates.filter((c: any) => c.supervisionStatus === 'PENDING_REVIEW').length;
  const approvedCount = candidates.filter((c: any) => c.supervisionStatus === 'APPROVED').length;
  const recheckCount = candidates.filter((c: any) => c.supervisionStatus === 'NEEDS_RECHECK').length;
  const rejectedCount = candidates.filter((c: any) => c.supervisionStatus === 'REJECTED').length;

  return (
    <div className="space-y-6 text-slate-900">
      {/* Top Banner & KPI Grid */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Compass className="text-emerald-600" size={20} />
              <span>Průzkum lokalit v terénu</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cíl: <strong>{data.targetName}</strong> {data.targetAddress ? `(${data.targetAddress})` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRouteModal(true)}
              className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-slate-800 transition"
            >
              <Plus size={14} className="text-emerald-400" />
              <span>Přidat příjezdovou trasu</span>
            </button>
            <a
              href={`/mobile-surveys/${navigationOrderId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-emerald-100 transition"
            >
              <ExternalLink size={14} />
              <span>Otevřít mobilní průzkum</span>
            </a>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`p-3 rounded-2xl border text-left transition ${
              activeFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-[11px] font-bold block">Celkem lokalit</span>
            <strong className="text-xl font-black">{totalCandidates}</strong>
          </button>

          <button
            onClick={() => setActiveFilter('PENDING_REVIEW')}
            className={`p-3 rounded-2xl border text-left transition ${
              activeFilter === 'PENDING_REVIEW' ? 'bg-sky-900 text-white border-sky-900 shadow-md' : 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100'
            }`}
          >
            <span className="text-[11px] font-bold block">⏳ Čeká na kontrolu</span>
            <strong className="text-xl font-black text-sky-700">{pendingCount}</strong>
          </button>

          <button
            onClick={() => setActiveFilter('APPROVED')}
            className={`p-3 rounded-2xl border text-left transition ${
              activeFilter === 'APPROVED' ? 'bg-emerald-900 text-white border-emerald-900 shadow-md' : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <span className="text-[11px] font-bold block">✓ Schváleno</span>
            <strong className="text-xl font-black text-emerald-700">{approvedCount}</strong>
          </button>

          <button
            onClick={() => setActiveFilter('NEEDS_RECHECK')}
            className={`p-3 rounded-2xl border text-left transition ${
              activeFilter === 'NEEDS_RECHECK' ? 'bg-amber-900 text-white border-amber-900 shadow-md' : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span className="text-[11px] font-bold block">↻ K prověření</span>
            <strong className="text-xl font-black text-amber-700">{recheckCount}</strong>
          </button>

          <button
            onClick={() => setActiveFilter('REJECTED')}
            className={`p-3 rounded-2xl border text-left transition ${
              activeFilter === 'REJECTED' ? 'bg-rose-900 text-white border-rose-900 shadow-md' : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100'
            }`}
          >
            <span className="text-[11px] font-bold block">✕ Zamítnuto</span>
            <strong className="text-xl font-black text-rose-700">{rejectedCount}</strong>
          </button>
        </div>

        {/* Arrival Routes Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 text-xs">
          <span className="font-bold text-slate-500 shrink-0">Příjezdové trasy ({data.surveyRoutes.length}):</span>
          {data.surveyRoutes.length === 0 ? (
            <span className="text-slate-400 italic">Zatím nebyly zadané žádné trasy</span>
          ) : (
            data.surveyRoutes.map((r: any) => (
              <span key={r.id} className="bg-slate-100 text-slate-800 px-3 py-1 rounded-xl border border-slate-200 font-bold shrink-0">
                🚗 {r.name}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Candidates List / Supervision Table */}
      <div className="space-y-4">
        {filteredCandidates.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
            <Compass size={32} className="mx-auto text-slate-400" />
            <h3 className="font-extrabold text-slate-800 text-sm">Žádné kandidátní lokality pro tento filtr</h3>
            <p className="text-xs text-slate-500">Pracovníci v terénu mohou přidávat místa přes mobilní rozhraní.</p>
          </div>
        ) : (
          filteredCandidates.map((c: any) => (
            <div key={c.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base text-slate-900">{c.label}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      c.supervisionStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      c.supervisionStatus === 'NEEDS_RECHECK' ? 'bg-amber-100 text-amber-800' :
                      c.supervisionStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      'bg-sky-100 text-sky-800'
                    }`}>
                      {c.supervisionStatus === 'APPROVED' ? '✓ SCHVÁLENO' :
                       c.supervisionStatus === 'NEEDS_RECHECK' ? '↻ K PROVĚŘENÍ' :
                       c.supervisionStatus === 'REJECTED' ? '✕ ZAMÍTNUTO' :
                       '⏳ ČEKÁ NA SUPERVIZI'}
                    </span>
                    {c.convertedNavigationPointId && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                        ✓ PŘEDÁNO DO NABÍDKY
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-2 font-mono">
                    <MapPin size={13} className="text-sky-500" />
                    <span>GPS: {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}</span>
                    {c.distanceValue && <span className="font-bold text-slate-800">({c.distanceValue} km k cíli)</span>}
                  </p>
                </div>

                {/* Supervision Action Bar */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => handleSupervise(c, 'APPROVE')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                  >
                    ✓ SCHVÁLIT
                  </button>
                  <button
                    onClick={() => handleSupervise(c, 'NEEDS_RECHECK')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition"
                  >
                    ↻ VRÁTIT K PROVĚŘENÍ
                  </button>
                  <button
                    onClick={() => handleSupervise(c, 'REJECT')}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs transition"
                  >
                    ✕ ZAMÍTNOUT
                  </button>

                  {c.supervisionStatus === 'APPROVED' && !c.convertedNavigationPointId && (
                    <button
                      onClick={() => handleConvert(c.id)}
                      disabled={convertingId === c.id}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition"
                    >
                      {convertingId === c.id ? 'Převádím...' : 'PŘIDAT DO NABÍDKY'}
                    </button>
                  )}
                </div>
              </div>

              {/* Details & Photos Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="font-bold text-slate-700 block">Vlastnosti příjezdu & nosiče:</span>
                  <p>Trasa: <strong className="text-slate-900">{c.surveyRoute?.name || 'Obecná'}</strong></p>
                  <p>Typ nosiče: <strong className="text-slate-900">{c.placementType}</strong></p>
                  <p>Orientace šipky: <strong className="text-slate-900">{c.arrowDirection || 'ROVNĚ'}</strong></p>
                  <p>Viditelnost: <strong className="text-slate-900">{c.visibilityTowardTarget === 'GOOD' ? '✅ Dobrá' : '⚠️ K ověření'}</strong></p>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="font-bold text-slate-700 block">Vlastnictví & Povolení:</span>
                  <p>Vlastník: <strong className="text-slate-900">{c.ownershipType}</strong></p>
                  <p>Stav povolení: <strong className="text-slate-900">{c.permitStatus}</strong></p>
                  <p>Autor průzkumu: <strong className="text-slate-900">{c.createdByUser?.name || 'Pracovník'}</strong></p>
                  {c.internalNote && <p className="italic text-slate-600 mt-1">„{c.internalNote}“</p>}
                </div>

                {/* Photos */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="font-bold text-slate-700 block">Fotografie ({c.photos.length}):</span>
                  {c.photos.length === 0 ? (
                    <p className="text-slate-400 italic">Bez fotografií</p>
                  ) : (
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {c.photos.map((p: any) => (
                        <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative size-14 rounded-xl overflow-hidden border border-slate-300 shrink-0 block">
                          <Image src={p.url} alt={c.label} fill className="object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Supervision Reason Note if existing */}
              {c.supervisionNote && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                  <strong>Poznámka ze supervize:</strong> {c.supervisionNote}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Arrival Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-w-md w-full bg-white space-y-4 p-5 rounded-3xl shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-slate-900">🚗 Přidat novou příjezdovou trasu</h3>
              <button onClick={() => setShowRouteModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleAddRoute} className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Název trasy *
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  required
                  placeholder="Např. Petřkovice → Centrum služeb"
                  className="input text-xs mt-1"
                />
              </label>
              <label className="text-xs font-bold text-slate-700 block">Popis trasy
                <textarea
                  value={routeDesc}
                  onChange={(e) => setRouteDesc(e.target.value)}
                  rows={2}
                  placeholder="Např. Hlavní příjezdová komunikace od Ostravy"
                  className="input text-xs mt-1"
                />
              </label>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setShowRouteModal(false)} className="btn variant-secondary text-xs">Zrušit</button>
                <button type="submit" disabled={savingRoute} className="btn bg-emerald-600 text-white font-bold text-xs">
                  {savingRoute ? 'Ukládám...' : 'Uložit trasu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervision Note Modal */}
      {supervisionModalCandidate && supervisionAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-w-md w-full bg-white space-y-4 p-5 rounded-3xl shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-base text-slate-900">
                {supervisionAction === 'NEEDS_RECHECK' ? '↻ Vrátit k prověření v terénu' : '✕ Zamítnout kandidátní místo'}
              </h3>
              <button onClick={() => setSupervisionModalCandidate(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Zadejte prosím pokyny nebo důvod pro pracovníky pro lokalitu <strong>{supervisionModalCandidate.label}</strong>:
              </p>
              <textarea
                value={supervisionNote}
                onChange={(e) => setSupervisionNote(e.target.value)}
                rows={3}
                required
                placeholder={supervisionAction === 'NEEDS_RECHECK' ? 'Např. Vyfotit z pohledu přijíždějícího řidiče z hlavní cesty' : 'Např. Kolize s jinou reklamou, nevhodná viditelnost'}
                className="input text-xs"
              />
              <div className="flex justify-end gap-2 border-t pt-3">
                <button type="button" onClick={() => setSupervisionModalCandidate(null)} className="btn variant-secondary text-xs">Zrušit</button>
                <button
                  type="button"
                  onClick={submitSupervisionNote}
                  disabled={submittingSupervision}
                  className={`btn text-white font-bold text-xs ${supervisionAction === 'NEEDS_RECHECK' ? 'bg-amber-600' : 'bg-rose-600'}`}
                >
                  {submittingSupervision ? 'Ukládám...' : 'Potvrdit supervizi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
