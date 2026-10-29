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
} from 'lucide-react';
import { LandPermitModal } from '@/components/election-removal/LandPermitModal';
import type { CuzkParcelInfo } from '@/lib/cadastre/cuzk-service';

interface LandPermitsViewProps {
  initialPoints: ElectionRemovalPoint[];
}

export function LandPermitsView({ initialPoints }: LandPermitsViewProps) {
  const [points, setPoints] = useState<ElectionRemovalPoint[]>(initialPoints);
  const [selectedPointForModal, setSelectedPointForModal] = useState<ElectionRemovalPoint | null>(null);

  // New plot identification state
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [plotLabel, setPlotLabel] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [savingPlot, setSavingPlot] = useState(false);
  const [identifiedData, setIdentifiedData] = useState<CuzkParcelInfo | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [ownershipFilter, setOwnershipFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
          landOwnership: identifiedData?.ownershipClassification || 'UNKNOWN',
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
      // Open modal for this new point right away
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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchLabel = p.label.toLowerCase().includes(q);
      const matchParcel = (p.parcelNumber || '').toLowerCase().includes(q);
      const matchArea = (p.cadastralArea || '').toLowerCase().includes(q);
      const matchOwner = (p.landownerName || '').toLowerCase().includes(q);
      if (!matchLabel && !matchParcel && !matchArea && !matchOwner) return false;
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              ARES propojení
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Pozemky & Povolování ploch
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Průzkum lokalit pro nové reklamní plochy, automatická identifikace parcel podle GPS z Katastru nemovitostí (ČÚZK),
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

      {/* Scout / Identify Box */}
      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-slate-50 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-600" />
              Ověřit nový pozemek přes ČÚZK (RÚIAN)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Zadejte GPS souřadnice nalezeného místa v terénu nebo použijte aktuální polohu. Systém automaticky zjistí parcelní číslo a katastrální území.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="btn btn-outline text-xs font-semibold flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-white"
          >
            <MapPin size={14} className="text-emerald-600" />
            <span>📍 Moje aktuální GPS</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Zeměpisná šířka (Latitude)</label>
            <input
              type="text"
              placeholder="např. 49.835400"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Zeměpisná délka (Longitude)</label>
            <input
              type="text"
              placeholder="např. 18.292300"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Název lokality / Popis</label>
            <input
              type="text"
              placeholder="např. Křižovatka Rudná - plot autoservisu"
              value={plotLabel}
              onChange={(e) => setPlotLabel(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
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
                <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${identifiedData.ownershipClassification === 'PRIVATE_COMPANY' ? 'bg-amber-100 text-amber-900' : identifiedData.ownershipClassification === 'MUNICIPAL' ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-800'}`}>
                  {identifiedData.ownershipClassification === 'PRIVATE_COMPANY' ? '🏢 Soukromá firma' : identifiedData.ownershipClassification === 'MUNICIPAL' ? '🏛️ Obecní / Městský' : '👤 Soukromá osoba / Neurčeno'}
                </span>
              </div>
              <a
                href={identifiedData.cuzkViewerUrl}
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
                <span className="font-semibold text-emerald-800">{identifiedData.ownershipClassification === 'MUNICIPAL' ? 'Žádost Radě obce (§39)' : 'Přímá dohoda s majitelem'}</span>
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

      {/* Table of Scouted Plots */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Evidované pozemky pro reklamní plochy</h2>
            <p className="text-xs text-slate-500">Seznam vytipovaných lokalit, stav jednání s majiteli a sjednané nájmy.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Hledat lokalitu, parcelu, majitele…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 px-3 py-2 w-48 sm:w-64 focus:outline-none focus:border-emerald-500"
            />
            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 px-2.5 py-2 bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">Všechna vlastnictví</option>
              <option value="PRIVATE_COMPANY">🏢 Soukromé firmy</option>
              <option value="PRIVATE_INDIVIDUAL">👤 Soukromé FO</option>
              <option value="MUNICIPAL">🏛️ Městské / Obecní</option>
              <option value="STATE">🇨🇿 Státní (ŘSD / SŽ)</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 px-2.5 py-2 bg-white text-slate-700 focus:outline-none"
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
            <div className="mt-2 text-xs text-slate-400">Zadejte nahoře GPS souřadnice a uložte první vytipovaný pozemek.</div>
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
                      <button
                        type="button"
                        onClick={() => setSelectedPointForModal(p)}
                        className="btn btn-outline text-xs font-semibold py-1 px-2.5 rounded-lg border-slate-300 hover:bg-slate-100"
                      >
                        Detail a smlouva →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
