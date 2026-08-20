'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Camera,
  Compass,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  Store,
  Navigation as NavIcon,
  ShieldCheck,
  Building2,
  FileText,
  Layers,
  ChevronRight,
  ExternalLink,
  Edit3,
  Trash2,
  Check,
  Send,
} from 'lucide-react';
import { GoogleNavigationOfferMap } from '@/components/offers/GoogleNavigationOfferMap';

export type CandidatePointItem = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  campaignType?: string | null;
  placementType: string;
  approachDirection?: string | null;
  arrowDirection?: string | null;
  distanceValue?: number | null;
  distanceUnit?: string | null;
  ownershipType: string;
  ownerName?: string | null;
  visibilityTowardTarget: 'GOOD' | 'NEEDS_CHECK' | 'POOR';
  permitStatus: string;
  internalNote?: string | null;
  surveyStatus: 'DRAFT' | 'COMPLETED';
  supervisionStatus: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_RECHECK' | 'REJECTED';
  supervisionNote?: string | null;
  rejectionReason?: string | null;
  surveyRouteId?: string | null;
  surveyRoute?: { id: string; name: string } | null;
  carrierId?: string | null;
  surfaceId?: string | null;
  carrier?: { id: string; code: string; name: string; city?: string | null } | null;
  convertedNavigationPointId?: string | null;
  photos: Array<{ id: string; url: string; createdAt: string }>;
  createdByUser?: { id: string; name: string } | null;
  createdAt: string;
};

export type SurveyDetailData = {
  id: string;
  crmOrderId: string;
  client?: { id: string; name: string; tradingName?: string | null } | null;
  targetName: string;
  targetAddress?: string | null;
  targetLatitude: number;
  targetLongitude: number;
  targetNote?: string | null;
  status: string;
  surveyRoutes: Array<{
    id: string;
    name: string;
    description?: string | null;
    originName?: string | null;
  }>;
  candidatePoints: CandidatePointItem[];
  nearbyCarriers: Array<{
    id: string;
    code: string;
    name: string;
    city?: string | null;
    street?: string | null;
    latitude: number;
    longitude: number;
    distanceKm: number;
    surfaces: Array<{
      id: string;
      name: string;
      status: string;
      occupancies: Array<{ id: string; clientName: string; status: string }>;
    }>;
  }>;
};

