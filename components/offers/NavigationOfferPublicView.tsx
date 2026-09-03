'use client';

import { useState } from 'react';
import {
  Store,
  Compass,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  MoveHorizontal,
  FileDown,
  CheckCircle2,
  ClipboardList,
  UploadCloud,
  Sparkles,
  FileText,
  RefreshCw,
} from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';
import { canDownloadInstallationSheet, canDownloadOfferPdf } from '@/lib/offers/navigation-document-access';
import { canUploadNavigationArtwork } from '@/lib/offers/navigation-artwork-access';
import { GoogleNavigationOfferMap } from './GoogleNavigationOfferMap';

const money = (val: string | number | null | undefined) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(
    Number(val || 0),
  );

export function ArrowBadge({ arrowEnum }: { arrowEnum?: string | null }) {
  switch (arrowEnum) {
    case 'LEFT':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-900 border border-sky-300">
          <ArrowLeft size={14} className="text-sky-700 stroke-[3]" /> VLEVO
        </span>
      );
    case 'RIGHT':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-900 border border-sky-300">
          <ArrowRight size={14} className="text-sky-700 stroke-[3]" /> VPRAVO
        </span>
      );
    case 'SLANTED_LEFT':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-900 border border-sky-300">
          <ArrowUpLeft size={14} className="text-sky-700 stroke-[3]" /> ŠIKMO VLEVO
        </span>
      );
    case 'SLANTED_RIGHT':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-900 border border-sky-300">
          <ArrowUpRight size={14} className="text-sky-700 stroke-[3]" /> ŠIKMO VPRAVO
        </span>
      );
    case 'U_TURN':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900 border border-amber-300">
          <RotateCcw size={14} className="text-amber-700 stroke-[3]" /> OTOČENÍ DO PROTISMĚRU
        </span>
      );
    case 'TWO_WAY':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-900 border border-purple-300">
          <MoveHorizontal size={14} className="text-purple-700 stroke-[3]" /> OBOUSMĚRNÝ
        </span>
      );
    case 'STRAIGHT':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-900 border border-emerald-300">
          <ArrowUp size={14} className="text-emerald-700 stroke-[3]" /> ROVNĚ
        </span>
      );
  }
}

export function formatDistanceBadge(point: Record<string, unknown>) {
  if (point.distanceSource === 'MANUAL' && point.manualDistanceValue) {
    const unit = point.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm';
    return `${String(point.manualDistanceValue)} ${unit} od cíle`;
  }
  if (typeof point.calculatedDistanceMeters === 'number') {
    if (point.calculatedDistanceMeters >= 1000) {
      return `${(point.calculatedDistanceMeters / 1000).toFixed(1).replace('.', ',')} km od cíle`;
    }
    return `${point.calculatedDistanceMeters} m od cíle`;
  }
  return 'Trasa vypočítávána';
}

