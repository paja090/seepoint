'use client';

import {
  ArrowUp,
  ArrowDown,
  Copy,
  Edit3,
  MapPin,
  Trash2,
  CheckCircle2,
  Camera,
  Check,
  Compass,
} from 'lucide-react';
import type { DraftPoint, DraftTarget } from './types';
import { getPointPinVisual } from '@/lib/offers/navigation-carrier-types';

interface NavigationPointListProps {
  points: DraftPoint[];
  targets: DraftTarget[];
  selectedPointId: string | null;
  onSelectPoint: (id: string) => void;
  onOpenDetail: (point: DraftPoint) => void;
  onDuplicatePoint: (id: string) => void;
  onDeletePoint: (id: string) => void;
  onMovePoint: (fromIndex: number, toIndex: number) => void;
  proposalMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE';
}

export function NavigationPointList({
  points,
  targets,
  selectedPointId,
  onSelectPoint,
  onOpenDetail,
  onDuplicatePoint,
  onDeletePoint,
  onMovePoint,
  proposalMode,
}: NavigationPointListProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500 space-y-2">
        <MapPin size={28} className="mx-auto text-slate-300" />
        <p className="text-xs font-bold text-slate-700">Zatím nebyly přidány žádné body.</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Klikněte kamkoliv do mapy vlevo nebo použijte tlačítko <strong>+ Přidat navigační bod</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
      {points.map((pt, index) => {
        const isSelected = selectedPointId === pt.id;
        const vis = getPointPinVisual(pt);
        const assignedTarget = targets.find((t) => t.id === pt.targetId) || targets[0];

        const distText = pt.distanceSource === 'MANUAL' && pt.manualDistanceValue?.trim()
          ? `${pt.manualDistanceValue.trim()} ${pt.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm'} (ručně)`
          : pt.calculatedDistanceMeters
          ? pt.calculatedDistanceMeters >= 1000
            ? `${(pt.calculatedDistanceMeters / 1000).toFixed(1)} km`
            : `${pt.calculatedDistanceMeters} m`
          : null;

        const hasPhoto = Boolean(pt.sitePhotoUrl || pt.visualizedPhotoUrl);

        return (
          <div
            key={pt.id}
            onClick={() => onSelectPoint(pt.id)}
            className={`group rounded-xl border p-3 transition cursor-pointer text-left ${
              isSelected
                ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
            }`}
          >
            {/* Top row: Order, label, carrier chip */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-black text-xs text-white shadow-2xs"
                  style={{ backgroundColor: vis.color }}
                >
                  #{index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-extrabold text-slate-900 truncate">
                    {pt.label}
                  </h4>
                  {pt.address && (
                    <p className="text-[10px] text-slate-500 truncate">{pt.address}</p>
                  )}
                </div>
              </div>

              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border"
                style={{
                  backgroundColor: `${vis.color}15`,
                  borderColor: `${vis.color}40`,
                  color: vis.color,
                }}
              >
                <span>{vis.icon}</span>
                <span>{vis.category.shortLabel}</span>
              </span>
            </div>

            {/* Middle row: Routing and metadata */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600">
              {distText && (
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Compass size={11} className="text-sky-600" />
                  <span>{distText}</span>
                </span>
              )}

              {assignedTarget && targets.length > 1 && (
                <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[120px]">
                  ↳ {assignedTarget.name}
                </span>
              )}

              {pt.pillarNumber && (
                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-700 font-bold">
                  VO #{pt.pillarNumber}
                </span>
              )}

              {hasPhoto ? (
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <Camera size={11} /> Foto ✓
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Bez fotky</span>
              )}

              {pt.isSelectedByClient === false && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 rounded border border-amber-200">
                  Klient nevybral
                </span>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Posunout nahoru"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovePoint(index, index - 1);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  title="Posunout dolů"
                  disabled={index === points.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovePoint(index, index + 1);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                >
                  <ArrowDown size={13} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicatePoint(pt.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold cursor-pointer"
                  title="Duplikovat bod"
                >
                  <Copy size={11} />
                  <span>Duplikovat</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(pt);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-sky-100/70 hover:bg-sky-200/80 text-sky-900 px-2 py-0.5 font-bold cursor-pointer"
                >
                  <Edit3 size={11} />
                  <span>Detail</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePoint(pt.id);
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition"
                  title="Smazat bod"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
