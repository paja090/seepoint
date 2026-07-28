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

export function NavigationOfferPublicView({ offer }: { offer: OfferView }) {
  const navigation = offer.navigation;
  const isLocationSelectionPhase = (navigation as unknown as Record<string, unknown>).proposalMode !== 'PRICED_QUOTE';
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>(() =>
    navigation?.points.filter((p) => (p as unknown as Record<string, unknown>).isSelectedByClient !== false).map((p) => p.id) || []
  );
  const [submittingSelection, setSubmittingSelection] = useState(false);
  const [selectionSubmitted, setSelectionSubmitted] = useState(false);
  const [graphicApproved, setGraphicApproved] = useState(false);
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
    setSubmittingSelection(true);
    try {
      const res = await fetch(`/api/proposals/${offer.id}/selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPointIds }),
      });
      if (res.ok) {
        setSelectionSubmitted(true);
      }
    } catch {
      // Ignore
    } finally {
      setSubmittingSelection(false);
    }
  }

  if (!navigation) return null;

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
                Fáze 2: Schválená cenová nabídka navigační sítě
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xs min-w-[200px]">
              <div className="text-xs font-bold text-slate-400">Celkový počet bodů trasy</div>
              <div className="mt-1 text-2xl font-black text-white">{navigation.points.length} navigačních cedulí</div>
              <div className="mt-1 text-xs text-sky-400 font-semibold">📍 Google Maps Routes API</div>
            </div>

            <a
              href={`/api/proposals/${offer.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-sky-500 px-5 py-3.5 text-xs font-black text-slate-950 shadow-lg hover:bg-sky-400 transition cursor-pointer shrink-0"
            >
              <FileDown size={18} /> Stáhnout PDF nabídku
            </a>

            <a
              href={`/api/proposals/${offer.id}/installation-sheet`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-xs font-bold text-slate-200 shadow-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Stáhnout montážní protokol s GPS a sloupky VO pro instalační techniky"
            >
              <ClipboardList size={18} className="text-amber-400" /> Montážní list
            </a>
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

                    {isLocationSelectionPhase ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePointSelection(point.id);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {isSelected ? '✓ Vybráno' : '+ Vybrat'}
                      </button>
                    ) : (
                      <div className="text-right">
                        <div className="font-black text-slate-900 text-sm">{money(point.subtotal)}</div>
                        <div className="text-[11px] text-slate-400">za bod</div>
                      </div>
                    )}
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
                        alt={`Vizualizace ${point.label}`}
                        className="h-32 w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-black">
                        🔍 Kliknutím zvětšíte snímek
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Graphic Artwork Proof Section (670 x 900 mm) */}
      {(navigation as unknown as Record<string, unknown>).includeGraphicProof !== false && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 font-extrabold text-lg">
              🎨
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Grafický náhled a motiv navigační cedule SeePOINT
              </h3>
              <p className="text-xs text-slate-500">
                Standardní rozměr plástve: 670 mm (šířka) × 900 mm (výška) • Oboustranné provedení na sloup
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
            Provedení 670 × 900 mm
          </span>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-6">
          {/* Isolated Graphic Sign Plate Rendering */}
          <div className="relative w-48 h-64 shrink-0 rounded-2xl border-4 border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-white p-4 shadow-xl flex flex-col justify-between overflow-hidden">
            {/* Right side brackets */}
            <div className="absolute right-0 top-6 w-2.5 h-4 bg-slate-500 rounded-l" />
            <div className="absolute right-0 bottom-12 w-2.5 h-4 bg-slate-500 rounded-l" />

            {/* Inner dashed bounds */}
            <div className="absolute inset-3 border border-dashed border-white/30 rounded-xl pointer-events-none" />

            {/* Content or Artwork */}
            {typeof (navigation as unknown as Record<string, unknown>).graphicArtworkUrl === 'string' && (navigation as unknown as Record<string, unknown>).graphicArtworkUrl ? (
              <img
                src={String((navigation as unknown as Record<string, unknown>).graphicArtworkUrl)}
                alt="Grafický motiv cedule"
                className="w-full h-36 object-contain rounded-lg"
              />
            ) : (
              <div className="text-center pt-6 space-y-1">
                <div className="text-xs font-bold tracking-widest text-sky-400 uppercase">SeePOINT</div>
                <div className="text-sm font-black uppercase text-white leading-tight">{navigation.targetName}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">NAVIGAČNÍ REKLAMA</div>
              </div>
            )}

            {/* Bottom Badge */}
            <div className="rounded-xl border border-white/20 bg-slate-950/80 p-2.5 text-center flex items-center justify-between text-xs font-black">
              <span>⬅</span>
              <span>1,3 km</span>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <h4 className="font-bold text-slate-900 text-sm">Specifikace navigačního prvku SeePOINT:</h4>
            <ul className="space-y-1.5 list-disc list-inside font-medium text-slate-700">
              <li>Formát plakátu / cedule: <strong>670 mm × 900 mm</strong></li>
              <li>Materiál: Odolný hliníkový oboustranný panel s UV laminací</li>
              <li>Montáž: Certifikované sloupové nerezové svorky na sloupy veřejného osvětlení</li>
              <li>Dopravní navedení: Reflexní prvky se směrovou šipkou a kilometráží k cíli</li>
            </ul>
            <p className="text-[11px] text-slate-500 pt-1">
              💡 Návrh grafiky cedule bude před výrobou zaslán klientovi k finální korektuře a odsouhlasení.
            </p>

            {/* Interactive Client Graphic Approval & Upload Controls */}
            <div className="pt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {graphicApproved ? (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-100/90 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2 shadow-xs">
                    <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                    <span>✓ Grafický návrh navigační cedule byl odsouhlasen klientem!</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGraphicApproved(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500 transition shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 size={16} /> Odsouhlasit a schválit tento grafický návrh
                  </button>
                )}

                {/* Client File Upload Button */}
                <label className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-xs font-bold text-sky-900 hover:bg-sky-100 transition cursor-pointer">
                  <span>📤 Nahrát vlastní logo / grafické podklady</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.ai,.eps,.svg"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const dataUrl = ev.target?.result as string;
                        try {
                          await fetch(`/api/proposals/${offer.id}/artwork`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientArtworkUrl: dataUrl, clientArtworkFileName: file.name }),
                          });
                          alert(`Podklady "${file.name}" byly úspěšně nahrány obchodníkovi!`);
                        } catch {
                          alert('Chyba při nahrávání podkladů');
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              {typeof (navigation as unknown as Record<string, unknown>).clientArtworkFileName === 'string' && (
                <div className="text-[11px] font-bold text-slate-600 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  📁 Nahrané podklady od klienta: {String((navigation as unknown as Record<string, unknown>).clientArtworkFileName)}
                </div>
              )}
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
