'use client';

import React, { useState } from 'react';
import type { ElectionRemovalPoint } from '@prisma/client';
import {
  Building2,
  MapPin,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
  FileText,
  Copy,
  Check,
  X,
  Compass,
} from 'lucide-react';
import { LandPermitModal } from '@/components/election-removal/LandPermitModal';
import type { CadastralParcelResult } from '@/lib/cadastre/cuzk-service';
import type { AiScoutedLocation, AiPlotAnalysis } from '@/lib/cadastre/ai-land-scout';

interface LandPermitsViewProps {
  initialPoints: ElectionRemovalPoint[];
}

const CITY_PRESETS = [
  'Ostrava',
  'Praha',
  'Brno',
  'Plzeň',
  'Olomouc',
  'Hradec Králové',
  'České Budějovice',
  'Liberec',
  'Pardubice',
];

export function LandPermitsView({ initialPoints }: LandPermitsViewProps) {
  const [points, setPoints] = useState<ElectionRemovalPoint[]>(initialPoints);
  const [selectedPointForModal, setSelectedPointForModal] = useState<ElectionRemovalPoint | null>(null);

  // Scout Mode Toggle: AI Radar vs Manual GPS
  const [scoutMode, setScoutMode] = useState<'AI_RADAR' | 'MANUAL_GPS'>('AI_RADAR');

  // AI Radar State
  const [aiCity, setAiCity] = useState('Ostrava');
  const [aiFocus, setAiFocus] = useState('ALL');
  const [aiScouting, setAiScouting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiScoutedLocation[]>([]);

  // AI Plot Analysis Modal State
  const [analyzingPlot, setAnalyzingPlot] = useState<ElectionRemovalPoint | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<AiPlotAnalysis | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // New plot identification state (Manual GPS / Selected AI)
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [plotLabel, setPlotLabel] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [savingPlot, setSavingPlot] = useState(false);
  const [identifiedData, setIdentifiedData] = useState<CadastralParcelResult | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [ownershipFilter, setOwnershipFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Run AI Scout
  const handleRunAiScout = async (cityToUse?: string, focusToUse?: string) => {
    const city = (cityToUse || aiCity).trim();
    if (!city) {
      alert('Zadejte město nebo oblast.');
      return;
    }
    setAiScouting(true);
    try {
      const res = await fetch('/api/cadastre/ai-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scout',
          cityOrArea: city,
          preferredFocus: focusToUse || aiFocus,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Dotaz na AI selhal.');
      }
      setAiSuggestions(data.locations || []);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při vyhledávání AI lokalit.');
    } finally {
      setAiScouting(false);
    }
  };

  // Select an AI scouted location and check cadastre
  const handleSelectAiSuggestion = (s: AiScoutedLocation) => {
    setLatInput(s.latitude.toFixed(6));
    setLngInput(s.longitude.toFixed(6));
    setPlotLabel(s.title);
    setScoutMode('MANUAL_GPS');
    handleIdentify(s.latitude, s.longitude);
  };

  // Open AI Analysis Modal for an existing point
  const handleOpenAiAnalysis = async (point: ElectionRemovalPoint) => {
    setAnalyzingPlot(point);
    setAiAnalysisLoading(true);
    setAiAnalysisData(null);
    setCopiedPitch(false);
    try {
      const res = await fetch('/api/cadastre/ai-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          plot: {
            label: point.label,
            parcelNumber: point.parcelNumber,
            cadastralArea: point.cadastralArea,
            landType: point.landType,
            latitude: point.latitude,
            longitude: point.longitude,
            landownerName: point.landownerName,
            monthlyRent: point.monthlyRent ? Number(point.monthlyRent) : null,
          },
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysisData(data.analysis);
      }
    } catch (err) {
      console.error('Error generating AI analysis:', err);
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const handleCopyPitch = () => {
    if (!aiAnalysisData?.outreachLetterTemplate) return;
    navigator.clipboard.writeText(aiAnalysisData.outreachLetterTemplate);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  // GPS Geolocation handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolokace není ve vašem prohlížeči podporována.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLatInput(lat);
        setLngInput(lng);
        handleIdentify(Number(lat), Number(lng));
      },
      (err) => {
        alert(`Nelze načíst polohu: ${err.message}`);
      }
    );
  };

  const handleIdentify = async (lat?: number, lng?: number) => {
    const useLat = lat ?? parseFloat(latInput);
    const useLng = lng ?? parseFloat(lngInput);

    if (isNaN(useLat) || isNaN(useLng)) {
      setMsg({ text: 'Zadejte platné GPS souřadnice (např. 49.8354, 18.2923).', type: 'error' });
      return;
    }

    setIdentifying(true);
    setIdentifiedData(null);
    setMsg(null);

    try {
      const res = await fetch(`/api/cadastre/identify?lat=${useLat}&lng=${useLng}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Dotaz na ČÚZK selhal.');
      }
      if (!data.parcel) {
        setMsg({ text: 'Na těchto souřadnicích nebyla v katastru nalezena parcela.', type: 'error' });
        return;
      }
      setIdentifiedData(data.parcel);
      if (!plotLabel) {
        setPlotLabel(`Lokalita k.ú. ${data.parcel.cadastralAreaName} (p.č. ${data.parcel.parcelNumber})`);
      }
      setMsg({ text: `Parcela č. ${data.parcel.parcelNumber} v k.ú. ${data.parcel.cadastralAreaName} byla úspěšně načtena z ČÚZK!`, type: 'success' });
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : 'Chyba při zjišťování parcely.', type: 'error' });
    } finally {
      setIdentifying(false);
    }
  };

  const handleSaveScoutedPlot = async () => {
    if (!latInput || !lngInput) {
      alert('Vyplňte souřadnice a nechte ověřit parcelu.');
      return;
    }

    setSavingPlot(true);
    try {
      const res = await fetch('/api/cadastre/scout-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: plotLabel || `Pozemek ${identifiedData?.parcelNumber || ''}`,
          latitude: parseFloat(latInput),
          longitude: parseFloat(lngInput),
          parcelNumber: identifiedData?.parcelNumber || null,
          cadastralArea: identifiedData?.cadastralAreaName || null,
          cadastralAreaCode: identifiedData?.cadastralAreaCode || null,
          landArea: identifiedData?.areaSqm || null,
          landType: identifiedData ? `${identifiedData.landTypeName}${identifiedData.landUseName ? ` · ${identifiedData.landUseName}` : ''}` : null,
          landOwnership: 'UNKNOWN',
          permitStatus: 'SCOUTING',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení selhalo.');

      setPoints((prev) => [data.point, ...prev]);
      setIdentifiedData(null);
      setLatInput('');
      setLngInput('');
      setPlotLabel('');
      setMsg({ text: 'Pozemek byl úspěšně zaevidován do SeePOINTu pro další jednání!', type: 'success' });
      setSelectedPointForModal(data.point);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSavingPlot(false);
    }
  };

  // Filtered points
  const filteredPoints = points.filter((p) => {
    if (ownershipFilter !== 'ALL' && p.landOwnership !== ownershipFilter) return false;
    if (statusFilter !== 'ALL' && p.permitStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = p.label.toLowerCase().includes(q);
      const matchArea = p.cadastralArea?.toLowerCase().includes(q);
      const matchParcel = p.parcelNumber?.toLowerCase().includes(q);
      const matchOwner = p.landownerName?.toLowerCase().includes(q);
      if (!matchLabel && !matchArea && !matchParcel && !matchOwner) return false;
    }
    return true;
  });

  const privateCount = points.filter((p) => p.landOwnership === 'PRIVATE_COMPANY' || p.landOwnership === 'PRIVATE_INDIVIDUAL').length;
  const municipalCount = points.filter((p) => p.landOwnership === 'MUNICIPAL' || p.landOwnership === 'STATE').length;
  const approvedCount = points.filter((p) => p.permitStatus === 'AGREED' || p.permitStatus === 'CONTRACT_SIGNED').length;
  const totalRent = points.reduce((sum, p) => sum + (Number(p.monthlyRent) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ČÚZK Katastr nemovitostí & RÚIAN
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Sparkles size={11} className="text-indigo-600" />
              AI Radar lukrativních pozemků
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              ARES propojení
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Pozemky & Povolování reklamních ploch
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Inteligentní AI vytipování lukrativních soukromých pozemků, automatická identifikace parcel podle GPS z Katastru nemovitostí (ČÚZK),
            rozlišení soukromých vs. obecních pozemků, správa nájmů a převod na aktivní nosiče.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-slate-400">Celkem zmapováno</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{points.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">pozemků v evidenci</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-emerald-700">Soukromé pozemky</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{privateCount}</p>
          <p className="mt-0.5 text-xs text-emerald-600">snazší a rychlejší dohoda</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-sky-700">Městské / Státní</p>
          <p className="mt-1 text-2xl font-bold text-sky-900">{municipalCount}</p>
          <p className="mt-0.5 text-xs text-sky-600">schválení radou obce</p>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase text-purple-700">Dohodnuto / Podepsáno</p>
          <p className="mt-1 text-2xl font-bold text-purple-900">{approvedCount}</p>
          <p className="mt-0.5 text-xs text-purple-600">nájem: {totalRent.toLocaleString('cs-CZ')} Kč/měs.</p>
        </div>
      </div>

      {/* Scout Box: AI Radar vs Manual GPS */}
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/30 via-white to-emerald-50/30 p-6 shadow-xs space-y-4">
        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setScoutMode('AI_RADAR')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                scoutMode === 'AI_RADAR'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={14} className="text-indigo-600" />
              <span>⚡ AI Radar lukrativních pozemků</span>
            </button>
            <button
              type="button"
              onClick={() => setScoutMode('MANUAL_GPS')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                scoutMode === 'MANUAL_GPS'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search size={14} className="text-emerald-600" />
              <span>🗺️ Ruční zadání GPS & ČÚZK</span>
            </button>
          </div>

          {scoutMode === 'MANUAL_GPS' && (
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="btn btn-outline text-xs font-semibold flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white border-emerald-300 text-emerald-800"
            >
              <MapPin size={14} className="text-emerald-600" />
              <span>📍 Moje aktuální GPS</span>
            </button>
          )}
        </div>

        {/* 1. AI Radar View */}
        {scoutMode === 'AI_RADAR' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                AI Návrhy zajímavých soukromých pozemků pro reklamu
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Umělá inteligence zanalyzuje klíčové dopravní tahy, frekventované křižovatky a komerční areály ve vybraném městě.
                Navrhne soukromé pozemky s vysokým dosahem a snadným vyjednáním nájmu.
              </p>
            </div>

            {/* City Preset Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium mr-1">Rychlá volba:</span>
              {CITY_PRESETS.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    setAiCity(city);
                    handleRunAiScout(city);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition ${
                    aiCity === city
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            {/* AI Search Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Město / Okres / Oblast</label>
                <input
                  type="text"
                  placeholder="např. Ostrava, Brno-jih, Praha 9..."
                  value={aiCity}
                  onChange={(e) => setAiCity(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Typ zájmových pozemků</label>
                <select
                  value={aiFocus}
                  onChange={(e) => setAiFocus(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-indigo-500 focus:outline-none bg-white"
                >
                  <option value="ALL">Všechny lukrativní pozemky</option>
                  <option value="COMMERCIAL_ZONES">Komerční a retail parky</option>
                  <option value="CROSSROADS">Křižovatky a kruhové objezdy</option>
                  <option value="SERVICES_GAS">Autoservisy a čerpací stanice</option>
                  <option value="LOGISTICS">Průmyslové a logistické areály</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={aiScouting || !aiCity.trim()}
                  onClick={() => handleRunAiScout()}
                  className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl p-2.5 w-full flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {aiScouting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI vyhodnocuje lokality…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>⚡ Vyhledat pozemky pomocí AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Results Grid */}
            {aiSuggestions.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Compass size={14} className="text-indigo-600" />
                  Nalezené strategické pozemky ({aiSuggestions.length}) pro {aiCity}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-xs hover:border-indigo-400 transition space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 mb-1">
                              {s.propertyTypeLabel || 'Soukromý pozemek'}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm leading-snug">{s.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400" />
                              <span>{s.addressOrJunction}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                              ⭐ {s.visibilityScore}/10
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Odhad provozu</span>
                            <span className="font-semibold text-slate-800">🚗 {s.trafficEstimate}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Férový nájem majiteli</span>
                            <span className="font-semibold text-emerald-800">💰 {s.estimatedMonthlyRentCzk?.toLocaleString('cs-CZ')} Kč/měs.</span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-slate-200/50">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Doporučený nosič</span>
                            <span className="font-semibold text-indigo-900">📐 {s.recommendedCarrierType}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                          <strong className="text-slate-800">Proč právě tady:</strong> {s.commercialRationale}
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-1 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                          <strong>💡 Tip pro jednání:</strong> {s.acquisitionTip}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-400">
                          GPS: {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectAiSuggestion(s)}
                          className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded-xl flex items-center gap-1.5 shadow-xs"
                        >
                          <Search size={13} />
                          <span>🎯 Ověřit parcelu v ČÚZK & Převzít</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Manual GPS & Cadastre Resolver */}
        {scoutMode === 'MANUAL_GPS' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                Ověřit parcelu přes Katastr nemovitostí ČÚZK (RÚIAN)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Zadejte GPS souřadnice nalezeného místa v terénu nebo z AI radaru. Systém automaticky zjistí parcelní číslo a katastrální území.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Zeměpisná šířka (Latitude)</label>
                <input
                  type="text"
                  placeholder="např. 49.835400"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Zeměpisná délka (Longitude)</label>
                <input
                  type="text"
                  placeholder="např. 18.292300"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Název lokality / Popis</label>
                <input
                  type="text"
                  placeholder="např. Křižovatka Rudná - plot autoservisu"
                  value={plotLabel}
                  onChange={(e) => setPlotLabel(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  disabled={identifying || !latInput || !lngInput}
                  onClick={() => handleIdentify()}
                  className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl p-2.5 w-full flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {identifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Hledám v ČÚZK…</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Ověřit v ČÚZK</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-300' : 'bg-red-100/70 text-red-900 border border-red-300'}`}>
            {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Identified Cadastre Result Card */}
        {identifiedData && (
          <div className="rounded-xl border border-emerald-300 bg-white p-4 shadow-xs space-y-3 mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">
                  Parcela č. {identifiedData.parcelNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                  k.ú. {identifiedData.cadastralAreaName} ({identifiedData.cadastralAreaCode})
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-900">
                  🗺️ ČÚZK RÚIAN
                </span>
              </div>
              <a
                href={identifiedData.cuzkViewUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border-sky-300 bg-sky-50"
              >
                <ExternalLink size={13} />
                <span>Otevřít Nahlížení do KN (ČÚZK) ↗</span>
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block">Výměra parcely:</span>
                <span className="font-semibold text-slate-800">{identifiedData.areaSqm ? `${identifiedData.areaSqm.toLocaleString('cs-CZ')} m²` : 'neuvedeno'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Druh pozemku:</span>
                <span className="font-semibold text-slate-800">{identifiedData.landTypeName || 'neuvedeno'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Způsob využití:</span>
                <span className="font-semibold text-slate-800">{identifiedData.landUseName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Doporučený postup:</span>
                <span className="font-semibold text-emerald-800">Přímé jednání / Nahlížení KN</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={savingPlot}
                onClick={handleSaveScoutedPlot}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                {savingPlot ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
                <span>Uložit pozemek do SeePOINTu a zahájit jednání</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Parcels Table & Management */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Evidence zmapovaných pozemků & vyjednávání nájmů
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Seznam všech vytipovaných pozemků, stav jednání s majiteli, schvalování na obcích a konverze na nosiče.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div>
            <input
              type="text"
              placeholder="Hledat lokalitu, parcelu, k.ú. nebo majitele..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">Všechny typy vlastnictví</option>
              <option value="PRIVATE_COMPANY">🏢 Soukromá firma</option>
              <option value="PRIVATE_INDIVIDUAL">👤 Soukromá FO</option>
              <option value="MUNICIPAL">🏛️ Obecní / Městský</option>
              <option value="STATE">🇨🇿 Státní</option>
            </select>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none bg-white"
            >
              <option value="ALL">Všechny stavy</option>
              <option value="SCOUTING">V průzkumu</option>
              <option value="NEGOTIATING">V jednání</option>
              <option value="AGREED">Souhlas majitele</option>
              <option value="CONTRACT_SIGNED">Smlouva podepsána</option>
              <option value="REJECTED">Zamítnuto</option>
            </select>
          </div>
        </div>

        {filteredPoints.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Zatím zde nejsou žádné pozemky odpovídající filtru.
            <div className="mt-2 text-xs text-slate-400">Použijte nahoře AI Radar nebo zadejte GPS souřadnice.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">Lokalita / Název</th>
                  <th className="p-3">Parcela (ČÚZK)</th>
                  <th className="p-3">Katastrální území</th>
                  <th className="p-3">Vlastník & Kontakt</th>
                  <th className="p-3">Typ vlastnictví</th>
                  <th className="p-3">Měsíční nájem</th>
                  <th className="p-3">Stav jednání</th>
                  <th className="p-3 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPoints.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{p.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">GPS: {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</div>
                    </td>
                    <td className="p-3 font-mono font-medium text-slate-800">
                      {p.parcelNumber ? (
                        <div className="flex items-center gap-1.5">
                          <span>{p.parcelNumber}</span>
                          {p.cadastralAreaCode && (
                            <a
                              href={`https://nahlizenidokn.cuzk.gov.cz/ZobrazObjekt.aspx?typ=KU&id=${p.cadastralAreaCode}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Otevřít v Katastru"
                              className="text-sky-600 hover:text-sky-800"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">nezjištěna</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{p.cadastralArea || '—'}</div>
                      {p.landArea && <div className="text-[10px] text-slate-400">{p.landArea} m²</div>}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{p.landownerName || '—'}</div>
                      {p.landownerContact && <div className="text-[10px] text-slate-500">{p.landownerContact}</div>}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${p.landOwnership === 'PRIVATE_COMPANY' || p.landOwnership === 'PRIVATE_INDIVIDUAL' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : p.landOwnership === 'MUNICIPAL' ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-slate-100 text-slate-600'}`}>
                        {p.landOwnership === 'PRIVATE_COMPANY' ? '🏢 Soukromá firma' : p.landOwnership === 'PRIVATE_INDIVIDUAL' ? '👤 Soukromá FO' : p.landOwnership === 'MUNICIPAL' ? '🏛️ Obecní' : p.landOwnership === 'STATE' ? '🇨🇿 Státní' : 'Neurčeno'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900">
                      {p.monthlyRent !== null && p.monthlyRent !== undefined && Number(p.monthlyRent) > 0 ? (
                        <span>{Number(p.monthlyRent).toLocaleString('cs-CZ')} Kč/měs.</span>
                      ) : (
                        <span className="text-slate-400 font-normal">0 Kč</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${p.permitStatus === 'CONTRACT_SIGNED' || p.permitStatus === 'AGREED' ? 'bg-purple-100 text-purple-900' : p.permitStatus === 'REJECTED' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>
                        {p.permitStatus === 'CONTRACT_SIGNED' ? '✍️ Smlouva podepsána' : p.permitStatus === 'AGREED' ? '✅ Souhlas majitele' : p.permitStatus === 'NEGOTIATING' ? '💬 V jednání' : p.permitStatus === 'REJECTED' ? '❌ Zamítnuto' : '🔍 V průzkumu'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAiAnalysis(p)}
                          className="btn btn-outline text-xs font-semibold py-1 px-2.5 rounded-lg border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 flex items-center gap-1"
                          title="Vygenerovat AI analýzu komerčního potenciálu a vzor oslovení"
                        >
                          <Sparkles size={12} className="text-indigo-600" />
                          <span>AI Analýza</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPointForModal(p)}
                          className="btn btn-outline text-xs font-semibold py-1 px-2.5 rounded-lg border-slate-300 hover:bg-slate-100"
                        >
                          Detail & Smlouva →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI Plot Analysis & Negotiation Pitch Modal */}
      {analyzingPlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 overflow-y-auto"
          onClick={() => setAnalyzingPlot(null)}
        >
          <div
            className="relative w-full max-w-2xl my-auto rounded-3xl border border-indigo-200 bg-white text-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">AI Komerční Analýza & Argumentář</h3>
                  <p className="text-xs text-slate-500">{analyzingPlot.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAnalyzingPlot(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {aiAnalysisLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">AI analyzuje lokalitu, dopravní uzel a počítá férový nájem…</p>
                </div>
              ) : aiAnalysisData ? (
                <div className="space-y-5">
                  {/* Score & Key Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-600 block">Komerční skóre</span>
                      <span className="text-2xl font-black text-indigo-900">⭐ {aiAnalysisData.overallScore}/10</span>
                      <span className="text-[10px] text-indigo-700 font-semibold block mt-0.5">Doprava: {aiAnalysisData.trafficRating}</span>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Férový nájem majiteli</span>
                      <span className="text-xl font-black text-emerald-900">
                        {aiAnalysisData.estimatedFairRentCzk?.toLocaleString('cs-CZ')} Kč
                      </span>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">měsíčně</span>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-3.5 text-center">
                      <span className="text-[10px] font-extrabold uppercase text-purple-700 block">Hodnota kampaně</span>
                      <span className="text-xl font-black text-purple-900">
                        {aiAnalysisData.estimatedCampaignValueCzk?.toLocaleString('cs-CZ')} Kč
                      </span>
                      <span className="text-[10px] text-purple-600 block mt-0.5">měsíčně</span>
                    </div>
                  </div>

                  {/* Recommended Format */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 block uppercase">Doporučený typ reklamního nosiče:</span>
                    <span className="text-sm font-bold text-indigo-900 flex items-center gap-1.5 mt-0.5">
                      <TrendingUp size={16} className="text-indigo-600" />
                      {aiAnalysisData.recommendedCarrier}
                    </span>
                  </div>

                  {/* Pros & Cons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                      <span className="font-bold text-emerald-900 block flex items-center gap-1">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Silné stránky lokality:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        {aiAnalysisData.pros.map((pro, i) => (
                          <li key={i}>{pro}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1.5">
                      <span className="font-bold text-amber-900 block flex items-center gap-1">
                        <AlertCircle size={13} className="text-amber-600" />
                        Upozornění a rizika:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700">
                        {aiAnalysisData.cons.map((con, i) => (
                          <li key={i}>{con}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Negotiation Points */}
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
                    <span className="font-bold text-indigo-950 block flex items-center gap-1.5 text-sm">
                      <Sparkles size={14} className="text-indigo-600" />
                      Argumenty pro vyjednávání s majitelem:
                    </span>
                    <ul className="space-y-1.5 text-slate-700">
                      {aiAnalysisData.negotiationPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-indigo-600 font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cold Outreach Letter */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <FileText size={14} className="text-slate-500" />
                        Návrh oslovovacího dopisu / e-mailu majiteli:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPitch}
                        className="btn btn-outline text-xs font-bold py-1 px-2.5 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                      >
                        {copiedPitch ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            <span className="text-emerald-600">Zkopírováno!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Kopírovat dopis</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-800">
                      Předmět: {aiAnalysisData.outreachSubject}
                    </div>
                    <textarea
                      readOnly
                      rows={7}
                      value={aiAnalysisData.outreachLetterTemplate}
                      className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  Nepodařilo se vygenerovat analýzu.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail / Land Permit Modal */}
      {selectedPointForModal && (
        <LandPermitModal
          point={selectedPointForModal}
          onClose={() => setSelectedPointForModal(null)}
          onUpdated={(updated) => {
            setPoints((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setSelectedPointForModal(null);
          }}
        />
      )}
    </div>
  );
}
