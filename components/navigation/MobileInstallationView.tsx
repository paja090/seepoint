'use client';

import { useState, useEffect } from 'react';
import {
  Camera,
  MapPin,
  CheckCircle2,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  Navigation as NavigationIcon,
  RotateCcw,
  Clock,
  User,
  Wifi,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

export type MobileTaskItem = {
  id: string;
  orderNumber: string;
  clientName: string;
  targetName: string;
  pointId: string;
  label: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  orientation?: string | null;
  navigationType: string;
  carrierCode?: string | null;
  surfaceName?: string | null;
  installedPhotoUrl?: string | null;
  beforePhotoUrl?: string | null;
  status: string;
  routeOrder?: number;
  issueReported?: boolean;
  issueType?: string | null;
  issueNote?: string | null;
  plannedInstallationAt?: string | null;
};

export const ISSUE_TYPES = [
  'Sloup nebyl nalezen',
  'Sloup neodpovídá dokumentaci',
  'Místo je obsazené jiným nájemcem',
  'Montáž není technicky možná',
  'Poškozená konstrukce nebo nosič',
  'Chybí cedule z tisku',
  'Nesprávný motiv grafiky',
  'Překážka nebo vegetace v místě',
  'Jiný provozní problém',
];

export function MobileInstallationView({
  initialItems,
  userName = 'Montážní pracovník',
}: {
  initialItems: MobileTaskItem[];
  userName?: string;
}) {
  const [items, setItems] = useState<MobileTaskItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'done' | 'issues'>('today');
  const [activeItem, setActiveItem] = useState<MobileTaskItem | null>(null);

  // Photos state for active task
  const [beforePhotoUrl, setBeforePhotoUrl] = useState('');
  const [beforePhotoPreview, setBeforePhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  // Field Issue state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [issueNote, setIssueNote] = useState('');
  const [issuePhotoUrl, setIssuePhotoUrl] = useState('');
  const [issuePhotoPreview, setIssuePhotoPreview] = useState<string | null>(null);

  const todayStr = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' });

  // Filtered lists
  const todayItems = items.filter((i) => i.status !== 'INSTALLED' && !i.issueReported);
  const upcomingItems = items.filter((i) => i.status === 'WAITING' || i.status === 'PLANNED');
  const doneItems = items.filter((i) => i.status === 'INSTALLED');
  const issueItems = items.filter((i) => i.issueReported);

  // Photo handlers with client-side Canvas compression
  const compressImage = (file: File, callback: (compressedDataUrl: string) => void) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = previewUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIMENSION = 1200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIMENSION) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        callback(dataUrl);
      } else {
        callback(previewUrl);
      }
    };
  };

  const handleBeforeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBeforePhotoPreview(URL.createObjectURL(file));
    compressImage(file, setBeforePhotoUrl);
  };

  const handleAfterCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    compressImage(file, setPhotoUrl);
  };

  const handleIssueCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIssuePhotoPreview(URL.createObjectURL(file));
    compressImage(file, setIssuePhotoUrl);
  };

  async function handleCompleteTask(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;
    if (!activeItem.installedPhotoUrl && !photoUrl) {
      setMsg('⚠️ Pro dokončení montáže musíte vyfotit fotografii po instalaci.');
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
            note: note || 'Fotografie po instalaci',
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Nepodařilo se uložit fotku z montáže.');
        }
      }

      setItems((prev) =>
        prev.map((i) =>
          i.pointId === activeItem.pointId
            ? { ...i, status: 'INSTALLED', installedPhotoUrl: photoUrl || i.installedPhotoUrl }
            : i
        )
      );

      setShowSuccessScreen(true);
    } catch (err: unknown) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : 'Chyba při ukládání.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReportIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!activeItem) return;

    setSubmitting(true);
    setMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${activeItem.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navigationPointId: activeItem.pointId,
          issueType,
          issueNote,
          photoUrl: issuePhotoUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se nahlásit problém v terénu.');
      }

      setItems((prev) =>
        prev.map((i) =>
          i.pointId === activeItem.pointId
            ? { ...i, issueReported: true, issueType, issueNote }
            : i
        )
      );

      setShowIssueModal(false);
      setActiveItem(null);
      setMsg(`Problém u bodu "${activeItem.label}" byl zaznamenán a předán správci.`);
    } catch (err: unknown) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : 'Chyba při hlášení problému.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  const openNextTask = () => {
    const remaining = todayItems.filter((i) => i.pointId !== activeItem?.pointId);
    if (remaining.length > 0) {
      setActiveItem(remaining[0]);
      setPhotoUrl('');
      setPhotoPreview(null);
      setBeforePhotoUrl('');
      setBeforePhotoPreview(null);
      setNote('');
      setShowSuccessScreen(false);
    } else {
      setActiveItem(null);
      setShowSuccessScreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Top Mobile Bar */}
      <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/navigation" className="p-1 text-slate-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                <User size={13} /> {userName}
              </span>
              <h1 className="text-sm font-black text-white capitalize">{todayStr}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
            <Wifi size={13} /> Online 🟢
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* If Active Task Detail is Open */}
        {activeItem ? (
          showSuccessScreen ? (
            /* Success Screen */
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-950/40 p-6 text-center space-y-6 animate-fade-in my-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">Montáž úspěšně dokončena!</h2>
                <p className="text-sm text-slate-300">
                  Fotografie i údaje o bodu <b>{activeItem.label}</b> byly bezpečně uloženy do systému.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                {todayItems.filter((i) => i.pointId !== activeItem.pointId).length > 0 ? (
                  <button
                    onClick={openNextTask}
                    className="w-full btn min-h-[52px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-base font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    Další bod na trase <ChevronRight size={20} />
                  </button>
                ) : null}

                <button
                  onClick={() => {
                    setActiveItem(null);
                    setShowSuccessScreen(false);
                  }}
                  className="w-full btn min-h-[52px] border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-base font-bold rounded-2xl"
                >
                  Zpět na dnešní plán 🏠
                </button>
              </div>
            </div>
          ) : (
            /* Execution Step-by-Step Task Detail */
            <div className="space-y-4">
              <button
                onClick={() => setActiveItem(null)}
                className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1"
              >
                ← Zpět na seznam bodů
              </button>

              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 space-y-4 shadow-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-sky-400 bg-sky-950 px-2.5 py-1 rounded-md border border-sky-800">
                      {activeItem.orderNumber}
                    </span>
                    <h2 className="text-lg font-black text-white mt-2">{activeItem.label}</h2>
                    <p className="text-xs text-slate-400">Klient: <b className="text-slate-200">{activeItem.clientName}</b></p>
                    <p className="text-xs text-slate-400">Cíl: <b className="text-slate-200">{activeItem.targetName}</b></p>
                  </div>

                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="btn border border-amber-800/80 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1"
                  >
                    <AlertTriangle size={14} /> Nahlásit problém
                  </button>
                </div>

                {/* Step 1: Navigation */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5"><MapPin size={16} className="text-rose-500" /> Adresa & GPS</span>
                    <span>{activeItem.navigationType}</span>
                  </div>
                  <p className="text-xs text-slate-400">{activeItem.address || 'Adresa neuvedena'}</p>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${activeItem.latitude},${activeItem.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full btn min-h-[48px] bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <NavigationIcon size={18} /> Spustit navigaci na místo
                  </a>
                </div>

                {/* Step 2: Fyzický sloup / Nosič */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2 text-xs">
                  <span className="font-bold text-slate-300 block">Fyzické ověření sloupu / nosiče</span>
                  {activeItem.carrierCode ? (
                    <span className="inline-block text-xs font-bold text-sky-300 bg-sky-950 px-2.5 py-1 rounded-md border border-sky-800">
                      Nosič: {activeItem.carrierCode} {activeItem.surfaceName ? `(${activeItem.surfaceName})` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-500">Plánovaný bod bez nosiče</span>
                  )}
                  {activeItem.orientation && (
                    <p className="text-slate-400 mt-1">Směr cedule: <b>{activeItem.orientation}</b></p>
                  )}
                </div>

                {/* Step 3: Fotodokumentace PŘED a PO montáži */}
                <form onSubmit={handleCompleteTask} className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-300 uppercase">
                      1. Fotografovat PŘED montáží (Volitelné)
                    </label>
                    {beforePhotoPreview ? (
                      <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
                        <img src={beforePhotoPreview} alt="Před" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setBeforePhotoPreview(null);
                            setBeforePhotoUrl('');
                          }}
                          className="absolute bottom-2 right-2 bg-slate-950/80 text-xs font-bold text-white px-3 py-1.5 rounded-xl border border-slate-700"
                        >
                          Vyfotit znovu
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center min-h-[90px] rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-900 cursor-pointer text-slate-400">
                        <Camera size={24} />
                        <span className="text-xs font-bold mt-1">Vyfotit stav PŘED montáží</span>
                        <input type="file" accept="image/*" capture="environment" onChange={handleBeforeCapture} className="hidden" />
                      </label>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-emerald-400 uppercase">
                      2. Fotografovat PO montáži (Povinné *)
                    </label>
                    {photoPreview ? (
                      <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-900">
                        <img src={photoPreview} alt="Po" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoPreview(null);
                            setPhotoUrl('');
                          }}
                          className="absolute bottom-2 right-2 bg-slate-950/80 text-xs font-bold text-white px-3 py-1.5 rounded-xl border border-slate-700"
                        >
                          Vyfotit znovu
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center min-h-[120px] rounded-2xl border-2 border-dashed border-emerald-500/60 bg-emerald-950/20 hover:bg-emerald-950/40 cursor-pointer text-emerald-400">
                        <Camera size={32} />
                        <span className="text-sm font-bold mt-1">Stisknout pro vyfocení instalované cedule</span>
                        <input type="file" accept="image/*" capture="environment" onChange={handleAfterCapture} className="hidden" />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Montážní poznámka</label>
                    <input
                      type="text"
                      placeholder="např. Uchyceno na 2 nerez pásky Bandimex..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  {msg && <div className="text-xs font-bold text-amber-400">{msg}</div>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full btn min-h-[56px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-base font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle2 size={22} /> {submitting ? 'Ukládám...' : 'Potvrdit dokončení montáže bodu'}
                  </button>
                </form>
              </div>
            </div>
          )
        ) : (
          /* Home Dashboard & Tasks List */
          <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Celkem</span>
                <span className="text-lg font-black text-white">{items.length}</span>
              </div>
              <div className="rounded-2xl border border-sky-800/80 bg-sky-950/40 p-3">
                <span className="text-sky-400 block text-[10px] uppercase font-bold">Zbývá</span>
                <span className="text-lg font-black text-sky-300">{todayItems.length}</span>
              </div>
              <div className="rounded-2xl border border-emerald-800/80 bg-emerald-950/40 p-3">
                <span className="text-emerald-400 block text-[10px] uppercase font-bold">Hotovo</span>
                <span className="text-lg font-black text-emerald-300">{doneItems.length}</span>
              </div>
              <div className="rounded-2xl border border-amber-800/80 bg-amber-950/40 p-3">
                <span className="text-amber-400 block text-[10px] uppercase font-bold">Problémy</span>
                <span className="text-lg font-black text-amber-300">{issueItems.length}</span>
              </div>
            </div>

            {/* Mobile Navigation Tabs */}
            <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setActiveTab('today')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  activeTab === 'today' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Dnes ({todayItems.length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  activeTab === 'upcoming' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Další ({upcomingItems.length})
              </button>
              <button
                onClick={() => setActiveTab('done')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  activeTab === 'done' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Hotovo ({doneItems.length})
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                className={`flex-1 py-2.5 rounded-xl transition-all ${
                  activeTab === 'issues' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Problémy ({issueItems.length})
              </button>
            </div>

            {/* List of Tasks */}
            <div className="space-y-3">
              {(activeTab === 'today' ? todayItems : activeTab === 'upcoming' ? upcomingItems : activeTab === 'done' ? doneItems : issueItems).length === 0 ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                  <CheckCircle2 size={40} className="mx-auto mb-2 text-slate-700" />
                  <p className="font-bold text-slate-300">Žádné body v této sekci</p>
                </div>
              ) : (
                (activeTab === 'today' ? todayItems : activeTab === 'upcoming' ? upcomingItems : activeTab === 'done' ? doneItems : issueItems).map((item, idx) => (
                  <div
                    key={item.pointId}
                    className="rounded-3xl border border-slate-800 bg-slate-950 p-4 space-y-3 shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-sky-950 text-sky-300 border border-sky-800 w-6 h-6 flex items-center justify-center text-xs font-black">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-black text-sky-400">{item.orderNumber}</span>
                          <h3 className="font-bold text-white text-base leading-tight">{item.label}</h3>
                        </div>
                      </div>

                      {item.status === 'INSTALLED' ? (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800">
                          ✓ Namontováno
                        </span>
                      ) : item.issueReported ? (
                        <span className="text-xs font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-800">
                          ⚠️ Problém
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <p>Klient: <b className="text-slate-200">{item.clientName}</b></p>
                      <p className="flex items-center gap-1">
                        <MapPin size={13} className="text-rose-500 shrink-0" /> {item.address || item.targetName}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn border border-slate-800 bg-slate-900 hover:bg-slate-800 text-sky-400 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1"
                      >
                        <NavigationIcon size={14} /> Navigovat
                      </a>

                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setPhotoUrl('');
                          setPhotoPreview(null);
                          setBeforePhotoUrl('');
                          setBeforePhotoPreview(null);
                          setNote('');
                        }}
                        className="btn bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm"
                      >
                        Otevřít úkol <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Field Issue Modal */}
      {showIssueModal && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <form onSubmit={handleReportIssue} className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 text-slate-100">
            <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <AlertTriangle size={20} /> Nahlásit problém v terénu
            </h3>
            <p className="text-xs text-slate-400">
              Bod <b>{activeItem.label}</b> nebyl namontován z důvodu překážky nebo závady.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Typ problému</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-semibold text-white"
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Popis závady nebo překážky</label>
              <textarea
                required
                rows={3}
                placeholder="Stručně popište situaci v terénu..."
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Fotografie problému</label>
              {issuePhotoPreview ? (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                  <img src={issuePhotoPreview} alt="Závada" className="w-full h-full object-cover" />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950 hover:bg-slate-900 cursor-pointer text-slate-400 text-xs font-bold">
                  <Camera size={20} />
                  <span className="mt-1">Vyfotit závadu v terénu</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleIssueCapture} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="btn border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl"
              >
                Odeslat hlášení problému
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
