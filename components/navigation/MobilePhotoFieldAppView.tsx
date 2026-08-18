'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Camera,
  MapPin,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Search,
  HardDrive,
  Cloud,
  ChevronRight,
  Compass,
  ExternalLink,
} from 'lucide-react';
import { MOBILE_PHOTO_DAMAGE_TYPES, type MobilePhotoDamageType } from '@/lib/mobile-photo-damage';

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
    side: 'SIDE_A' | 'SIDE_B' | null;
    status: string;
    currentClient: { id: string | null; name: string } | null;
    currentCampaign: { id: string; name: string } | null;
    occupiedFrom: string | null;
    occupiedUntil: string | null;
    latestPhotoUrl: string | null;
    artworkUrl: string | null;
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

function surfaceClientLabel(surface: NearbyCarrier['surfaces'][number]) {
  if (surface.status === 'RESERVED') return surface.currentClient ? `REZERVOVÁNO – ${surface.currentClient.name}` : 'REZERVOVÁNO – klient nezjištěn';
  if (surface.currentClient) return surface.currentClient.name;
  if (surface.status === 'AVAILABLE') return 'VOLNÁ PLOCHA';
  return 'Klient nezjištěn';
}

function surfaceSideLabel(surface: NearbyCarrier['surfaces'][number]) {
  if (surface.side === 'SIDE_A') return 'Strana A';
  if (surface.side === 'SIDE_B') return 'Strana B';
  return surface.name;
}

function formatCzechDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('cs-CZ') : null;
}

