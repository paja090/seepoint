'use client';

import { useState } from 'react';
import {
  Plus,
  Crosshair,
  RefreshCw,
  MapPin,
  Compass,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { DraftPoint, DraftTarget } from './types';
import { GoogleNavigationOfferMap } from '../GoogleNavigationOfferMap';
import { NavigationPointList } from './NavigationPointList';
import { NavigationPointDrawer } from './NavigationPointDrawer';

interface NavigationMapStepProps {
  points: DraftPoint[];
  targets: DraftTarget[];
  onPointsChange: (points: DraftPoint[]) => void;
  onTargetsChange: (targets: DraftTarget[]) => void;
  mode: 'target' | 'point';
  onModeChange: (mode: 'target' | 'point') => void;
  onAddPoint: () => void;
  onMapClick: (lat: number, lng: number, address?: string) => void;
  onPointMove: (id: string, lat: number, lng: number, calculatedDist?: number, polyline?: string, address?: string) => void;
  onRecalculateRoutes: () => Promise<void>;
  recalculatingRoutes: boolean;
  proposalMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE';
  onOpenVisualizer?: (pointId: string) => void;
  onUploadSitePhoto?: (pointId: string, file: File) => void;
}

export function NavigationMapStep({
  points,
  targets,
  onPointsChange,
  onTargetsChange,
  mode,
  onModeChange,
  onAddPoint,
  onMapClick,
  onPointMove,
  onRecalculateRoutes,
  recalculatingRoutes,
  proposalMode,
  onOpenVisualizer,
  onUploadSitePhoto,
}: NavigationMapStepProps) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(points[0]?.id || null);
  const [editingPoint, setEditingPoint] = useState<DraftPoint | null>(null);

  const activeTarget = targets[0];

  function handleSelectPoint(id: string) {
    setSelectedPointId(id);
  }

  function handleOpenDetail(point: DraftPoint) {
    setEditingPoint(point);
    setSelectedPointId(point.id);
  }

  function handleCloseDetail() {
    setEditingPoint(null);
  }

  function handleUpdatePoint(id: string, updates: Partial<DraftPoint>) {
    onPointsChange(
      points.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    if (editingPoint && editingPoint.id === id) {
      setEditingPoint((prev) => (prev ? { ...prev, ...updates } : null));
    }
  }

  function handleDuplicatePoint(id: string) {
    const original = points.find((p) => p.id === id);
    if (!original) return;

    const newPoint: DraftPoint = {
      ...original,
      id: `point-${Date.now()}`,
      label: `${original.label} (kopie)`,
      latitude: original.latitude + 0.0003,
      longitude: original.longitude + 0.0003,
      stableKey: undefined,
      sitePhotoId: undefined,
      sitePhotoUrl: undefined,
      visualizedPhotoUrl: undefined,
    };

    const next = [...points, newPoint];
    onPointsChange(next);
    setSelectedPointId(newPoint.id);
  }

  function handleDeletePoint(id: string) {
    const next = points.filter((p) => p.id !== id);
    onPointsChange(next);
    if (selectedPointId === id) {
      setSelectedPointId(next[0]?.id || null);
    }
    if (editingPoint?.id === id) {
      setEditingPoint(null);
    }
  }

  function handleMovePoint(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= points.length || toIndex < 0 || toIndex >= points.length) return;
    const updated = [...points];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onPointsChange(updated);
  }

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddPoint}
            className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Přidat navigační bod</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('target')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              mode === 'target'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Crosshair size={14} />
            <span>Zaměřit cíl ({activeTarget?.name || 'Prodejnu'})</span>
          </button>

          {targets.length > 0 && points.length > 0 && (
            <button
              type="button"
              disabled={recalculatingRoutes}
              onClick={() => void onRecalculateRoutes()}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Přepočítat reálné jízdní trasy přes Google Routes API"
            >
              <RefreshCw size={14} className={recalculatingRoutes ? 'animate-spin text-sky-600' : ''} />
              <span>{recalculatingRoutes ? 'Přepočítávám trasy...' : 'Přepočítat trasy'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
          <span>
            📍 <strong>{points.length}</strong> {points.length === 1 ? 'bod' : points.length < 5 ? 'body' : 'bodů'}
          </span>
          <span>·</span>
          <span>
            🎯 <strong>{targets.length}</strong> {targets.length === 1 ? 'prodejna' : targets.length < 5 ? 'prodejny' : 'prodejen'}
          </span>
        </div>
      </div>

      {/* Main Workspace: 68% Map + 32% Compact Point List */}
      <div className="grid gap-4 lg:grid-cols-12 items-start">
        {/* Left Column: Dominant Map View (8 of 12 cols = 67%) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
          <GoogleNavigationOfferMap
            mode={mode}
            targets={targets.map((t) => ({
              id: t.id,
              latitude: t.latitude,
              longitude: t.longitude,
              label: t.name,
              address: t.address,
              color: t.color,
            }))}
            target={activeTarget ? {
              id: activeTarget.id,
              latitude: activeTarget.latitude,
              longitude: activeTarget.longitude,
              label: activeTarget.name || 'Cíl navigace',
              address: activeTarget.address,
              color: activeTarget.color,
            } : undefined}
            onTargetSelect={(place, targetId) => {
              const moved = targetId ? targets.find((t) => t.id === targetId) : activeTarget;
              if (moved) {
                const updated = {
                  ...moved,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  name: moved.name || place.label,
                  address: place.address || moved.address,
                };
                onTargetsChange(targets.map((t) => (t.id === moved.id ? updated : t)));
                onModeChange('point');
              }
            }}
            onMapClick={onMapClick}
            onPointMove={onPointMove}
            points={points}
            selectedPointId={selectedPointId}
            onPointClick={(id) => {
              setSelectedPointId(id);
              const pt = points.find((p) => p.id === id);
              if (pt) setEditingPoint(pt);
            }}
          />
        </div>

        {/* Right Column: Compact Points List (4 of 12 cols = 33%) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <span>Navigační body trasy</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700">
                {points.length}
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">Kliknutím otevřete detail</span>
          </div>

          <NavigationPointList
            points={points}
            targets={targets}
            selectedPointId={selectedPointId}
            onSelectPoint={handleSelectPoint}
            onOpenDetail={handleOpenDetail}
            onDuplicatePoint={handleDuplicatePoint}
            onDeletePoint={handleDeletePoint}
            onMovePoint={handleMovePoint}
            proposalMode={proposalMode}
          />
        </div>
      </div>

      {/* Slide-over Side Drawer for Point Details */}
      {editingPoint && (
        <NavigationPointDrawer
          point={editingPoint}
          onClose={handleCloseDetail}
          onUpdatePoint={handleUpdatePoint}
          targets={targets}
          proposalMode={proposalMode}
          onOpenVisualizer={onOpenVisualizer}
          onUploadSitePhoto={onUploadSitePhoto}
        />
      )}
    </div>
  );
}
