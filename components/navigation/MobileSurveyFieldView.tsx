'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  RotateCw,
  Car,
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
import { compressImageFile } from '@/lib/image-compress';
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
  pillarNumber?: string | null;
  pillarType?: string | null;
  variant?: string | null;
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

export function formatSurveyArrowBadge(arrow?: string | null) {
  const a = (arrow || 'STRAIGHT').toUpperCase();
  switch (a) {
    case 'LEFT':
      return { label: 'VLEVO', icon: '←', color: 'bg-sky-50 text-sky-800 border-sky-300' };
    case 'RIGHT':
      return { label: 'VPRAVO', icon: '→', color: 'bg-sky-50 text-sky-800 border-sky-300' };
    case 'SLANTED_LEFT':
      return { label: 'ŠIKMO VLEVO', icon: '↖', color: 'bg-sky-50 text-sky-800 border-sky-300' };
    case 'SLANTED_RIGHT':
      return { label: 'ŠIKMO VPRAVO', icon: '↗', color: 'bg-sky-50 text-sky-800 border-sky-300' };
    case 'U_TURN':
      return { label: 'DO PROTISMĚRU', icon: '↩', color: 'bg-amber-50 text-amber-800 border-amber-300' };
    case 'ROUNDABOUT_1':
      return { label: 'KRUH. OBJ. – 1. VÝJEZD', icon: '🔄 1.', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
    case 'ROUNDABOUT_2':
      return { label: 'KRUH. OBJ. – 2. VÝJEZD', icon: '🔄 2.', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
    case 'ROUNDABOUT_3':
      return { label: 'KRUH. OBJ. – 3. VÝJEZD', icon: '🔄 3.', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
    case 'ROUNDABOUT_4':
      return { label: 'KRUH. OBJ. – 4. VÝJEZD', icon: '🔄 4.', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
    case 'ROUNDABOUT_5':
      return { label: 'KRUH. OBJ. – 5. VÝJEZD', icon: '🔄 5.', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
    case 'ROUNDABOUT':
      return { label: 'KRUHOVÝ OBJEZD', icon: '🔄', color: 'bg-indigo-50 text-indigo-800 border-indigo-300' };
    case 'TWO_WAY':
      return { label: 'OBOUSMĚRNÝ', icon: '↔', color: 'bg-purple-50 text-purple-800 border-purple-300' };
    case 'STRAIGHT':
    default:
      return { label: 'PŘÍMO', icon: '↑', color: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}

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
  const [modalError, setModalError] = useState<string | null>(null);

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
  const [formPillarNumber, setFormPillarNumber] = useState('');
  const [formVisibility, setFormVisibility] = useState<'GOOD' | 'NEEDS_CHECK' | 'POOR'>('GOOD');
  const [formOwnership, setFormOwnership] = useState('UNKNOWN');
  const [formPermit, setFormPermit] = useState('UNKNOWN');
  const [formNote, setFormNote] = useState('');
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string | null>(null);

  const openNavigation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
    setModalError(null);
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
      setFormPillarNumber(existing.pillarNumber || '');
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
      setFormPillarNumber('');
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
      setModalError('Poloha GPS je povinná. Klikněte na Získat moji GPS.');
      return;
    }
    setSaving(true);
    setModalError(null);

    const uploadedPhotoIds: string[] = [];
    try {
      // 1. Upload photos if any
      for (const p of photosToUpload) {
        const compressed = await compressImageFile(p.file);
        const formData = new FormData();
        formData.append('file', compressed);
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
          pillarNumber: formPillarNumber || null,
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
        // Rollback unlinked uploaded photos
        if (uploadedPhotoIds.length > 0) {
          await Promise.allSettled(
            uploadedPhotoIds.map((id) => fetch(`/api/photos/${id}`, { method: 'DELETE' }).catch(() => {}))
          );
        }
        const errJson = await res.json().catch(() => ({}));
        const rawErr = typeof errJson?.error === 'string' ? errJson.error : '';
        const friendlyMsg = rawErr.includes('Foreign key') || rawErr.includes('Prisma') || rawErr.includes('P2003')
          ? 'Místo se nepodařilo uložit. Zkuste akci zopakovat.'
          : (rawErr || 'Místo se nepodařilo uložit. Zkuste akci zopakovat.');
        setModalError(friendlyMsg);
      }
    } catch (error: unknown) {
      // Rollback unlinked uploaded photos
      if (uploadedPhotoIds.length > 0) {
        await Promise.allSettled(
          uploadedPhotoIds.map((id) => fetch(`/api/photos/${id}`, { method: 'DELETE' }).catch(() => {}))
        );
      }
      setModalError('Chyba připojení k serveru. Zkontrolujte připojení a zkuste akci zopakovat.');
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
          <Link href="/mobile-surveys" className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-bold transition">
            <ArrowLeft size={16} />
            <span>Všechny průzkumy</span>
          </Link>
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

          {/* Quick point strip below map */}
          {data.candidatePoints.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-black text-slate-700 block px-1">
                Body pro tuto zakázku ({data.candidatePoints.length}) – rychlá navigace:
              </span>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {data.candidatePoints.map((c) => {
                  const arrowInfo = formatSurveyArrowBadge(c.arrowDirection);
                  return (
                    <div
                      key={c.id}
                      className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm min-w-[240px] sm:min-w-[270px] shrink-0 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 space-y-0.5">
                          <h5 className="font-extrabold text-xs text-slate-900 truncate">{c.label}</h5>
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <MapPin size={10} className="text-sky-500 shrink-0" />
                            <span>{c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}</span>
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md border font-black text-[10px] shrink-0 ${arrowInfo.color}`}>
                          {arrowInfo.icon}
                        </span>
                      </div>

                      {c.pillarNumber && (
                        <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-black text-[10px]">
                          💡 Sloup: {c.pillarNumber}
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => openNavigation(c.latitude, c.longitude)}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-1.5 px-2.5 rounded-xl text-[11px] shadow-sm active:scale-95 transition cursor-pointer"
                        >
                          <NavIcon size={11} />
                          <span>Navigovat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(c)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                          title="Upravit"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            data.candidatePoints.map((c) => {
              const arrowInfo = formatSurveyArrowBadge(c.arrowDirection);
              return (
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
                        {c.distanceValue != null && <span className="font-bold text-slate-700">({c.distanceValue} km od cíle)</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openNavigation(c.latitude, c.longitude)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm active:scale-95 transition cursor-pointer"
                        title="Spustit navigaci k bodu v Google Mapách"
                      >
                        <NavIcon size={12} className="shrink-0" />
                        <span>Navigovat</span>
                      </button>
                      <a
                        href={`https://mapy.cz/zakladni?q=${c.latitude},${c.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center"
                        title="Otevřít v Mapy.cz"
                      >
                        🗺️
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(c)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold shrink-0 cursor-pointer"
                        title="Upravit polohu a informace"
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Properties Pills */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-600">
                    {c.pillarNumber && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-md font-black flex items-center gap-1">
                        <span>💡 Sloup:</span>
                        <strong>{c.pillarNumber}</strong>
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-md border font-black flex items-center gap-1 ${arrowInfo.color}`}>
                      <span>Šipka:</span>
                      <span>{arrowInfo.icon}</span>
                      <span>{arrowInfo.label}</span>
                    </span>
                    {c.approachDirection && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        Příjezd: {c.approachDirection}
                      </span>
                    )}
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">Trasa: {c.surveyRoute?.name || 'Bez trasy'}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-md">Typ: {c.placementType}</span>
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
                      {c.photos.map((p) => {
                        const photoSrc = p.url || `/api/photos/${p.id}/file`;
                        return (
                          <div key={p.id} className="relative size-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                            <Image src={photoSrc} alt={c.label} fill unoptimized className="object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
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

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-150">
                <span>⚠️ {modalError}</span>
                <button type="button" onClick={() => setModalError(null)} className="text-rose-600 hover:text-rose-900 font-bold p-1">✕</button>
              </div>
            )}

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
                  className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-xl transition cursor-pointer"
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
                <p className="text-xs text-amber-700 font-semibold italic">Zatím nezískána GPS. Klikněte na tlačítko nahoře.</p>
              )}

              {formLat && formLng && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openNavigation(formLat, formLng)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 py-1.5 px-3 rounded-xl transition cursor-pointer"
                  >
                    <NavIcon size={12} />
                    <span>🚗 Spustit navigaci k tomuto místu</span>
                  </button>
                  <a
                    href={`https://mapy.cz/zakladni?q=${formLat},${formLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center shrink-0"
                    title="Otevřít v Mapy.cz"
                  >
                    🗺️ Mapy.cz
                  </a>
                </div>
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
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Příjezdová trasa / Koridor
                  <select value={formRouteId} onChange={(e) => setFormRouteId(e.target.value)} className="input text-xs mt-1 font-bold">
                    <option value="">-- Bez trasy / Obecné místo --</option>
                    {data.surveyRoutes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                    <option value="__NEW__">➕ Vytvořit novou trasa (např. Příjezd od Hlučína)...</option>
                  </select>
                </label>
                <p className="text-[10px] text-slate-500 font-medium">
                  Trasy slouží ke seskupování navigačních cedulí podle směrů, odkud klienti přijíždějí.
                </p>

                {formRouteId === '__NEW__' && (
                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 space-y-2 mt-2">
                    <span className="text-xs font-bold text-purple-900 block">Zadejte název nové příjezdové trasy:</span>
                    <input
                      type="text"
                      placeholder="Např. Hlavní příjezd od Opavy / Dálnice D1"
                      className="input text-xs bg-white border-purple-300"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          try {
                            const res = await fetch(`/api/navigation/orders/${orderId}/routes`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: val }),
                            });
                            if (res.ok) {
                              const routeData = await res.json();
                              setData((prev) => prev ? { ...prev, surveyRoutes: [...prev.surveyRoutes, routeData] } : null);
                              setFormRouteId(routeData.id);
                            }
                          } catch (err) {
                            console.error('Create route error:', err);
                          }
                        }
                      }}
                    />
                    <span className="text-[10px] text-purple-700 block">Stiskněte Enter pro uložení nové trasy.</span>
                  </div>
                )}
              </div>

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

              {/* Číslo sloupu / VO lampy */}
              <label className="text-xs font-bold text-slate-700 block">
                Číslo sloupu / VO lampy (přesné umístění v terénu)
                <input
                  type="text"
                  value={formPillarNumber}
                  onChange={(e) => setFormPillarNumber(e.target.value)}
                  placeholder="Např. VO 45/2 nebo Trolejový sloup č. 14"
                  className="input text-xs mt-1 font-bold border-amber-300 focus:border-amber-500"
                />
              </label>

              {/* Arrow Choice */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Doporučená orientace směrové šipky</label>
                
                {/* Standard Arrows */}
                <div className="grid grid-cols-6 gap-1.5">
                  {[
                    { id: 'LEFT', icon: '←', label: 'Vlevo' },
                    { id: 'STRAIGHT', icon: '↑', label: 'Rovně' },
                    { id: 'RIGHT', icon: '→', label: 'Vpravo' },
                    { id: 'SLANTED_LEFT', icon: '↖', label: 'Šikmo L' },
                    { id: 'SLANTED_RIGHT', icon: '↗', label: 'Šikmo P' },
                    { id: 'U_TURN', icon: '↩', label: 'Otočení' },
                  ].map((arr) => (
                    <button
                      key={arr.id}
                      type="button"
                      onClick={() => setFormArrowDirection(arr.id)}
                      className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center border transition cursor-pointer ${
                        formArrowDirection === arr.id
                          ? 'bg-sky-600 text-white border-sky-700 shadow-md font-black'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 font-bold'
                      }`}
                      title={arr.label}
                    >
                      <span className="text-base font-black">{arr.icon}</span>
                      <span className="text-[10px] leading-tight">{arr.label}</span>
                    </button>
                  ))}
                </div>

                {/* Roundabout Arrows */}
                <div className="pt-1 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">Kruhové objezdy (výjezdy):</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'ROUNDABOUT_1', icon: '🔄', label: '1. výjezd' },
                      { id: 'ROUNDABOUT_2', icon: '🔄', label: '2. výjezd' },
                      { id: 'ROUNDABOUT_3', icon: '🔄', label: '3. výjezd' },
                      { id: 'ROUNDABOUT_4', icon: '🔄', label: '4. výjezd' },
                      { id: 'ROUNDABOUT', icon: '🔄', label: 'Obecně' },
                    ].map((arr) => (
                      <button
                        key={arr.id}
                        type="button"
                        onClick={() => setFormArrowDirection(arr.id)}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center border transition cursor-pointer ${
                          formArrowDirection === arr.id
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md font-black'
                            : 'bg-indigo-50/70 text-indigo-950 hover:bg-indigo-100 border-indigo-200 font-bold'
                        }`}
                        title={`Kruhový objezd – ${arr.label}`}
                      >
                        <span className="text-sm font-black">{arr.icon}</span>
                        <span className="text-[10px] leading-tight font-black">{arr.label}</span>
                      </button>
                    ))}
                  </div>
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
