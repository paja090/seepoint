'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  MapPin,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  HardDrive,
  Cloud,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Compass,
} from 'lucide-react';

type NearbyCarrier = {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  street?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  surfaces: Array<{
    id: string;
    name: string;
    status: string;
    currentClient?: { name: string } | null;
  }>;
  photos: Array<{
    id: string;
    url: string;
    storageProvider?: string;
    capturedLatitude?: number | null;
    capturedLongitude?: number | null;
    capturedByWorkerName?: string | null;
    createdAt: string;
    aiStatus?: string | null;
    aiConfidence?: number | null;
  }>;
};

export function MobilePhotoFieldAppView() {
  // GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Carriers State
  const [carriers, setCarriers] = useState<NearbyCarrier[]>([]);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [radiusKm, setRadiusKm] = useState(2.0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<NearbyCarrier | null>(null);

  // Camera & Photo State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto request location on load
  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    setLocating(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolokace není podporována vaším prohlížečem.');
      setLocating(false);
      fetchCarriers(null, null, radiusKm);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        setCoords({ lat, lng, accuracy });
        setLocating(false);
        fetchCarriers(lat, lng, radiusKm);
      },
      (err) => {
        console.warn('GPS Error:', err);
        setGpsError('Nepodařilo se získat vašu přesnou polohu. Zobrazují se všechna nosná místa.');
        setLocating(false);
        fetchCarriers(null, null, radiusKm);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchCarriers = async (lat: number | null, lng: number | null, radius: number) => {
    setLoadingCarriers(true);
    try {
      const params = new URLSearchParams();
      if (lat !== null && lng !== null) {
        params.set('lat', String(lat));
        params.set('lng', String(lng));
        params.set('radius', String(radius));
      }
      const res = await fetch(`/api/mobile-photos/nearby?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.carriers) {
        setCarriers(data.carriers);
        if (selectedCarrier) {
          const updated = data.carriers.find((c: NearbyCarrier) => c.id === selectedCarrier.id);
          if (updated) setSelectedCarrier(updated);
        }
      }
    } catch (err) {
      console.error('Fetch carriers error:', err);
    } finally {
      setLoadingCarriers(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadSuccessMsg(null);
      setUploadErrorMsg(null);
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !selectedCarrier) return;
    setUploading(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('carrierId', selectedCarrier.id);
      if (coords) {
        fd.append('latitude', String(coords.lat));
        fd.append('longitude', String(coords.lng));
        fd.append('accuracyMeters', String(coords.accuracy));
      }
      fd.append('note', photoNote.trim() || 'Mobilní fotodokumentace v terénu');

      const res = await fetch('/api/mobile-photos/upload', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nahrání fotografie selhalo');

      setUploadSuccessMsg(
        `Fotografie byla úspěšně uložena (${data.photo.storageProvider === 'GOOGLE_DRIVE' ? 'Google Drive Cloud' : 'Lokální úložiště'}) a odeslána k AI rozpoznání.`
      );
      setPhotoFile(null);
      setPreviewUrl(null);
      setPhotoNote('');

      // Refresh list
      fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm);
    } catch (err: unknown) {
      setUploadErrorMsg(err instanceof Error ? err.message : 'Nahrání fotografie selhalo');
    } finally {
      setUploading(false);
    }
  };

  const filteredCarriers = carriers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.city && c.city.toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-12">
      {/* Mobile Top Bar */}
      <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">Mobilní Fotodokumentace</h1>
              <p className="text-xs text-slate-400 font-medium">Terénní režim montážníka</p>
            </div>
          </div>
          <button
            onClick={requestLocation}
            disabled={locating}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95 transition"
            title="Aktualizovat moji polohu"
          >
            <RefreshCw size={18} className={locating ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>

        {/* GPS Status Badge */}
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-800/80 px-3.5 py-2.5 text-xs border border-slate-700/60">
          <div className="flex items-center gap-2">
            <Compass size={16} className={coords ? 'text-emerald-400 animate-pulse' : 'text-amber-400'} />
            {coords ? (
              <span className="font-semibold text-emerald-300">
                Moje GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </span>
            ) : (
              <span className="font-medium text-amber-300">Zjišťuji Vaši GPS polohu...</span>
            )}
          </div>
          {coords && (
            <span className="rounded-md bg-emerald-950/80 px-2 py-0.5 font-bold text-emerald-400 border border-emerald-800/60 text-[10px]">
              ± {Math.round(coords.accuracy)} m
            </span>
          )}
        </div>
        {gpsError && <p className="mt-2 text-xs text-amber-400 font-medium flex items-center gap-1"><AlertTriangle size={14} /> {gpsError}</p>}
      </div>

      {/* Filter Radius & Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Hledat kód nebo miasto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={radiusKm}
          onChange={(e) => {
            const r = parseFloat(e.target.value);
            setRadiusKm(r);
            fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, r);
          }}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none"
        >
          <option value={0.5}>Do 500 m</option>
          <option value={2.0}>Do 2 km</option>
          <option value={5.0}>Do 5 km</option>
          <option value={50}>Všechny</option>
        </select>
      </div>

      {/* Carriers Nearby List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Nosiče v okolí ({filteredCarriers.length})
          </h2>
          {loadingCarriers && <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Načítám...</span>}
        </div>

        {filteredCarriers.length === 0 && !loadingCarriers && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">Žádné nosiče v tomto okruhu</p>
            <p className="text-xs text-slate-400 mt-1">Zkuste zvětšit okruh vyhledávání nebo zadat název do vyhledávače.</p>
          </div>
        )}

        {filteredCarriers.map((c) => {
          const isSelected = selectedCarrier?.id === c.id;
          const distM = c.distanceKm ? Math.round(c.distanceKm * 1000) : null;
          const distText = distM !== null ? (distM < 1000 ? `${distM} m` : `${c.distanceKm?.toFixed(1)} km`) : null;

          return (
            <div
              key={c.id}
              onClick={() => setSelectedCarrier(c)}
              className={`group relative cursor-pointer rounded-3xl border p-4 transition-all duration-200 shadow-sm ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-950/90 text-white ring-2 ring-emerald-500/40'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md text-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-black tracking-wide ${isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-white'}`}>
                      {c.code}
                    </span>
                    {distText && (
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isSelected ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        <MapPin size={12} /> {distText} od vás
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-2 font-bold text-sm leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>{c.name}</h3>
                  <p className={`text-xs mt-0.5 ${isSelected ? 'text-emerald-200/80' : 'text-slate-500'}`}>
                    {[c.city, c.street].filter(Boolean).join(' · ') || 'Adresa neuvedena'}
                  </p>
                </div>
                <ChevronRight size={18} className={isSelected ? 'text-emerald-400' : 'text-slate-300 group-hover:text-slate-600'} />
              </div>

              {/* Photos count & Surfaces */}
              <div className={`mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] font-medium ${isSelected ? 'border-emerald-800/60 text-emerald-200' : 'border-slate-100 text-slate-500'}`}>
                <span>{c.surfaces.length} reklamních ploch</span>
                <span className="flex items-center gap-1 font-bold">
                  <Camera size={13} /> {c.photos.length} fotek zaevidováno
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Carrier Shutter & Upload Drawer */}
      {selectedCarrier && (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-800 bg-slate-950 p-5 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-800" />
          
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Vybraný nosič pro fotodokumentaci</span>
              <h2 className="text-base font-black text-white">{selectedCarrier.code} — {selectedCarrier.name}</h2>
            </div>
            <button
              onClick={() => {
                setSelectedCarrier(null);
                setPreviewUrl(null);
                setPhotoFile(null);
              }}
              className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1"
            >
              Zavřít
            </button>
          </div>

          {/* Messages */}
          {uploadSuccessMsg && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-emerald-950/90 p-3 text-xs font-bold text-emerald-300 border border-emerald-700/60">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{uploadSuccessMsg}</span>
            </div>
          )}
          {uploadErrorMsg && (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-rose-950/90 p-3 text-xs font-bold text-rose-300 border border-rose-700/60">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{uploadErrorMsg}</span>
            </div>
          )}

          {/* Photo Shutter Input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {!previewUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-98 transition text-base"
            >
              <Camera size={22} /> POŘÍDIT FOTOGRAFII FOTOAPARÁTEM
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 max-h-48">
                <img src={previewUrl} alt="Preview" className="w-full object-cover max-h-48" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold text-emerald-400 backdrop-blur border border-slate-700 flex items-center gap-1">
                    <Compass size={11} /> GPS Razítko zapsáno
                  </span>
                </div>
              </div>

              <input
                type="text"
                placeholder="Poznámka k fotografii (např. Po instalaci grafiky)"
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Vyfotit znovu
                </button>
                <button
                  onClick={handleUploadPhoto}
                  disabled={uploading}
                  className="flex-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 hover:bg-emerald-400 active:scale-98 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? 'Ukládám fotku & AI...' : 'Uložit fotku s GPS & AI'}
                </button>
              </div>
            </div>
          )}

          {/* Recent Photos for this Carrier */}
          {selectedCarrier.photos.length > 0 && (
            <div className="mt-4 border-t border-slate-800/80 pt-3">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">Poslední fotografie nosiče:</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedCarrier.photos.map((p) => (
                  <div key={p.id} className="shrink-0 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
                    <img src={p.url} alt="Carrier photo" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 px-1 py-0.5 text-[9px] text-slate-300 text-center truncate flex items-center justify-center gap-0.5">
                      {p.storageProvider === 'GOOGLE_DRIVE' ? <Cloud size={9} className="text-sky-400" /> : <HardDrive size={9} className="text-emerald-400" />}
                      {new Date(p.createdAt).toLocaleDateString('cs-CZ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
