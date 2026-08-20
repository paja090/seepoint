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
  const artworkUploadEnabled = canUploadNavigationArtwork(offer);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(
    navigation?.points[0]?.id || null,
  );
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

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
              const pObj = point as unknown as Record<string, unknown>;

              return (
                <article
                  key={point.id}
                  onClick={() => setSelectedPointId(point.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    selectedPointId === point.id
                      ? 'border-sky-500 bg-sky-50/50 shadow-md ring-2 ring-sky-500/20'
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

                  {/* Visualizer Photo Preview if available */}
                  {typeof pObj.visualizedPhotoUrl === 'string' && pObj.visualizedPhotoUrl && (
                    <div
                      className="mt-3 overflow-hidden rounded-xl border border-slate-200 cursor-zoom-in relative group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLightboxImage(String(pObj.visualizedPhotoUrl));
                      }}
                    >
                      <img
                        src={String(pObj.visualizedPhotoUrl)}
                        alt={`Fotografie a vizualizace nosiče – ${point.label}`}
                        className="h-48 w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-bold text-xs">
                        🔍 Kliknutím zvětšíte snímek
                      </div>
                    </div>
                  )}
                  {isLocationSelectionPhase && !pObj.visualizedPhotoUrl ? (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                      Fotografie umístění a vizualizace nosiče zatím nebyla přiložena.
                    </div>
                  ) : null}
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

            {/* Client artwork upload option */}
            <div className="pt-2">
              {artworkUploadEnabled ? (
                <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-xs font-bold text-sky-300 hover:bg-sky-500/20 hover:text-white transition cursor-pointer shadow-lg shadow-sky-500/10">
                  <span>📤 Nahrát vlastní logo / grafické podklady</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.ai,.eps,.svg"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) {
                        setArtworkMessage('Soubor může mít maximálně 3 MB.');
                        return;
                      }
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
                          setArtworkMessage('Podklady byly úspěšně předány obchodníkovi SeePOINT.');
                        } catch {
                          setArtworkMessage('Podklady se nepodařilo nahrát.');
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                <div className="text-[11px] font-bold text-slate-600 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  📁 Nahrané podklady od klienta: {uploadedArtworkName}
                </div>
              ) : null}
              {artworkMessage ? <p className="text-xs font-semibold text-slate-700" role="status">{artworkMessage}</p> : null}
            </div>
          </div>
        </div>
      </div>
      )}

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
