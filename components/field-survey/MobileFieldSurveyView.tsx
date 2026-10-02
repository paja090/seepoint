'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { processPhotoForUpload } from '@/lib/client-photo-processing';

// ==========================================
// MOBILNÍ VIEW PRO TERÉNNÍ PRŮZKUM PLOCH
// Workflow: Vybrat typ → GPS → Fotit → Uložit → Pokračovat
//
// ZCELA ODDĚLENO od existujícího MobilePhotoFieldAppView
// Fotografie se NIKDY neuloží do Photo (carrier galerie)
// ==========================================

const SURFACE_TYPES = [
  { value: 'ACKO', label: 'Ačko', icon: '🔺', description: 'Oboustranná tabule' },
  { value: 'TOWER', label: 'Tower', icon: '🏙️', description: 'Sloupová věž' },
  { value: 'BANNER', label: 'Banner', icon: '📌', description: 'Vlajkový banner' },
  { value: 'PLOT', label: 'Plot', icon: '🚧', description: 'Reklamní plachta na plotě' },
  { value: 'OTHER', label: 'Ostatní', icon: '📋', description: 'Jiný typ plochy' },
] as const;

type SurfaceType = typeof SURFACE_TYPES[number]['value'];

type GpsState =
  | { status: 'IDLE' }
  | { status: 'ACQUIRING' }
  | { status: 'OK'; lat: number; lng: number; accuracy: number }
  | { status: 'ERROR'; message: string };

type UploadState =
  | { status: 'IDLE' }
  | { status: 'UPLOADING' }
  | { status: 'SUCCESS'; photoId: string; warning?: string }
  | { status: 'ERROR'; message: string };

type SaveState =
  | { status: 'IDLE' }
  | { status: 'SAVING' }
  | { status: 'SUCCESS'; pointId: string }
  | { status: 'ERROR'; message: string };

type CompletedPoint = {
  id: string;
  surfaceType: SurfaceType;
  lat: number;
  lng: number;
  photos: number;
  address?: string;
};

