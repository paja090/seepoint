'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  AlertTriangle,
  FileImage,
  Layers,
  CheckCircle2,
  TreeDeciduous,
  RotateCw,
  Sun,
  Lightbulb,
  Building2,
  MapPin,
  Send,
} from 'lucide-react';

export type CarrierOption = {
  id: string;
  name: string;
  code: string;
  city: string;
  type?: string;
};

export function CarrierPhotoUploadModal({
  isOpen,
  onClose,
  carriers = [],
  preselectedCarrierId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  carriers?: CarrierOption[];
  preselectedCarrierId?: string;
  onSuccess?: () => void;
}) {
  const [carrierList, setCarrierList] = useState<CarrierOption[]>(carriers);
  const [selectedCarrierId, setSelectedCarrierId] = useState(preselectedCarrierId || '');
  const [side, setSide] = useState<'SIDE_A' | 'SIDE_B' | 'BOTH'>('SIDE_A');
  const [purpose, setPurpose] = useState<'CLIENT_REPORT' | 'DAMAGE' | 'INSPECTION' | 'MOTIF_CHANGE'>('CLIENT_REPORT');
  const [damageType, setDamageType] = useState<string>('OVERGROWN');
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (carriers.length > 0) {
      setCarrierList(carriers);
      if (!selectedCarrierId && carriers[0]) {
        setSelectedCarrierId(carriers[0].id);
      }
    } else if (isOpen) {
      // Fetch carriers if list was not passed
      fetch('/api/carriers?take=100')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.carriers || data)) {
            const list = data.carriers || data;
            setCarrierList(list);
            if (list[0] && !selectedCarrierId) {
              setSelectedCarrierId(list[0].id);
            }
          }
        })
        .catch(() => null);
    }
  }, [isOpen, carriers]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Chyba při načítání obrázku.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Chyba při čtení souboru.'));
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSubmitting(true);
      const compressedDataUrl = await compressImage(file);
      setImageUrl(compressedDataUrl);
    } catch {
      alert('Fotku se nepodařilo zpracovat.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarrierId) return setError('Vyberte nosič / reklamní plochu.');
    if (!imageUrl) return setError('Pořiďte nebo vyberte fotku plochy.');

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/carriers/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierId: selectedCarrierId,
          side,
          purpose,
          damageType: purpose === 'DAMAGE' ? damageType : undefined,
          note: note.trim() || undefined,
          imageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nahrání fotky selhalo.');

      alert(data.message);
      setImageUrl('');
      setNote('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredCarriers = carrierList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overscroll-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 font-black text-slate-950 shadow-md">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                📷 Vyfotit & Dokumentovat Plochu
              </h2>
              <p className="text-xs font-bold text-slate-400">
                Mobilní zpráva z terénu s označením strany A/B a účelu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain touch-pan-y">
          {error && (
            <div className="rounded-2xl border border-red-800 bg-red-950/80 p-3 text-xs font-extrabold text-red-200">
              ⚠️ {error}
            </div>
          )}

          {/* 1. Select Carrier / Billboard */}
          <div>
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              1. Vyberte reklamní / navigační plochu *
            </label>

            {carrierList.length > 8 && (
              <input
                type="text"
                placeholder="🔍 Hledat nosič podle kódů nebo města..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full mb-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500"
              />
            )}

            <select
              value={selectedCarrierId}
              onChange={(e) => setSelectedCarrierId(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
              required
            >
              {filteredCarriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Side Selection (Strana A / Strana B / Obě) */}
          <div>
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              2. Která strana plochy byla vyfocena? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSide('SIDE_A')}
                className={`rounded-2xl border p-3 text-center transition ${
                  side === 'SIDE_A'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="block text-sm font-black">🅰️ Strana A</span>
                <span className="text-[10px] font-bold text-slate-400">Přední strana</span>
              </button>

              <button
                type="button"
                onClick={() => setSide('SIDE_B')}
                className={`rounded-2xl border p-3 text-center transition ${
                  side === 'SIDE_B'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="block text-sm font-black">🅱️ Strana B</span>
                <span className="text-[10px] font-bold text-slate-400">Zadní strana</span>
              </button>

              <button
                type="button"
                onClick={() => setSide('BOTH')}
                className={`rounded-2xl border p-3 text-center transition ${
                  side === 'BOTH'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="block text-sm font-black">🔀 Obě strany</span>
                <span className="text-[10px] font-bold text-slate-400">Celá plocha (A i B)</span>
              </button>
            </div>
          </div>

          {/* 3. Photo Purpose Selection */}
          <div>
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              3. Za jakým účelem fotka vznikla? *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPurpose('CLIENT_REPORT')}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                  purpose === 'CLIENT_REPORT'
                    ? 'border-blue-500 bg-blue-950/60 text-blue-300 ring-2 ring-blue-500/30'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-xl shrink-0">📸</span>
                <div>
                  <span className="block text-xs font-black text-white">Doložení výlepu klienta</span>
                  <span className="text-[10px] font-bold text-slate-400">Fotoreportáž pro klienta</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPurpose('DAMAGE')}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                  purpose === 'DAMAGE'
                    ? 'border-rose-500 bg-rose-950/80 text-rose-300 ring-2 ring-rose-500/40'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-xl shrink-0">🚨</span>
                <div>
                  <span className="block text-xs font-black text-rose-300">Poškození / Závada na ploše</span>
                  <span className="text-[10px] font-bold text-rose-400/80">Odešle urgentní hlášení týmu</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPurpose('INSPECTION')}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                  purpose === 'INSPECTION'
                    ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-xl shrink-0">🧹</span>
                <div>
                  <span className="block text-xs font-black text-white">Pravidelná kontrola / Údržba</span>
                  <span className="text-[10px] font-bold text-slate-400">Běžná prohlídka v terénu</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPurpose('MOTIF_CHANGE')}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                  purpose === 'MOTIF_CHANGE'
                    ? 'border-purple-500 bg-purple-950/60 text-purple-300 ring-2 ring-purple-500/30'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span className="text-xl shrink-0">🔄</span>
                <div>
                  <span className="block text-xs font-black text-white">Výměna motivu / Přelep</span>
                  <span className="text-[10px] font-bold text-slate-400">Nový banner / plachtování</span>
                </div>
              </button>
            </div>
          </div>

          {/* 4. SPECIFIC DAMAGE TYPES (Only if purpose === 'DAMAGE') */}
          {purpose === 'DAMAGE' && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 space-y-3 animate-in fade-in duration-200">
              <label className="text-xs font-black uppercase text-rose-300 tracking-wider block">
                ⚠️ Jaká závada / poškození vzniklo? *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDamageType('OVERGROWN')}
                  className={`flex items-center gap-2 rounded-xl p-2.5 border text-xs font-bold transition text-left ${
                    damageType === 'OVERGROWN'
                      ? 'border-rose-500 bg-rose-950 text-rose-200 font-black'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <TreeDeciduous size={16} className="text-emerald-400 shrink-0" />
                  <span>🌳 Zarostlá – prořez stromů</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDamageType('TURNED')}
                  className={`flex items-center gap-2 rounded-xl p-2.5 border text-xs font-bold transition text-left ${
                    damageType === 'TURNED'
                      ? 'border-rose-500 bg-rose-950 text-rose-200 font-black'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <RotateCw size={16} className="text-amber-400 shrink-0" />
                  <span>🔄 Vytočená / hnutá konstrukce</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDamageType('FADED')}
                  className={`flex items-center gap-2 rounded-xl p-2.5 border text-xs font-bold transition text-left ${
                    damageType === 'FADED'
                      ? 'border-rose-500 bg-rose-950 text-rose-200 font-black'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Sun size={16} className="text-amber-300 shrink-0" />
                  <span>☀️ Vybledlý tisk / zničený motiv</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDamageType('DAMAGED_STRUCTURE')}
                  className={`flex items-center gap-2 rounded-xl p-2.5 border text-xs font-bold transition text-left ${
                    damageType === 'DAMAGED_STRUCTURE'
                      ? 'border-rose-500 bg-rose-950 text-rose-200 font-black'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                  <span>🚨 Rozbitá konstrukce / prasklé sklo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDamageType('LIGHTING_OFF')}
                  className={`flex items-center gap-2 rounded-xl p-2.5 border text-xs font-bold transition text-left ${
                    damageType === 'LIGHTING_OFF'
                      ? 'border-rose-500 bg-rose-950 text-rose-200 font-black'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Lightbulb size={16} className="text-yellow-400 shrink-0" />
                  <span>💡 Nesvítí osvětlení</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. Photo File Attachment */}
          <div>
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              5. Vyfotit fotoaparátem mobilu / Vybrat z galerie *
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {imageUrl ? (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-800 bg-emerald-950/60 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={imageUrl} alt="Náhled fotky" className="h-12 w-12 rounded-xl object-cover border border-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-emerald-300 truncate">📷 Fotka z terénu připravena</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-4 text-xs font-black text-slate-200 hover:bg-slate-800 transition shadow-sm"
              >
                <Camera size={20} className="text-emerald-400" />
                <span>📷 Vyfotit fotoaparátem mobilu / Galerie</span>
              </button>
            )}
          </div>

          {/* 6. Optional Note */}
          <div>
            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block mb-1.5">
              6. Poznámka k fotce / závadě (volitelné)
            </label>
            <textarea
              rows={2}
              placeholder="Např. Nutno prořezat věve zleva, jinak nevypadá dobře..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-medium text-white outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !selectedCarrierId || !imageUrl}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-black text-slate-950 shadow-xl transition disabled:opacity-50 ${
              purpose === 'DAMAGE'
                ? 'bg-gradient-to-r from-rose-500 to-red-400 hover:brightness-110'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110'
            }`}
          >
            <Send size={16} />
            <span>
              {submitting
                ? 'Ukládám…'
                : purpose === 'DAMAGE'
                ? '🚨 Nahlásit Závadu & Odeslat do Chatu'
                : '✓ Uložit Fotku k Nosiči'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
