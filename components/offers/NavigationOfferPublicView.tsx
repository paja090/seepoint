'use client';

import { useState } from 'react';
import {
  MapPin,
  Store,
  Compass,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  MoveHorizontal,
  ChevronRight,
  Image as ImageIcon,
  CheckCircle2,
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

export function formatDistanceBadge(point: any) {
  if (point.distanceSource === 'MANUAL' && point.manualDistanceValue) {
    const unit = point.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm';
    return `${point.manualDistanceValue} ${unit} od cíle`;
  }
  if (point.calculatedDistanceMeters) {
    if (point.calculatedDistanceMeters >= 1000) {
      return `${(point.calculatedDistanceMeters / 1000).toFixed(1).replace('.', ',')} km od cíle`;
    }
    return `${point.calculatedDistanceMeters} m od cíle`;
  }
  return 'Trasa vypočítávána';
}

export function NavigationOfferPublicView({ offer }: { offer: OfferView }) {
  const navigation = offer.navigation;
  const [selectedPointId, setSelectedPointId] = useState<string | null>(
    navigation?.points[0]?.id || null,
  );

  if (!navigation) return null;

  const target = {
    latitude: navigation.targetLatitude,
    longitude: navigation.targetLongitude,
    label: navigation.targetName,
    address: navigation.targetAddress || undefined,
  };

  const selectedPoint = navigation.points.find((p) => p.id === selectedPointId) || navigation.points[0];

  return (
    <section className="space-y-6">
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

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-xs min-w-[240px]">
            <div className="text-xs font-bold text-slate-400">Celkový počet bodů trasy</div>
            <div className="mt-1 text-2xl font-black text-white">{navigation.points.length} navigačních cedulí</div>
            <div className="mt-1 text-xs text-sky-400 font-semibold">📍 Plně propojeno přes Google Maps Routes API</div>
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
            points={navigation.points.map((p) => ({
              id: p.id,
              label: p.label,
              latitude: p.latitude,
              longitude: p.longitude,
              arrowDirectionEnum: (p as any).arrowDirectionEnum,
              pillarNumber: (p as any).pillarNumber,
              pillarType: (p as any).pillarType,
              routePolyline: (p as any).routePolyline,
              calculatedDistanceMeters: (p as any).calculatedDistanceMeters,
            }))}
            mode="point"
            onTargetSelect={() => {}}
            onPointMove={() => {}}
            onMapClick={() => {}}
          />
        </div>

        {/* Navigation Points Selector List & Selected Detail */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Seznam vytipovaných bodů ({navigation.points.length})</h3>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {navigation.points.map((point, index) => {
              const isSelected = point.id === selectedPointId;
              const pAny = point as any;

              return (
                <article
                  key={point.id}
                  onClick={() => setSelectedPointId(point.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/50 shadow-md ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-slate-50/80 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black ${
                        isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
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

                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm">{money(point.subtotal)}</div>
                      <div className="text-[11px] text-slate-400">za bod</div>
                    </div>
                  </div>

                  {/* Metadata Row: Arrow + Distance + Pillar */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <ArrowBadge arrowEnum={pAny.arrowDirectionEnum} />

                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 border border-slate-200">
                      <Compass size={13} className="text-sky-600" />
                      {formatDistanceBadge(pAny)}
                    </span>

                    {pAny.pillarNumber && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                        📍 Sloup {pAny.pillarNumber}
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
                  {(point as any).visualizedPhotoUrl && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      <img
                        src={(point as any).visualizedPhotoUrl}
                        alt={`Vizualizace ${point.label}`}
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