export function MobileFieldSurveyView({ surveyId, surveyName }: { surveyId: string; surveyName: string }) {
  const [selectedType, setSelectedType] = useState<SurfaceType | null>(null);
  const [gps, setGps] = useState<GpsState>({ status: 'IDLE' });
  const [upload, setUpload] = useState<UploadState>({ status: 'IDLE' });
  const [save, setSave] = useState<SaveState>({ status: 'IDLE' });
  const [isCompressing, setIsCompressing] = useState(false);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [completedPoints, setCompletedPoints] = useState<CompletedPoint[]>([]);
  const [address, setAddress] = useState('');
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpsWatchRef = useRef<number | null>(null);

  // Automaticky zahájíme GPS sledování
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps({ status: 'ERROR', message: 'GPS není v tomto prohlížeči dostupná.' });
      return;
    }

    setGps({ status: 'ACQUIRING' });
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGps({
          status: 'OK',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Přístup k poloze byl zamítnut. Povolte GPS v nastavení telefonu.',
          2: 'GPS poloha není dostupná. Jste venku?',
          3: 'GPS přesahuje časový limit. Zkuste přejít na otevřené místo.',
        };
        setGps({ status: 'ERROR', message: messages[error.code] ?? 'GPS chyba.' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  // Reverse geocoding (OpenStreetMap Nominatim – zdarma)
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsAddressLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=cs&zoom=18`,
        { headers: { 'User-Agent': 'SeePoint OS FieldSurvey/1.0' } }
      );
      if (!response.ok) return;
      const data = await response.json() as { display_name?: string; address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string } };
      if (data.address) {
        const parts = [
          data.address.road,
          data.address.house_number,
          data.address.city || data.address.town || data.address.village,
        ].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      // Reverse geocoding selhalo – nevadí, adresa je volitelná
    } finally {
      setIsAddressLoading(false);
    }
  }, []);

  // Výběr fotografie s automatickou klientskou kompresí (max 1920px, JPEG ~350 KB)
  // Zabraňuje selhání uploadu velkých fotek z moderních mobilních fotoaparátů (Vercel 4.5 MB limit)
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFiles = [...(e.target.files ?? [])];
    if (!rawFiles.length) return;

    setIsCompressing(true);
    try {
      const processed: { file: File; preview: string }[] = [];
      for (const rawFile of rawFiles) {
        try {
          const { file: optimized } = await processPhotoForUpload(rawFile, {
            maxDimension: 1920,
            maxBytes: 1.5 * 1024 * 1024,
            initialQuality: 0.82,
          });
          processed.push({
            file: optimized,
            preview: URL.createObjectURL(optimized),
          });
        } catch (err) {
          console.warn('Optimalizace fotografie selhala, použiji původní soubor', err);
          processed.push({
            file: rawFile,
            preview: URL.createObjectURL(rawFile),
          });
        }
      }
      setPhotos((prev) => [...prev, ...processed].slice(0, 10)); // max 10 fotek
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleDeletePoint(pointId: string) {
    if (!confirm('Opravdu chcete smazat tento bod průzkumu včetně fotografií?')) return;
    try {
      const res = await fetch(`/api/field-survey/${surveyId}/points/${pointId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        alert('Bod se nepodařilo smazat.');
        return;
      }
      setCompletedPoints((prev) => prev.filter((p) => p.id !== pointId));
    } catch {
      alert('Chyba při komunikaci se serverem.');
    }
  }

  async function handleSave() {
    if (!selectedType) return;
    if (gps.status !== 'OK') return;
    if (photos.length === 0) return;

    setSave({ status: 'SAVING' });

    try {
      // 1. Vytvoříme průzkumný bod
      const pointResponse = await fetch(`/api/field-survey/${surveyId}/points`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          surfaceType: selectedType,
          latitude: gps.lat,
          longitude: gps.lng,
          gpsAccuracyMeters: gps.accuracy,
          gpsSource: 'DEVICE',
          address: address || undefined,
          note: note.trim() || undefined,
        }),
      });

      if (!pointResponse.ok) {
        const err = await pointResponse.json().catch(() => ({ error: 'Neznámá chyba' })) as { error?: string };
        throw new Error(err.error ?? 'Bod průzkumu se nepodařilo uložit.');
      }

      const pointData = await pointResponse.json() as { point: { id: string } };
      const pointId = pointData.point.id;

      // 2. Nahrajeme fotografie (s kontrolou velikosti)
      let uploadWarning: string | undefined;
      for (const photo of photos) {
        setUpload({ status: 'UPLOADING' });

        let fileToUpload = photo.file;
        if (fileToUpload.size > 3.5 * 1024 * 1024) {
          try {
            const { file: recompressed } = await processPhotoForUpload(fileToUpload, {
              maxDimension: 1280,
              maxBytes: 1.5 * 1024 * 1024,
              initialQuality: 0.72,
            });
            fileToUpload = recompressed;
          } catch {
            // pokračujeme s původním souborem
          }
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);

        const photoResponse = await fetch(`/api/field-survey/${surveyId}/points/${pointId}/photos`, {
          method: 'POST',
          body: formData,
        });

        if (!photoResponse.ok) {
          let errorMsg = 'Fotografii se nepodařilo nahrát.';
          try {
            const err = await photoResponse.json();
            if (err.error) errorMsg = err.error;
          } catch {
            if (photoResponse.status === 413) {
              errorMsg = 'Fotografie překračuje povolenou velikost serveru. Aplikace ji zmenší.';
            }
          }
          throw new Error(errorMsg);
        }

        const photoData = await photoResponse.json() as { warning?: string };
        if (photoData.warning) uploadWarning = photoData.warning;
      }

      setUpload({ status: 'SUCCESS', photoId: pointId, warning: uploadWarning });
      setSave({ status: 'SUCCESS', pointId });

      // Přidáme do seznamu dokončených bodů
      setCompletedPoints((prev) => [{
        id: pointId,
        surfaceType: selectedType,
        lat: gps.lat,
        lng: gps.lng,
        photos: photos.length,
        address: address || undefined,
      }, ...prev]);

      // Reset pro další bod
      setPhotos([]);
      setNote('');
      setAddress('');
      setSelectedType(null);
      setSave({ status: 'IDLE' });
      setUpload({ status: 'IDLE' });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neznámá chyba. Zkuste akci zopakovat.';
      setSave({ status: 'ERROR', message });
      setUpload({ status: 'IDLE' });
    }
  }

  const isReady = selectedType !== null && gps.status === 'OK' && photos.length > 0;
  const isSaving = save.status === 'SAVING' || upload.status === 'UPLOADING';

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate text-sm">Průzkum ploch</h1>
          <p className="text-xs text-slate-400 truncate">{surveyName}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {gps.status === 'OK' && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${
              gps.accuracy <= 10 ? 'bg-green-900 text-green-300' :
              gps.accuracy <= 30 ? 'bg-yellow-900 text-yellow-300' :
              'bg-red-900 text-red-300'
            }`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              ±{Math.round(gps.accuracy)} m
            </span>
          )}
          {gps.status === 'ACQUIRING' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800 text-slate-400 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
              GPS…
            </span>
          )}
          {gps.status === 'ERROR' && (
            <span className="px-2 py-1 rounded-full bg-red-900 text-red-300 text-xs">❌ GPS</span>
          )}
        </div>
      </header>

      <div className="p-4 space-y-5">
        {/* GPS ERROR */}
        {gps.status === 'ERROR' && (
          <div className="rounded-2xl bg-red-950 border border-red-800 p-4" role="alert">
            <p className="text-sm font-semibold text-red-300">⚠️ {gps.message}</p>
          </div>
        )}

        {/* KROK 1: Typ plochy */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">1. Typ plochy</h2>
          <div className="grid grid-cols-2 gap-2">
            {SURFACE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelectedType(type.value)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  selectedType === type.value
                    ? 'border-sky-500 bg-sky-950 text-white'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 active:bg-slate-800'
                }`}
              >
                <span className="text-2xl">{type.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{type.label}</div>
                  <div className="text-xs text-slate-400">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* KROK 2: Fotografie */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">2. Fotografie</h2>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={handleFileChange}
          />

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {photos.map((photo, i) => (
                <div key={i} className="relative flex-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt={`Fotografie ${i + 1}`}
                    className="h-24 w-24 rounded-xl object-cover border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"
                    aria-label="Odebrat fotografii"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {isCompressing && (
            <div className="flex items-center gap-2 p-3 mt-2 rounded-xl bg-sky-950 border border-sky-800 text-sky-300 text-xs animate-pulse">
              <span>🔄</span>
              <span>Optimalizuji fotografii pro spolehlivé uložení…</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            className="w-full rounded-2xl border-2 border-dashed border-slate-700 p-5 text-center text-slate-400 hover:border-sky-600 hover:text-sky-400 transition disabled:opacity-50"
          >
            <span className="block text-3xl mb-1">📷</span>
            <span className="block text-sm font-semibold">
              {photos.length === 0 ? 'Fotit plochu' : 'Přidat další fotku'}
            </span>
            <span className="block text-xs mt-1">Fotí zadní kamera</span>
          </button>
        </section>

        {/* KROK 3: Adresa + poznámka */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">3. Detaily (volitelné)</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Adresa</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Automaticky nebo zadat ručně…"
                  className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                {gps.status === 'OK' && (
                  <button
                    type="button"
                    onClick={() => void reverseGeocode((gps as Extract<GpsState, { status: 'OK' }>).lat, (gps as Extract<GpsState, { status: 'OK' }>).lng)}
                    disabled={isAddressLoading}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 disabled:opacity-50"
                    title="Zjistit adresu ze souřadnic"
                  >
                    {isAddressLoading ? '…' : '📍'}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Poznámka</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Viditelnost, okolí, dostupnost, jiné poznatky…"
                className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
          </div>
        </section>

        {/* GPS souřadnice */}
        {gps.status === 'OK' && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-400 font-mono">
            GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} (±{Math.round(gps.accuracy)} m)
          </div>
        )}

        {/* CHYBA ULOŽENÍ */}
        {save.status === 'ERROR' && (
          <div className="rounded-2xl bg-red-950 border border-red-800 p-4" role="alert">
            <p className="text-sm font-semibold text-red-300">❌ {save.message}</p>
            <button
              type="button"
              onClick={() => setSave({ status: 'IDLE' })}
              className="mt-2 text-xs text-red-400 underline"
            >
              Zkusit znovu
            </button>
          </div>
        )}

        {/* TLAČÍTKO ULOŽIT */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!isReady || isSaving || isCompressing}
          className={`w-full rounded-2xl py-4 text-base font-bold transition ${
            isReady && !isSaving && !isCompressing
              ? 'bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-lg'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isSaving
            ? upload.status === 'UPLOADING' ? '📤 Nahrávám fotografie…' : '💾 Ukládám bod…'
            : isCompressing ? '🔄 Zpracovávám fotografie…'
            : !selectedType ? '← Vyberte typ plochy'
            : gps.status !== 'OK' ? '← Čekám na GPS…'
            : photos.length === 0 ? '← Přidejte fotografii'
            : `✅ Uložit bod (${photos.length} foto)`
          }
        </button>

        {/* SEZNAM DOKONČENÝCH BODŮ */}
        {completedPoints.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Dnešní průzkum ({completedPoints.length} {completedPoints.length === 1 ? 'bod' : completedPoints.length <= 4 ? 'body' : 'bodů'})
            </h2>
            <ul className="space-y-2">
              {completedPoints.map((p) => {
                const typeInfo = SURFACE_TYPES.find((t) => t.value === p.surfaceType);
                return (
                  <li key={p.id} className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 flex items-center gap-3">
                    <span className="text-2xl">{typeInfo?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{typeInfo?.label ?? p.surfaceType}</div>
                      {p.address && <div className="text-xs text-slate-400 truncate">{p.address}</div>}
                      <div className="text-xs text-slate-500 font-mono">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</div>
                    </div>
                    <div className="text-xs text-slate-500 mr-1">{p.photos} foto</div>
                    <button
                      type="button"
                      onClick={() => void handleDeletePoint(p.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                      title="Smazat tento bod"
                      aria-label="Smazat bod"
                    >
                      🗑️
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Link na desktopový přehled */}
        <div className="text-center py-4">
          <a
            href={`/field-survey/${surveyId}`}
            className="text-sm text-sky-400 underline"
          >
            Otevřít přehled průzkumu →
          </a>
        </div>
      </div>
    </div>
  );
}
