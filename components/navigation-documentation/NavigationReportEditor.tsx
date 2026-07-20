'use client';

import { useState } from 'react';
import { AlertTriangle, Camera, Check } from 'lucide-react';
import type { PrePublishWarning } from '@/lib/navigation-documentation';

export type ReportItemEdit = {
  id: string;
  navigationPointId?: string | null;
  carrierId?: string | null;
  selectedPhotoId?: string | null;
  clientNote?: string | null;
  sortOrder: number;
  isVisible: boolean;
  navigationPoint?: {
    label: string;
    address?: string | null;
    latitude: number;
    longitude: number;
    status: string;
    orientation?: string | null;
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

  function toggleVisibility(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, isVisible: !item.isVisible } : item)),
    );
  }

  function updatePhoto(id: string, photoId: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const foundPhoto = item.carrier?.photos.find((p) => p.id === photoId) ?? null;
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

  return (
    <div className="space-y-6">
      {/* Warnings List */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>Kontrola před publikováním ({warnings.length})</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-800 space-y-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Items Curation Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Položky fotodokumentace ({items.length})</h3>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            disabled={saving}
            onClick={() => onSave(items)}
            type="button"
          >
            <Check size={15} />
            {saving ? 'Ukládám…' : 'Uložit změny položek'}
          </button>
        </div>

        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((item) => {
            const label = item.navigationPoint?.label || item.carrier?.code || item.carrier?.name || 'Navigační bod';
            const address = item.navigationPoint?.address || item.carrier?.address || 'Bez adresy';
            const city = item.carrier?.city || 'Lokalita neuvedena';
            const lat = item.navigationPoint?.latitude ?? item.carrier?.latitude;
            const lng = item.navigationPoint?.longitude ?? item.carrier?.longitude;
            const hasGps = lat !== undefined && lat !== null && lng !== undefined && lng !== null && (lat !== 0 || lng !== 0);

            const photoSrc =
              item.selectedPhoto?.url || (item.selectedPhoto?.id ? `/api/photos/${item.selectedPhoto.id}/file` : null);

            return (
              <div
                key={item.id}
                className={`p-4 transition ${!item.isVisible ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/50'}`}
              >
                <div className="grid gap-4 md:grid-cols-[200px_1fr_240px]">
                  {/* Photo Preview & Selector */}
                  <div className="space-y-2">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {photoSrc ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={label}
                          className="h-full w-full object-cover"
                          src={photoSrc}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-3 text-center text-slate-400">
                          <Camera size={24} />
                          <span className="mt-1 text-[11px]">Bez fotografie</span>
                        </div>
                      )}
                    </div>

                    {/* Photo selector dropdown */}
                    {item.carrier?.photos && item.carrier.photos.length > 0 && (
                      <select
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={item.selectedPhotoId || ''}
                        onChange={(e) => updatePhoto(item.id, e.target.value)}
                      >
                        <option value="">-- Vybrat fotku --</option>
                        {item.carrier.photos.map((p, pIdx) => (
                          <option key={p.id} value={p.id}>
                            Fotka #{pIdx + 1} ({new Date(p.createdAt).toLocaleDateString('cs-CZ')})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Navigation Details */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500">{city} · {address}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        {item.navigationPoint?.status || 'INSTALLED'}
                      </span>
                    </div>

                    {!hasGps && (
                      <p className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <AlertTriangle size={12} /> Bez GPS (nelze zobrazit na mapě)
                      </p>
                    )}

                    {/* Client Note Textarea */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Poznámka pro klienta (zobrazí se na klientské stránce)
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                        placeholder="Napište doplňující poznámku pro klienta…"
                        value={item.clientNote || ''}
                        onChange={(e) => updateNote(item.id, e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Actions & Visibility Toggle */}
                  <div className="flex flex-col justify-between items-end gap-2 border-t pt-3 md:border-t-0 md:pt-0">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={item.isVisible}
                        onChange={() => toggleVisibility(item.id)}
                        className="rounded accent-sky-600"
                      />
                      <span>{item.isVisible ? 'Zahrnuto v reportu' : 'Vyřazeno z reportu'}</span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
