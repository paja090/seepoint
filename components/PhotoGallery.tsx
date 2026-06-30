'use client';

import { useRef, useState } from 'react';
import type { Photo, PhotoType, Surface } from '@/lib/types';

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
}: {
  carrierId: string;
  carrierPhotos: Photo[];
  surfaces: Surface[];
}) {
  const initialPhotos: GalleryPhoto[] = [
    ...carrierPhotos.map((photo) => ({ ...photo, targetLabel: 'Nosič' })),
    ...surfaces.flatMap((surface) =>
      surface.photos.map((photo) => ({ ...photo, targetLabel: surface.name })),
    ),
  ];
  const [photos, setPhotos] = useState(initialPhotos);
  const [target, setTarget] = useState('carrier');
  const [type, setType] = useState<PhotoType>('CARRIER');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return setError('Vyber fotografii.');
    if (file.size > 4 * 1024 * 1024) return setError('Fotografie musí mít nejvýše 4 MB.');

    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (note) form.append('note', note);
    if (target === 'carrier') form.append('carrierId', carrierId);
    else form.append('surfaceId', target.replace('surface:', ''));

    try {
      const response = await fetch('/api/photos', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Fotografii se nepodařilo uložit.');

      const targetLabel =
        target === 'carrier' ? 'Nosič' : surfaces.find((surface) => `surface:${surface.id}` === target)?.name ?? 'Plocha';
      setPhotos((current) => [...current, { ...data, targetLabel }]);
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Fotografii se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(photo: GalleryPhoto) {
    if (!window.confirm('Opravdu odstranit tuto fotografii?')) return;
    setError('');
    const response = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? 'Fotografii se nepodařilo odstranit.');
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  }

  return (
    <section>
      <h3 className="font-semibold mb-3">Galerie fotek</h3>
      <form onSubmit={upload} className="rounded-xl border p-3 mb-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            Cíl
            <select className="input mt-1" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="carrier">Celý nosič</option>
              {surfaces.map((surface) => (
                <option key={surface.id} value={`surface:${surface.id}`}>{surface.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Typ fotografie
            <select className="input mt-1" value={type} onChange={(event) => setType(event.target.value as PhotoType)}>
              {PHOTO_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-sm block">
          Fotografie (JPEG, PNG nebo WebP, maximálně 4 MB)
          <input ref={fileInput} className="input mt-1" type="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <label className="text-sm block">
          Poznámka
          <input className="input mt-1" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Nahrávám…' : 'Nahrát fotografii'}</button>
      </form>

      {photos.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="rounded-xl border overflow-hidden bg-white">
              <img src={photo.url} alt={photo.note || `${photo.type} – ${photo.targetLabel}`} className="aspect-video w-full object-cover bg-slate-100" />
              <figcaption className="p-2 text-xs flex items-start justify-between gap-2">
                <span><b>{photo.targetLabel}</b><br />{photo.type}{photo.note ? ` · ${photo.note}` : ''}</span>
                <button type="button" className="text-red-600" onClick={() => remove(photo)}>Odstranit</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Bez fotografií</p>
      )}
    </section>
  );
}
