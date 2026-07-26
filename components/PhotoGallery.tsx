'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiResponseMessage, prepareImageForUpload, validateImageFile } from '@/lib/client-image-upload';
import type { Photo, PhotoType, Surface } from '@/lib/types';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailLink?: string;
}

type GalleryPhoto = Photo & { targetLabel: string };

const PHOTO_TYPES: Array<{ value: PhotoType; label: string }> = [
  { value: 'LOCATION', label: 'Umístění' },
  { value: 'CARRIER', label: 'Nosič' },
  { value: 'CAMPAIGN', label: 'Kampaň' },
  { value: 'INSTALLATION', label: 'Instalace' },
  { value: 'CHECK', label: 'Kontrola' },
  { value: 'ARCHIVE', label: 'Archiv' },
];

export function PhotoGallery({
  carrierId,
  carrierPhotos,
  surfaces,
  canEdit = false,
}: {
  carrierId: string;
  carrierPhotos: Photo[];
  surfaces: Surface[];
  canEdit?: boolean;
}) {
  const initialPhotos: GalleryPhoto[] = [
    ...carrierPhotos.map((photo) => ({ ...photo, targetLabel: 'Nosič' })),
    ...surfaces.flatMap((surface) =>
      surface.photos.map((photo) => ({ ...photo, targetLabel: surface.name })),
    ),
  ].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [target, setTarget] = useState('carrier');
  const [type, setType] = useState<PhotoType>('CARRIER');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Google Drive Modal Selector State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [linkClientVisible, setLinkClientVisible] = useState(false);

  // Lightbox State
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  // Synchronize photos state when props change
  useEffect(() => {
    const updated = [
      ...carrierPhotos.map((photo) => ({ ...photo, targetLabel: 'Nosič' })),
      ...surfaces.flatMap((surface) =>
        surface.photos.map((photo) => ({ ...photo, targetLabel: surface.name })),
      ),
    ].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
    setPhotos(updated);
  }, [carrierPhotos, surfaces]);

  // Lightbox handlers
  const closeLightbox = useCallback(() => {
    setActivePhotoIndex(null);
    if (triggerElementRef.current) {
      triggerElementRef.current.focus();
    }
  }, []);

  const navigateLightbox = useCallback((direction: -1 | 1) => {
    setActivePhotoIndex((currentIndex) => {
      if (currentIndex === null) return null;
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = photos.length - 1;
      if (nextIndex >= photos.length) nextIndex = 0;
      return nextIndex;
    });
    setZoomScale(1);
  }, [photos.length]);

  // Lightbox key listeners & scrolling lock
  useEffect(() => {
    if (activePhotoIndex === null) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        navigateLightbox(1);
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Focus trap inside Lightbox
    if (lightboxRef.current) {
      lightboxRef.current.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [activePhotoIndex, navigateLightbox, closeLightbox]);

  // Handle standard upload
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedFile = fileInput.current?.files?.[0];
    if (!selectedFile) return setError('Vyber fotografii.');
    const validationError = validateImageFile(selectedFile);
    if (validationError) return setError(validationError);

    setSaving(true);
    setError('');

    try {
      const file = await prepareImageForUpload(selectedFile);
      const form = new FormData();
      form.append('file', file);
      form.append('type', type);
      if (note) form.append('note', note);
      if (target === 'carrier') form.append('carrierId', carrierId);
      else form.append('surfaceId', target.replace('surface:', ''));
      const response = await fetch('/api/photos', { method: 'POST', body: form });
      if (!response.ok) throw new Error(await apiResponseMessage(response, 'Fotografii se nepodařilo uložit.'));
      const data = await response.json();

      const targetLabel =
        target === 'carrier' ? 'Nosič' : surfaces.find((surface) => `surface:${surface.id}` === target)?.name ?? 'Plocha';
      setPhotos((current) => [...current, { ...data, targetLabel }].sort((l, r) => (l.sortOrder ?? 0) - (r.sortOrder ?? 0)));
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Fotografii se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  // Remove photo ( Czech warning )
  async function remove(photo: GalleryPhoto) {
    if (!window.confirm('Opravdu chcete fotografii odebrat z tohoto nosiče? Soubor na Google Disku zůstane zachován.')) return;
    setError('');
    const response = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? 'Fotografii se nepodařilo odstranit.');
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  }

  // Load Google Drive files
  async function openDriveModal() {
    setIsDriveModalOpen(true);
    setLoadingDrive(true);
    setDriveError('');
    setSelectedFileIds(new Set());
    try {
      const res = await fetch('/api/google-drive/images');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Nepodařilo se načíst soubory.');
      setDriveFiles(data);
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : 'Nepodařilo se načíst soubory.');
    } finally {
      setLoadingDrive(false);
    }
  }

  // Handle multi-select toggle
  function toggleFileSelection(fileId: string) {
    const next = new Set(selectedFileIds);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    setSelectedFileIds(next);
  }

  // Confirm linking of selected photos
  async function linkSelectedPhotos() {
    if (selectedFileIds.size === 0) return;
    setLoadingDrive(true);
    setDriveError('');

    const targetLabel =
      target === 'carrier' ? 'Nosič' : surfaces.find((surface) => `surface:${surface.id}` === target)?.name ?? 'Plocha';
    const carrierIdParam = target === 'carrier' ? carrierId : null;
    const surfaceIdParam = target === 'carrier' ? null : target.replace('surface:', '');

    let successCount = 0;
    const errors: string[] = [];

    for (const fileId of selectedFileIds) {
      const file = driveFiles.find((f) => f.id === fileId);
      if (!file) continue;

      try {
        const response = await fetch('/api/photos/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFileId: file.id,
            carrierId: carrierIdParam,
            surfaceId: surfaceIdParam,
            fileName: file.name,
            mimeType: file.mimeType,
            size: file.size,
            type: type,
            note: note,
            isClientVisible: linkClientVisible,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `Soubor ${file.name} se nepodařilo propojit.`);

        setPhotos((current) => [...current, { ...data, targetLabel }].sort((l, r) => (l.sortOrder ?? 0) - (r.sortOrder ?? 0)));
        successCount++;
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : `Soubor ${file.name} se nepodařilo propojit.`);
      }
    }

    setLoadingDrive(false);
    if (errors.length > 0) {
      setDriveError(`Připojeno ${successCount} fotek. Chyby: ${errors.join('; ')}`);
    } else {
      setIsDriveModalOpen(false);
      setNote('');
    }
  }

  // Patch properties helper
  async function patchPhoto(photoId: string, updates: Partial<Photo>) {
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Nepodařilo se uložit vlastnosti.');

      setPhotos((current) =>
        current
          .map((item) => (item.id === photoId ? { ...item, ...data } : item))
          .sort((l, r) => (l.sortOrder ?? 0) - (r.sortOrder ?? 0))
      );

      // If we set a new primary, re-fetch other elements to sync local isPrimary state
      if (updates.isPrimary) {
        setPhotos((current) =>
          current.map((item) => (item.id !== photoId ? { ...item, isPrimary: false } : item))
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit vlastnosti.');
    }
  }

  // Swap / Reorder logic
  async function movePhoto(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= photos.length) return;

    const currentPhoto = photos[index];
    await patchPhoto(currentPhoto.id, { sortOrder: targetIdx });
  }

  // Lightbox handlers
  function openLightbox(index: number, e: React.MouseEvent) {
    triggerElementRef.current = e.currentTarget as HTMLElement;
    setActivePhotoIndex(index);
    setZoomScale(1);
  }

  const filteredDriveFiles = driveFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Galerie fotek</h3>
        {canEdit && (
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={openDriveModal}
          >
            Vybrat z Google Disku
          </button>
        )}
      </div>

      {canEdit && (
        <form onSubmit={upload} className="rounded-xl border p-3 bg-slate-50 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-slate-700">
              Cíl
              <select className="input mt-1 font-normal" value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="carrier">Celý nosič</option>
                {surfaces.map((surface) => (
                  <option key={surface.id} value={`surface:${surface.id}`}>{surface.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Typ fotografie
              <select className="input mt-1 font-normal" value={type} onChange={(event) => setType(event.target.value as PhotoType)}>
                {PHOTO_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm font-semibold text-slate-700 block">
            Nahrát soubor (JPEG, PNG nebo WebP, maximálně 4 MB)
            <input ref={fileInput} className="input mt-1 font-normal bg-white" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <label className="text-sm font-semibold text-slate-700 block">
            Poznámka
            <input className="input mt-1 font-normal bg-white" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Např. pohled z křižovatky" />
          </label>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition-colors" type="submit" disabled={saving}>
            {saving ? 'Nahrávám…' : 'Nahrát fotku'}
          </button>
        </form>
      )}

      {photos.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative group rounded-2xl border overflow-hidden bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-between">
              {/* Photo Area */}
              <div className="relative aspect-video w-full bg-slate-100 cursor-pointer overflow-hidden" onClick={(e) => openLightbox(index, e)}>
                <img
                  src={photo.url}
                  alt={photo.note || `${photo.type} – ${photo.targetLabel}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                
                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {photo.isPrimary && (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Hlavní</span>
                  )}
                  {photo.isClientVisible && (
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">Klient</span>
                  )}
                </div>
              </div>

              {/* Caption & Admin Controls */}
              <div className="p-3 text-xs space-y-3 bg-white border-t flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-slate-800">{photo.targetLabel}</span>
                    <span className="text-slate-500 font-medium">{photo.type}</span>
                  </div>
                  {photo.note && <p className="mt-1 text-slate-600 italic">“{photo.note}”</p>}
                </div>

                {canEdit && (
                  <div className="pt-2 border-t space-y-2">
                    {/* Primary & Client Visible checkboxes */}
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!photo.isPrimary}
                          onChange={(e) => patchPhoto(photo.id, { isPrimary: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        Hlavní fotka
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!photo.isClientVisible}
                          onChange={(e) => patchPhoto(photo.id, { isClientVisible: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        Pro nabídky
                      </label>
                    </div>

                    {/* Sorting & Delete Actions */}
                    <div className="flex justify-between items-center gap-1 pt-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => movePhoto(index, -1)}
                          className="rounded p-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                          title="Posunout doleva"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={index === photos.length - 1}
                          onClick={() => movePhoto(index, 1)}
                          className="rounded p-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                          title="Posunout doprava"
                        >
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(photo)}
                        className="rounded px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors"
                      >
                        Odebrat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl text-center">Tento nosič nemá žádné fotografie.</p>
      )}

      {/* Google Drive Modal Selector */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="drive-modal-title">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h4 id="drive-modal-title" className="font-bold text-lg text-slate-800">Výběr z Google Drive složky</h4>
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-3 border-b space-y-3 bg-white">
              <input
                type="text"
                placeholder="Vyhledat podle názvu souboru..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input w-full"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={linkClientVisible}
                    onChange={(e) => setLinkClientVisible(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Označit jako vhodné pro klientské nabídky (`isClientVisible`)
                </label>
                <div className="text-slate-500">
                  Vybráno: <b>{selectedFileIds.size}</b>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-grow bg-slate-50 min-h-[300px]">
              {loadingDrive ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-500">Načítám soubory z Disku...</p>
                </div>
              ) : driveError ? (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{driveError}</p>
              ) : filteredDriveFiles.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-12">Ve složce nebyly nalezeny žádné podporované obrázky.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {filteredDriveFiles.map((file) => {
                    const isSelected = selectedFileIds.has(file.id);
                    const formattedSize = file.size
                      ? `${(file.size / 1024).toFixed(1)} KB`
                      : 'Neznámá velikost';

                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleFileSelection(file.id)}
                        className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors bg-white hover:bg-slate-100 ${
                          isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200'
                        }`}
                      >
                        {/* Selector indicator */}
                        <div className="shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded border-slate-300 pointer-events-none"
                          />
                        </div>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden shrink-0 relative flex items-center justify-center">
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-slate-400 text-xs">Obr</span>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formattedSize} · {file.mimeType.replace('image/', '')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 bg-white transition-colors"
              >
                Zrušit
              </button>
              <button
                type="button"
                disabled={selectedFileIds.size === 0 || loadingDrive}
                onClick={linkSelectedPhotos}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
              >
                Připojit vybrané ({selectedFileIds.size})
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Accessible Full-screen Lightbox */}
      {activePhotoIndex !== null && (
        <div
          ref={lightboxRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 outline-none"
          role="dialog"
          aria-modal="true"
          aria-label="Detail fotografie"
        >
          {/* Top Bar */}
          <div className="flex justify-between items-center text-white p-2">
            <div className="text-sm font-semibold">
              {photos[activePhotoIndex].targetLabel} ({activePhotoIndex + 1} / {photos.length})
            </div>
            <div className="flex gap-4 items-center">
              <button
                type="button"
                onClick={() => setZoomScale((s) => (s === 1 ? 1.6 : 1))}
                className="text-sm bg-slate-800/80 hover:bg-slate-700/80 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                {zoomScale === 1 ? 'Přiblížit' : 'Oddálit'}
              </button>
              <button
                type="button"
                onClick={closeLightbox}
                className="text-white hover:text-slate-300 text-3xl font-semibold leading-none p-1 focus:outline-none"
                aria-label="Zavřít"
              >
                ×
              </button>
            </div>
          </div>

          {/* Left Arrow */}
          <button
            type="button"
            onClick={() => navigateLightbox(-1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-slate-800/60 hover:bg-slate-700/60 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-colors focus:outline-none z-10"
            aria-label="Předchozí fotografie"
          >
            ‹
          </button>

          {/* Image Display Area */}
          <div
            className="flex-grow flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
          >
            <div
              className="max-w-[85vw] max-h-[75vh] transition-transform duration-200 relative select-none"
              style={{ transform: `scale(${zoomScale})` }}
            >
              <img
                src={photos[activePhotoIndex].url}
                alt={photos[activePhotoIndex].note || ''}
                className="max-w-full max-h-[75vh] object-contain rounded"
                draggable="false"
              />
            </div>
          </div>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={() => navigateLightbox(1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-slate-800/60 hover:bg-slate-700/60 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-colors focus:outline-none z-10"
            aria-label="Další fotografie"
          >
            ›
          </button>

          {/* Bottom Bar / Note */}
          <div className="text-center text-white pb-4 max-w-xl mx-auto px-4">
            {photos[activePhotoIndex].note ? (
              <p className="text-sm bg-slate-900/60 px-4 py-2.5 rounded-xl border border-slate-800 inline-block">
                {photos[activePhotoIndex].note}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Bez poznámky</p>
            )}
          </div>

        </div>
      )}

    </section>
  );
}
