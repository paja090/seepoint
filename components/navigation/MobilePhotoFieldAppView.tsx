'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  ChevronUp,
  ChevronDown,
  Compass,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { MOBILE_PHOTO_DAMAGE_TYPES, type MobilePhotoDamageType } from '@/lib/mobile-photo-damage';
import { MobileCreateCarrierModal } from '@/components/navigation/MobileCreateCarrierModal';

export type NearbyCarrier = {
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

  // View Mode Tab State
  const [activeTab, setActiveTab] = useState<'campaigns' | 'nearby'>('campaigns');
  const [campaigns, setCampaigns] = useState<Array<{
    id: string;
    title: string;
    clientName: string;
    status: string;
    publicToken?: string | null;
    totalSurfaces: number;
    installedCount: number;
    progressPercent: number;
    surfaces: Array<{
      itemId: string;
      surfaceId: string;
      surfaceName: string;
      side: string;
      carrierId: string;
      carrierCode: string;
      carrierName: string;
      address: string;
      city: string;
      latitude: number | null;
      longitude: number | null;
      dateFrom: string | null;
      dateTo: string | null;
      isInstalled: boolean;
      installedPhotoUrl: string | null;
    }>;
  }>>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  // Carriers State
  const [carriers, setCarriers] = useState<NearbyCarrier[]>([]);
  const [totalCarriers, setTotalCarriers] = useState(0);
  const [carriersLimited, setCarriersLimited] = useState(false);
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

  // GPS Carrier Refinement State
  const [pendingNewGps, setPendingNewGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [updatingGps, setUpdatingGps] = useState(false);
  const [gpsUpdateSuccessMsg, setGpsUpdateSuccessMsg] = useState<string | null>(null);
  const [gpsUpdateErrorMsg, setGpsUpdateErrorMsg] = useState<string | null>(null);

  // Create New Carrier State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPreviewUrl, setCreatePreviewUrl] = useState<string | null>(null);
  const [createSuccessAlert, setCreateSuccessAlert] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const createPreviewUrlRef = useRef<string | null>(null);
  const carriersRequestRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/mobile-photos/campaigns');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns);
          if (data.campaigns.length > 0 && !expandedCampaignId) {
            setExpandedCampaignId(data.campaigns[0].id);
          }
        }
      }
    } catch (err) {
      console.error('[fetchCampaigns]', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearCreatePreview = () => {
    if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
    createPreviewUrlRef.current = null;
    setCreatePreviewUrl(null);
    setCreatePhotoFile(null);
    if (createFileInputRef.current) createFileInputRef.current.value = '';
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const handleCreateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) {
          throw new Error('Vybraný soubor není podporovaná fotografie.');
        }
        if (createPreviewUrlRef.current) URL.revokeObjectURL(createPreviewUrlRef.current);
        const nextUrl = URL.createObjectURL(file);
        createPreviewUrlRef.current = nextUrl;
        setCreatePhotoFile(file);
        setCreatePreviewUrl(nextUrl);
        setIsCreateModalOpen(true);
      } catch (error) {
        console.error('[mobile-photos/create-camera]', error);
        clearCreatePreview();
      }
    }
  };

  const handleCreateCarrierSuccess = (newCarrier: NearbyCarrier, message: string) => {
    setCreateSuccessAlert(message);
    setCarriers((prev) => [newCarrier, ...prev.filter((c) => c.id !== newCarrier.id)]);
    setTotalCarriers((prev) => prev + 1);
    setSelectedCarrier(newCarrier);
    setSelectedSurfaceId(newCarrier.surfaces[0]?.id || null);
    clearCreatePreview();
  };

  // Auto request location and campaigns on load
  useEffect(() => {
    requestLocation();
    void fetchCampaigns();
    // Geolocation is intentionally requested once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartCampaignPhoto = (
    campaign: (typeof campaigns)[number],
    surface: (typeof campaigns)[number]['surfaces'][number]
  ) => {
    const syntheticCarrier: NearbyCarrier = {
      id: surface.carrierId,
      code: surface.carrierCode,
      name: surface.carrierName,
      city: surface.city,
      street: surface.address,
      latitude: surface.latitude,
      longitude: surface.longitude,
      surfaces: [
        {
          id: surface.surfaceId,
          name: surface.surfaceName,
          side: surface.side === 'Strana B' ? 'SIDE_B' : 'SIDE_A',
          status: 'OCCUPIED',
          currentClient: { id: null, name: campaign.clientName },
          currentCampaign: { id: campaign.id, name: campaign.title },
          occupiedFrom: surface.dateFrom,
          occupiedUntil: surface.dateTo,
          latestPhotoUrl: surface.installedPhotoUrl,
          artworkUrl: null,
        },
      ],
      photos: [],
    };

    setSelectedCarrier(syntheticCarrier);
    setSelectedSurfaceId(surface.surfaceId);
    setSide(surface.side === 'Strana B' ? 'SIDE_B' : 'SIDE_A');
    setPurpose('CLIENT_REPORT');
    setPhotoNote(`Výlep kampaně: ${campaign.title} (${campaign.clientName})`);

    fileInputRef.current?.click();
  };

  const requestLocation = () => {
    setLocating(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolokace není podporována vaším prohlížečem.');
      setLocating(false);
      fetchCarriers(null, null, radiusKm, searchQuery);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;
        setCoords({ lat, lng, accuracy });
        setLocating(false);
        fetchCarriers(lat, lng, radiusKm, searchQuery);
      },
      (err) => {
        console.warn('GPS Error:', err);
        setGpsError('Nepodařilo se získat vaši přesnou polohu. Zobrazuje se omezený seznam; pro přesnější výběr použijte hledání.');
        setLocating(false);
        fetchCarriers(null, null, radiusKm, searchQuery);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchCarriers = async (lat: number | null, lng: number | null, radius: number, query = '') => {
    const requestId = ++carriersRequestRef.current;
    setLoadingCarriers(true);
    try {
      const params = new URLSearchParams();
      if (lat !== null && lng !== null) {
        params.set('lat', String(lat));
        params.set('lng', String(lng));
        params.set('radius', String(radius));
      }
      const trimmedQuery = query.trim();
      if (trimmedQuery) params.set('q', trimmedQuery);
      const res = await fetch(`/api/mobile-photos/nearby?${params.toString()}`);
      const data = await res.json();
      if (requestId === carriersRequestRef.current && res.ok && Array.isArray(data.carriers)) {
        setCarriers(data.carriers);
        setTotalCarriers(typeof data.total === 'number' ? data.total : data.carriers.length);
        setCarriersLimited(Boolean(data.limited));
        setSelectedCarrier((current) => {
          if (!current) return current;
          return data.carriers.find((carrier: NearbyCarrier) => carrier.id === current.id) || current;
        });
      }
    } catch (err) {
      console.error('Fetch carriers error:', err);
    } finally {
      if (requestId === carriersRequestRef.current) setLoadingCarriers(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm, value);
    }, 300);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) throw new Error('INVALID_IMAGE');
        if (!file.size || file.size > 4 * 1024 * 1024) throw new Error('PHOTO_TOO_LARGE');
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
        setUploadErrorMsg(error instanceof Error && error.message === 'PHOTO_TOO_LARGE'
          ? 'Fotografie je příliš velká. Maximální velikost je 4 MB.'
          : 'Použijte fotografii ve formátu JPEG, PNG nebo WebP.');
      }
    }
  };

  const handleUploadPhoto = async () => {
    if (!photoFile || !selectedCarrier) return;
    if (!coords) {
      setUploadErrorMsg('Před uložením fotografie je nutné získat aktuální GPS polohu zařízení.');
      requestLocation();
      return;
    }
    setUploading(true);
    setUploadSuccessMsg(null);
    setUploadErrorMsg(null);

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
      fd.append('latitude', String(coords.lat));
      fd.append('longitude', String(coords.lng));
      fd.append('accuracyMeters', String(coords.accuracy));
      fd.append('requireGps', 'true');
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
          PHOTO_TOO_LARGE: 'Fotografie je příliš velká. Maximální velikost je 4 MB.',
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
      fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm, searchQuery);
      void fetchCampaigns();
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
      await fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm, searchQuery);
    } catch (error) {
      console.error('[mobile-photos/confirm]', error);
      setUploadErrorMsg('Přiřazení fotografie se nepodařilo potvrdit. Zkuste akci zopakovat.');
    }
  };

  const handleGetNewPhoneGps = () => {
    setGpsUpdateErrorMsg(null);
    setGpsUpdateSuccessMsg(null);
    if (!navigator.geolocation) {
      setGpsUpdateErrorMsg('Geolokace není v tomto prohlížeči podporována.');
      return;
    }
    setUpdatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPendingNewGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setUpdatingGps(false);
      },
      (err) => {
        console.warn('GPS Refinement Error:', err);
        setGpsUpdateErrorMsg('Nepodařilo se načíst přesnou polohu z telefonu. Skontrolujte oprávnění GPS.');
        setUpdatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveCarrierGps = async () => {
    if (!selectedCarrier || !pendingNewGps) return;
    setUpdatingGps(true);
    setGpsUpdateErrorMsg(null);
    setGpsUpdateSuccessMsg(null);

    try {
      const res = await fetch(`/api/carriers/${selectedCarrier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: pendingNewGps.lat,
          longitude: pendingNewGps.lng,
          gpsStatus: 'VERIFIED',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Aktualizace GPS polohy nosiče se nepodařila.');
      }

      setGpsUpdateSuccessMsg(`📍 GPS poloha nosiče byla v systému úspěšně zpřesněna! (${pendingNewGps.lat.toFixed(5)}, ${pendingNewGps.lng.toFixed(5)})`);
      setSelectedCarrier((prev) => prev ? { ...prev, latitude: pendingNewGps.lat, longitude: pendingNewGps.lng } : null);
      setPendingNewGps(null);
      fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, radiusKm, searchQuery);
    } catch (err: unknown) {
      setGpsUpdateErrorMsg(err instanceof Error ? err.message : 'Došlo k chybě při ukládání GPS polohy.');
    } finally {
      setUpdatingGps(false);
    }
  };

  const filteredCarriers = carriers;

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

        {/* Primary Action: Create New Carrier from Photo */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={createFileInputRef}
            onChange={handleCreateFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => createFileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 py-3.5 px-4 font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-98 transition text-xs tracking-wide"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-950/20">
              <Plus size={16} className="text-slate-950" />
            </div>
            <span>+ ZALOŽIT NOVOU REKLAMNÍ PLOCHU Z FOTKY</span>
          </button>
        </div>

        {/* Quick Switcher Banner to Location Survey */}
        <Link
          href="/mobile-surveys"
          className="mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 p-3 text-xs font-bold text-white border border-sky-700/50 shadow-md hover:border-sky-400 active:scale-[0.99] transition group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-500/20 text-sky-300 rounded-xl border border-sky-500/30">
              <Compass size={18} />
            </div>
            <div>
              <span className="block font-black text-sky-200">📍 Hledáte nové navigační místo?</span>
              <span className="text-[11px] text-sky-300/80 font-medium">Otevřít Mobilní Průzkum Lokalit pro zakázky</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-sky-300 group-hover:translate-x-1 transition" />
        </Link>

        {/* Quick Banner to Field Route Optimizer */}
        <Link
          href="/work/route"
          className="mt-2.5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-3 text-xs font-bold text-white border border-emerald-700/50 shadow-md hover:border-emerald-400 active:scale-[0.99] transition group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
              <Compass size={18} />
            </div>
            <div>
              <span className="block font-black text-emerald-200">🚗 Optimalizovat trasu dnešního výjezdu</span>
              <span className="text-[11px] text-emerald-300/80 font-medium">Spočítat nejkratší trasu mezi nosiči & spustit Waze/Google Maps</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-emerald-300 group-hover:translate-x-1 transition" />
        </Link>
      </div>

      {/* Global Success Alert after Creating Carrier */}
      {createSuccessAlert && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-950/90 p-4 text-xs font-bold text-emerald-300 border border-emerald-700/80 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{createSuccessAlert}</span>
          </div>
          <button
            onClick={() => setCreateSuccessAlert(null)}
            className="text-emerald-400 hover:text-white px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* View Mode Switcher: Kampaně vs Nosiče */}
      <div className="flex rounded-2xl bg-slate-200/80 p-1 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'campaigns'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <span>🎯 Aktivní zakázky k výlepu</span>
          {campaigns.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'campaigns' ? 'bg-purple-900 text-purple-200' : 'bg-slate-300 text-slate-700'}`}>
              {campaigns.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('nearby')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'nearby'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <span>📍 Všechny nosiče (GPS)</span>
        </button>
      </div>

      {activeTab === 'campaigns' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Zakázky k realizaci ({campaigns.length})
            </h2>
            {loadingCampaigns && (
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> Načítám...
              </span>
            )}
          </div>

          {campaigns.length === 0 && !loadingCampaigns && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">Žádné aktivní kampaně k výlepu</p>
              <p className="text-xs text-slate-400">Jakmile je nabídka schválena, zakázka a její plochy se zde automaticky zobrazí.</p>
            </div>
          )}

          {campaigns.map((camp) => {
            const isExpanded = expandedCampaignId === camp.id;
            return (
              <div key={camp.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div
                  onClick={() => setExpandedCampaignId(isExpanded ? null : camp.id)}
                  className="cursor-pointer flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                        {camp.clientName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {camp.installedCount}/{camp.totalSurfaces} vylepeno
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-900 mt-1 truncate">{camp.title}</h3>
                    <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${camp.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <button type="button" className="p-1 text-slate-400 hover:text-slate-700 mt-1">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <div className="text-[11px] font-black uppercase text-slate-400 px-1">
                      Plochy kampaně ({camp.surfaces.length}):
                    </div>
                    {camp.surfaces.map((surf) => (
                      <div
                        key={surf.surfaceId}
                        className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-900 text-white font-black text-xs px-2 py-0.5 rounded-md">
                              {surf.carrierCode}
                            </span>
                            <span className="text-xs font-bold text-slate-700">{surf.side}</span>
                            {surf.isInstalled && (
                              <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                                ✓ Vylepeno
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-800 mt-1 truncate">{surf.address}</p>
                          <p className="text-[11px] text-slate-500">{surf.city}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {surf.installedPhotoUrl && (
                            <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                              <Image src={surf.installedPhotoUrl} alt="Foto" fill unoptimized className="object-cover" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartCampaignPhoto(camp, surf)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xs transition ${
                              surf.isInstalled
                                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                            }`}
                          >
                            <Camera size={14} />
                            <span>{surf.isInstalled ? 'Pře-fotit' : 'Vyfotit výlep'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
      {/* Filter Radius & Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Hledat kód nebo město..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={radiusKm}
          onChange={(e) => {
            const r = parseFloat(e.target.value);
            setRadiusKm(r);
            fetchCarriers(coords?.lat ?? null, coords?.lng ?? null, r, searchQuery);
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
            Nosiče v okolí ({filteredCarriers.length}{totalCarriers > filteredCarriers.length ? ` z ${totalCarriers}` : ''})
          </h2>
          {loadingCarriers && <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Načítám...</span>}
        </div>

        {carriersLimited && !loadingCarriers && (
          <p className="px-1 text-xs font-medium text-slate-500">
            Zobrazeno prvních {filteredCarriers.length} výsledků. Pro přesnější výběr použijte hledání.
          </p>
        )}

        {filteredCarriers.length === 0 && !loadingCarriers && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
            <MapPin size={32} className="mx-auto text-slate-300" />
            <div>
              <p className="text-sm font-bold text-slate-700">Žádné nosiče v tomto okruhu</p>
              <p className="text-xs text-slate-400 mt-1">Zkuste zvětšit okruh vyhledávání nebo založit nový nosič na tomto místě.</p>
            </div>
            <button
              type="button"
              onClick={() => createFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-sm"
            >
              <Plus size={14} />
              <span>Založit novou plochu z fotky</span>
            </button>
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
        </>
      )}

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

          {/* GPS Location Refinement Block */}
          <div className="mb-4 rounded-2xl border border-sky-800/80 bg-sky-950/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-sky-200">GPS poloha nosiče v systému</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-300">
                {selectedCarrier.latitude && selectedCarrier.longitude
                  ? `${selectedCarrier.latitude.toFixed(5)}, ${selectedCarrier.longitude.toFixed(5)}`
                  : 'Nezaměřeno'}
              </span>
            </div>

            {gpsUpdateSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{gpsUpdateSuccessMsg}</span>
              </div>
            )}

            {gpsUpdateErrorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-700 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                <span>{gpsUpdateErrorMsg}</span>
              </div>
            )}

            {!pendingNewGps ? (
              <button
                type="button"
                onClick={handleGetNewPhoneGps}
                disabled={updatingGps}
                className="w-full py-2.5 rounded-xl bg-sky-900/80 hover:bg-sky-800 text-sky-200 font-bold text-xs border border-sky-700/80 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <MapPin size={14} className="text-sky-300" />
                <span>{updatingGps ? 'Zjišťuji novou GPS polohu...' : '📍 Zpřesnit polohu nosiče dle mé GPS'}</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900 border border-sky-600/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>Zaměřená poloha telefonu:</span>
                  <span className="font-mono">{pendingNewGps.lat.toFixed(5)}, {pendingNewGps.lng.toFixed(5)}</span>
                </div>
                <div className="text-[10px] text-slate-400">Přesnost senzoru: ± {Math.round(pendingNewGps.accuracy)} metrů</div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPendingNewGps(null)}
                    className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs"
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCarrierGps}
                    disabled={updatingGps}
                    className="flex-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {updatingGps ? 'Ukládám...' : '💾 Uložit novou GPS nosiče'}
                  </button>
                </div>
              </div>
            )}
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
                  <span className={`rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold backdrop-blur border border-slate-700 flex items-center gap-1 ${coords ? 'text-emerald-400' : 'text-amber-300'}`}>
                    <Compass size={11} /> {coords ? 'GPS razítko připraveno' : 'GPS zatím není dostupná'}
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
                    !coords ? 'bg-amber-400 hover:bg-amber-300' : purpose === 'DAMAGE' ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'
                  }`}
                >
                  {uploading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading
                    ? 'Ukládám…'
                    : !coords
                    ? 'Nejprve načíst GPS'
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

      {/* Modal for Creating New Carrier from Photo */}
      <MobileCreateCarrierModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          clearCreatePreview();
        }}
        coords={coords}
        initialFile={createPhotoFile}
        initialPreviewUrl={createPreviewUrl}
        onRetake={() => createFileInputRef.current?.click()}
        onSuccess={handleCreateCarrierSuccess}
      />
    </div>
  );
}
