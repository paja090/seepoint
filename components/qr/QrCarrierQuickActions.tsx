'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Camera, MapPin, Wrench, AlertTriangle, CheckCircle2, ChevronLeft, Image as ImageIcon, ArrowUpRight } from 'lucide-react';
function getCarrierBadgeMeta(type: string) {
  switch (type) {
    case 'NAVIGATION':
      return { label: '🧭 Navigační tabule (VO / Troleje)', badgeClass: 'bg-sky-100 text-sky-900 border-sky-300' };
    case 'PROMO_BENCH':
      return { label: '🪑 Reklamní Lavička', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'CITY_POSTER':
    case 'CITYLIGHT':
      return { label: '🖼️ City Poster / City Light (CLP)', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300' };
    case 'BILLBOARD':
      return { label: '📐 Billboard (Euroformát 5.1x2.4 m)', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' };
    case 'BIGBOARD':
      return { label: '🏢 Bigboard (9.6x3.6 m)', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'LED_SCREEN':
      return { label: '📺 Digitální LED Obrazovka', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    default:
      return { label: `📍 ${type}`, badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}

type QrCarrierQuickActionsProps = {
  carrier: {
    id: string;
    code: string;
    name: string;
    city: string;
    street?: string | null;
    address?: string | null;
    type: string;
    structureCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    status: string;
    surfacesCount: number;
    photosCount: number;
  };
  surfaces: Array<{
    id: string;
    name: string;
    sidePosition?: string | null;
    mediaType: string;
    currentClientName?: string | null;
    campaignName?: string | null;
  }>;
  recentPhotos: Array<{
    id: string;
    url: string;
    createdAt: string;
  }>;
  recentHistory: Array<{
    id: string;
    eventType: string;
    title: string;
    description?: string | null;
    performedBy?: string | null;
    performedAt: string;
  }>;
};

export function QrCarrierQuickActions({
  carrier,
  surfaces,
  recentPhotos,
  recentHistory,
}: QrCarrierQuickActionsProps) {
  const badgeMeta = getCarrierBadgeMeta(carrier.type);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState('');

  // Service Modal State
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceType, setServiceType] = useState('GRAPHICS_CHANGE');
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceNote, setServiceNote] = useState('');
  const [savingService, setSavingService] = useState(false);

  // Damage Modal State
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [faultTitle, setFaultTitle] = useState('');
  const [faultNote, setFaultNote] = useState('');
  const [savingFault, setSavingFault] = useState(false);

  // Compress photo for upload
  function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 2048;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(file);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : resolve(file)),
            'image/jpeg',
            0.82
          );
        };
        img.onerror = () => reject(new Error('Chyba načítání fotky'));
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      const compressedBlob = await compressImage(file);
      const formData = new FormData();
      formData.append('file', new File([compressedBlob], 'qr-photo.jpg', { type: 'image/jpeg' }));
      if (selectedSurfaceId) {
        formData.append('surfaceId', selectedSurfaceId);
      } else {
        formData.append('carrierId', carrier.id);
      }
      formData.append('type', 'CHECK');
      formData.append('note', 'Fotka z mobilního QR skenu z terénu');

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Uložení fotky selhalo');
      }

      setPhotoSuccess(true);
      setTimeout(() => setPhotoSuccess(false), 4000);
      window.location.reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při nahrávání fotky');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingService(true);
      const res = await fetch(`/api/navigation/carriers/${carrier.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: serviceType,
          title: serviceTitle || `Servisní úkon: ${serviceType}`,
          description: serviceNote,
          surfaceId: selectedSurfaceId || undefined,
        }),
      });

      if (!res.ok) throw new Error('Uložení servisu selhalo');
      setShowServiceModal(false);
      setServiceTitle('');
      setServiceNote('');
      window.location.reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při uložení servisu');
    } finally {
      setSavingService(false);
    }
  }

  async function handleSaveFault(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingFault(true);
      const res = await fetch(`/api/navigation/carriers/${carrier.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'REPAIR',
          title: `⚠️ Poškození: ${faultTitle}`,
          description: faultNote,
          surfaceId: selectedSurfaceId || undefined,
        }),
      });

      if (!res.ok) throw new Error('Nahlášení poškození selhalo');
      setShowFaultModal(false);
      setFaultTitle('');
      setFaultNote('');
      window.location.reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při uložení závady');
    } finally {
      setSavingFault(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4 space-y-5 pb-20">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <Link href={`/carriers/${carrier.id}`} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition">
          <ChevronLeft size={16} /> Detail nosiče
        </Link>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase text-emerald-400 border border-slate-800">
          📱 QR Mobilní Sken
        </span>
      </div>

      {/* Main Carrier Header Card */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl space-y-3 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs ${badgeMeta.badgeClass}`}>
            {badgeMeta.label}
          </span>
          <span className="rounded-xl bg-slate-950 px-2.5 py-1 text-xs font-mono font-extrabold text-sky-400 border border-slate-800">
            #{carrier.code}
          </span>
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-white leading-snug">{carrier.name}</h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            {carrier.city}, {carrier.street || carrier.address || 'Přesná lokalita'}
          </p>
        </div>

        {carrier.structureCode && (
          <div className="rounded-xl bg-sky-950/60 p-2.5 border border-sky-800/60 text-xs text-sky-300 font-bold">
            Číslo sloupu / stožáru VO: <span className="text-white font-mono">{carrier.structureCode}</span>
          </div>
        )}

        {carrier.latitude && carrier.longitude && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${carrier.latitude},${carrier.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:underline"
          >
            <MapPin size={14} /> GPS Navigovat k nosiči <ArrowUpRight size={12} />
          </a>
        )}
      </div>

      {/* Surface Selector (if multiple surfaces) */}
      {surfaces.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Vyberte konkrétní plochu (volitelné):
          </label>
          <select
            value={selectedSurfaceId}
            onChange={(e) => setSelectedSurfaceId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
          >
            <option value="">Celý nosič / Všechny plochy</option>
            {surfaces
              .filter((s) => s.name !== 'Celý nosič' && s.name !== 'Celý nosič / Všechny plochy')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sidePosition || 'Plocha'}) {s.currentClientName ? `• ${s.currentClientName}` : '• Volno'}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Success Banner */}
      {photoSuccess && (
        <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/80 p-4 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>Fotografie byla úspěšně uložena do evidenční karty nosiče!</span>
        </div>
      )}

      {/* Hidden File Camera Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* 🚀 3 BIG 1-TAP ACTION BUTTONS FOR TECHNICIANS */}
      <div className="grid gap-3">
        {/* Action 1: Take Photo */}
        <button
          type="button"
          disabled={uploadingPhoto}
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-between rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-slate-950 shadow-lg hover:brightness-110 active:scale-98 transition group cursor-pointer"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950/20 text-white">
              <Camera size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">📸 Vyfotit stav z terénu</h3>
              <p className="text-xs font-semibold text-emerald-100">Okamžitá spoušť a uložení fotky k nosiči</p>
            </div>
          </div>
          <span className="rounded-full bg-white/20 p-2 text-white">→</span>
        </button>

        {/* Action 2: Service / Reinstallation Log */}
        <button
          type="button"
          onClick={() => setShowServiceModal(true)}
          className="w-full flex items-center justify-between rounded-3xl border border-sky-500/40 bg-gradient-to-r from-sky-600 to-blue-600 p-4 text-white shadow-lg hover:brightness-110 active:scale-98 transition group cursor-pointer"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950/20 text-white">
              <Wrench size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">🛠️ Zapsat servis / výměnu</h3>
              <p className="text-xs font-semibold text-sky-100">Instalace plástve, výměna polepu, údržba</p>
            </div>
          </div>
          <span className="rounded-full bg-white/20 p-2 text-white">→</span>
        </button>

        {/* Action 3: Report Damage */}
        <button
          type="button"
          onClick={() => setShowFaultModal(true)}
          className="w-full flex items-center justify-between rounded-3xl border border-rose-500/40 bg-gradient-to-r from-rose-700 to-amber-700 p-4 text-white shadow-lg hover:brightness-110 active:scale-98 transition group cursor-pointer"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950/20 text-white">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">⚠️ Nahlásit poškození / závadu</h3>
              <p className="text-xs font-semibold text-rose-100">Poničená plástev, ohnutá konstrukce, vandalismus</p>
            </div>
          </div>
          <span className="rounded-full bg-white/20 p-2 text-white">→</span>
        </button>
      </div>

      {/* Recent Photos Gallery */}
      {recentPhotos.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-purple-400" /> Poslední fotodokumentace
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{carrier.photosCount} fotek celkem</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {recentPhotos.map((p) => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                <img src={p.url} alt="Nosič photo" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Action Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Zapsat Servisní Zásah</h3>
              <button type="button" onClick={() => setShowServiceModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveService} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Typ úkonu</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-bold"
                >
                  <option value="GRAPHICS_CHANGE">🎨 Výměna grafiky / polepu</option>
                  <option value="INSTALLATION">🔨 Nová montáž</option>
                  <option value="REINSTALLATION">🔄 Reinstalace</option>
                  <option value="SERVICE">⚙️ Běžná kontrola / Servis</option>
                  <option value="DEINSTALLATION">❌ Demontáž</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Název úkonu</label>
                <input
                  type="text"
                  placeholder="Např. Výměna směrové tabule AutoŠkoda"
                  value={serviceTitle}
                  onChange={(e) => setServiceTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Poznámka</label>
                <textarea
                  rows={2}
                  placeholder="Podrobnosti servisu..."
                  value={serviceNote}
                  onChange={(e) => setServiceNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowServiceModal(false)} className="rounded-xl border border-slate-700 px-3 py-2 text-slate-300 font-bold">Zrušit</button>
                <button type="submit" disabled={savingService} className="rounded-xl bg-sky-600 px-4 py-2 text-white font-black">
                  {savingService ? 'Ukládám…' : 'Uložit servis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fault Action Modal */}
      {showFaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-rose-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-rose-400">⚠️ Nahlásit Poškození Nosiče</h3>
              <button type="button" onClick={() => setShowFaultModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveFault} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Název závady / poškození</label>
                <input
                  type="text"
                  placeholder="Např. Ohnuté rameno výstrče, rozbité sklo"
                  value={faultTitle}
                  onChange={(e) => setFaultTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">Podrobný popis závady</label>
                <textarea
                  rows={2}
                  placeholder="Popište přesný stav poškození..."
                  value={faultNote}
                  onChange={(e) => setFaultNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowFaultModal(false)} className="rounded-xl border border-slate-700 px-3 py-2 text-slate-300 font-bold">Zrušit</button>
                <button type="submit" disabled={savingFault} className="rounded-xl bg-rose-600 px-4 py-2 text-white font-black">
                  {savingFault ? 'Ukládám…' : 'Nahlásit poškození'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
