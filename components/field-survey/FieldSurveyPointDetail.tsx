'use client';

import { useState, useRef } from 'react';
import type { SurveyPointItem } from './FieldSurveyMapView';
import { processPhotoForUpload } from '@/lib/client-photo-processing';

/**
 * Přímý klientský dotaz na bezplatné veřejné ArcGIS REST API ČÚZK RÚIAN.
 * Běží přímo z prohlížeče uživatele (s českou IP a plnou CORS podporou),
 * čímž obchází případné firewallové blokace zahraničních cloudových serverů (Vercel).
 */
async function fetchCuzkParcelDirect(lat: number, lng: number): Promise<{
  found: boolean;
  parcelNumber?: string;
  cadastralArea?: string;
  municipality?: string;
  sourceUrl?: string;
  errorMessage?: string;
}> {
  try {
    const delta = 0.005;
    const params = new URLSearchParams({
      f: 'json',
      geometryType: 'esriGeometryPoint',
      geometry: JSON.stringify({ x: lng, y: lat }),
      sr: '4326',
      layers: 'all:1,5,7,12',
      tolerance: '5',
      mapExtent: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
      imageDisplay: '800,600,96',
      returnGeometry: 'false',
    });

    const res = await fetch(
      `https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer/identify?${params.toString()}`
    );
    if (!res.ok) {
      return { found: false, errorMessage: `ČÚZK RÚIAN vrátil HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      results?: Array<{
        layerId: number;
        layerName: string;
        attributes?: Record<string, string>;
      }>;
    };
    const parcel = data.results?.find((r) => r.layerId === 5);
    const ku = data.results?.find((r) => r.layerId === 7);
    const obec = data.results?.find((r) => r.layerId === 12);

    const parcelNumber = parcel?.attributes?.['Číslo parcely'] || parcel?.attributes?.['Kmenové parcelní číslo'];
    if (!parcelNumber) {
      return { found: false, errorMessage: 'Na zadaných GPS souřadnicích nebyla nalezena parcela v ČÚZK.' };
    }

    const kuName = ku?.attributes?.['Název katastrálního území'];
    const obecName = obec?.attributes?.['Název obce'];
    const ikatastrUrl = `https://www.ikatastr.cz/#kde=${lat},${lng},18&info=${lat},${lng}&mapa=letecka&vrstvy=parcelybudovy`;

    return {
      found: true,
      parcelNumber: String(parcelNumber),
      cadastralArea: kuName ? String(kuName) : undefined,
      municipality: obecName ? String(obecName) : undefined,
      sourceUrl: ikatastrUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba';
    return { found: false, errorMessage: `ČÚZK přímé spojení selhalo: ${message}` };
  }
}

export function FieldSurveyPointDetail({
  point,
  userRole,
  onClose,
  onPointUpdated,
  onPointDeleted,
}: {
  point: SurveyPointItem;
  userRole: string;
  onClose: () => void;
  onPointUpdated: (updatedPoint: SurveyPointItem) => void;
  onPointDeleted?: (pointId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'parcel' | 'owner' | 'contact' | 'ai' | 'convert'>('overview');
  const [isLookingUpParcel, setIsLookingUpParcel] = useState(false);
  const [parcelMessage, setParcelMessage] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // Point deletion state
  const [isDeletingPoint, setIsDeletingPoint] = useState(false);
  const [deletePointError, setDeletePointError] = useState('');

  // Photo management state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const addPhotoInputRef = useRef<HTMLInputElement>(null);

  // Manual parcel form state
  const [isEditingParcelManual, setIsEditingParcelManual] = useState(false);
  const [manualParcelNumber, setManualParcelNumber] = useState(point.parcelData?.parcelNumber ?? '');
  const [manualCadastralArea, setManualCadastralArea] = useState(point.parcelData?.cadastralArea ?? '');
  const [manualMunicipality, setManualMunicipality] = useState(point.parcelData?.municipality ?? '');
  const [manualLv, setManualLv] = useState('');
  const [isSavingManualParcel, setIsSavingManualParcel] = useState(false);

  // Owner form state
  const [ownerName, setOwnerName] = useState(point.ownerData?.ownerName ?? '');
  const [ownerType, setOwnerType] = useState(point.ownerData?.ownerType ?? 'UNKNOWN');
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  // Contact form state
  const [contactCompany, setContactCompany] = useState(point.contactData?.company ?? '');
  const [contactPerson, setContactPerson] = useState(point.contactData?.contactPerson ?? '');
  const [contactPhone, setContactPhone] = useState(point.contactData?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(point.contactData?.email ?? '');
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Carrier conversion state
  const [carrierCode, setCarrierCode] = useState(`CAR-${point.surfaceType}-${point.id.slice(-5).toUpperCase()}`);
  const [carrierName, setCarrierName] = useState(`Nosič ${point.address || point.surfaceType}`);
  const [carrierCity, setCarrierCity] = useState(point.parcelData?.municipality || 'Ostrava');
  const [carrierType, setCarrierType] = useState('BILLBOARD');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<string | null>(null);

  const canConvert = userRole === 'ADMIN' || userRole === 'MANAGER';

  // Smazání celé plochy (průzkumného bodu)
  async function handleDeletePoint() {
    const desc = point.address ? `${point.surfaceType} (${point.address})` : point.surfaceType;
    if (!confirm(`Opravdu chcete smazat plochu "${desc}" včetně všech fotografií a údajů? Tuto akci nelze vrátit.`)) {
      return;
    }
    setIsDeletingPoint(true);
    setDeletePointError('');
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Chyba při mazání plochy.' })) as { error?: string };
        setDeletePointError(err.error || 'Plochu se nepodařilo smazat.');
        return;
      }
      if (onPointDeleted) {
        onPointDeleted(point.id);
      }
      onClose();
    } catch {
      setDeletePointError('Chyba při komunikaci se serverem.');
    } finally {
      setIsDeletingPoint(false);
    }
  }

  // Přidání fotografie z detailu (s automatickou optimalizací)
  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setIsUploadingPhoto(true);
    try {
      let fileToUpload = rawFile;
      try {
        const { file: optimized } = await processPhotoForUpload(rawFile, {
          maxDimension: 1920,
          maxBytes: 1.5 * 1024 * 1024,
          initialQuality: 0.82,
        });
        fileToUpload = optimized;
      } catch (optErr) {
        console.warn('Optimalizace fotografie selhala, použiji originál', optErr);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        alert('Fotografii se nepodařilo nahrát.');
        return;
      }

      const data = await res.json() as { photo?: SurveyPointItem['photos'][number] };
      if (data.photo) {
        onPointUpdated({
          ...point,
          photos: [...(point.photos || []), data.photo],
        });
      }
    } catch {
      alert('Chyba při komunikaci se serverem při nahrávání fotografie.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  }

  // Smazání fotografie z bodu
  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Opravdu chcete smazat tuto fotografii?')) return;
    setDeletingPhotoId(photoId);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/photos?photoId=${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onPointUpdated({
          ...point,
          photos: point.photos.filter((p) => p.id !== photoId),
        });
      } else {
        alert('Fotografii se nepodařilo smazat.');
      }
    } catch {
      alert('Chyba při komunikaci se serverem.');
    } finally {
      setDeletingPhotoId(null);
    }
  }

  // Ruční uložení parcelních dat
  async function handleSaveManualParcel(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingManualParcel(true);
    setParcelMessage('');
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/parcel-lookup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelNumber: manualParcelNumber,
          cadastralArea: manualCadastralArea,
          municipality: manualMunicipality,
          lv: manualLv,
        }),
      });
      const data = await res.json() as { success: boolean; message: string; parcel?: SurveyPointItem['parcelData'] };
      setParcelMessage(data.message || (data.success ? 'Parcela byla ručně uložena.' : 'Uložení selhalo.'));
      if (data.success && data.parcel) {
        onPointUpdated({ ...point, parcelData: data.parcel, status: 'PARCEL_FOUND' });
        setIsEditingParcelManual(false);
      }
    } catch {
      setParcelMessage('Chyba při komunikaci se serverem.');
    } finally {
      setIsSavingManualParcel(false);
    }
  }

  // Aplikace typu navrženého AI
  async function handleApplyAiSuggestion() {
    if (!point.aiAnalysis?.suggestedType) return;
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceType: point.aiAnalysis.suggestedType,
        }),
      });
      if (res.ok) {
        onPointUpdated({
          ...point,
          surfaceType: point.aiAnalysis.suggestedType as SurveyPointItem['surfaceType'],
        });
        setAiMessage(`Typ plochy byl změněn na ${point.aiAnalysis.suggestedType}.`);
      }
    } catch {
      setAiMessage('Nepodařilo se aplikovat návrh typu.');
    }
  }

  // Vyhledání parcely (s automatickým přímým klientským fallbackem pro případ výpadku spojení server-ČÚZK)
  async function handleParcelLookup() {
    setIsLookingUpParcel(true);
    setParcelMessage('Zjišťuji parcelu z katastru nemovitostí ČR…');
    try {
      // 1. Zkusíme server-side lookup
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/parcel-lookup`, {
        method: 'POST',
      });
      const data = await res.json() as {
        success: boolean;
        found?: boolean;
        message: string;
        parcel?: SurveyPointItem['parcelData'];
      };

      if (data.success && data.found && data.parcel?.parcelNumber) {
        setParcelMessage(data.message || `Parcela ${data.parcel.parcelNumber} nalezena.`);
        onPointUpdated({ ...point, parcelData: data.parcel, status: 'PARCEL_FOUND' });
        return;
      }

      // 2. Klientský fallback: Pokud server ČÚZK z cloudu neodpověděl, dotážeme se přímo z prohlížeče
      setParcelMessage('Zkouším přímé spojení s ČÚZK RÚIAN z Vašeho prohlížeče…');
      const direct = await fetchCuzkParcelDirect(point.latitude, point.longitude);
      if (direct.found && direct.parcelNumber) {
        const putRes = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/parcel-lookup`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parcelNumber: direct.parcelNumber,
            cadastralArea: direct.cadastralArea,
            municipality: direct.municipality,
            sourceUrl: direct.sourceUrl,
          }),
        });
        const putData = await putRes.json() as { success: boolean; message: string; parcel?: SurveyPointItem['parcelData'] };
        if (putData.success && putData.parcel) {
          setParcelMessage(`Parcela ${direct.parcelNumber} byla úspěšně zjištěna z ČÚZK RÚIAN.`);
          onPointUpdated({ ...point, parcelData: putData.parcel, status: 'PARCEL_FOUND' });
          return;
        }
      }

      setParcelMessage(data.message || direct.errorMessage || 'Parcela nebyla na těchto souřadnicích v ČÚZK nalezena. Můžete ji zadat ručně.');
    } catch {
      // 3. Fallback při chybě spojení se serverem
      try {
        const direct = await fetchCuzkParcelDirect(point.latitude, point.longitude);
        if (direct.found && direct.parcelNumber) {
          const putRes = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/parcel-lookup`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parcelNumber: direct.parcelNumber,
              cadastralArea: direct.cadastralArea,
              municipality: direct.municipality,
              sourceUrl: direct.sourceUrl,
            }),
          });
          const putData = await putRes.json() as { success: boolean; parcel?: SurveyPointItem['parcelData'] };
          if (putData.success && putData.parcel) {
            setParcelMessage(`Parcela ${direct.parcelNumber} nalezena přes přímé spojení.`);
            onPointUpdated({ ...point, parcelData: putData.parcel, status: 'PARCEL_FOUND' });
            return;
          }
        }
      } catch {
        // ignore
      }
      setParcelMessage('Chyba při komunikaci s katastrem nemovitostí. Můžete parcelní číslo zadat ručně.');
    } finally {
      setIsLookingUpParcel(false);
    }
  }

  // Spuštění AI analýzy
  async function handleAiAnalyze() {
    setIsAiAnalyzing(true);
    setAiMessage('');
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/ai-analyze`, {
        method: 'POST',
      });
      const data = await res.json() as { success: boolean; message: string; analysis?: SurveyPointItem['aiAnalysis'] };
      setAiMessage(data.message || (data.success ? 'AI analýza hotova.' : 'AI analýza selhala.'));
      if (data.success && data.analysis) {
        onPointUpdated({ ...point, aiAnalysis: data.analysis });
      }
    } catch {
      setAiMessage('Chyba při spouštění AI analýzy.');
    } finally {
      setIsAiAnalyzing(false);
    }
  }

  // Uložení vlastníka
  async function handleSaveOwner(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingOwner(true);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/owner`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName, ownerType }),
      });
      const data = await res.json() as { success: boolean; owner?: SurveyPointItem['ownerData'] };
      if (data.success && data.owner) {
        onPointUpdated({ ...point, ownerData: data.owner, status: 'OWNER_FOUND' });
      }
    } finally {
      setIsSavingOwner(false);
    }
  }

  // Uložení kontaktu
  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingContact(true);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: contactCompany,
          contactPerson,
          phone: contactPhone,
          email: contactEmail,
        }),
      });
      const data = await res.json() as { success: boolean; contact?: SurveyPointItem['contactData'] };
      if (data.success && data.contact) {
        onPointUpdated({ ...point, contactData: data.contact, status: 'CONTACT_FOUND' });
      }
    } finally {
      setIsSavingContact(false);
    }
  }

  // Převod na nosič
  async function handleConvertToCarrier(e: React.FormEvent) {
    e.preventDefault();
    setIsConverting(true);
    setConversionResult(null);
    try {
      const res = await fetch(`/api/field-survey/${point.surveyId}/points/${point.id}/convert-to-carrier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: carrierCode,
          name: carrierName,
          city: carrierCity,
          type: carrierType,
        }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setConversionResult(data.message || (data.success ? 'Nosič byl vytvořen.' : 'Chyba převodu.'));
      if (data.success) {
        onPointUpdated({ ...point, status: 'CONVERTED' });
      }
    } catch {
      setConversionResult('Chyba při komunikaci se serverem.');
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto">
      {/* Záhlaví detailu */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-900">{point.surfaceType}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {point.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Zaznamenal {point.createdBy?.name} · {new Date(point.createdAt).toLocaleDateString('cs-CZ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDeletePoint()}
            disabled={isDeletingPoint}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-red-200 transition disabled:opacity-50"
            title="Smazat tuto plochu z průzkumu"
          >
            {isDeletingPoint ? 'Mažu…' : '🗑️ Smazat plochu'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold px-2 py-1 rounded-lg"
            aria-label="Zavřít detail"
          >
            ✕
          </button>
        </div>
      </div>

      {deletePointError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          ❌ {deletePointError}
        </div>
      )}

      {/* Navigační taby */}
      <div className="flex gap-1 border-b border-slate-100 pb-2 overflow-x-auto text-xs font-medium">
        {[
          { id: 'overview', label: 'Přehled & Foto' },
          { id: 'parcel', label: 'Parcela' },
          { id: 'owner', label: 'Vlastník' },
          { id: 'contact', label: 'Kontakt' },
          { id: 'ai', label: 'AI Analýza' },
          ...(canConvert ? [{ id: 'convert', label: 'Převod na nosič' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-xl transition ${
              activeTab === tab.id
                ? 'bg-sky-950 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PŘEHLED & FOTO */}
      {activeTab === 'overview' && (
        <div className="space-y-4 text-sm">
          {/* Hlavička sekce fotografií */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Fotografie ({point.photos?.length || 0})
            </span>
            <input
              ref={addPhotoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleAddPhoto(e)}
            />
            <button
              type="button"
              onClick={() => addPhotoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition disabled:opacity-50"
            >
              {isUploadingPhoto ? 'Nahrávám…' : '+ Přidat foto'}
            </button>
          </div>

          {/* Fotogalerie */}
          {point.photos?.length > 0 ? (
            <div className="space-y-2">
              <div className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={point.photos[0].url}
                  alt="Fotografie bodu"
                  className="w-full h-48 rounded-xl object-cover border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => void handleDeletePhoto(point.photos[0].id)}
                  disabled={deletingPhotoId === point.photos[0].id}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2 py-1 rounded-lg opacity-80 group-hover:opacity-100 shadow transition"
                  title="Smazat tuto fotografii"
                >
                  {deletingPhotoId === point.photos[0].id ? '…' : '🗑️ Smazat foto'}
                </button>
              </div>

              {point.photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pt-1">
                  {point.photos.slice(1).map((photo, i) => (
                    <div key={photo.id || i} className="relative group flex-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={`Foto ${i + 2}`}
                        className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDeletePhoto(photo.id)}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full h-5 w-5 text-xs font-bold flex items-center justify-center opacity-90 shadow transition"
                        title="Smazat foto"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-32 rounded-xl bg-slate-50 border border-dashed border-slate-200 grid place-items-center text-xs text-slate-400">
              Bez fotografií
            </div>
          )}

          {/* GPS a Adresa */}
          <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-700">GPS poloha:</span>
              <div className="flex gap-2">
                <a
                  href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  Google Maps ↗
                </a>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  OSM ↗
                </a>
              </div>
            </div>
            <div className="font-mono text-slate-900">
              {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              {point.gpsAccuracyMeters ? ` (±${Math.round(point.gpsAccuracyMeters)} m)` : ''}
            </div>
            {point.address && (
              <div>
                <span className="font-semibold text-slate-700">Adresa:</span>
                <p className="text-slate-900 mt-0.5">{point.address}</p>
              </div>
            )}
            {point.note && (
              <div>
                <span className="font-semibold text-slate-700">Poznámka z terénu:</span>
                <p className="text-slate-900 mt-0.5 italic">{point.note}</p>
              </div>
            )}
          </div>

          {/* Smazání plochy na spodku */}
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-400">Správa plochy:</span>
            <button
              type="button"
              onClick={() => void handleDeletePoint()}
              disabled={isDeletingPoint}
              className="text-red-600 hover:text-red-700 hover:underline font-semibold"
            >
              Odstranit tuto plochu z průzkumu
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PARCELA */}
      {activeTab === 'parcel' && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <strong>Geodatová vrstva:</strong> Data pochází z oficiálního katastru nemovitostí ČR (ČÚZK RÚIAN) nebo ručního zadání. AI parcelní čísla nevymýšlí.
          </div>

          {point.parcelData?.parcelNumber ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700">Parcelní číslo:</span>
                <div className="flex items-center gap-2">
                  <strong className="text-slate-900 font-mono text-sm">{point.parcelData.parcelNumber}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(point.parcelData?.parcelNumber || '').catch(() => {});
                      }
                      setParcelMessage(`Číslo parcely ${point.parcelData?.parcelNumber} bylo zkopírováno do schránky.`);
                    }}
                    className="px-2 py-0.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-medium transition"
                    title="Kopírovat parcelní číslo"
                  >
                    📋 Kopírovat
                  </button>
                </div>
              </div>
              {point.parcelData.cadastralArea && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Katastrální území:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900">{point.parcelData.cadastralArea}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator?.clipboard?.writeText) {
                          navigator.clipboard.writeText(point.parcelData?.cadastralArea || '').catch(() => {});
                        }
                        setParcelMessage(`Katastrální území ${point.parcelData?.cadastralArea} bylo zkopírováno do schránky.`);
                      }}
                      className="px-2 py-0.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-medium transition"
                      title="Kopírovat katastrální území"
                    >
                      📋 Kopírovat
                    </button>
                  </div>
                </div>
              )}
              {point.parcelData.municipality && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Obec:</span>
                  <span className="text-slate-900">{point.parcelData.municipality}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700">Stav ověření:</span>
                <span className="font-bold text-sky-700">{point.parcelData.confidence}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                <a
                  href={`https://www.ikatastr.cz/#kde=${point.latitude},${point.longitude},18&info=${point.latitude},${point.longitude}&mapa=letecka&vrstvy=parcelybudovy`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs border border-emerald-200 transition shadow-sm"
                >
                  🗺️ Otevřít v iKatastr.cz (interaktivní mapa parcel) ↗
                </a>
                <a
                  href="https://nahlizenidokn.cuzk.cz/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-xs border border-sky-200 transition shadow-sm"
                >
                  🏛️ Nahlížení do KN (ČÚZK) ↗
                </a>
                <a
                  href={`https://mapy.cz/zakladni?x=${point.longitude}&y=${point.latitude}&z=19&base=ophoto`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 font-semibold text-xs border border-slate-200 transition"
                >
                  📍 Mapy.cz ↗
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">K tomuto bodu zatím nejsou přiřazena parcelní data.</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleParcelLookup()}
              disabled={isLookingUpParcel}
              className="flex-1 btn btn-primary text-xs py-2.5"
            >
              {isLookingUpParcel ? 'Zjišťuji parcelu…' : '🔍 Vyhledat parcelu pro GPS'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditingParcelManual((prev) => !prev)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              {isEditingParcelManual ? 'Zavřít úpravu' : '✏️ Zadat ručně'}
            </button>
          </div>

          {isEditingParcelManual && (
            <form onSubmit={handleSaveManualParcel} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800">Ruční zadání parcelních dat</div>
              <div>
                <label className="block text-slate-600 mb-0.5">Parcelní číslo *</label>
                <input
                  type="text"
                  required
                  value={manualParcelNumber}
                  onChange={(e) => setManualParcelNumber(e.target.value)}
                  placeholder="Např. 2379/7"
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-0.5">Katastrální území</label>
                  <input
                    type="text"
                    value={manualCadastralArea}
                    onChange={(e) => setManualCadastralArea(e.target.value)}
                    placeholder="Např. Moravská Ostrava"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-0.5">Obec</label>
                  <input
                    type="text"
                    value={manualMunicipality}
                    onChange={(e) => setManualMunicipality(e.target.value)}
                    placeholder="Např. Ostrava"
                    className="input w-full"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSavingManualParcel}
                className="w-full btn btn-primary py-2 text-xs font-semibold disabled:opacity-50"
              >
                {isSavingManualParcel ? 'Ukládám…' : 'Uložit parcelní data'}
              </button>
            </form>
          )}

          {parcelMessage && (
            <p className="text-xs text-slate-700 bg-slate-100 p-2.5 rounded-lg">{parcelMessage}</p>
          )}
        </div>
      )}

      {/* TAB 3: VLASTNÍK */}
      {activeTab === 'owner' && (
        <form onSubmit={handleSaveOwner} className="space-y-3 text-xs">
          <p className="text-slate-500">Vlastník pozemku nebo objektu, na kterém plocha stojí.</p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jméno / Název vlastníka</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Např. Statutární město Ostrava, Dopravní podnik..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Typ vlastníka</label>
            <select
              value={ownerType}
              onChange={(e) => setOwnerType(e.target.value)}
              className="input w-full"
            >
              <option value="UNKNOWN">Neznámý</option>
              <option value="MUNICIPALITY">Město / Obec</option>
              <option value="STATE">Stát / ŘSD / SŽ</option>
              <option value="COMPANY">Firma / S.R.O. / A.S.</option>
              <option value="INDIVIDUAL">Soukromá osoba</option>
            </select>
          </div>
          <button type="submit" disabled={isSavingOwner} className="btn btn-primary w-full py-2">
            {isSavingOwner ? 'Ukládám…' : 'Uložit vlastníka'}
          </button>
        </form>
      )}

      {/* TAB 4: KONTAKT */}
      {activeTab === 'contact' && (
        <form onSubmit={handleSaveContact} className="space-y-3 text-xs">
          <p className="text-slate-500">Kontaktní údaje pro obchodní jednání o pronájmu plochy.</p>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Společnost</label>
            <input
              type="text"
              value={contactCompany}
              onChange={(e) => setContactCompany(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kontaktní osoba</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="input w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>
          <button type="submit" disabled={isSavingContact} className="btn btn-primary w-full py-2">
            {isSavingContact ? 'Ukládám…' : 'Uložit kontakt'}
          </button>
        </form>
      )}

      {/* TAB 5: AI ANALÝZA */}
      {activeTab === 'ai' && (
        <div className="space-y-3 text-xs">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-sky-900">
            <strong>AI asistent:</strong> Analyzuje fyzické parametry z fotografie (viditelnost, překážky, okolí). Výsledky jsou návrhy určené k potvrzení.
          </div>

          {point.aiAnalysis ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Stav analýzy:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  point.aiAnalysis.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                  point.aiAnalysis.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  'bg-slate-200 text-slate-700'
                }`}>
                  {point.aiAnalysis.status}
                </span>
              </div>

              {point.aiAnalysis.status === 'FAILED' && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                  <p className="font-semibold">⚠️ AI analýza selhala</p>
                  <p className="mt-0.5">{point.aiAnalysis.errorMessage || 'AI služba nebyla schopna fotografii vyhodnotit. Zkontrolujte API klíč.'}</p>
                </div>
              )}

              {point.aiAnalysis.suggestedType && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Návrh typu plochy:</span>
                  <div className="flex items-center gap-2">
                    <strong className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded">{point.aiAnalysis.suggestedType}</strong>
                    {point.surfaceType !== point.aiAnalysis.suggestedType && (
                      <button
                        type="button"
                        onClick={() => void handleApplyAiSuggestion()}
                        className="text-xs font-semibold text-sky-600 hover:underline"
                        title="Změnit typ plochy na návrh AI"
                      >
                        Použít typ
                      </button>
                    )}
                  </div>
                </div>
              )}

              {point.aiAnalysis.isUsable !== null && point.aiAnalysis.isUsable !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Využitelné pro reklamu:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    point.aiAnalysis.isUsable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {point.aiAnalysis.isUsable ? 'Ano' : 'Ne'}
                  </span>
                </div>
              )}

              {point.aiAnalysis.locationDesc && (
                <div>
                  <span className="font-semibold text-slate-700">Popis místa:</span>
                  <p className="text-slate-900 mt-0.5 bg-white p-2 rounded border border-slate-200">{point.aiAnalysis.locationDesc}</p>
                </div>
              )}

              {point.aiAnalysis.visibility && (
                <div>
                  <span className="font-semibold text-slate-700">Viditelnost:</span>
                  <p className="text-slate-900 mt-0.5 bg-white p-2 rounded border border-slate-200">{point.aiAnalysis.visibility}</p>
                </div>
              )}

              {point.aiAnalysis.orientation && (
                <div>
                  <span className="font-semibold text-slate-700">Orientace k provozu:</span>
                  <p className="text-slate-900 mt-0.5 bg-white p-2 rounded border border-slate-200">{point.aiAnalysis.orientation}</p>
                </div>
              )}

              {point.aiAnalysis.surroundings && (
                <div>
                  <span className="font-semibold text-slate-700">Okolí:</span>
                  <p className="text-slate-900 mt-0.5 bg-white p-2 rounded border border-slate-200">{point.aiAnalysis.surroundings}</p>
                </div>
              )}

              {point.aiAnalysis.obstacles && (
                <div>
                  <span className="font-semibold text-slate-700">Překážky:</span>
                  <p className="text-slate-900 mt-0.5 bg-white p-2 rounded border border-slate-200">{point.aiAnalysis.obstacles}</p>
                </div>
              )}

              {point.aiAnalysis.placementChar && (
                <div>
                  <span className="font-semibold text-slate-700">Umístění:</span>
                  <p className="text-slate-900 mt-0.5 bg-white p-2 rounded border border-slate-200">{point.aiAnalysis.placementChar}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500">AI analýza pro tento bod ještě nebyla spuštěna.</p>
          )}

          <button
            type="button"
            onClick={() => void handleAiAnalyze()}
            disabled={isAiAnalyzing || point.photos?.length === 0}
            className="w-full btn btn-primary py-2.5 disabled:opacity-50"
          >
            {isAiAnalyzing ? 'Analyzuji fotografii…' : point.aiAnalysis ? '🤖 Znovu spustit AI analýzu' : '🤖 Spustit AI analýzu'}
          </button>

          {aiMessage && (
            <p className="text-slate-700 bg-slate-100 p-2.5 rounded-lg">{aiMessage}</p>
          )}
        </div>
      )}

      {/* TAB 6: PŘEVOD NA SKUTEČNÝ NOSIČ */}
      {activeTab === 'convert' && canConvert && (
        <form onSubmit={handleConvertToCarrier} className="space-y-3 text-xs">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">
            <strong>Převod na nosič (pouze ADMIN/MANAGER):</strong>
            <p className="mt-1">
              Vytvoří plnohodnotný reklamní nosič v evidenci agentury s ověřenou GPS polohou a propojí ho s tímto bodem.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kód nosiče *</label>
            <input
              type="text"
              required
              value={carrierCode}
              onChange={(e) => setCarrierCode(e.target.value)}
              className="input w-full font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Název nosiče *</label>
            <input
              type="text"
              required
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              className="input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Město *</label>
              <input
                type="text"
                required
                value={carrierCity}
                onChange={(e) => setCarrierCity(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Typ nosiče *</label>
              <select
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value)}
                className="input w-full"
              >
                <option value="BILLBOARD">Billboard</option>
                <option value="BIGBOARD">Bigboard</option>
                <option value="CITYLIGHT">Citylight</option>
                <option value="BANNER">Banner</option>
                <option value="PROMO_TOWER">Promo Tower</option>
                <option value="PROMO_BENCH">Lavička</option>
                <option value="OTHER">Ostatní</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isConverting || point.status === 'CONVERTED'}
            className="w-full btn btn-primary py-2.5 font-bold disabled:opacity-50"
          >
            {isConverting
              ? 'Převádím na nosič…'
              : point.status === 'CONVERTED'
              ? 'Již převedeno na nosič'
              : '⚡ Potvrdit převod na nosič'}
          </button>

          {conversionResult && (
            <p className="text-slate-800 bg-slate-100 p-2.5 rounded-lg font-semibold">{conversionResult}</p>
          )}
        </form>
      )}
    </div>
  );
}
