'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Check,
  AlertCircle,
  Eye,
  RotateCw,
  Compass,
} from 'lucide-react';
import type { DraftPoint } from './types';
import { getPointPinVisual } from '@/lib/offers/navigation-carrier-types';

interface NavigationStreetViewModalProps {
  point: DraftPoint | null;
  points: DraftPoint[];
  onClose: () => void;
  onSelectPoint: (point: DraftPoint) => void;
  onUpdatePoint: (id: string, updates: Partial<DraftPoint>) => void;
  apiKey?: string;
}

export function NavigationStreetViewModal({
  point,
  points,
  onClose,
  onSelectPoint,
  onUpdatePoint,
  apiKey,
}: NavigationStreetViewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<unknown>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [savedBadge, setSavedBadge] = useState(false);

  const effectiveApiKey =
    apiKey ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  const currentIndex = points.findIndex((p) => p.id === point?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < points.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onSelectPoint(points[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, points, onSelectPoint]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onSelectPoint(points[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, points, onSelectPoint]);

  // ESC and Arrow key listeners
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey)) handlePrev();
      if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey)) handleNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handlePrev, handleNext]);

  // Initialize or update StreetView Panorama
  useEffect(() => {
    if (!point || !containerRef.current) return;
    setStatus('loading');
    setErrorMessage('');

    // Function to attach StreetView once google.maps is ready
    const initPanorama = () => {
      const googleMaps = window.google?.maps;
      if (!googleMaps || !containerRef.current) {
        setStatus('error');
        setErrorMessage('Google Maps rozhraní se nepodařilo načíst.');
        return;
      }

      const StreetViewService = (googleMaps as unknown as {
        StreetViewService?: new () => {
          getPanorama: (
            request: { location: { lat: number; lng: number }; radius: number },
            callback: (data: { location?: { pano?: string; latLng?: unknown } } | null, status: string) => void
          ) => void;
        };
      }).StreetViewService;

      const StreetViewPanorama = (googleMaps as unknown as {
        StreetViewPanorama?: new (
          element: HTMLElement,
          options: Record<string, unknown>
        ) => {
          setPano: (pano: string) => void;
          setPosition: (pos: { lat: number; lng: number }) => void;
          setVisible: (visible: boolean) => void;
        };
      }).StreetViewPanorama;

      if (!StreetViewService || !StreetViewPanorama) {
        setStatus('error');
        setErrorMessage('Služba Google Street View není v prohlížeči dostupná.');
        return;
      }

      const sv = new StreetViewService();
      const pos = { lat: point.latitude, lng: point.longitude };

      // Search nearest panorama within 50 meters
      sv.getPanorama({ location: pos, radius: 50 }, (data, svStatus) => {
        if (svStatus === 'OK' && data?.location?.pano) {
          if (!panoramaRef.current && containerRef.current) {
            panoramaRef.current = new StreetViewPanorama(containerRef.current, {
              position: pos,
              pov: { heading: 180, pitch: 0 },
              zoom: 1,
              addressControl: true,
              linksControl: true,
              panControl: true,
              enableCloseButton: false,
              motionTracking: false,
              motionTrackingControl: false,
            });
          }

          const pano = panoramaRef.current as {
            setPano: (pano: string) => void;
            setVisible: (v: boolean) => void;
          };
          pano.setPano(data.location.pano);
          pano.setVisible(true);
          setStatus('ready');
        } else {
          setStatus('not_found');
        }
      });
    };

    if (window.google?.maps?.Map) {
      initPanorama();
    } else if (effectiveApiKey) {
      // Load script if missing
      const scriptId = 'google-maps-js-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${effectiveApiKey}&libraries=places,geometry`;
        script.async = true;
        script.onload = () => initPanorama();
        script.onerror = () => {
          setStatus('error');
          setErrorMessage('Nepodařilo se načíst skript Google Maps.');
        };
        document.head.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (window.google?.maps?.Map) {
            clearInterval(interval);
            initPanorama();
          }
        }, 150);
        return () => clearInterval(interval);
      }
    } else {
      setStatus('error');
      setErrorMessage('Klíč k mapám (API klíč) není nakonfigurován.');
    }
  }, [point?.id, point?.latitude, point?.longitude, effectiveApiKey]);

  if (!point) return null;

  const pinVis = getPointPinVisual(point);
  const directMapsUrl = `https://www.google.com/maps?q=&layer=c&cbll=${point.latitude},${point.longitude}`;

  const handleFieldChange = (field: keyof DraftPoint, value: unknown) => {
    onUpdatePoint(point.id, { [field]: value });
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 1800);
  };

  const poleTypeSuggestions = [
    'Sloup VO (ocelový kuželový)',
    'Betonový sloup VO',
    'Trakční stožár (DPO / DP)',
    'Sloup semaforu',
    'Výložník VO na fasádě',
    'Samostatný sloupek',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black shadow-md text-white"
              style={{ backgroundColor: pinVis.color }}
            >
              #{currentIndex + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black truncate text-white">
                  {point.label}
                </h2>
                {point.pillarNumber && (
                  <span className="rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black font-mono">
                    VO #{point.pillarNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate flex items-center gap-2">
                <span>📍 {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</span>
                {point.address && (
                  <>
                    <span>·</span>
                    <span className="truncate">{point.address}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-2 shrink-0">
            {points.length > 1 && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={handlePrev}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                  title="Předchozí bod (Ctrl+Vlevo)"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 text-xs font-bold text-slate-400">
                  {currentIndex + 1} / {points.length}
                </span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={handleNext}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                  title="Další bod (Ctrl+Vpravo)"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            <a
              href={directMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-950/60 px-3 py-2 text-xs font-bold text-sky-300 hover:bg-sky-900/60 hover:text-white transition shadow-2xs"
              title="Otevřít plné zobrazení Google Street View v novém okně prohlížeče"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Otevřít na Google Maps ↗</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="Zavřít náhled (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Area: 65% Interactive Panorama + 35% Pole Inspector Panel */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Canvas: Google Street View Panorama */}
          <div className="relative lg:col-span-8 flex flex-col bg-slate-950">
            {/* The Panorama Mount DOM Element */}
            <div
              ref={containerRef}
              className={`h-full w-full flex-1 transition-opacity duration-300 ${
                status === 'ready' ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Loading State Overlay */}
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center">
                <RotateCw className="animate-spin text-sky-400" size={32} />
                <div>
                  <h3 className="text-sm font-bold text-white">Načítám 360° Street View…</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Hledám nejbližší snímek veřejného osvětlení v okruhu 50 m.
                  </p>
                </div>
              </div>
            )}

            {/* Not Found / No Coverage Overlay */}
            {status === 'not_found' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Eye size={28} />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-base font-black text-white">
                    V tomto přesném místě není dostupný Street View snímek
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Místo může ležet uvnitř privátního areálu, na chodníku nebo na nově vybudované komunikaci.
                    Můžete otevřít okolí přímo na Google Maps nebo sloup zapsat ručně.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={directMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-500 transition shadow-md"
                  >
                    <ExternalLink size={14} />
                    Otevřít okolí na Google Maps ↗
                  </a>
                </div>
              </div>
            )}

            {/* Error Overlay */}
            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center">
                <AlertCircle size={32} className="text-rose-400" />
                <div className="max-w-md">
                  <h3 className="text-base font-black text-white">Chyba zobrazení Street View</h3>
                  <p className="mt-1 text-xs text-slate-400">{errorMessage}</p>
                </div>
                <a
                  href={directMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                >
                  <ExternalLink size={14} />
                  Otevřít na Google Maps v novém okně ↗
                </a>
              </div>
            )}

            {/* Bottom Tip Bar */}
            <div className="border-t border-slate-800/80 bg-slate-900/90 px-4 py-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass size={13} className="text-sky-400 shrink-0" />
                <span>
                  <strong>Tip pro práci z kanceláře:</strong> Otáčejte pohled 360°, najděte sloup VO a opište jeho číslo do panelu vpravo.
                </span>
              </span>
              <span className="hidden sm:inline text-slate-500">
                Přepínání bodů: Ctrl + ⬅ / ➡
              </span>
            </div>
          </div>

          {/* Right Panel: Rapid VO Pole Data Capture (35%) */}
          <div className="lg:col-span-4 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/95 p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-sky-400">
                  Průzkum sloupu z kanceláře
                </h3>
                <p className="text-[11px] text-slate-400">
                  Zapište zjištěný sloup VO bez nutnosti výjezdu technika
                </p>
              </div>
              {savedBadge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold animate-in fade-in">
                  <Check size={11} /> Uloženo
                </span>
              )}
            </div>

            {/* Číslo sloupu VO */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
              <label className="block text-xs font-black text-white">
                💡 Číslo sloupu VO (pillarNumber)
              </label>
              <input
                type="text"
                value={point.pillarNumber || ''}
                onChange={(e) => handleFieldChange('pillarNumber', e.target.value)}
                placeholder="např. 142/8 nebo VO 34"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono font-bold text-emerald-400 placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-400">
                Odečtěte číslo ze žluté/bílé tabulky na těle sloupu v panoramatu.
              </p>
            </div>

            {/* Typ konstrukce sloupu */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Typ sloupu / konstrukce
              </label>
              <input
                type="text"
                value={point.pillarType || ''}
                onChange={(e) => handleFieldChange('pillarType', e.target.value)}
                placeholder="např. Sloup veřejného osvětlení"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {poleTypeSuggestions.map((typ) => (
                  <button
                    key={typ}
                    type="button"
                    onClick={() => handleFieldChange('pillarType', typ)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition cursor-pointer ${
                      point.pillarType === typ
                        ? 'border-sky-400 bg-sky-950 text-sky-200'
                        : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {typ}
                  </button>
                ))}
              </div>
            </div>

            {/* Směrová šipka */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Směr navedení (šipka na ceduli)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: 'LEFT', label: '⬅ Vlevo' },
                  { value: 'STRAIGHT', label: '⬆ Rovně' },
                  { value: 'RIGHT', label: '➡ Vpravo' },
                  { value: 'SLANTED_LEFT', label: '↖ Šikmo vlevo' },
                  { value: 'ROUNDABOUT', label: '🔄 Kruháč' },
                  { value: 'SLANTED_RIGHT', label: '↗ Šikmo vpravo' },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handleFieldChange('arrowDirectionEnum', s.value)}
                    className={`rounded-xl border px-2 py-2 text-center text-xs font-bold transition cursor-pointer ${
                      point.arrowDirectionEnum === s.value
                        ? 'border-emerald-500 bg-emerald-950/80 text-emerald-200 shadow-xs'
                        : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upřesnění umístění / poznámka */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Poznámka k umístění / instrukce pro montáž
              </label>
              <textarea
                rows={3}
                value={point.clientNote || point.internalNote || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdatePoint(point.id, { clientNote: val, internalNote: val });
                  setSavedBadge(true);
                  setTimeout(() => setSavedBadge(false), 1800);
                }}
                placeholder="např. Sloup VO před světelnou křižovatkou po pravé straně, montáž pod svítidlem do výšky 3 m..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            {/* Adresa / křižovatka */}
            <div className="space-y-1 border-t border-slate-800 pt-3">
              <label className="block text-xs font-bold text-slate-400">
                Adresa / lokalita
              </label>
              <input
                type="text"
                value={point.address || ''}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder="Ulice × Křižovatka"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-sky-500 focus:outline-hidden"
              />
            </div>

            {/* Save & Done buttons */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                <span>Hotovo (údaje uloženy)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