export function NavigationOfferPublicView({ offer, proposalKey }: { offer: OfferView; proposalKey?: string }) {
  const navigation = offer.navigation;
  const effectiveProposalKey = proposalKey ?? offer.id;
  const isLocationSelectionPhase = (navigation as unknown as Record<string, unknown>).proposalMode !== 'PRICED_QUOTE';
  const showOfferPdf = canDownloadOfferPdf(offer);
  const showInstallationSheet = canDownloadInstallationSheet(offer);
  const targetPhotoUrl = (navigation as unknown as Record<string, unknown> | null)?.targetPhotoUrl;
  const missingVisualCount = navigation?.points.filter((point) => !((point as unknown as Record<string, unknown>).visualizedPhotoUrl)).length ?? 0;
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>(() =>
    navigation?.points.filter((p) => (p as unknown as Record<string, unknown>).isSelectedByClient !== false).map((p) => p.id) || []
  );
  const [submittingSelection, setSubmittingSelection] = useState(false);
  const [selectionSubmitted, setSelectionSubmitted] = useState(
    (navigation as unknown as Record<string, unknown> | null)?.selectionSubmitted === true,
  );
  const [selectionMessage, setSelectionMessage] = useState('');
  const [uploadedArtworkName, setUploadedArtworkName] = useState(() => {
    const value = (navigation as unknown as Record<string, unknown> | null)?.clientArtworkFileName;
    return typeof value === 'string' ? value : '';
  });
  const [artworkMessage, setArtworkMessage] = useState('');
  const [isUploadingArtwork, setIsUploadingArtwork] = useState(false);
  const artworkUploadEnabled = canUploadNavigationArtwork(offer);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(
    navigation?.points[0]?.id || null,
  );
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  async function handleArtworkFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setArtworkMessage('Soubor může mít maximálně 5 MB.');
      return;
    }
    setIsUploadingArtwork(true);
    setArtworkMessage('');
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        if (!effectiveProposalKey) throw new Error('Chybí identifikátor nabídky.');
        const response = await fetch(`/api/proposals/${encodeURIComponent(effectiveProposalKey)}/artwork`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientArtworkUrl: dataUrl, clientArtworkFileName: file.name }),
        });
        const result = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(result?.error || 'Nahrání podkladů selhalo.');
        setUploadedArtworkName(file.name);
        setArtworkMessage('Podklady byly úspěšně uloženy a předány grafikovi SeePOINT.');
      } catch (err: unknown) {
        setArtworkMessage(err instanceof Error ? err.message : 'Podklady se nepodařilo nahrát.');
      } finally {
        setIsUploadingArtwork(false);
      }
    };
    reader.onerror = () => {
      setIsUploadingArtwork(false);
      setArtworkMessage('Soubor se nepodařilo načíst.');
    };
    reader.readAsDataURL(file);
  }

  function togglePointSelection(id: string) {
    setSelectedPointIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  }

  async function handleConfirmClientSelection() {
    if (!effectiveProposalKey) return;
    setSubmittingSelection(true);
    setSelectionMessage('');
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(effectiveProposalKey)}/selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPointIds }),
      });
      if (res.ok) {
        setSelectionSubmitted(true);
      } else {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        setSelectionMessage(data?.error || 'Výběr bodů se nepodařilo odeslat.');
      }
    } catch {
      setSelectionMessage('Výběr bodů se nepodařilo odeslat.');
    } finally {
      setSubmittingSelection(false);
    }
  }

  if (!navigation) return null;

  // Filter price rows dynamically for selected points (or all if none filtered)
  const activePoints = navigation.points.filter((p) =>
    selectedPointIds.length > 0 ? selectedPointIds.includes(p.id) : true
  );

  const priceRows = activePoints.map((point) => {
    const quantity = Number(point.quantity || 0);
    const rental = quantity * Number(point.unitPrice || 0);
    const frame = quantity * Number((point as Record<string, unknown>).framePrice || 0);
    const production = quantity * Number(point.productionPrice || 0);
    const installation = quantity * Number(point.installationPrice || 0);
    const removal = quantity * Number(point.removalPrice || 0);
    return { point, quantity, rental, frame, production, installation, removal, subtotal: rental + frame + production + installation + removal };
  });

  const priceTotals = priceRows.reduce((sum, row) => ({
    rental: sum.rental + row.rental,
    frame: sum.frame + row.frame,
    production: sum.production + row.production,
    installation: sum.installation + row.installation,
    removal: sum.removal + row.removal,
    subtotal: sum.subtotal + row.subtotal,
  }), { rental: 0, frame: 0, production: 0, installation: 0, removal: 0, subtotal: 0 });

  const taxRate = Number(offer.taxRate || 21);
  const taxAmount = Math.round(priceTotals.subtotal * taxRate) / 100;
  const totalWithTax = priceTotals.subtotal + taxAmount;

  const target = {
    latitude: navigation.targetLatitude,
    longitude: navigation.targetLongitude,
    label: navigation.targetName,
    address: navigation.targetAddress || undefined,
  };

  return (
    <section className="space-y-6">
      {/* Proposal Phase Banner */}
      {isLocationSelectionPhase ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white font-extrabold">
              1
            </span>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-amber-900">
                Fáze 1: Nezávazný lokační návrh rozmístění v terénu (ZDARMA)
              </h4>
              <p className="text-xs text-amber-800 font-medium">
                Vyberte na trase pozice navigačních bodů, které vám nejvíce vyhovují. Po schválení připravíme přesnou cenovou nabídku.
              </p>
            </div>
          </div>
          <div className="text-xs font-bold bg-amber-200/80 border border-amber-300 px-3 py-1.5 rounded-xl self-start md:self-auto shrink-0">
            ✓ Bez cenových závazků
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold">
              2
            </span>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-emerald-900">
                Fáze 2: Cenová nabídka navigační sítě
              </h4>
              <p className="text-xs text-emerald-800 font-medium">
                Kompletní rozpočet pronájmu, výroby a instalace navigačních cedulí pro vybrané pozice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Target Business Banner */}
      <div className="overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl lg:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-rose-500/20 p-2 text-rose-400 border border-rose-500/30">
                <Store size={22} />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-widest text-sky-400">
                Cílová provozovna navigace
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              {navigation.targetName}
            </h2>
            <p className="text-sm font-medium text-slate-300">
              📍 {navigation.targetAddress || `${navigation.targetLatitude.toFixed(5)}, ${navigation.targetLongitude.toFixed(5)}`}
            </p>
            {typeof targetPhotoUrl === 'string' && targetPhotoUrl ? (
              <img
                alt={`Cílová provozovna ${navigation.targetName}`}
                className="mt-4 h-36 w-full max-w-md rounded-2xl border border-sky-700/60 object-cover shadow-lg"
                src={targetPhotoUrl}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xs min-w-[200px]">
              <div className="text-xs font-bold text-slate-400">Celkový počet bodů trasy</div>
              <div className="mt-1 text-2xl font-black text-white">{navigation.points.length} navigačních cedulí</div>
              <div className="mt-1 text-xs text-sky-400 font-semibold">📍 Google Maps Routes API</div>
            </div>

            {effectiveProposalKey && showOfferPdf ? <a
              href={`/api/proposals/${encodeURIComponent(effectiveProposalKey)}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-sky-500 px-5 py-3.5 text-xs font-black text-slate-950 shadow-lg hover:bg-sky-400 transition cursor-pointer shrink-0"
            >
              <FileDown size={18} /> Stáhnout PDF nabídku
            </a> : null}

            {effectiveProposalKey && showInstallationSheet ? <a
              href={`/api/proposals/${encodeURIComponent(effectiveProposalKey)}/installation-sheet`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-xs font-bold text-slate-200 shadow-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Stáhnout montážní protokol s GPS a sloupky VO pro instalační techniky"
            >
              <ClipboardList size={18} className="text-amber-400" /> Montážní list
            </a> : null}
          </div>
        </div>

        {navigation.targetNote && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
            <strong>Poznámka k příjezdu:</strong> {navigation.targetNote}
          </div>
        )}
      </div>

      {/* Main Interactive Google Map & Detail Panel */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Interactive Map */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-2 pt-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Compass size={18} className="text-sky-600" /> Interaktivní mapa navigační trasy
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {navigation.points.length} bodů v nabídce
            </span>
          </div>

          <GoogleNavigationOfferMap
            target={target}
            points={navigation.points.map((p) => {
              const pObj = p as unknown as Record<string, unknown>;
              return {
                id: p.id,
                label: p.label,
                latitude: p.latitude,
                longitude: p.longitude,
                arrowDirectionEnum: typeof pObj.arrowDirectionEnum === 'string' ? pObj.arrowDirectionEnum : undefined,
                pillarNumber: typeof pObj.pillarNumber === 'string' ? pObj.pillarNumber : undefined,
                pillarType: typeof pObj.pillarType === 'string' ? pObj.pillarType : undefined,
                routePolyline: typeof pObj.routePolyline === 'string' ? pObj.routePolyline : undefined,
                calculatedDistanceMeters: typeof pObj.calculatedDistanceMeters === 'number' ? pObj.calculatedDistanceMeters : undefined,
              };
            })}
            mode="point"
            selectedPointId={selectedPointId}
            onPointClick={(id) => {
              setSelectedPointId(id);
              const el = document.getElementById(`nav-point-card-${id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }}
            onTargetSelect={() => {}}
            onPointMove={() => {}}
            onMapClick={() => {}}
          />
        </div>

        {/* Navigation Points Selector List & Selected Detail */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Navigační body v nabídce ({navigation.points.length})
            </h3>
            {isLocationSelectionPhase && (
              <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                Vybráno: {selectedPointIds.length} / {navigation.points.length}
              </span>
            )}
          </div>

          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {navigation.points.map((point, index) => {
              const isSelected = selectedPointIds.includes(point.id);
              const isFocused = selectedPointId === point.id;
              const pObj = point as unknown as Record<string, unknown>;

              return (
                <article
                  id={`nav-point-card-${point.id}`}
                  key={point.id}
                  onClick={() => setSelectedPointId(point.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
                    isFocused
                      ? 'border-amber-500 bg-amber-50/70 shadow-lg ring-4 ring-amber-400/40 scale-[1.01]'
                      : isSelected
                      ? 'border-slate-200 bg-white hover:border-sky-300'
                      : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black ${
                        selectedPointId === point.id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{point.label}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {point.navigationType}{point.variant ? ` · ${point.variant}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={selectionSubmitted}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePointSelection(point.id);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {isSelected ? '✓ Vybráno v nabídce' : '+ Vybrat do nabídky'}
                    </button>
                  </div>

                  {/* Metadata Row: Arrow + Distance + Pillar */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <ArrowBadge arrowEnum={typeof pObj.arrowDirectionEnum === 'string' ? pObj.arrowDirectionEnum : undefined} />

                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 border border-slate-200">
                      <Compass size={13} className="text-sky-600" />
                      {formatDistanceBadge(pObj)}
                    </span>

                    {Boolean(pObj.pillarNumber) && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                        📍 Sloup {String(pObj.pillarNumber)}
                      </span>
                    )}
                  </div>

                  {/* Address & Notes */}
                  {point.address && (
                    <div className="mt-2 text-xs font-medium text-slate-600">
                      📍 {point.address}
                    </div>
                  )}

                  {point.clientNote && (
                    <p className="mt-2 rounded-lg bg-white/80 p-2 text-xs text-slate-700 border border-slate-100">
                      {point.clientNote}
                    </p>
                  )}

                  {/* Visualizer / Site Photo Preview if available */}
                  {(() => {
                    const activePhoto = (typeof pObj.visualizedPhotoUrl === 'string' && pObj.visualizedPhotoUrl)
                      ? pObj.visualizedPhotoUrl
                      : (typeof pObj.sitePhotoUrl === 'string' && pObj.sitePhotoUrl ? pObj.sitePhotoUrl : null);

                    if (!activePhoto) {
                      return isLocationSelectionPhase ? (
                        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                          Fotografie umístění a vizualizace nosiče zatím nebyla přiložena.
                        </div>
                      ) : null;
                    }

                    return (
                      <div
                        className="mt-3 overflow-hidden rounded-xl border border-slate-200 cursor-zoom-in relative group"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLightboxImage(String(activePhoto));
                        }}
                      >
                        <img
                          src={String(activePhoto)}
                          alt={`Fotografie a vizualizace nosiče – ${point.label}`}
                          className="h-48 w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-bold text-xs">
                          🔍 Kliknutím zvětšíte snímek
                        </div>
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {!isLocationSelectionPhase ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-labelledby="navigation-pricing-heading">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">Položkový rozpočet</p>
              <h2 className="mt-1 text-xl font-black" id="navigation-pricing-heading">Kompletní cenová nabídka</h2>
              <p className="mt-1 text-sm text-slate-300">Přehled ceny vybraných navigačních bodů ({activePoints.length} z {navigation.points.length}).</p>
            </div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-2.5 sm:text-right shrink-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Živý přepočet: {activePoints.length} z {navigation.points.length} bodů</p>
              <p className="text-xl font-black text-emerald-400">{money(totalWithTax)} <span className="text-xs text-slate-300 font-normal">s DPH</span></p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Navigační bod</th>
                  <th className="px-3 py-3 text-right">Počet</th>
                  <th className="px-3 py-3 text-right">Pronájem (rok / měs)</th>
                  <th className="px-3 py-3 text-right">Výroba rámu</th>
                  <th className="px-3 py-3 text-right">UV tisk na Dibond</th>
                  <th className="px-3 py-3 text-right">Montáž</th>
                  <th className="px-3 py-3 text-right">Demontáž</th>
                  <th className="px-5 py-3 text-right">Celkem bez DPH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priceRows.map(({ point, quantity, rental, frame, production, installation, removal, subtotal }) => (
                  <tr key={point.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{point.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{point.navigationType}{point.variant ? ` · ${point.variant}` : ''}</p>
                    </td>
                    <td className="px-3 py-4 text-right font-semibold text-slate-700">{quantity.toLocaleString('cs-CZ')} ks</td>
                    <td className="px-3 py-4 text-right text-slate-700">
                      <div className="font-bold">{money(rental)}</div>
                      <div className="text-[10px] text-sky-700 font-semibold">{money(Math.round(rental / 12))}/měs</div>
                    </td>
                    <td className="px-3 py-4 text-right text-slate-700">{money(frame)}</td>
                    <td className="px-3 py-4 text-right text-slate-700">{money(production)}</td>
                    <td className="px-3 py-4 text-right text-slate-700">{money(installation)}</td>
                    <td className="px-3 py-4 text-right text-slate-700">{money(removal)}</td>
                    <td className="px-5 py-4 text-right font-black text-slate-950">{money(subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-5 border-t border-slate-200 bg-slate-50 p-6 lg:grid-cols-[1fr_340px]">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3 border"><dt className="text-slate-500 text-xs">Pronájem nosičů</dt><dd className="mt-1 font-bold text-slate-900">{money(priceTotals.rental)} <span className="text-[10px] text-sky-700 font-normal">({money(Math.round(priceTotals.rental / 12))}/měs)</span></dd></div>
              <div className="rounded-xl bg-white p-3 border"><dt className="text-slate-500 text-xs">Výroba rámů (D-FLEX)</dt><dd className="mt-1 font-bold text-slate-900">{money(priceTotals.frame)}</dd></div>
              <div className="rounded-xl bg-white p-3 border"><dt className="text-slate-500 text-xs">UV tisk na Dibond</dt><dd className="mt-1 font-bold text-slate-900">{money(priceTotals.production)}</dd></div>
              <div className="rounded-xl bg-white p-3 border"><dt className="text-slate-500 text-xs">Montáž / Instalace</dt><dd className="mt-1 font-bold text-slate-900">{money(priceTotals.installation)}</dd></div>
              <div className="rounded-xl bg-white p-3 border"><dt className="text-slate-500 text-xs">Demontáž / Deinstalace</dt><dd className="mt-1 font-bold text-slate-900">{money(priceTotals.removal)}</dd></div>
            </dl>
            <dl className="space-y-3 rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex justify-between gap-4 text-sm"><dt className="text-slate-300">Cena bez DPH</dt><dd className="font-bold">{money(priceTotals.subtotal)}</dd></div>
              <div className="flex justify-between gap-4 text-sm"><dt className="text-slate-300">DPH {taxRate.toLocaleString('cs-CZ')} %</dt><dd className="font-bold">{money(taxAmount)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-slate-700 pt-3 text-lg"><dt className="font-black">Celkem včetně DPH</dt><dd className="font-black text-emerald-400">{money(totalWithTax)}</dd></div>
            </dl>
          </div>
        </section>
      ) : null}

      {isLocationSelectionPhase ? (
        <div className="rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          {selectionSubmitted ? (
            <div className="mx-auto max-w-2xl">
              <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
              <h2 className="mt-3 text-xl font-black text-slate-950">Výběr bodů byl odeslán</h2>
              <p className="mt-2 text-sm text-slate-600">SeePOINT nyní připraví přesnou cenovou nabídku pouze pro vámi vybrané pozice.</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              <h2 className="text-xl font-black text-slate-950">Potvrďte vybrané navigační body</h2>
              <p className="mt-2 text-sm text-slate-600">Tímto krokem ještě neschvalujete cenu ani realizaci. Odesíláte pouze výběr {selectedPointIds.length} z {navigation.points.length} bodů k nacenění.</p>
              {missingVisualCount > 0 ? <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Před potvrzením musí SeePOINT doplnit fotografie a vizualizace u {missingVisualCount} bodů.</p> : null}
              <button
                type="button"
                disabled={submittingSelection || selectedPointIds.length === 0 || missingVisualCount > 0}
                onClick={() => void handleConfirmClientSelection()}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CheckCircle2 size={18} />
                {submittingSelection ? 'Odesílám výběr…' : 'Potvrdit body k nacenění'}
              </button>
              {selectionMessage ? <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{selectionMessage}</p> : null}
            </div>
          )}
        </div>
      ) : null}

      {/* 🎨 Executive Proofing & Graphic Specification Studio Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl ring-1 ring-white/10 space-y-6">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

        {/* Section Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
              <span className="text-xl">🎨</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Grafický návrh a technické provedení navigační cedule
              </h3>
              <p className="text-xs font-medium text-slate-400">
                Přesný formát a tvar panelu se řídí pravidly města a konkrétním místem instalace.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs font-black text-sky-400 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              Rozměr: 670 × 900 mm
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Premium Interactive Graphic Artwork Frame (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div
              className="group relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-2xl transition duration-300 hover:border-sky-500/50 cursor-pointer"
              onClick={() =>
                setActiveLightboxImage(
                  typeof (navigation as unknown as Record<string, unknown>).graphicArtworkUrl === 'string' && (navigation as unknown as Record<string, unknown>).graphicArtworkUrl
                    ? String((navigation as unknown as Record<string, unknown>).graphicArtworkUrl)
                    : '/offer/navigation-proof-template.jpg'
                )
              }
            >
              {/* Studio Window Header Bar */}
              <div className="mb-2.5 flex items-center justify-between border-b border-slate-800/80 pb-2 px-1 text-[11px] font-bold text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                    {typeof (navigation as unknown as Record<string, unknown>).graphicArtworkUrl === 'string' && (navigation as unknown as Record<string, unknown>).graphicArtworkUrl
                      ? 'NÁHLED GRAFICKÉHO MOTIVU'
                      : 'OFICIÁLNÍ ŠABLONA PANELU (670 × 900 MM)'}
                  </span>
                </div>
                <span className="text-sky-400 group-hover:underline flex items-center gap-1">
                  🔍 Zvětšit náhled
                </span>
              </div>

              {/* Artwork Image Container */}
              <div className="relative flex min-h-[300px] w-full items-center justify-center rounded-xl bg-slate-900 p-2 shadow-inner overflow-hidden">
                {typeof (navigation as unknown as Record<string, unknown>).graphicArtworkUrl === 'string' && (navigation as unknown as Record<string, unknown>).graphicArtworkUrl ? (
                  <img
                    src={String((navigation as unknown as Record<string, unknown>).graphicArtworkUrl)}
                    alt="Grafický motiv cedule"
                    className="max-h-[360px] w-full object-contain rounded-lg transition transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <img
                    src="/offer/navigation-proof-template.jpg"
                    alt="Šablona navigačního panelu 670 × 900 mm"
                    className="max-h-[360px] w-full object-contain rounded-lg transition transform duration-300 group-hover:scale-[1.02]"
                  />
                )}

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center backdrop-blur-[2px]">
                  <span className="rounded-xl border border-white/30 bg-slate-900/90 px-4 py-2 text-xs font-bold text-white shadow-xl flex items-center gap-2">
                    🔍 Kliknutím otevřete detail v plné velikosti
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Specification Details & Feature Cards (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
              <span>📋</span> Technické parametry prvku:
            </h4>

            <div className="space-y-2.5 text-xs text-slate-300 font-medium">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-xs">
                <span className="text-base leading-none">📐</span>
                <div>
                  <span className="font-bold text-white block">Rozměry panelu:</span>
                  <span className="text-slate-400"><strong>Ostrava 670 × 900 mm</strong>; Havířov používá odlišný tvar s horním půlkruhem (přesný rozměr bude doplněn po ověření).</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-xs">
                <span className="text-base leading-none">🛡️</span>
                <div>
                  <span className="font-bold text-white block">Materiálové provedení:</span>
                  <span className="text-slate-400">Odolná sendvičová deska <strong>DIBOND (3 mm)</strong>, standardně jednostranná; dle lokality oboustranná.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-xs">
                <span className="text-base leading-none">🎨</span>
                <div>
                  <span className="font-bold text-white block">Tisková grafika:</span>
                  <span className="text-slate-400">Matný černý podklad bez reflexních prvků, logo klienta, směrová šipka a vzdálenost k cíli.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-xs">
                <span className="text-base leading-none">🔩</span>
                <div>
                  <span className="font-bold text-white block">Instalace a uchycení:</span>
                  <span className="text-slate-400">Nerezové ocelové pásky (Bandimex) na sloupy veřejného osvětlení nebo určené sloupky.</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0">💡</span>
              <span>Přesný rozměr pro danou lokalitu a finální grafický návrh budou před výrobou zaslány klientovi ke korektuře a odsouhlasení.</span>
            </div>

            {/* 🚀 High-Visibility Dedicated Artwork & Logo Upload Studio Card */}
            <div className="pt-2">
              <div className="rounded-2xl border-2 border-dashed border-sky-400/60 bg-gradient-to-br from-sky-950/80 via-slate-900/95 to-blue-950/70 p-4 shadow-xl transition-all duration-300 hover:border-sky-400 hover:shadow-sky-500/10">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500 text-slate-950 font-black">
                      <Sparkles size={14} />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-sky-300">
                      Nahrát logo / Grafické podklady
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300">
                    Vizualizace ZDARMA
                  </span>
                </div>

                <div className="mt-3">
                  {uploadedArtworkName ? (
                    <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/40 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                          <span className="text-xs font-black text-emerald-200">
                            Podklady úspěšně uloženy k nabídce
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400/80 bg-emerald-900/60 px-2 py-0.5 rounded">
                          Předáno grafikovi
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-950/80 p-2.5 text-xs font-mono font-bold text-sky-300 border border-slate-800">
                        <FileText size={15} className="text-sky-400 shrink-0" />
                        <span className="truncate">{uploadedArtworkName}</span>
                      </div>
                      <label className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer">
                        <span>🔄 Nahrát jiný soubor nebo aktualizovat verzi loga</span>
                        <input
                          type="file"
                          accept="image/*,.pdf,.ai,.eps,.svg"
                          className="hidden"
                          onChange={handleArtworkFileChange}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4 text-center transition cursor-pointer hover:bg-sky-500/20 hover:border-sky-400">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 group-hover:scale-110 transition duration-300">
                        {isUploadingArtwork ? (
                          <RefreshCw size={22} className="animate-spin" />
                        ) : (
                          <UploadCloud size={24} />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-black text-white group-hover:text-sky-300 transition">
                          {isUploadingArtwork ? 'Nahrávám grafické podklady…' : 'Klikněte pro nahrání vašeho loga'}
                        </span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Grafik SeePOINT bezplatně připraví reálný návrh panelu s vaším logem a směrovkou.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                        <span className="rounded bg-slate-900/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">PDF</span>
                        <span className="rounded bg-slate-900/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">AI / EPS</span>
                        <span className="rounded bg-slate-900/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">SVG</span>
                        <span className="rounded bg-slate-900/90 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">PNG / JPG</span>
                        <span className="text-[10px] font-medium text-slate-400">(max 5 MB)</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf,.ai,.eps,.svg"
                        disabled={isUploadingArtwork}
                        className="hidden"
                        onChange={handleArtworkFileChange}
                      />
                    </label>
                  )}
                </div>

                {artworkMessage ? (
                  <p className={`text-xs font-semibold pt-2 text-center ${artworkMessage.includes('úspěšně') ? 'text-emerald-400' : 'text-rose-400'}`} role="status">
                    {artworkMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🏆 References & Realization Photo Gallery Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-black text-xl shadow-xs border border-emerald-100">
              🏆
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Ukázky realizací a zkušenosti našich klientů
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Více než 400+ navigačních ploch a úspěšně zřízených tras na sloupech VO v Moravskoslezském kraji.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
            ✓ 100% Schváleno úřady & VO
          </span>
        </div>

        {/* Realization Stats Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
            <div className="text-xl md:text-2xl font-black text-slate-900">400+</div>
            <div className="text-[11px] font-semibold text-slate-500">Navigačních ploch na sloupech VO</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
            <div className="text-xl md:text-2xl font-black text-slate-900">150+</div>
            <div className="text-[11px] font-semibold text-slate-500">Realizovaných sítí a tras v MS kraji</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
            <div className="text-xl md:text-2xl font-black text-slate-900">100 %</div>
            <div className="text-[11px] font-semibold text-slate-500">Zajištění záborů & správců VO</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
            <div className="text-xl md:text-2xl font-black text-emerald-700">14 dní</div>
            <div className="text-[11px] font-semibold text-slate-500">Průměrná doba od schválení po instalaci</div>
          </div>
        </div>

        {/* Client Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-red-900 bg-red-100 px-2.5 py-1 rounded-lg">KFC ČR</span>
                <span className="text-amber-500 text-xs font-bold">★★★★★</span>
              </div>
              <p className="text-xs text-slate-600 italic leading-relaxed">
                „Perfektní řešení příjezdové navigace k našim restauracím a Drive-Thru z hlavních městských průtahů. Řidiči odbočí přesně tam, kde mají.“
              </p>
            </div>
            <div className="text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-200/60">
              Navigační síť Drive-Thru • Ostrava & okrajové sídliště
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">LIDL Česká republika</span>
                <span className="text-amber-500 text-xs font-bold">★★★★★</span>
              </div>
              <p className="text-xs text-slate-600 italic leading-relaxed">
                „Rychlé vyřízení všech potřebných záborů a povolení na sloupech VO a bezchybná pravidelná fotodokumentaci. Vše proběhlo přesně podle plánu.“
              </p>
            </div>
            <div className="text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-200/60">
              Městské navádění prodejen • Havířov & Karviná
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg">Penny Market</span>
                <span className="text-amber-500 text-xs font-bold">★★★★★</span>
              </div>
              <p className="text-xs text-slate-600 italic leading-relaxed">
                „Přehledná navigační kampaň na klíčových křižovatkách efektivně navádí řidiče z hlavních tahů přímo k našim prodejnám.“
              </p>
            </div>
            <div className="text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-200/60">
              Navigační cedule Dibond • Frýdek-Místek & Karviná
            </div>
          </div>
        </div>

        {/* Realization Photo Gallery Showcase */}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-950 p-5 text-white space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📸</span>
              <h4 className="font-bold text-sm text-white">Ukázka vybraných realizací navigačních nosičů v terénu</h4>
            </div>
            <span className="text-xs font-medium text-slate-400">
              Ilustrační přehled různorodých klientů a typů instalací (400+ nosičů v síti)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Penny Fryčovice */}
            <div
              className="group relative h-56 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden cursor-pointer flex flex-col justify-between"
              onClick={() => setActiveLightboxImage('/offer/real-penny-frycovice.jpg')}
            >
              <img
                src="/offer/real-penny-frycovice.jpg"
                alt="Ukázka realizace – Penny Market Fryčovice"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-red-300 bg-red-950/90 px-2.5 py-1 rounded-lg border border-red-800/60 backdrop-blur-xs">PENNY Fryčovice</span>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-800/60 backdrop-blur-xs">✓ VO Schváleno</span>
                </div>
                <div className="space-y-0.5 text-white">
                  <p className="text-xs font-bold flex items-center justify-between">
                    <span>📍 PENNY Market – Fryčovice (2,5 km)</span>
                    <span className="text-sky-400 text-[11px] group-hover:underline font-normal">🔍 Zvětšit</span>
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium">Červená směrová cedule s odrazovou šipkou na betonovém sloupu VO.</p>
                </div>
              </div>
            </div>

            {/* 2. McDonald's */}
            <div
              className="group relative h-56 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden cursor-pointer flex flex-col justify-between"
              onClick={() => setActiveLightboxImage('/offer/real-mcdonalds.jpg')}
            >
              <img
                src="/offer/real-mcdonalds.jpg"
                alt="Ukázka realizace – McDonald's"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-amber-300 bg-amber-950/90 px-2.5 py-1 rounded-lg border border-amber-800/60 backdrop-blur-xs">McDonald&apos;s</span>
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-800/60 backdrop-blur-xs">✓ VO Schváleno</span>
                </div>
                <div className="space-y-0.5 text-white">
                  <p className="text-xs font-bold flex items-center justify-between">
                    <span>📍 McDonald&apos;s – Navigace k provozovně (1,4 km)</span>
                    <span className="text-sky-400 text-[11px] group-hover:underline font-normal">🔍 Zvětšit</span>
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium">Černá matná deska Dibond s logem a vzdáleností na sloupu veřejného osvětlení (VO).</p>
                </div>
              </div>
            </div>

            {/* 3. LIDL */}
            <div
              className="group relative h-56 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden cursor-pointer flex flex-col justify-between"
              onClick={() => setActiveLightboxImage('/offer/real-lidl.jpg')}
            >
              <img
                src="/offer/real-lidl.jpg"
                alt="Ukázka realizace – LIDL"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-blue-300 bg-blue-950/90 px-2.5 py-1 rounded-lg border border-blue-800/60 backdrop-blur-xs">LIDL Navigace</span>
                  <span className="text-[10px] font-bold text-sky-300 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-800/60 backdrop-blur-xs">✓ Samostatný sloupek</span>
                </div>
                <div className="space-y-0.5 text-white">
                  <p className="text-xs font-bold flex items-center justify-between">
                    <span>📍 LIDL Česká republika (1,1 km)</span>
                    <span className="text-sky-400 text-[11px] group-hover:underline font-normal">🔍 Zvětšit</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Performance Divider Strip (Breaks up heavy graphics flow) */}
      <section className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl text-center space-y-5">
        <div className="max-w-3xl mx-auto space-y-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400 bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800/60 inline-block">
            🤝 Garance spolehlivého partnerství
          </span>
          <h4 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Kompletní outdoorový servis od A do Z pod jednou střechou
          </h4>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Postaráme se o kompletní realizaci bez vaší starosti – od vyřízení městských a policejních povolení (PČR), přes vlastní velkoformátový tisk a montáž plošinami, až po záruční servis a čištění do 48 hodin.
          </p>
        </div>

        {/* 4 Key Trust Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 max-w-4xl mx-auto pt-3 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/70 text-center space-y-1 hover:border-purple-800/50 transition">
            <span className="text-2xl font-black text-purple-400 block tracking-tight">400+</span>
            <span className="text-[11px] font-bold text-slate-300">Ploch v MS kraji</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/70 text-center space-y-1 hover:border-purple-800/50 transition">
            <span className="text-2xl font-black text-purple-400 block tracking-tight">15+ let</span>
            <span className="text-[11px] font-bold text-slate-300">Zkušeností v oboru</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/70 text-center space-y-1 hover:border-purple-800/50 transition">
            <span className="text-2xl font-black text-purple-400 block tracking-tight">100%</span>
            <span className="text-[11px] font-bold text-slate-300">Vyřízení povolení</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/70 text-center space-y-1 hover:border-purple-800/50 transition">
            <span className="text-2xl font-black text-purple-400 block tracking-tight">48 hod</span>
            <span className="text-[11px] font-bold text-slate-300">Garance servisu</span>
          </div>
        </div>
      </section>

      {/* About SeePOINT s.r.o. - Full Service Advertising & Manufacturing Section */}
      <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/60 p-6 md:p-8 text-white shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-800/60 mb-2">
              <span>🏢 Realizátor nabídky</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <span>O společnosti SEEPOINT s.r.o.</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 font-medium max-w-2xl">
              Přední dodavatel outdoorové reklamy a výrobce originálních nosičů v Moravskoslezském kraji. Kromě navigačních systémů zajišťujeme kompletní reklamní servis pro malé i velké značky.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="https://seepoint.cz"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition"
            >
              <span>🌐 Navštívit seepoint.cz</span>
            </a>
          </div>
        </div>

        {/* 5 Core Pillars Grid with Real Media Type Photos & Professional Copywriting */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Navigation */}
          <div className="group rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden space-y-3 hover:border-purple-500/60 transition shadow-md">
            <div className="relative h-36 w-full overflow-hidden bg-slate-900">
              <img
                src="/images/media-types/navigation.jpg"
                alt="Navigační systémy na sloupech VO a trolejí"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3 flex items-end">
                <span className="font-extrabold text-xs text-sky-300 bg-sky-950/90 px-2.5 py-1 rounded-lg border border-sky-800/60 backdrop-blur-xs">🧭 Městská navigace (VO)</span>
              </div>
            </div>
            <div className="p-4 pt-0 space-y-1">
              <h4 className="text-sm font-extrabold text-white">Navigační tabule a směrové panely</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Exkluzivní síť více než 400+ navigačních ploch na sloupech veřejného osvětlení u nejfrekventovanějších křižovatek a tahů. Dlouhodobá navigace zákazníků přímo k provozovně.</p>
            </div>
          </div>

          {/* 2. Citylight */}
          <div className="group rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden space-y-3 hover:border-purple-500/60 transition shadow-md">
            <div className="relative h-36 w-full overflow-hidden bg-slate-900">
              <img
                src="/images/media-types/citylight.jpg"
                alt="Prosvětlené Citylight CLV vitríny"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3 flex items-end">
                <span className="font-extrabold text-xs text-amber-300 bg-amber-950/90 px-2.5 py-1 rounded-lg border border-amber-800/60 backdrop-blur-xs">💡 Prosvětlená reklama (CLV)</span>
              </div>
            </div>
            <div className="p-4 pt-0 space-y-1">
              <h4 className="text-sm font-extrabold text-white">City Light Vitríny (CLV)</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Prestižní svítící vitríny na klíčových městských tepnách, u zastávek MHD a v pěších zónách. Zajišťují 100% nepřetržitou viditelnost a dominanci vašich motivů ve dne i v noci.</p>
            </div>
          </div>

          {/* 3. Promo Tower */}
          <div className="group rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden space-y-3 hover:border-purple-500/60 transition shadow-md">
            <div className="relative h-36 w-full overflow-hidden bg-slate-900">
              <img
                src="/images/media-types/promo-tower.jpg"
                alt="Promo věže a velkoplošné konstrukce"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3 flex items-end">
                <span className="font-extrabold text-xs text-teal-300 bg-teal-950/90 px-2.5 py-1 rounded-lg border border-teal-800/60 backdrop-blur-xs">🗼 Promo věže & Dominanty</span>
              </div>
            </div>
            <div className="p-4 pt-0 space-y-1">
              <h4 className="text-sm font-extrabold text-white">Promo věže & věžní konstrukce</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Nepřehlédnutelné velkoplošné čtyřstranné věže a horizontální nosiče situované u nákupních zón, kruhových objezdů a vstupů do měst. Zásah tisíců řidičů denně.</p>
            </div>
          </div>

          {/* 4. City Poster */}
          <div className="group rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden space-y-3 hover:border-purple-500/60 transition shadow-md">
            <div className="relative h-36 w-full overflow-hidden bg-slate-900">
              <img
                src="/images/media-types/city-poster.jpg"
                alt="City Poster CLP plakátové vitríny"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3 flex items-end">
                <span className="font-extrabold text-xs text-purple-300 bg-purple-950/90 px-2.5 py-1 rounded-lg border border-purple-800/60 backdrop-blur-xs">🖼️ City Poster & Vitríny</span>
              </div>
            </div>
            <div className="p-4 pt-0 space-y-1">
              <h4 className="text-sm font-extrabold text-white">City Poster (CLP) & A0 bannery</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Městské plakátové vitríny a kampaňové plochy v těsné blízkosti poštám, úřadům, zdravotnickým zařízením a obchodním centrům pro cílenou regionální komunikaci.</p>
            </div>
          </div>

          {/* 5. Full Service & Manufacturing */}
          <div className="group rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden space-y-3 hover:border-purple-500/60 transition shadow-md lg:col-span-2">
            <div className="relative h-36 w-full overflow-hidden bg-slate-900">
              <img
                src="/images/media-types/promo-bench.jpg"
                alt="Vlastní výroba, velkoformátový tisk a servis na klíč"
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent p-3 flex items-end justify-between">
                <span className="font-extrabold text-xs text-emerald-300 bg-emerald-950/90 px-2.5 py-1 rounded-lg border border-emerald-800/60 backdrop-blur-xs">🪑 Mobiliář & Kompletní výroba na klíč</span>
                <span className="font-bold text-[10px] text-purple-300 bg-purple-950/90 px-2.5 py-1 rounded-lg border border-purple-800/60">⚡ Servis do 48 hod</span>
              </div>
            </div>
            <div className="p-4 pt-0 space-y-1">
              <h4 className="text-sm font-extrabold text-white">Vlastní tiskárna, zámečnictví & servis na klíč</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Disponujeme vlastní moderní tiskárnou, výrobou Dibond desek i montážními plošinami. Zabezpečíme kompletní legislativu (povolení měst a PČR), profesionální instalaci i bleskovou servisní údržbu či čištění do 48 hodin.</p>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80 text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-1.5">
            <span>📍 Fráni Šrámka 1209/5, 709 00 Ostrava-Mariánské Hory</span>
          </div>
          <div className="flex items-center gap-4">
            <span>📞 +420 778 089 099</span>
            <span>✉️ info@seepoint.cz</span>
            <span className="text-purple-400 font-bold">seepoint.cz</span>
          </div>
        </div>
      </section>

      {/* Photo Lightbox Modal */}
      {activeLightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md cursor-zoom-out"
          onClick={() => setActiveLightboxImage(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-[92vw] overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeLightboxImage}
              alt="Detail vizualizace"
              className="max-h-[82vh] max-w-[85vw] object-contain"
            />
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 p-4 text-white text-xs font-bold">
              <span>🔍 Detail fotodokumentace / vizualizace navigační cedule SeePOINT</span>
              <button
                type="button"
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                onClick={() => setActiveLightboxImage(null)}
              >
                ✕ Zavřít (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
