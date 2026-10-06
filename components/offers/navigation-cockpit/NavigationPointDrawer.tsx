'use client';

import { useState } from 'react';
import {
  X,
  MapPin,
  Compass,
  Camera,
  DollarSign,
  FileText,
  Upload,
  Image as ImageIcon,
  Zap,
  RotateCw,
  RefreshCw,
  Layers,
} from 'lucide-react';
import type { DraftPoint, DraftTarget } from './types';
import {
  NAVIGATION_CARRIER_TYPES,
  CARRIER_PIN_COLORS,
  getPointPinVisual,
} from '@/lib/offers/navigation-carrier-types';

interface NavigationPointDrawerProps {
  point: DraftPoint | null;
  onClose: () => void;
  onUpdatePoint: (id: string, updates: Partial<DraftPoint>) => void;
  targets: DraftTarget[];
  proposalMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE';
  onOpenVisualizer?: (pointId: string) => void;
  onUploadSitePhoto?: (pointId: string, file: File) => void;
}

export function NavigationPointDrawer({
  point,
  onClose,
  onUpdatePoint,
  targets,
  proposalMode,
  onOpenVisualizer,
  onUploadSitePhoto,
}: NavigationPointDrawerProps) {
  if (!point) return null;

  const pinVis = getPointPinVisual(point);
  const isPricedMode = proposalMode === 'PRICED_QUOTE';
  const isManualActive = point.distanceSource === 'MANUAL' && Boolean(point.manualDistanceValue?.trim());

  // Carrier specific dimension suggestions
  const carrierVariantsMap: Record<string, string[]> = {
    A_BOARD: ['A1 (594 × 841 mm)', 'B1 (700 × 1000 mm)', 'A0 (841 × 1189 mm)', '500 × 700 mm', 'Atyp stojan'],
    TOWER: ['1 × 3 m', '1,2 × 4 m', '1,5 × 5 m', 'Atyp věž'],
    CITYLIGHT: ['118,5 × 175 cm (CLV standard)', 'Atyp vitrína'],
    BILLBOARD: ['5,1 × 2,4 m (Eurobillboard)', '9,6 × 3,6 m (Bigboard)', 'Atyp billboard'],
    BANNER: ['2 × 1 m', '3 × 1 m', '4 × 1 m', '5 × 2 m', 'Vlastní plachta'],
    NAVIGATION: ['670 × 900 mm (Ostrava)', 'Havířov – atyp s horním půlkruhem', '120 × 80 cm', '100 × 150 cm'],
    OTHER: ['Dle specifikace', 'Atypický rozměr'],
  };

  const currentVariants = carrierVariantsMap[pinVis.category.id] || carrierVariantsMap.NAVIGATION;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl border-l border-slate-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-xs text-white shadow-xs"
            style={{ backgroundColor: pinVis.color }}
          >
            {pinVis.icon}
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 truncate max-w-sm">
              {point.label}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span>{pinVis.category.shortLabel}</span>
              <span>·</span>
              <span className="font-mono">{pinVis.color}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
        {/* Sekce 1: Umístění a cíl */}
        <div className="space-y-3">
          <h3 className="font-black uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
            <MapPin size={13} className="text-sky-600" />
            <span>1. Umístění a cíl trasy</span>
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">Název bodu *</label>
              <input
                type="text"
                className="input text-xs font-bold text-slate-900"
                value={point.label}
                onChange={(e) => onUpdatePoint(point.id, { label: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">Adresa / Křižovatka</label>
              <input
                type="text"
                className="input text-xs"
                placeholder="např. Hlavní × Nádražní, Ostrava"
                value={point.address || ''}
                onChange={(e) => onUpdatePoint(point.id, { address: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Zeměpisná šířka (Lat)</label>
              <input
                type="number"
                step="any"
                className="input text-xs font-mono"
                value={point.latitude || ''}
                onChange={(e) => onUpdatePoint(point.id, { latitude: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Zeměpisná délka (Lng)</label>
              <input
                type="number"
                step="any"
                className="input text-xs font-mono"
                value={point.longitude || ''}
                onChange={(e) => onUpdatePoint(point.id, { longitude: Number(e.target.value) })}
              />
            </div>

            {targets.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">🎯 Cílová provozovna</label>
                <select
                  className="input text-xs font-bold text-sky-950 bg-sky-50/60 border-sky-300"
                  value={point.targetId || targets[0]?.id || ''}
                  onChange={(e) => {
                    const tid = e.target.value;
                    const chosen = targets.find((t) => t.id === tid) || targets[0];
                    onUpdatePoint(point.id, {
                      targetId: tid,
                      targetLatitude: chosen?.latitude,
                      targetLongitude: chosen?.longitude,
                    });
                  }}
                >
                  {targets.map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      #{idx + 1} {t.name} {t.address ? `(${t.address})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Vzdálenost */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Vzdálenost do cíle</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  Google auto: <strong>{point.calculatedDistanceMeters ? `${point.calculatedDistanceMeters} m` : '—'}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Ruční hodnota vzdálenosti
                </label>
                <input
                  type="text"
                  className={`input text-xs ${isManualActive ? 'border-amber-400 bg-amber-50/40 text-amber-950 font-bold' : ''}`}
                  placeholder={point.calculatedDistanceMeters ? `${point.calculatedDistanceMeters}` : 'např. 350'}
                  value={point.manualDistanceValue || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numStr = val.trim().replace(',', '.').replace(/[^0-9.]/g, '');
                    onUpdatePoint(point.id, {
                      manualDistanceValue: val,
                      distanceSource: numStr && Number(numStr) > 0 ? 'MANUAL' : 'CALCULATED',
                    });
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Jednotka
                </label>
                <select
                  className="input text-xs font-semibold"
                  value={point.manualDistanceUnit || 'METERS'}
                  onChange={(e) =>
                    onUpdatePoint(point.id, {
                      manualDistanceUnit: e.target.value as 'METERS' | 'KILOMETERS',
                    })
                  }
                >
                  <option value="METERS">Metry (m)</option>
                  <option value="KILOMETERS">Kilometry (km)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Sekce 2: Navigační parametry a nosič */}
        <div className="space-y-3 pt-3 border-t">
          <h3 className="font-black uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
            <Compass size={13} className="text-sky-600" />
            <span>2. Typ nosiče a parametry značení</span>
          </h3>

          {/* Rychlá volba nosiče */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">Kategorie nosiče</label>
            <div className="flex flex-wrap gap-1.5">
              {NAVIGATION_CARRIER_TYPES.map((cat) => {
                const isSelected = pinVis.category.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      const smartVariants = carrierVariantsMap[cat.id] || [];
                      onUpdatePoint(point.id, {
                        navigationType: cat.defaultName,
                        color: cat.color,
                        variant: smartVariants[0] || point.variant,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.shortLabel}</span>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Směrová šipka (Enum)</label>
              <select
                className="input text-xs font-bold text-sky-900"
                value={point.arrowDirectionEnum || 'STRAIGHT'}
                onChange={(e) =>
                  onUpdatePoint(point.id, {
                    arrowDirectionEnum: e.target.value as DraftPoint['arrowDirectionEnum'],
                  })
                }
              >
                <option value="STRAIGHT">⬆️ Rovně (STRAIGHT)</option>
                <option value="LEFT">⬅️ Vlevo (LEFT)</option>
                <option value="RIGHT">➡️ Vpravo (RIGHT)</option>
                <option value="SLANTED_LEFT">↖️ Šikmo vlevo (SLANTED_LEFT)</option>
                <option value="SLANTED_RIGHT">↗️ Šikmo vpravo (SLANTED_RIGHT)</option>
                <option value="U_TURN">↩️ Otočení (U_TURN)</option>
                <option value="TWO_WAY">↔️ Obousměrný (TWO_WAY)</option>
                <option value="ROUNDABOUT_1">🔄 Kruhový objezd – 1. výjezd</option>
                <option value="ROUNDABOUT_2">🔄 Kruhový objezd – 2. výjezd</option>
                <option value="ROUNDABOUT_3">🔄 Kruhový objezd – 3. výjezd</option>
                <option value="ROUNDABOUT_4">🔄 Kruhový objezd – 4. výjezd</option>
                <option value="ROUNDABOUT_5">🔄 Kruhový objezd – 5. výjezd</option>
                <option value="ROUNDABOUT">🔄 Kruhový objezd – obecně</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Číslo sloupu (pillarNumber)</label>
              <input
                type="text"
                className="input text-xs font-mono"
                placeholder="např. VO #142"
                value={point.pillarNumber || ''}
                onChange={(e) => onUpdatePoint(point.id, { pillarNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Typ sloupu / konstrukce</label>
              <input
                type="text"
                className="input text-xs"
                placeholder="např. Sloup veřejného osvětlení"
                value={point.pillarType || ''}
                onChange={(e) => onUpdatePoint(point.id, { pillarType: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Orientace značení</label>
              <input
                type="text"
                className="input text-xs"
                placeholder="např. vpravo, oboustranně..."
                value={point.orientation || ''}
                onChange={(e) => onUpdatePoint(point.id, { orientation: e.target.value })}
              />
            </div>

            {/* Rozměr / varianta */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block font-bold text-slate-800">Rozměr / varianta nosiče</label>
              <input
                type="text"
                className="input text-xs font-semibold"
                placeholder="např. 670 × 900 mm, A1..."
                value={point.variant}
                onChange={(e) => onUpdatePoint(point.id, { variant: e.target.value })}
              />
              <div className="flex flex-wrap gap-1">
                {currentVariants.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onUpdatePoint(point.id, { variant: v })}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold border transition cursor-pointer ${
                      point.variant === v
                        ? 'bg-sky-100 text-sky-900 border-sky-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Barva špendlíku na mapě */}
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">Barva špendlíku na mapě</label>
                {point.color && (
                  <button
                    type="button"
                    onClick={() => onUpdatePoint(point.id, { color: undefined })}
                    className="text-[10px] text-sky-700 hover:underline cursor-pointer"
                  >
                    Obnovit výchozí ({pinVis.category.shortLabel})
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {CARRIER_PIN_COLORS.slice(0, 8).map((c) => {
                  const isSelected = (point.color || pinVis.color).toLowerCase() === c.value.toLowerCase();
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => onUpdatePoint(point.id, { color: c.value })}
                      title={c.label}
                      className={`h-6 w-6 rounded-full border-2 transition transform hover:scale-110 cursor-pointer ${
                        isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-105 border-white' : 'border-white shadow-2xs'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  );
                })}
                <label
                  className="relative inline-flex items-center justify-center h-6 w-6 rounded-full border border-slate-300 bg-white cursor-pointer shadow-xs hover:border-slate-400 overflow-hidden"
                  title="Vlastní barva"
                >
                  <input
                    type="color"
                    value={point.color || pinVis.color}
                    onChange={(e) => onUpdatePoint(point.id, { color: e.target.value })}
                    className="absolute -inset-2 w-10 h-10 cursor-pointer opacity-0"
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-slate-200"
                    style={{ backgroundColor: point.color || pinVis.color }}
                  />
                </label>
                <span className="font-mono text-xs text-slate-600 font-medium">
                  {point.color || pinVis.color}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sekce 3: Fotodokumentace */}
        <div className="space-y-3 pt-3 border-t">
          <h3 className="font-black uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
            <Camera size={13} className="text-sky-600" />
            <span>3. Fotodokumentace a vizualizace</span>
          </h3>

          {/* Reálná fotka sloupu */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {point.sitePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={point.sitePhotoUrl}
                  alt={point.label}
                  className="h-16 w-20 rounded-lg object-cover border"
                />
              ) : (
                <div className="flex h-16 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400">
                  <ImageIcon size={20} />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-bold text-slate-900 block truncate">Fotografie sloupu v terénu</span>
                <span className="text-[11px] text-slate-500">
                  {point.sitePhotoUrl ? '✓ Fotografie uložena' : 'Doporučeno pro terénní ověření'}
                </span>
              </div>
            </div>

            <label className="btn btn-secondary text-xs px-3 py-1.5 font-bold flex items-center gap-1 cursor-pointer shrink-0">
              <Upload size={13} />
              <span>{point.sitePhotoUrl ? 'Nahradit' : 'Nahrát'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onUploadSitePhoto) {
                    onUploadSitePhoto(point.id, file);
                  }
                }}
              />
            </label>
          </div>

          {/* Vizualizace */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {point.visualizedPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={point.visualizedPhotoUrl}
                  alt="Vizualizace"
                  className="h-16 w-20 rounded-lg object-cover border"
                />
              ) : (
                <div className="flex h-16 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400">
                  <Camera size={20} />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-bold text-slate-900 block truncate">Klientská foto-vizualizace</span>
                <span className="text-[11px] text-slate-500">
                  {point.visualizedPhotoUrl ? '✓ Vizualizace vygenerována' : 'Zobrazí se v nabídce'}
                </span>
              </div>
            </div>

            {onOpenVisualizer && (
              <button
                type="button"
                onClick={() => onOpenVisualizer(point.id)}
                className="btn btn-secondary text-xs px-3 py-1.5 font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Zap size={13} className="text-amber-600" />
                <span>Foto-vizualizátor</span>
              </button>
            )}
          </div>
        </div>

        {/* Sekce 4: Poznámky */}
        <div className="space-y-3 pt-3 border-t">
          <h3 className="font-black uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
            <FileText size={13} className="text-sky-600" />
            <span>4. Poznámky</span>
          </h3>

          <div className="space-y-2">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Poznámka pro klienta (viditelná v nabídce)</label>
              <textarea
                rows={2}
                className="input text-xs"
                placeholder="např. Výborná viditelnost při sjezdu z kruhového objezdu..."
                value={point.clientNote || ''}
                onChange={(e) => onUpdatePoint(point.id, { clientNote: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Interní poznámka pro montáž</label>
              <textarea
                rows={2}
                className="input text-xs"
                placeholder="např. Nutná delší páska, vysoký sloup..."
                value={point.internalNote || ''}
                onChange={(e) => onUpdatePoint(point.id, { internalNote: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Sekce 5: Ceny (POUZE v režimu PRICED_QUOTE) */}
        {isPricedMode && (
          <div className="space-y-3 pt-3 border-t bg-purple-50/40 p-4 rounded-xl border-purple-200">
            <h3 className="font-black uppercase tracking-wider text-purple-900 text-[11px] flex items-center gap-1.5">
              <DollarSign size={13} className="text-purple-600" />
              <span>5. Individuální ceny bodu (Kč bez DPH)</span>
            </h3>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Pronájem (rok)</label>
                <input
                  type="text"
                  className="input text-xs font-mono font-bold"
                  value={point.unitPrice}
                  onChange={(e) => onUpdatePoint(point.id, { unitPrice: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Výroba rámu</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  value={point.framePrice}
                  onChange={(e) => onUpdatePoint(point.id, { framePrice: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Tisk cedule</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  value={point.productionPrice}
                  onChange={(e) => onUpdatePoint(point.id, { productionPrice: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Montáž</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  value={point.installationPrice}
                  onChange={(e) => onUpdatePoint(point.id, { installationPrice: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Demontáž</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  value={point.removalPrice}
                  onChange={(e) => onUpdatePoint(point.id, { removalPrice: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Počet kusů</label>
                <input
                  type="text"
                  className="input text-xs font-mono font-bold"
                  value={point.quantity}
                  onChange={(e) => onUpdatePoint(point.id, { quantity: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary text-xs px-5 py-2 font-bold cursor-pointer"
        >
          Hotovo (Zavřít detail)
        </button>
      </div>
    </div>
  );
}