type ClientMismatch = {
  photoId: string;
  expectedSurfaceId: string | null;
  expectedClient: string;
  detectedClient: string;
  confidence: number;
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
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null);

  // Photo Metadata State
  const [side, setSide] = useState<'SIDE_A' | 'SIDE_B' | 'BOTH'>('SIDE_A');
  const [purpose, setPurpose] = useState<'CLIENT_REPORT' | 'DAMAGE' | 'INSPECTION' | 'MOTIF_CHANGE'>('CLIENT_REPORT');
  const [damageType, setDamageType] = useState<MobilePhotoDamageType>('OVERGROWN');

  // Camera & Photo State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [clientMismatch, setClientMismatch] = useState<ClientMismatch | null>(null);
  const [photoNote, setPhotoNote] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  // Auto request location on load
  useEffect(() => {
    requestLocation();
    // Geolocation is intentionally requested once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      try {
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) {
          throw new Error('Vybraný soubor není podporovaná fotografie.');
        }
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const nextPreviewUrl = URL.createObjectURL(file);
        previewUrlRef.current = nextPreviewUrl;
        setPhotoFile(file);
        setPreviewUrl(nextPreviewUrl);
        setUploadSuccessMsg(null);
        setUploadErrorMsg(null);
      } catch (error) {
        console.error('[mobile-photos/camera]', error);
        clearPreview();
        setUploadErrorMsg('Fotografii se nepodařilo načíst z fotoaparátu. Zkuste ji pořídit znovu.');
      }
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !selectedCarrier) return;
    setUploading(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);

    const lat = coords?.lat ?? selectedCarrier.latitude ?? 0;
    const lng = coords?.lng ?? selectedCarrier.longitude ?? 0;
    const accuracy = coords?.accuracy ?? 50;

    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('carrierId', selectedCarrier.id);
      if (selectedSurfaceId && side !== 'BOTH') fd.append('surfaceId', selectedSurfaceId);
      fd.append('side', side);
      fd.append('purpose', purpose);
      if (purpose === 'DAMAGE') {
        fd.append('damageType', damageType);
      }
      fd.append('latitude', String(lat));
      fd.append('longitude', String(lng));
      fd.append('accuracyMeters', String(accuracy));
      fd.append('note', photoNote.trim() || 'Mobilní fotodokumentace v terénu');

      const uploadUrl = new URL('/api/mobile-photos/upload', window.location.origin);
      const res = await fetch(uploadUrl.toString(), {
        method: 'POST',
        body: fd,
      });

      const responseText = await res.text();
      let data: { error?: string; code?: string; message?: string; warnings?: string[]; clientMismatch?: ClientMismatch | null; chatSent?: boolean } = {};
      try { data = responseText ? JSON.parse(responseText) : {}; } catch { /* filtered below */ }
      if (!res.ok) {
        const messages: Record<string, string> = {
          GPS_REQUIRED: 'Před uložením fotografie je nutné získat GPS polohu.',
          DATABASE_ERROR: 'Fotografii se nepodařilo zapsat do databáze. Zkuste akci zopakovat.',
          INVALID_IMAGE: 'Formát fotografie není podporován.',
          DAMAGE_TYPE_REQUIRED: 'Vyberte typ závady.',
        };
        throw new Error(messages[data.code || ''] || 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.');
      }

      const warningParts = [
        data.warnings?.includes('google-drive') ? 'Google Drive nebyl dostupný; použit byl bezpečný záložní zápis.' : null,
        data.warnings?.includes('history') ? 'Zápis do historie se nepodařil.' : null,
        data.warnings?.includes('carrier-note') ? 'Poznámku nosiče se nepodařilo aktualizovat.' : null,
      ].filter(Boolean);
      setClientMismatch(data.clientMismatch || null);
      setUploadSuccessMsg(data.clientMismatch ? null : [data.message || 'Fotografie byla úspěšně uložena!', ...warningParts].join(' '));
      if (purpose === 'DAMAGE' && data.chatSent === false) {
        setUploadErrorMsg('Fotografie závady je bezpečně uložená, ale urgentní zprávu do chatu se nepodařilo odeslat. Informujte prosím dispečink.');
      }
      clearPreview();
      setPhotoNote('');

      // Refresh list
      fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm);
    } catch (err: unknown) {
      console.error('[mobile-photos/upload]', err);
      setUploadErrorMsg(err instanceof Error && err.message ? err.message : 'Fotografii se nepodařilo uložit. Zkuste akci zopakovat.');
    } finally {
      setUploading(false);
    }
  };

  const confirmPhotoSurface = async (surfaceId: string) => {
    if (!clientMismatch) return;
    try {
      const res = await fetch(new URL('/api/mobile-photos/confirm', window.location.origin).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: clientMismatch.photoId, surfaceId }),
      });
      if (!res.ok) throw new Error();
      setClientMismatch(null);
      setUploadSuccessMsg('Přiřazení fotografie k ploše bylo potvrzeno.');
      await fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm);
    } catch (error) {
      console.error('[mobile-photos/confirm]', error);
      setUploadErrorMsg('Přiřazení fotografie se nepodařilo potvrdit. Zkuste akci zopakovat.');
    }
  };

  const filteredCarriers = carriers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.city && c.city.toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-16">
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
            placeholder="Hledat kód nebo město..."
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
          const thumbnail = c.surfaces.find((surface) => surface.latestPhotoUrl)?.latestPhotoUrl || c.photos[0]?.url || null;

          return (
            <div
              key={c.id}
              onClick={() => {
                const defaultSurface = c.surfaces.find((surface) => surface.side === 'SIDE_A') || c.surfaces[0] || null;
                setSelectedCarrier(c);
                setSelectedSurfaceId(defaultSurface?.id || null);
                if (defaultSurface?.side) setSide(defaultSurface.side);
              }}
              className={`group relative cursor-pointer rounded-3xl border p-4 transition-all duration-200 shadow-sm ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-950/90 text-white ring-2 ring-emerald-500/40'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md text-slate-900'
              }`}
            >
              {thumbnail ? (
                <Image src={thumbnail} alt={`Aktuální vzhled ${c.name}`} width={560} height={256} unoptimized className="mb-3 h-32 w-full rounded-2xl border border-slate-200/20 object-cover" />
              ) : (
                <div className="mb-3 flex h-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Camera size={24} /></div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 space-y-1.5">
                    {c.surfaces.length ? c.surfaces.map((surface) => (
                      <div key={surface.id} className={`rounded-xl px-3 py-2 ${isSelected ? 'bg-emerald-900/70' : 'bg-emerald-50'}`}>
                        <div className={`text-sm font-black ${isSelected ? 'text-emerald-200' : 'text-emerald-900'}`}>{surfaceClientLabel(surface)}</div>
                        <div className={`text-[10px] font-bold ${isSelected ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          {surfaceSideLabel(surface)}{surface.currentCampaign ? ` · ${surface.currentCampaign.name}` : ''}
                        </div>
                      </div>
                    )) : <div className="font-black text-slate-500">Klient nezjištěn</div>}
                  </div>
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

              {/* Photos count, Surfaces & Direct Link to Carrier Card */}
              <div className={`mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] font-medium ${isSelected ? 'border-emerald-800/60 text-emerald-200' : 'border-slate-100 text-slate-500'}`}>
                <div className="flex items-center gap-2">
                  <span>{c.surfaces.length} ploch</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-bold">
                    <Camera size={13} /> {c.photos.length} fotek
                  </span>
                </div>
                <a
                  href={`/carriers/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    isSelected
                      ? 'bg-emerald-900/90 text-emerald-200 hover:bg-emerald-800 border border-emerald-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                  }`}
                  title="Otevřít novou kartu nosiče v novém okně"
                >
                  <span>🪧 Karta nosiče</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Carrier Shutter & Upload Drawer */}
      {selectedCarrier && (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-800 bg-slate-950 p-5 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-800" />
          
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Vybraný nosič pro fotodokumentaci</span>
              <h2 className="text-base font-black text-white">{selectedCarrier.code} — {selectedCarrier.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/carriers/${selectedCarrier.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
              >
                <span>🪧 Karta nosiče</span>
                <ExternalLink size={13} />
              </a>
              <button
                onClick={() => {
                  setSelectedCarrier(null);
                  setSelectedSurfaceId(null);
                  clearPreview();
                }}
                className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1"
              >
                Zavřít
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-emerald-700/60 bg-emerald-950/50 p-3">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">Aktuálně na ploše</div>
            <div className="space-y-2">
              {selectedCarrier.surfaces.length ? selectedCarrier.surfaces.map((surface) => (
                <button key={surface.id} type="button" onClick={() => {
                  setSelectedSurfaceId(surface.id);
                  if (surface.side) setSide(surface.side);
                }} className={`w-full rounded-xl border p-3 text-left ${selectedSurfaceId === surface.id ? 'border-emerald-400 bg-emerald-900/60' : 'border-slate-700 bg-slate-900/70'}`}>
                  <div className="text-[10px] font-bold uppercase text-slate-400">{surfaceSideLabel(surface)}</div>
                  <div className="text-base font-black text-white">{surfaceClientLabel(surface)}</div>
                  {surface.currentCampaign && <div className="text-xs text-emerald-300">Kampaň: {surface.currentCampaign.name}</div>}
                  {surface.occupiedUntil && <div className="text-[11px] text-slate-400">Obsazeno do: {formatCzechDate(surface.occupiedUntil)}</div>}
                </button>
              )) : <div className="text-sm font-bold text-slate-400">Plochy nosiče nejsou evidovány.</div>}
            </div>
          </div>

          {/* Messages */}
          {uploadSuccessMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-950/90 p-3 text-xs font-bold text-emerald-300 border border-emerald-700/60">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{uploadSuccessMsg}</span>
            </div>
          )}
          {uploadErrorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-950/90 p-3 text-xs font-bold text-rose-300 border border-rose-700/60">
              <AlertTriangle size={16} className="shrink-0 text-rose-400" />
              <span>{uploadErrorMsg}</span>
            </div>
          )}
          {clientMismatch && (
            <div className="mb-4 rounded-2xl border border-amber-500/70 bg-amber-950/70 p-3 text-xs text-amber-100">
              <div className="font-black">⚠️ Fotografie možná neodpovídá vybrané ploše.</div>
              <div className="mt-1">Očekávaný klient: <strong>{clientMismatch.expectedClient}</strong></div>
              <div>Rozpoznaný motiv / klient: <strong>{clientMismatch.detectedClient}</strong></div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={!clientMismatch.expectedSurfaceId} onClick={() => clientMismatch.expectedSurfaceId && confirmPhotoSurface(clientMismatch.expectedSurfaceId)} className="rounded-xl bg-amber-400 px-2 py-2 font-black text-slate-950 disabled:opacity-50">Přesto uložit</button>
                <button type="button" onClick={() => { setSelectedSurfaceId(null); setUploadErrorMsg('Vyberte níže správnou plochu a potvrďte přiřazení.'); }} className="rounded-xl border border-amber-400 px-2 py-2 font-black">Vybrat jinou plochu</button>
              </div>
              {selectedSurfaceId && selectedSurfaceId !== clientMismatch.expectedSurfaceId && (
                <button type="button" onClick={() => confirmPhotoSurface(selectedSurfaceId)} className="mt-2 w-full rounded-xl bg-emerald-500 px-2 py-2 font-black text-slate-950">Přiřadit k vybrané ploše</button>
              )}
            </div>
          )}

          {/* 1. Side Selection */}
          <div className="mb-4">
            <label className="text-[11px] font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              1. Která strana plochy byla vyfocena?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {selectedCarrier.surfaces.map((surface) => (
                <button key={surface.id} type="button" onClick={() => {
                  setSelectedSurfaceId(surface.id);
                  setSide(surface.side || 'SIDE_A');
                }} className={`rounded-xl border p-2 text-center transition ${selectedSurfaceId === surface.id && side !== 'BOTH' ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'}`}>
                  <span className="block text-xs font-black">{surface.side === 'SIDE_A' ? '🅰️ ' : surface.side === 'SIDE_B' ? '🅱️ ' : ''}{surfaceSideLabel(surface)}</span>
                  <span className="block truncate text-[10px] font-bold text-white">{surfaceClientLabel(surface)}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => { setSide('BOTH'); setSelectedSurfaceId(null); }}
                className={`rounded-xl border p-2 text-center transition ${
                  side === 'BOTH'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <span className="block text-xs font-black">🔀 Obě strany</span>
                <span className="text-[9px] text-slate-400">Celá plocha</span>
              </button>
            </div>
          </div>

          {/* 2. Photo Purpose Selection */}
          <div className="mb-4">
            <label className="text-[11px] font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              2. Účel fotografie
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPurpose('CLIENT_REPORT')}
                className={`rounded-xl border p-2 text-left transition ${
                  purpose === 'CLIENT_REPORT'
                    ? 'border-blue-500 bg-blue-950/60 text-blue-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <span className="block text-xs font-bold text-white">📸 Doložení klienta</span>
                <span className="text-[9px] text-slate-400">Fotoreport výlepu</span>
              </button>

              <button
                type="button"
                onClick={() => setPurpose('DAMAGE')}
                className={`rounded-xl border p-2 text-left transition ${
                  purpose === 'DAMAGE'
                    ? 'border-rose-500 bg-rose-950/80 text-rose-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <span className="block text-xs font-bold text-rose-300">🚨 Závada / Poškození</span>
                <span className="text-[9px] text-rose-400/80">Odešle alert do Chatu</span>
              </button>
            </div>
          </div>

          {/* 3. Specific Damage Types (if purpose === 'DAMAGE') */}
          {purpose === 'DAMAGE' && (
            <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 space-y-2">
              <label className="text-[11px] font-black uppercase text-rose-300 tracking-wider block">
                ⚠️ Jaká závada nastala?
              </label>

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {MOBILE_PHOTO_DAMAGE_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDamageType(item.value)}
                    className={`rounded-xl p-2 border text-left font-bold transition flex items-center gap-1.5 ${
                      damageType === item.value ? 'border-rose-500 bg-rose-950 text-rose-200' : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              {damageType === 'OTHER' && <p className="text-[10px] font-semibold text-amber-300">Popište jinou závadu do poznámky pod fotografií.</p>}
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
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-98 transition text-sm mb-3"
            >
              <Camera size={20} /> POŘÍDIT FOTOGRAFII FOTOAPARÁTEM
            </button>
          ) : (
            <div className="space-y-3 mb-3">
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 max-h-44">
                <Image src={previewUrl} alt="Náhled pořízené fotografie" width={560} height={352} unoptimized className="w-full object-cover max-h-44" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold text-emerald-400 backdrop-blur border border-slate-700 flex items-center gap-1">
                    <Compass size={11} /> GPS Razítko zapsáno
                  </span>
                </div>
              </div>

              <input
                type="text"
                placeholder="Poznámka k fotografii (volitelné)"
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
                  className={`flex-2 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black text-slate-950 transition disabled:opacity-50 ${
                    purpose === 'DAMAGE' ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                >
                  {uploading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading
                    ? 'Ukládám…'
                    : purpose === 'DAMAGE'
                    ? '🚨 Nahlásit Závadu do Chatu'
                    : 'Uložit fotku s GPS'}
                </button>
              </div>
            </div>
          )}

          {/* Recent Photos for this Carrier */}
          {selectedCarrier.photos.length > 0 && (
            <div className="mt-3 border-t border-slate-800/80 pt-3">
              <span className="text-[11px] font-bold text-slate-400 block mb-2">Všechny fotografie nosiče i ploch ({selectedCarrier.photos.length}):</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedCarrier.photos.map((p) => (
                  <div key={p.id} className="shrink-0 relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
                    <Image src={p.url} alt="Fotografie nosiče" fill sizes="80px" unoptimized className="object-cover" />
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
