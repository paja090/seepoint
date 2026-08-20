'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Upload, X } from 'lucide-react';

type SignTheme = 'dark' | 'blue' | 'green' | 'yellow' | 'red';

function getArrowChar(arrowEnum?: string): string {
  switch (arrowEnum) {
    case 'LEFT': return '⬅';
    case 'RIGHT': return '➔';
    case 'SLANTED_LEFT': return '↖';
    case 'SLANTED_RIGHT': return '↗';
    case 'U_TURN': return '↩';
    case 'TWO_WAY': return '↔';
    case 'STRAIGHT':
    default: return '⬆';
  }
}

export function NavigationSignVisualizer({
  pointLabel,
  initialSignText,
  subText: initialSubText,
  distanceText: initialDistanceText,
  arrowDirectionEnum,
  orientation,
  initialPhotoUrl,
  onClose,
  onSaveVisualization,
}: {
  pointLabel: string;
  initialSignText: string;
  subText?: string;
  distanceText?: string;
  arrowDirectionEnum?: string;
  orientation?: string;
  initialPhotoUrl?: string | null;
  onClose: () => void;
  onSaveVisualization: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Sign properties
  const [signText, setSignText] = useState(initialSignText || 'NÁZEV ZNAČKY');
  const [subText, setSubText] = useState(initialSubText || 'Směrová tabule');
  const [distanceText, setDistanceText] = useState(initialDistanceText || '1,1 km');
  const [arrow, setArrow] = useState(getArrowChar(arrowDirectionEnum || (orientation?.includes('vlevo') ? 'LEFT' : orientation?.includes('rovně') ? 'STRAIGHT' : 'RIGHT')));
  const [theme, setTheme] = useState<SignTheme>('dark');

  // Sign position & size overlay on canvas
  const [signX, setSignX] = useState(250);
  const [signY, setSignY] = useState(180);
  const [signScale, setSignScale] = useState(1.0);
  const [signRotation, setSignRotation] = useState(0);
  const [mountType, setMountType] = useState<'pole' | 'ground_pole'>('pole');

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ offsetX: 0, offsetY: 0 });

  // Custom AI Graphic Artwork overlay state
  const [graphicImage, setGraphicImage] = useState<HTMLImageElement | null>(null);

  // Load photo or default background placeholder image on mount
  useEffect(() => {
    const img = new Image();
    if (initialPhotoUrl && (initialPhotoUrl.startsWith('http://') || initialPhotoUrl.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      setBgImage(img);
      setSignX(img.width ? img.width / 2 : 400);
      setSignY(img.height ? img.height / 2 : 300);
    };
    img.onerror = (err) => {
      console.error('Visualizer photo load error:', err);
    };
    if (initialPhotoUrl) {
      img.src = initialPhotoUrl;
    } else {
      img.src =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%2394a3b8"/><path d="M 0 450 Q 400 380 800 450 L 800 600 L 0 600 Z" fill="%23475569"/><rect x="520" y="40" width="22" height="560" fill="%23334155"/><rect x="526" y="40" width="10" height="560" fill="%2364748b"/><text x="360" y="240" font-family="sans-serif" font-size="20" font-weight="bold" fill="%231e293b" text-anchor="middle">Nahrajte fotku ulice/sloupu pro vizualizaci</text></svg>';
    }
  }, [initialPhotoUrl]);

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && (e as TouchEvent).touches && (e as TouchEvent).touches.length > 0) {
      clientX = (e as TouchEvent).touches[0].clientX;
      clientY = (e as TouchEvent).touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Handle global mouse/touch dragging window events
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMove = (e: MouseEvent | TouchEvent) => {
      const coords = getCanvasCoords(e);
      setSignX(coords.x - dragStart.offsetX);
      setSignY(coords.y - dragStart.offsetY);
    };

    const handleWindowEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchmove', handleWindowMove, { passive: false });
    window.addEventListener('touchend', handleWindowEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [isDragging, dragStart]);

  // Handle custom photo upload
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setSignX(img.width / 2);
        setSignY(img.height / 2);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Handle custom graphic artwork / AI logo upload
  function handleGraphicUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => setGraphicImage(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Draw scene on canvas whenever parameters change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = bgImage.width || 800;
    canvas.height = bgImage.height || 600;

    // 1. Draw Background Image
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // 2. Draw Realistic Vertical SeePOINT Pole Navigation Sign
    ctx.save();
    ctx.translate(signX, signY);
    ctx.rotate((signRotation * Math.PI) / 180);
    ctx.scale(signScale, signScale);

    // Dimensions: Realistic Vertical SeePOINT Pole Sign
    const width = 150;
    const height = 195;
    const radius = 16;

    // Metallic pole & mounting brackets behind sign
    if (mountType === 'ground_pole') {
      // Standalone ground pole extending downwards
      const poleWidth = 16;
      const poleHeight = 450;
      const poleGrad = ctx.createLinearGradient(-poleWidth / 2, 0, poleWidth / 2, 0);
      poleGrad.addColorStop(0, '#334155');
      poleGrad.addColorStop(0.3, '#94A3B8');
      poleGrad.addColorStop(0.7, '#E2E8F0');
      poleGrad.addColorStop(1, '#1E293B');

      ctx.save();
      ctx.fillStyle = poleGrad;
      ctx.fillRect(-poleWidth / 2, -height / 2 + 15, poleWidth, poleHeight);

      // Pole metal top cap
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-poleWidth / 2 - 2, -height / 2 + 10, poleWidth + 4, 6);
      ctx.restore();
    } else {
      ctx.fillStyle = '#64748B';
      ctx.fillRect(width / 2, -height / 2 + 35, 14, 14);
      ctx.fillRect(width / 2, height / 2 - 45, 14, 14);
    }

    // Outer Drop Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    // Theme plate background
    let plateBg = ['#1E293B', '#0B0F19'];
    let textColor = '#FFFFFF';
    let borderColor = '#94A3B8';

    if (theme === 'blue') {
      plateBg = ['#0284c7', '#0369a1'];
    } else if (theme === 'green') {
      plateBg = ['#059669', '#047857'];
    } else if (theme === 'yellow') {
      plateBg = ['#f59e0b', '#d97706'];
      textColor = '#0f172a';
      borderColor = '#0f172a';
    } else if (theme === 'red') {
      plateBg = ['#e11d48', '#be123c'];
    } else if (theme === 'dark') {
      plateBg = ['#182232', '#0A0E17'];
      borderColor = '#CBD5E1';
    }

    const grad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    grad.addColorStop(0, plateBg[0]);
    grad.addColorStop(1, plateBg[1]);

    // Draw main plate body
    ctx.fillStyle = grad;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    // Inner subtle border
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, radius - 4);
    ctx.stroke();

    // Render Graphic Artwork Image if uploaded
    if (graphicImage) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-width / 2 + 8, -height / 2 + 8, width - 16, height - 64, 8);
      ctx.clip();
      ctx.drawImage(graphicImage, -width / 2 + 8, -height / 2 + 8, width - 16, height - 64);
      ctx.restore();
    } else {
      // Top Section: Client Brand / Logo Text
      ctx.fillStyle = textColor;
      ctx.font = '900 18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(signText.toUpperCase(), 0, -height / 2 + 55);

      // Subtext line if present
      if (subText && subText !== '—') {
        ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = theme === 'yellow' ? '#1e293b' : '#94a3b8';
        ctx.fillText(subText.toUpperCase(), 0, -height / 2 + 78);
      }
    }

    // Bottom Section: Integrated Dark Distance & Direction Badge (Enlarged & Bold!)
    const badgeHeight = 48;
    const badgeY = height / 2 - badgeHeight - 10;
    const badgeWidth = width - 20;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(-badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Text in Badge: Distance + Arrow (Enlarged bold 22px!)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${distanceText}   ${arrow}`, 0, badgeY + badgeHeight / 2 + 1);

    ctx.restore();
  }, [bgImage, graphicImage, signX, signY, signScale, signRotation, signText, subText, distanceText, arrow, theme, mountType]);

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onSaveVisualization(dataUrl);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col rounded-3xl border border-slate-700 bg-slate-900 text-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white font-bold">
              🎨
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Foto-vizualizátor navigační cedule SeePOINT</h2>
              <p className="text-xs text-slate-400">Vložení navigační cedule do fotky pro bod: {pointLabel}</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" type="button">
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Area */}
        <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_360px]">
          {/* Canvas Interactive Viewport */}
          <div className="relative flex items-center justify-center bg-slate-950 p-4 overflow-auto select-none">
            <canvas
              ref={canvasRef}
              className="max-h-full max-w-full rounded-2xl border border-slate-800 shadow-lg cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={(e) => {
                e.preventDefault();
                const coords = getCanvasCoords(e);
                setIsDragging(true);
                setDragStart({ offsetX: coords.x - signX, offsetY: coords.y - signY });
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const coords = getCanvasCoords(e);
                setIsDragging(true);
                setDragStart({ offsetX: coords.x - signX, offsetY: coords.y - signY });
              }}
            />

            <div className="absolute bottom-6 left-6 rounded-xl bg-slate-900/90 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 pointer-events-none">
              💡 Tip: Uchopte ceduli myší/prstem a přesuňte ji na sloup, nebo použijte tlačítka posunu vpravo.
            </div>
          </div>

          {/* Right Editor Controls */}
          <div className="space-y-4 border-l border-slate-800 bg-slate-900 p-6 overflow-y-auto">
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-sky-400">1. Podkladová fotografie</h3>
              <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/60 p-3 text-xs font-bold text-slate-300 hover:border-sky-500 hover:bg-slate-800 cursor-pointer transition">
                <Upload size={16} /> Nahrát vlastní fotku sloupu / ulice
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </section>

            <section className="space-y-3 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-bold text-sky-400">2. Text a navedení cedule</h3>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Hlavní název / Značka</label>
                <input className="input text-xs bg-slate-800 border-slate-700 text-white" value={signText} onChange={(e) => setSignText(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Podtitul / Doplňkový text</label>
                <input className="input text-xs bg-slate-800 border-slate-700 text-white" value={subText} onChange={(e) => setSubText(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Grafický podklad / AI logo (670x900 mm)</label>
                <label className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-700/60 bg-sky-950/30 p-2.5 text-xs font-bold text-sky-300 hover:border-sky-500 hover:bg-sky-900/40 cursor-pointer transition">
                  <Upload size={15} /> {graphicImage ? '✓ Grafický AI podklad nahrán' : '🎨 Nahrát grafiku / AI podklad'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleGraphicUpload} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Vzdálenost (km / m)</label>
                <input className="input text-xs bg-slate-800 border-slate-700 text-white" value={distanceText} onChange={(e) => setDistanceText(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Směrová šipka</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['⬆', '➔', '⬅', '↖', '↗', '↩', '↔'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setArrow(item)}
                      className={`flex h-9 items-center justify-center rounded-xl font-bold text-base border transition ${
                        arrow === item ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Provedení cedule</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { key: 'dark', label: 'Tmavá SeePOINT', bg: 'bg-slate-800' },
                    { key: 'blue', label: 'Modrá', bg: 'bg-sky-600' },
                    { key: 'green', label: 'Zelená', bg: 'bg-emerald-600' },
                    { key: 'yellow', label: 'Žlutá', bg: 'bg-amber-500' },
                    { key: 'red', label: 'Červená', bg: 'bg-rose-600' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTheme(t.key as SignTheme)}
                      className={`h-8 px-2.5 rounded-xl font-bold text-[11px] border transition ${t.bg} ${
                        theme === t.key ? 'ring-2 ring-white border-transparent' : 'border-slate-700 opacity-80'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-bold text-sky-400">3. Velikost, sloup a umístění</h3>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">Typ uchycení / Sloupek</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMountType('pole')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      mountType === 'pole'
                        ? 'bg-sky-600 border-sky-400 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>📌 Na sloup VO</span>
                    <span className="text-[10px] font-normal opacity-80">(Příchytka na sloup)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMountType('ground_pole')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      mountType === 'ground_pole'
                        ? 'bg-sky-600 border-sky-400 text-white shadow-md'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>🏗️ Samostatný słoupek</span>
                    <span className="text-[10px] font-normal opacity-80">(Do trávníku / země)</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                  <span>Velikost cedule:</span>
                  <span>{Math.round(signScale * 100)} %</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.8"
                  step="0.05"
                  value={signScale}
                  onChange={(e) => setSignScale(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                  <span>Natočení (perspektiva):</span>
                  <span>{signRotation}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={signRotation}
                  onChange={(e) => setSignRotation(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Precise Position Nudge D-Pad */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                  <span>Přesný posun na sloup:</span>
                  <span className="font-mono text-sky-400">X: {Math.round(signX)} | Y: {Math.round(signY)}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSignY((y) => y - 15)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-xl text-xs font-bold text-white transition active:scale-95 cursor-pointer"
                  >
                    ▲ Nahoru
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSignX((x) => x - 15)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-xl text-xs font-bold text-white transition active:scale-95 cursor-pointer"
                    >
                      ◀ Vlevo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (canvasRef.current) {
                          setSignX(canvasRef.current.width / 2);
                          setSignY(canvasRef.current.height / 2);
                        }
                      }}
                      className="px-3 py-1.5 bg-sky-950 border border-sky-700/60 text-sky-300 hover:bg-sky-900 rounded-xl text-[11px] font-bold transition active:scale-95 cursor-pointer"
                      title="Vycentrovat na střed obrázku"
                    >
                      🎯 Střed
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignX((x) => x + 15)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-xl text-xs font-bold text-white transition active:scale-95 cursor-pointer"
                    >
                      Vpravo ▶
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignY((y) => y + 15)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-sky-600 rounded-xl text-xs font-bold text-white transition active:scale-95 cursor-pointer"
                  >
                    ▼ Dolů
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 bg-slate-900">
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800" type="button">
            Zrušit
          </button>

          <button onClick={handleSave} className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 shadow-lg" type="button">
            <Check size={16} /> Uložit vygenerovanou vizualizaci k bodu
          </button>
        </div>
      </div>
    </div>
  );
}