export function MobileSurveyFieldView({
  orderId,
  initialData,
}: {
  orderId: string;
  initialData?: SurveyDetailData;
}) {
  const [data, setData] = useState<SurveyDetailData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');

  // GPS & Form State
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Form Drawer State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidatePointItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields
  const [formRouteId, setFormRouteId] = useState<string>('');
  const [formLabel, setFormLabel] = useState('');
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [formAddress, setFormAddress] = useState('');
  const [formCampaignType, setFormCampaignType] = useState('Dlouhodobá navigace');
  const [formPlacementType, setFormPlacementType] = useState('NAVIGATION');
  const [formApproachDirection, setFormApproachDirection] = useState('');
  const [formArrowDirection, setFormArrowDirection] = useState('STRAIGHT');
  const [formVisibility, setFormVisibility] = useState<'GOOD' | 'NEEDS_CHECK' | 'POOR'>('GOOD');
  const [formOwnership, setFormOwnership] = useState('UNKNOWN');
  const [formPermit, setFormPermit] = useState('UNKNOWN');
  const [formNote, setFormNote] = useState('');
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null);

  // Photo Capture State
  const [photosToUpload, setPhotosToUpload] = useState<Array<{ file: File; preview: string }>>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Proximity Alert State
  const [nearbyAlertCarrier, setNearbyAlertCarrier] = useState<SurveyDetailData['nearbyCarriers'][0] | null>(null);

  const fetchSurvey = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/navigation/orders/${orderId}/survey`);
      if (res.ok) {
        const json = await res.json();
        setData(json.survey || json);
      }
    } catch (e) {
      console.error('Error loading survey:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchSurvey();
    }
    handleGetLocation();
  }, [orderId]);

  // Handle Geolocation capture
  const handleGetLocation = () => {
    setLocating(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Váš prohlížeč nepodporuje geolokaci.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng, accuracy: pos.coords.accuracy });
        setFormLat(lat);
        setFormLng(lng);
        setLocating(false);
        checkProximityCarrier(lat, lng);
      },
      (err) => {
        setGpsError(`Chyba geolokace: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const checkProximityCarrier = (lat: number, lng: number) => {
    if (!data?.nearbyCarriers) return;
    const found = data.nearbyCarriers.find((c) => {
      const latDiff = (c.latitude - lat) * 111.32;
      const lngDiff = (c.longitude - lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
      const distMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 1000;
      return distMeters <= 80; // Within 80 meters
    });
    setNearbyAlertCarrier(found || null);
  };

  const handleOpenAddModal = (existing?: CandidatePointItem) => {
    if (existing) {
      setEditingCandidate(existing);
      setFormRouteId(existing.surveyRouteId || '');
      setFormLabel(existing.label || '');
      setFormLat(existing.latitude);
      setFormLng(existing.longitude);
      setFormAddress(existing.address || '');
      setFormCampaignType(existing.campaignType || 'Dlouhodobá navigace');
      setFormPlacementType(existing.placementType || 'NAVIGATION');
      setFormApproachDirection(existing.approachDirection || '');
      setFormArrowDirection(existing.arrowDirection || 'STRAIGHT');
      setFormVisibility(existing.visibilityTowardTarget || 'GOOD');
      setFormOwnership(existing.ownershipType || 'UNKNOWN');
      setFormPermit(existing.permitStatus || 'UNKNOWN');
      setFormNote(existing.internalNote || '');
      setSelectedCarrierId(existing.carrierId || null);
      setSelectedSurfaceId(existing.surfaceId || null);
      setPhotosToUpload([]);
    } else {
      const nextIndex = (data?.candidatePoints?.length || 0) + 1;
      setEditingCandidate(null);
      setFormRouteId('');
      setFormLabel(`Navigační bod #${nextIndex}`);
      setFormLat(coords?.lat || data?.targetLatitude || 49.82);
      setFormLng(coords?.lng || data?.targetLongitude || 18.29);
      setFormAddress('');
      setFormCampaignType('Dlouhodobá navigace');
      setFormPlacementType('NAVIGATION');
      setFormApproachDirection('');
      setFormArrowDirection('STRAIGHT');
      setFormVisibility('GOOD');
      setFormOwnership('UNKNOWN');
      setFormPermit('UNKNOWN');
      setFormNote('');
      setSelectedCarrierId(null);
      setSelectedSurfaceId(null);
      setPhotosToUpload([]);
    }
    setShowAddModal(true);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotosToUpload((prev) => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotosToUpload((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveCandidate = async (isDraft: boolean = false) => {
    if (!formLat || !formLng) {
      alert('Poloha GPS je povinná. Klikněte na Získat moji GPS.');
      return;
    }
    setSaving(true);

    try {
      // 1. Upload photos if any
      const uploadedPhotoIds: string[] = [];
      for (const p of photosToUpload) {
        const formData = new FormData();
        formData.append('file', p.file);
        formData.append('type', 'SURVEY');
        if (formLat && formLng) {
          formData.append('latitude', formLat.toString());
          formData.append('longitude', formLng.toString());
          formData.append('capturedLatitude', formLat.toString());
          formData.append('capturedLongitude', formLng.toString());
        }
        if (selectedCarrierId) {
          formData.append('carrierId', selectedCarrierId);
        }
        const uploadRes = await fetch('/api/mobile-photos/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const uJson = await uploadRes.json();
          if (uJson.photo?.id) {
            uploadedPhotoIds.push(uJson.photo.id);
          }
        }
      }

      // 2. Save candidate point
      const endpoint = editingCandidate
        ? `/api/navigation/orders/${orderId}/survey/candidates/${editingCandidate.id}`
        : `/api/navigation/orders/${orderId}/survey/candidates`;
      const method = editingCandidate ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyRouteId: formRouteId || null,
          label: formLabel || `Kandidátní místo (${formLat.toFixed(4)}, ${formLng.toFixed(4)})`,
          latitude: formLat,
          longitude: formLng,
          address: formAddress,
          campaignType: formCampaignType,
          placementType: formPlacementType,
          approachDirection: formApproachDirection,
          arrowDirection: formArrowDirection,
          visibilityTowardTarget: formVisibility,
          ownershipType: formOwnership,
          permitStatus: formPermit,
          internalNote: formNote,
          carrierId: selectedCarrierId,
          surfaceId: selectedSurfaceId,
          surveyStatus: isDraft ? 'DRAFT' : 'COMPLETED',
          photoIds: uploadedPhotoIds,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setToastMessage(isDraft ? '📝 Uloženo jako rozpracované!' : '✓ Místo bylo úspěšně uloženo!');
        setTimeout(() => setToastMessage(null), 4000);
        fetchSurvey();
      } else {
        const errJson = await res.json();
        alert(errJson.error || 'Chyba při ukládání kandidátního místa.');
      }
    } catch (e: any) {
      alert(e.message || 'Chyba připojení.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <RefreshCw size={28} className="animate-spin text-emerald-500" />
        <p className="text-sm font-bold">Načítám terénní průzkum...</p>
      </div>
    );
  }

  // Format Map Points for Google Navigation Offer Map
  const mapPoints = data.candidatePoints.map((c) => ({
    id: c.id,
    latitude: c.latitude,
    longitude: c.longitude,
    label: c.label,
    navigationType: c.placementType,
    status: c.supervisionStatus,
    arrowDirectionEnum: c.arrowDirection || 'STRAIGHT',
    address: c.address || undefined,
  }));

  return (
    <div className="space-y-4 pb-24 text-slate-900 max-w-5xl mx-auto">
      {/* Toast Confirmation */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-emerald-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-sm animate-in slide-in-from-top duration-200">
          <span>{toastMessage}</span>
          <button onClick={() => handleOpenAddModal()} className="bg-white text-emerald-950 px-3 py-1 rounded-xl text-xs font-black shadow-sm hover:bg-emerald-50">
            + Přidat další
          </button>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <a href="/mobile-surveys" className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-bold transition">
            <ArrowLeft size={16} />
            <span>Všechny průzkumy</span>
          </a>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            {data.status}
          </span>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{data.targetName}</h1>
          <p className="text-xs text-sky-300 font-semibold">{data.client?.name || 'Klient nezadán'}</p>
          {data.targetAddress && (
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <MapPin size={13} className="text-amber-400 shrink-0" />
              <span>Cíl: {data.targetAddress}</span>
            </p>
          )}
        </div>

        {/* View Mode Toggle & Primary Action */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('MAP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  viewMode === 'MAP' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                🗺️ Mapa
              </button>
              <button
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  viewMode === 'LIST' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 Seznam ({data.candidatePoints.length})
              </button>
            </div>

            <button
              onClick={() => handleGetLocation()}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                coords
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
              title="Zobrazit a vycentrovat moji GPS polohu na mapě"
            >
              <Compass size={13} className={locating ? 'animate-spin text-blue-400' : 'text-blue-400'} />
              <span>{locating ? 'Zjišťuji GPS…' : coords ? '📍 Moje GPS aktivní' : '🎯 Moje poloha'}</span>
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>+ PŘIDAT MÍSTO</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'MAP' ? (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
            <div className="h-[50vh] min-h-[350px] w-full relative">
              <GoogleNavigationOfferMap
                mode="point"
                readOnly={true}
                onTargetSelect={() => {}}
                onPointMove={() => {}}
                onMapClick={() => {}}
                points={mapPoints}
                userLocation={coords ? { latitude: coords.lat, longitude: coords.lng } : undefined}
                target={{
                  latitude: data.targetLatitude,
                  longitude: data.targetLongitude,
                  label: data.targetName,
                  address: data.targetAddress || undefined,
                }}
              />
            </div>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="hidden sm:flex w-full items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 text-slate-950 font-black p-4 rounded-2xl shadow-lg border border-emerald-300 active:scale-95 transition text-sm tracking-wide"
          >
            <Plus size={20} />
            <span>+ PŘIDAT NOVÉ MÍSTO V TERÉNU</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.candidatePoints.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3">
              <Compass size={36} className="mx-auto text-slate-400" />
              <h3 className="font-extrabold text-slate-800 text-base">Zatím nebylo přidáno žádné kandidátní místo</h3>
              <p className="text-xs text-slate-500">Klikněte na + PŘIDAT MÍSTO a zaznamenejte první potenciální lokalitu v terénu.</p>
              <button onClick={() => handleOpenAddModal()} className="btn font-bold bg-emerald-600 text-white text-xs px-5 py-2.5 rounded-xl shadow-md">
                + Přidat první místo
              </button>
            </div>
          ) : (
            data.candidatePoints.map((c) => (
              <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm text-slate-900 truncate">{c.label}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        c.supervisionStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        c.supervisionStatus === 'NEEDS_RECHECK' ? 'bg-amber-100 text-amber-800' :
                        c.supervisionStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {c.supervisionStatus === 'APPROVED' ? '✓ SCHVÁLENO' :
                         c.supervisionStatus === 'NEEDS_RECHECK' ? '↻ K PROVĚŘENÍ' :
                         c.supervisionStatus === 'REJECTED' ? '✕ ZAMÍTNUTO' :
                         '⏳ ČEKÁ NA SUPERVIZI'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                      <MapPin size={12} className="text-sky-500" />
                      <span>{c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}</span>
                      {c.distanceValue && <span className="font-bold text-slate-700">({c.distanceValue} km od cíle)</span>}
                    </p>
                  </div>

                  <button onClick={() => handleOpenAddModal(c)} className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold shrink-0">
                    <Edit3 size={15} />
                  </button>
                </div>

                {/* Properties Pills */}
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md">Trasa: {c.surveyRoute?.name || 'Bez trasy'}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md">Typ: {c.placementType}</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md">Šipka: {c.arrowDirection || 'ROVNĚ'}</span>
                  <span className={`px-2 py-0.5 rounded-md ${
                    c.visibilityTowardTarget === 'GOOD' ? 'bg-emerald-50 text-emerald-700' :
                    c.visibilityTowardTarget === 'NEEDS_CHECK' ? 'bg-amber-50 text-amber-700' :
                    'bg-rose-50 text-rose-700'
                  }`}>
                    {c.visibilityTowardTarget === 'GOOD' ? '✅ Viditelné' : c.visibilityTowardTarget === 'NEEDS_CHECK' ? '⚠️ Nutno prověřit' : '❌ Nevhodné'}
                  </span>
                </div>

                {/* Photos Strip */}
                {c.photos.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {c.photos.map((p) => (
                      <div key={p.id} className="relative size-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                        <Image src={p.url} alt={c.label} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Sticky Bottom Action Button on Mobile - Elevated above mobile browser bars */}
      <div
        className="fixed left-4 right-4 z-50 sm:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="p-1.5 rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl">
          <button
            onClick={() => handleOpenAddModal()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 text-slate-950 font-black py-3.5 px-4 rounded-2xl shadow-lg active:scale-95 transition text-xs tracking-wider"
          >
            <Plus size={18} />
            <span>+ PŘIDAT NOVÉ MÍSTO V TERÉNU</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Candidate Modal Drawer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 text-slate-900">
          <div className="card max-w-xl w-full bg-white rounded-t-3xl sm:rounded-3xl space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 p-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingCandidate ? '✏️ Upravit kandidátní místo' : '📍 Zaznamenat nové místo'}
                </h3>
                <p className="text-xs text-slate-500">{data.targetName}</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1.5">✕</button>
            </div>

            {/* GPS & Location Box */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Compass size={14} className="text-emerald-600" />
                  <span>GPS Souřadnice:</span>
                </span>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locating}
                  className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-xl transition"
                >
                  <RefreshCw size={12} className={locating ? 'animate-spin' : ''} />
                  <span>{locating ? 'Získávám GPS...' : 'Získat moji GPS'}</span>
                </button>
              </div>

              {coords ? (
                <div className="text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-xl border border-slate-200 flex justify-between">
                  <span>LAT: {coords.lat.toFixed(6)}, LNG: {coords.lng.toFixed(6)}</span>
                  <span className="text-emerald-700 font-semibold">Přesnost: ±{Math.round(coords.accuracy)}m</span>
                </div>
              ) : formLat && formLng ? (
                <div className="text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-xl border border-slate-200">
                  LAT: {formLat.toFixed(6)}, LNG: {formLng.toFixed(6)}
                </div>
              ) : (
                <p className="text-xs text-amber-700 font-semibold italic">Zatiaľ nezískaná GPS. Kliknite na tlačítko hore.</p>
              )}
            </div>

            {/* Proximity Carrier Warning */}
            {nearbyAlertCarrier && (
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-300 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                  <span>V blízkosti se nachází existující nosič SeePoint!</span>
                </div>
                <p className="text-amber-800 text-[11px]">
                  Kód: <strong>{nearbyAlertCarrier.code}</strong> ({nearbyAlertCarrier.name}) – vzdálenost cca {Math.round(nearbyAlertCarrier.distanceKm * 1000)} m.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCarrierId(nearbyAlertCarrier.id);
                      if (nearbyAlertCarrier.surfaces[0]) setSelectedSurfaceId(nearbyAlertCarrier.surfaces[0].id);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] border transition ${
                      selectedCarrierId === nearbyAlertCarrier.id
                        ? 'bg-amber-600 text-white border-amber-700'
                        : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    {selectedCarrierId === nearbyAlertCarrier.id ? '✓ Propojeno s nosičem' : 'Propojit s tímto nosičem'}
                  </button>
                </div>
              </div>
            )}

            {/* Camera / Photo Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">📷 Fotografie z terénu</label>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-md hover:bg-slate-800 active:scale-95 transition cursor-pointer"
                >
                  <Camera size={15} className="text-emerald-400" />
                  <span>Vyfotit fotoaparátem</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-300 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-200 active:scale-95 transition cursor-pointer"
                >
                  <span>🖼️ Vybrat z galerie</span>
                </button>

                {photosToUpload.map((p, idx) => (
                  <div key={idx} className="relative size-14 rounded-2xl overflow-hidden border border-slate-300 shrink-0">
                    <Image src={p.preview} alt="Upload preview" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-0.5 right-0.5 bg-red-600 text-white size-5 rounded-full text-[10px] font-black flex items-center justify-center shadow-md cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3 pt-1">
              <label className="text-xs font-bold text-slate-700 block">
                Příjezdová trasa
                <select value={formRouteId} onChange={(e) => setFormRouteId(e.target.value)} className="input text-xs mt-1 font-bold">
                  <option value="">-- Bez trasy / Obecné místo --</option>
                  {data.surveyRoutes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-bold text-slate-700 block">
                Název / Označení místa
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Např. Sloup VO č. 42 u křižovatky"
                  className="input text-xs mt-1"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Typ nosiče
                  <select value={formPlacementType} onChange={(e) => setFormPlacementType(e.target.value)} className="input text-xs mt-1">
                    <option value="NAVIGATION">Navigační cedule / Sloupek</option>
                    <option value="BILLBOARD">Billboard</option>
                    <option value="CITY_POSTER">City Poster</option>
                    <option value="PROMO_TOWER">Tower</option>
                    <option value="PROMO_MINITOWER">miniTower</option>
                    <option value="BANNER">Banner / Plot / Fasáda</option>
                    <option value="OTHER">Jiné</option>
                  </select>
                </label>

                <label className="text-xs font-bold text-slate-700 block">
                  Směr příjezdu
                  <input
                    type="text"
                    value={formApproachDirection}
                    onChange={(e) => setFormApproachDirection(e.target.value)}
                    placeholder="Např. od Hlučína"
                    className="input text-xs mt-1"
                  />
                </label>
              </div>

              {/* Arrow Choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Doporučená orientace šipky</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'LEFT', icon: '←' },
                    { id: 'STRAIGHT', icon: '↑' },
                    { id: 'RIGHT', icon: '→' },
                    { id: 'SLANTED_LEFT', icon: '↖' },
                    { id: 'SLANTED_RIGHT', icon: '↗' },
                  ].map((arr) => (
                    <button
                      key={arr.id}
                      type="button"
                      onClick={() => setFormArrowDirection(arr.id)}
                      className={`p-2.5 rounded-xl font-black text-lg border transition ${
                        formArrowDirection === arr.id
                          ? 'bg-sky-600 text-white border-sky-700 shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                      }`}
                    >
                      {arr.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility Choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Viditelnost k cíli</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormVisibility('GOOD')}
                    className={`p-2 rounded-xl text-xs font-bold border text-left transition ${
                      formVisibility === 'GOOD' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    ✅ Dobrá viditelnost
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormVisibility('NEEDS_CHECK')}
                    className={`p-2 rounded-xl text-xs font-bold border text-left transition ${
                      formVisibility === 'NEEDS_CHECK' ? 'bg-amber-600 text-white border-amber-700 shadow-sm' : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    ⚠️ Nutno ověřit
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormVisibility('POOR')}
                    className={`p-2 rounded-xl text-xs font-bold border text-left transition ${
                      formVisibility === 'POOR' ? 'bg-rose-600 text-white border-rose-700 shadow-sm' : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    ❌ Nevhodné
                  </button>
                </div>
              </div>

              {/* Ownership & Permit */}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Vlastnictví
                  <select value={formOwnership} onChange={(e) => setFormOwnership(e.target.value)} className="input text-xs mt-1">
                    <option value="CITY_MUNICIPALITY">Město / Obec</option>
                    <option value="PRIVATE_OWNER">Soukromník</option>
                    <option value="SEEPOINT">SeePoint</option>
                    <option value="OTHER">Jiné</option>
                    <option value="UNKNOWN">Nezjištěno</option>
                  </select>
                </label>

                <label className="text-xs font-bold text-slate-700 block">
                  Povolení
                  <select value={formPermit} onChange={(e) => setFormPermit(e.target.value)} className="input text-xs mt-1">
                    <option value="UNKNOWN">Nezjištěno</option>
                    <option value="NEEDS_VERIFICATION">Nutno prověřit</option>
                    <option value="UNDER_REVIEW">Prověřuje se</option>
                    <option value="APPROVED">Schváleno</option>
                    <option value="REJECTED">Zamítnuto</option>
                  </select>
                </label>
              </div>

              <label className="text-xs font-bold text-slate-700 block">
                Poznámka z terénu
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  placeholder="Např. Strom částečně zakrývá pohled z auta"
                  className="input text-xs mt-1"
                />
              </label>
            </div>

            {/* Modal Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => handleSaveCandidate(true)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
              >
                📝 Uložit jako Rozpracované
              </button>
              <button
                type="button"
                onClick={() => handleSaveCandidate(false)}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black shadow-lg hover:from-emerald-400 hover:to-teal-400 active:scale-95 transition"
              >
                {saving ? 'Ukládám...' : '💾 ULOŽIT MÍSTO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
