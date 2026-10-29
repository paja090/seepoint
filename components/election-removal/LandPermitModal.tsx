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
  X,
  FileText,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface LandPermitModalProps {
  point: ElectionRemovalPoint;
  onClose: () => void;
  onUpdated: (updatedPoint: ElectionRemovalPoint) => void;
}

export function LandPermitModal({ point, onClose, onUpdated }: LandPermitModalProps) {
  const [cadastralArea, setCadastralArea] = useState(point.cadastralArea || '');
  const [cadastralAreaCode, setCadastralAreaCode] = useState<number | null>(point.cadastralAreaCode || null);
  const [parcelNumber, setParcelNumber] = useState(point.parcelNumber || '');
  const [parcelId, setParcelId] = useState(point.parcelId || '');
  const [landArea, setLandArea] = useState<number | null>(point.landArea || null);
  const [landType, setLandType] = useState(point.landType || '');
  const [landOwnership, setLandOwnership] = useState(point.landOwnership || 'UNKNOWN');
  const [landownerName, setLandownerName] = useState(point.landownerName || '');
  const [landownerIco, setLandownerIco] = useState(point.landownerIco || '');
  const [landownerContact, setLandownerContact] = useState(point.landownerContact || '');
  const [landownerNote, setLandownerNote] = useState(point.landownerNote || '');
  const [monthlyRent, setMonthlyRent] = useState<string>(
    point.monthlyRent !== null && point.monthlyRent !== undefined ? String(point.monthlyRent) : ''
  );
  const [permitStatus, setPermitStatus] = useState(point.permitStatus || 'SCOUTING');
  const [permitNote, setPermitNote] = useState(point.permitNote || '');
  const [permitValidUntil, setPermitValidUntil] = useState(
    point.permitValidUntil ? new Date(point.permitValidUntil).toISOString().slice(0, 10) : ''
  );

  const [identifyingCuzk, setIdentifyingCuzk] = useState(false);
  const [aresLoading, setAresLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Identify parcel automatically via CUZK API
  const handleIdentifyFromCuzk = async () => {
    setIdentifyingCuzk(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/cadastre/identify?lat=${point.latitude}&lng=${point.longitude}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Nepodařilo se načíst data z Katastru nemovitostí.');
      }
      if (!data.parcel) {
        setStatusMessage('Na těchto souřadnicích nebyla v katastru nalezena parcela.');
        return;
      }

      const p = data.parcel;
      setParcelNumber(p.parcelNumber);
      setParcelId(p.parcelId);
      setCadastralArea(p.cadastralAreaName);
      setCadastralAreaCode(p.cadastralAreaCode);
      setLandArea(p.areaSqm);
      setLandType(`${p.landTypeName}${p.landUseName ? ` · ${p.landUseName}` : ''}`);
      setStatusMessage(`✅ Parcela ${p.parcelNumber} v ${p.cadastralAreaName} byla úspěšně načtena z ČÚZK!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při dotazování katastru');
    } finally {
      setIdentifyingCuzk(false);
    }
  };

  // Lookup company from ARES by ICO
  const handleLookupAres = async () => {
    const ico = landownerIco.trim().replace(/\s+/g, '');
    if (!ico || ico.length < 8) {
      alert('Zadejte platné 8místné IČO.');
      return;
    }
    setAresLoading(true);
    try {
      const res = await fetch(`/api/ares/lookup?ico=${encodeURIComponent(ico)}`);
      const data = await res.json();
      if (res.ok && data.success && data.company) {
        const c = data.company;
        setLandownerName(c.name || landownerName);
        if (c.city || c.street) {
          const addr = `${c.street || ''} ${c.buildingNumber || ''}, ${c.city || ''}`.trim();
          setLandownerContact((prev) => (prev ? `${prev} | Sídlo: ${addr}` : `Sídlo: ${addr}`));
        }
        setStatusMessage(`Firma "${c.name}" byla úspěšně nalezena v ARES.`);
      } else {
        alert(data.error || 'Firma s tímto IČO nebyla v registru ARES nalezena.');
      }
    } catch (err) {
      alert('Chyba při dotazu na ARES.');
    } finally {
      setAresLoading(false);
    }
  };

  // Save changes
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/election-removal/points/${point.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cadastralArea: cadastralArea.trim() || null,
          cadastralAreaCode: cadastralAreaCode,
          parcelNumber: parcelNumber.trim() || null,
          parcelId: parcelId.trim() || null,
          landArea: landArea,
          landType: landType.trim() || null,
          landOwnership,
          landownerName: landownerName.trim() || null,
          landownerIco: landownerIco.trim() || null,
          landownerContact: landownerContact.trim() || null,
          landownerNote: landownerNote.trim() || null,
          monthlyRent: monthlyRent ? parseFloat(monthlyRent) : null,
          permitStatus,
          permitNote: permitNote.trim() || null,
          permitValidUntil: permitValidUntil || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Nepodařilo se uložit data pozemku.');
      }

      onUpdated(data.point as ElectionRemovalPoint);
      setStatusMessage('Data pozemku a povolení byla úspěšně uložena.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání');
    } finally {
      setSaving(false);
    }
  };

  // Convert approved point to official carrier
  const handleConvertToCarrier = async () => {
    if (!confirm(`Opravdu chcete převést bod "${point.label}" na oficiální reklamní nosič SeePOINT a zařadit jej do inventáře?`)) {
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/election-removal/points/${point.id}/convert-to-carrier`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Převod na nosič selhal.');
      }
      alert(`🎉 ${data.message || 'Nosič byl vytvořen!'}`);
      onClose();
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při převodu');
    } finally {
      setConverting(false);
    }
  };

  const cuzkViewUrl = parcelId
    ? `https://nahlizenidokn.cuzk.cz/ZobrazObjekt.aspx?typ=par&id=${parcelId}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl my-auto rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  Katastr ČÚZK & Povolení pozemku
                </span>
                {point.carrierId && (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                    Aktivní nosič SeePOINT
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black text-white">{point.label}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>GPS: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 hover:bg-slate-700 p-2 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {statusMessage && (
            <div className="rounded-xl bg-emerald-950/80 border border-emerald-800 p-3 text-xs text-emerald-200 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* SECTION 1: CADASTRAL PARCEL (CUZK) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">🗺️ Parcela z Katastru nemovitostí (ČÚZK)</span>
                {parcelNumber && (
                  <span className="rounded-md bg-sky-950 border border-sky-800 text-sky-300 font-mono text-[11px] px-2 py-0.5 font-bold">
                    p. č. {parcelNumber}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={identifyingCuzk}
                  onClick={handleIdentifyFromCuzk}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold px-3 py-1.5 text-xs shadow transition cursor-pointer"
                  title="Dotázat se bezplatné mapové služby ČÚZK podle GPS souřadnic"
                >
                  {identifyingCuzk ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Zjišťuji z ČÚZK...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>{parcelNumber ? 'Znovu ověřit v ČÚZK' : '🔎 Načíst parcelu z Katastru'}</span>
                    </>
                  )}
                </button>

                {cuzkViewUrl && (
                  <a
                    href={cuzkViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 text-xs border border-slate-700 transition"
                  >
                    <span>Otevřít v KN (ČÚZK)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Číslo parcely</label>
                <input
                  type="text"
                  value={parcelNumber}
                  onChange={(e) => setParcelNumber(e.target.value)}
                  placeholder="např. 1420/3 nebo st. 308"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Katastrální území (k.ú.)</label>
                <input
                  type="text"
                  value={cadastralArea}
                  onChange={(e) => setCadastralArea(e.target.value)}
                  placeholder="např. Moravská Ostrava"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Výměra pozemku (m²)</label>
                <input
                  type="number"
                  value={landArea ?? ''}
                  onChange={(e) => setLandArea(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="např. 736"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white"
                />
              </div>
            </div>

            {landType && (
              <div className="rounded-xl bg-slate-900 border border-slate-800/80 px-3 py-2 text-[11px] text-slate-300">
                <strong className="text-slate-400">Druh a využití pozemku:</strong> {landType}
              </div>
            )}
          </div>

          {/* SECTION 2: LAND OWNERSHIP & LANDLORD CONTACT */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <span className="font-extrabold text-sm text-white block border-b border-slate-800/80 pb-2">
              👤 Majitel pozemku a jednání
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Typ vlastnictví pozemku</label>
                <select
                  value={landOwnership}
                  onChange={(e) => setLandOwnership(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white font-bold"
                >
                  <option value="PRIVATE">🟢 Soukromý vlastník / Firma (Rychlé jednání)</option>
                  <option value="MUNICIPAL">🔵 Město / Obec (Schválení Radou města)</option>
                  <option value="STATE">🟠 Stát / Kraj / SÚS / ŘSD</option>
                  <option value="UNKNOWN">⚪ Zatím nezjištěno</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  IČO firmy (pokud jde o firmu)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={landownerIco}
                    onChange={(e) => setLandownerIco(e.target.value)}
                    placeholder="8místné IČO"
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white font-mono"
                  />
                  <button
                    type="button"
                    disabled={aresLoading || !landownerIco}
                    onClick={handleLookupAres}
                    className="rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3 text-[11px] font-bold text-slate-200 border border-slate-700 cursor-pointer shrink-0"
                    title="Dotáhnout firmu z registru ARES"
                  >
                    {aresLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'ARES'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Jméno majitele / Název firmy
                </label>
                <input
                  type="text"
                  value={landownerName}
                  onChange={(e) => setLandownerName(e.target.value)}
                  placeholder="např. Jan Novák nebo ABC s.r.o."
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Kontakt (telefon, e-mail, adresa sídla)
                </label>
                <input
                  type="text"
                  value={landownerContact}
                  onChange={(e) => setLandownerContact(e.target.value)}
                  placeholder="např. +420 777 123 456, jan@firma.cz"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Dohodnutý nájem za pozemek (Kč / měsíc bez DPH)
                </label>
                <input
                  type="number"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  placeholder="např. 1500"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-emerald-400 font-extrabold"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Poznámka z jednání s majitelem / městem
              </label>
              <textarea
                rows={2}
                value={landownerNote}
                onChange={(e) => setLandownerNote(e.target.value)}
                placeholder="např. Majitel souhlasí s umístěním lavičky, smlouva zaslána e-mailem, schůzka příští úterý..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-white"
              />
            </div>
          </div>

          {/* SECTION 3: PERMIT STATUS & WORKFLOW */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
            <span className="font-extrabold text-sm text-white block border-b border-slate-800/80 pb-2">
              ⚖️ Stav schvalování a povolení
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Fáze povolení</label>
                <select
                  value={permitStatus}
                  onChange={(e) => setPermitStatus(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 font-black ${
                    permitStatus === 'APPROVED'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : permitStatus === 'REJECTED'
                      ? 'bg-rose-950 border-rose-500 text-rose-300'
                      : permitStatus === 'CONTRACT_SIGNED'
                      ? 'bg-purple-950 border-purple-500 text-purple-300'
                      : 'bg-slate-900 border-slate-800 text-sky-300'
                  }`}
                >
                  <option value="SCOUTING">🔍 1. Tip / Vytipováno z terénu</option>
                  <option value="CONTACTED">📞 2. Oslovení majitele / Jednání</option>
                  <option value="CONTRACT_SIGNED">✍️ 3. Nájemní smlouva podepsána</option>
                  <option value="MUNICIPALITY_SUBMITTED">🏛️ 4. Podána žádost na Radu města / Dopravní úřad</option>
                  <option value="APPROVED">✅ 5. Schváleno a povoleno k instalaci</option>
                  <option value="REJECTED">❌ Zamítnuto / Neprůchozí lokalita</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Platnost povolení / nájemní smlouvy do
                </label>
                <input
                  type="date"
                  value={permitValidUntil}
                  onChange={(e) => setPermitValidUntil(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Poznámka k povolení / číslo jednací
              </label>
              <input
                type="text"
                value={permitNote}
                onChange={(e) => setPermitNote(e.target.value)}
                placeholder="např. Usnesení Rady města č. 45/2026, vyjádření PČR DI bez výhrad"
                className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div>
              {!point.carrierId && permitStatus === 'APPROVED' && (
                <button
                  type="button"
                  disabled={converting}
                  onClick={handleConvertToCarrier}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2.5 text-xs shadow-lg transition cursor-pointer"
                  title="Přenést povolený bod do hlavního inventáře reklamních nosičů SeePOINT"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Vytvářím nosič...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>🚀 Převést na reklamní nosič SeePOINT</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
              >
                Zavřít
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Uložit údaje</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
