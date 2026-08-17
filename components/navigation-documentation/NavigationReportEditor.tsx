'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Camera, Check, Compass, Eye, EyeOff } from 'lucide-react';
import type { PrePublishWarning } from '@/lib/navigation-documentation';

export type ReportItemEdit = {
  id: string;
  navigationPointId?: string | null;
  carrierId?: string | null;
  selectedPhotoId?: string | null;
  clientNote?: string | null;
  customDirection?: string | null;
  snapshot?: { direction?: string | null } | null;
  sortOrder: number;
  isVisible: boolean;
  navigationPoint?: {
    id: string;
    label: string;
    address?: string | null;
    latitude: number;
    longitude: number;
    status: string;
    orientation?: string | null;
    variant?: string | null;
  } | null;
  carrier?: {
    code: string;
    name: string;
    address?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    photos: Array<{ id: string; url?: string | null; isClientVisible: boolean; isPrivate: boolean; createdAt: string }>;
  } | null;
  selectedPhoto?: { id: string; url?: string | null; isClientVisible: boolean } | null;
};

const DIRECTION_PRESETS = [
  'Obousměrný (A/B)',
  'Jednosměrný – Směr centrum',
  'Jednosměrný – Směr výjezd z města',
  'Jednosměrný – Pravá strana vozovky',
  'Jednosměrný – Levá strana vozovky',
  'Směr Kruhový objezd',
  'Směr Nákupní zóna / Parkoviště',
];

export function NavigationReportEditor({
  items: initialItems,
  warnings,
  onSave,
  saving,
}: {
  items: ReportItemEdit[];
  warnings: PrePublishWarning[];
  onSave: (updatedItems: ReportItemEdit[]) => void;
  saving: boolean;
}) {
  const [items, setItems] = useState<ReportItemEdit[]>(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function toggleVisibility(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, isVisible: !item.isVisible } : item)),
    );
  }

  function updatePhoto(id: string, photoId: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const availablePhotos = item.carrier?.photos || (item.navigationPoint as any)?.carrier?.photos || [];
        const foundPhoto = availablePhotos.find((p: any) => p.id === photoId) ?? null;
        return {
          ...item,
          selectedPhotoId: photoId || null,
          selectedPhoto: foundPhoto
            ? {
                id: foundPhoto.id,
                url: foundPhoto.url || `/api/photos/${foundPhoto.id}/file`,
                isClientVisible: foundPhoto.isClientVisible,
              }
            : null,
        };
      }),
    );
  }

  function updateNote(id: string, note: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, clientNote: note } : item)),
    );
  }

  function updateDirection(id: string, direction: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          customDirection: direction,
          navigationPoint: item.navigationPoint
            ? { ...item.navigationPoint, orientation: direction }
            : null,
        };
      }),
    );
  }

  return (
    <div className="space-y-6">
      {/* Warnings Bar */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>Kontrola před publikováním ({warnings.length} upozornění)</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Header & Save Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Položky fotodokumentace ({items.length})</h3>
          <p className="text-xs text-slate-500">Úprava fotografií, směru a poznámek pro klientský export.</p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50 transition"
          disabled={saving}
          onClick={() => onSave(items)}
          type="button"
        >
          <Check size={16} />
          {saving ? 'Ukládám zmeny…' : 'Uložit změny položek'}
        </button>
      </div>

      {/* Items List */}
      <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {items.map((item, idx) => {
          const label = item.navigationPoint?.label || item.carrier?.code || item.carrier?.name || `Navigační bod #${idx + 1}`;
          const address = item.navigationPoint?.address || item.carrier?.address || 'Adresa neuvedena';
          const city = item.carrier?.city || 'Lokalita neuvedena';
          const currentDir = item.customDirection || item.navigationPoint?.orientation || item.snapshot?.direction || 'Obousměrný (A/B)';

          const lat = item.navigationPoint?.latitude ?? item.carrier?.latitude;
          const lng = item.navigationPoint?.longitude ?? item.carrier?.longitude;
          const hasGps = lat !== undefined && lat !== null && lng !== undefined && lng !== null && (lat !== 0 || lng !== 0);

          const photoSrc =
            item.selectedPhoto?.url || (item.selectedPhoto?.id ? `/api/photos/${item.selectedPhoto.id}/file` : null);

          const effectiveCarrier = item.carrier || (item.navigationPoint as any)?.carrier;
          const availablePhotos = effectiveCarrier?.photos || [];

          return (
            <div
              key={item.id}
              className={`p-5 transition ${!item.isVisible ? 'bg-slate-50/80 opacity-60' : 'hover:bg-slate-50/40'}`}
            >
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                {/* Left Column: Photo Preview & Selection */}
                <div className="space-y-2.5">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 group">
                    {photoSrc ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        alt={label}
                        className="h-full w-full object-cover"
                        src={photoSrc}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-3 text-center text-slate-400">
                        <Camera size={26} />
                        <span className="mt-1 text-xs">Bez fotografie</span>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded-lg bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                      #{idx + 1}
                    </span>
                  </div>

                  {availablePhotos.length > 0 ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Výběr fotografie</label>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                        value={item.selectedPhotoId || ''}
                        onChange={(e) => updatePhoto(item.id, e.target.value)}
                      >
                        <option value="">-- Bez fotky --</option>
                        {availablePhotos.map((p: any, pIdx: number) => (
                          <option key={p.id} value={p.id}>
                            Fotka #{pIdx + 1} ({new Date(p.createdAt).toLocaleDateString('cs-CZ')})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-[11px] text-amber-700 font-medium block">Žádná fotka v nosiči</span>
                  )}
                </div>

                {/* Right Column: Editable Details */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Header info & Visibility toggle */}
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
                            {label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                            {item.navigationPoint?.status || 'INSTALLED'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 font-semibold">{city} · {address}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleVisibility(item.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          item.isVisible
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {item.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        {item.isVisible ? 'Zahrnuto v reportu' : 'Vyřazeno'}
                      </button>
                    </div>

                    {!hasGps && (
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        <AlertTriangle size={13} /> Bez GPS souřadnic (nebude na mapě)
                      </p>
                    )}

                    {/* EDITABLE DIRECTION / SMĚR NOSIČE */}
                    <div className="grid gap-3 sm:grid-cols-2 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <Compass size={14} className="text-sky-600" />
                          Směr / Orientace navigační cedule
                        </label>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                          value={DIRECTION_PRESETS.includes(currentDir) ? currentDir : 'custom'}
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              updateDirection(item.id, e.target.value);
                            }
                          }}
                        >
                          {DIRECTION_PRESETS.map((preset) => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                          <option value="custom">Vlastní zadání směru…</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Textové upřesnění směru
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                          placeholder="Např. Směr Olomouc / Pravá strana"
                          value={currentDir}
                          onChange={(e) => updateDirection(item.id, e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Client Note Textarea */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Poznámka k realizaci pro klienta
                      </label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                        placeholder="Zadejte doplňující poznámku pro klienta (např. Obnovená fólie 04/2026)…"
                        value={item.clientNote || ''}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
