'use client';

import { useState } from 'react';
import { Camera, MapPin, CheckCircle2, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export type MobileTaskItem = {
  id: string;
  orderNumber: string;
  targetName: string;
  pointId: string;
  label: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  orientation?: string | null;
  navigationType: string;
  installedPhotoUrl?: string | null;
  status: string;
};

export function MobileInstallationView({ initialItems }: { initialItems: MobileTaskItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [activeItem, setActiveItem] = useState<MobileTaskItem | null>(initialItems[0] || null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show immediate local preview
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);

    // Convert file to base64 data URL for photoUrl transmission
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  async function handleCompleteTask(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;
    if (!activeItem.installedPhotoUrl && !photoUrl) {
      setMsg('⚠️ Pro dokončení montáže musíte nahrát nebo vyfotit fotografii instalované plochy.');
      return;
    }

    setSubmitting(true);
    setMsg('');

    try {
      if (photoUrl) {
        const res = await fetch(`/api/navigation/orders/${activeItem.id}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            navigationPointId: activeItem.pointId,
            photoUrl,
            photoType: 'AFTER_INSTALLATION',
            note,
          }),
        });
        if (!res.ok) throw new Error('Nepodařilo se uložit fotku z montáže.');
      }

      setItems((prev) =>
        prev.map((i) => (i.pointId === activeItem.pointId ? { ...i, status: 'INSTALLED', installedPhotoUrl: photoUrl || i.installedPhotoUrl } : i))
      );

      setMsg('✅ Montáž byla úspěšně označena jako dokončená a fotka z fotoaparátu byla uložena.');
      setActiveItem(null);
      setPhotoUrl('');
      setPhotoPreview(null);
      setNote('');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Chyba při dokončení montáže.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans">
      {/* Top Mobile Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <Link href="/navigation" className="flex items-center gap-1 text-xs font-bold text-sky-400">
          <ArrowLeft size={16} /> Zpět do modulu
        </Link>
        <span className="text-xs font-bold bg-sky-500/20 text-sky-300 px-3 py-1 rounded-full border border-sky-500/30">
          📱 Montážní rozhraní
        </span>
      </div>

      <div className="py-4">
        <h1 className="text-xl font-bold text-white">Montážní plán pro terén</h1>
        <p className="text-xs text-slate-400">Seznam lokalit ke schváleným navigačním instalacím.</p>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs font-semibold text-sky-300">
          {msg}
        </div>
      )}

      {/* Task List */}
      {!activeItem ? (
        items.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-800/60 border border-slate-800 space-y-3 my-4">
            <CheckCircle2 size={44} className="mx-auto text-emerald-400 opacity-70" />
            <h3 className="text-base font-bold text-white">Žádné plánované montáže v terénu</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              V systému aktuálně nejsou žádné navigační zakázky ve fázi instalace.
              Jakmile zakázka v CRM postoupí do fáze „Připraveno k instalaci“, zobrazí se v tomto seznamu.
            </p>
            <div className="pt-2">
              <Link href="/navigation" className="inline-flex items-center gap-1.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl transition-all">
                Přejít na přehled navigačních zakázek
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={item.pointId}
                onClick={() => setActiveItem(item)}
                className="p-4 rounded-2xl bg-slate-800 border border-slate-700 hover:border-sky-500 cursor-pointer space-y-2 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-400">#{idx + 1} · {item.orderNumber}</span>
                  {item.status === 'INSTALLED' ? (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={14} /> Hotovo
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      ⏳ Čeká na montáž
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-white">{item.label} ({item.navigationType})</h2>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin size={12} className="text-rose-400" /> {item.targetName} {item.address ? `· ${item.address}` : ''}
                </p>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Active Task Detail View */
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-4">
          <button
            onClick={() => setActiveItem(null)}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
          >
            ➔ Zpět na seznam úkolů
          </button>

          <div>
            <span className="text-xs font-bold text-sky-400">{activeItem.orderNumber}</span>
            <h2 className="text-xl font-bold text-white">{activeItem.label}</h2>
            <p className="text-xs text-slate-300">Cíl: {activeItem.targetName}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 space-y-2 text-xs">
            <p><strong>Typ:</strong> {activeItem.navigationType}</p>
            <p><strong>Směr:</strong> {activeItem.orientation || 'Neuveden'}</p>
            <p><strong>GPS:</strong> {activeItem.latitude}, {activeItem.longitude}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${activeItem.latitude},${activeItem.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-sky-400 underline pt-1"
            >
              <ExternalLink size={14} /> Navigovat přes Google Maps
            </a>
          </div>

          <form onSubmit={handleCompleteTask} className="space-y-4 pt-2 border-t border-slate-700">
            <h3 className="text-sm font-bold text-white flex items-center gap-1">
              <Camera size={16} className="text-teal-400" /> Fotodokumentace z terénu
            </h3>

            {/* Direct Mobile Camera Button & Preview */}
            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-slate-900 p-2 space-y-2 text-center">
                <img
                  src={photoPreview}
                  alt="Náhled pořízené fotky"
                  className="w-full h-48 object-cover rounded-xl border border-slate-800"
                />
                <div className="flex items-center justify-between px-2 pb-1">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Fotka pořízena
                  </span>
                  <label className="text-xs font-bold text-sky-400 cursor-pointer hover:underline">
                    📷 Vyfotit znovu
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2.5 p-6 rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-950/20 hover:bg-sky-900/30 cursor-pointer transition-all text-center group active:scale-98">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-sky-500/20 text-sky-400 group-hover:scale-110 flex items-center justify-center transition-all border border-sky-400/30 shadow-lg shadow-sky-500/10">
                  <Camera size={28} />
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">📷 Vyfotit mobilním telefonem</span>
                  <span className="text-xs text-sky-300/70">Kliknutím spustíte fotoaparát v telefonu</span>
                </div>
              </label>
            )}

            {!photoPreview && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Nebo vložte URL / odkaz na fotku</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Poznámka instalatéra</label>
              <input
                type="text"
                placeholder="např. Montáž proběhla na pravý sloup osvětlení..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} /> {submitting ? 'Ukládám...' : 'Potvrdit dokončení montáže'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
