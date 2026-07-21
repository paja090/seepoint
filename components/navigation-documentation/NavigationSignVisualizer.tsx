'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Download, Layers, Move, RefreshCw, Upload, X } from 'lucide-react';

type SignTheme = 'blue' | 'green' | 'yellow' | 'red' | 'dark';

export function NavigationSignVisualizer({
  pointLabel,
  initialSignText,
  orientation,
  onClose,
  onSaveVisualization,
}: {
  pointLabel: string;
  initialSignText: string;
  orientation?: string;
  onClose: () => void;
  onSaveVisualization: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Sign properties
  const [signText, setSignText] = useState(initialSignText || 'Název prodejny');
  const [subText, setSubText] = useState('350 m k prodejně');
  const [arrow, setArrow] = useState(
    orientation?.includes('vlevo') ? '⬅' : orientation?.includes('rovně') ? '⬆' : '➔',
  );
  const [theme, setTheme] = useState<SignTheme>('blue');

  // Sign position & size overlay on canvas
  const [signX, setSignX] = useState(200);
  const [signY, setSignY] = useState(150);
  const [signScale, setSignScale] = useState(1.0);
  const [signRotation, setSignRotation] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load a default background placeholder image on mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setBgImage(img);
    // Standard street/pole background fallback canvas
    img.src =
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23cbd5e1"/><path d="M 0 450 Q 400 380 800 450 L 800 600 L 0 600 Z" fill="%2364748b"/><rect x="480" y="80" width="16" height="520" fill="%23475569"/><circle cx="488" cy="80" fill="%23334155" r="12"/><text x="400" y="250" font-family="sans-serif" font-size="22" font-weight="bold" fill="%23475569" text-anchor="middle">Nahrajte fotku ulice nebo sloupu pro vizualizaci</text></svg>';
  }, []);

  // Handle custom photo upload
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
        setSignX(img.width / 2 - 100);
        setSignY(img.height / 2 - 50);
      };
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

    // 2. Draw Navigation Sign Overlay
    ctx.save();
    ctx.translate(signX, signY);
    ctx.rotate((signRotation * Math.PI) / 180);
    ctx.scale(signScale, signScale);

    const width = 220;
    const height = 90;
    const radius = 12;

    // Theme styles
    let bgGradient = ['#0284c7', '#0369a1'];
    let textColor = '#ffffff';
    let borderColor = '#ffffff';

    if (theme === 'green') {
      bgGradient = ['#059669', '#047857'];
    } else if (theme === 'yellow') {
      bgGradient = ['#f59e0b', '#d97706'];
      textColor = '#0f172a';
      borderColor = '#0f172a';
    } else if (theme === 'red') {
      bgGradient = ['#e11d48', '#be123c'];
    } else if (theme === 'dark') {
      bgGradient = ['#1e293b', '#0f172a'];
    }

    // Sign Board Shadow & Plate
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 8;

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, bgGradient[0]);
    grad.addColorStop(1, bgGradient[1]);

    ctx.fillStyle = grad;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;

    // Rounded rectangle path
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    // Inner Border Line
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = textColor;
    ctx.beginPath();
    ctx.roundRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, radius - 4);
    ctx.stroke();

    // Text & Arrow Content
    ctx.fillStyle = textColor;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(signText, 0, -12);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${subText} ${arrow}`, 0, 16);

    ctx.restore();
  }, [bgImage, signX, signY, signScale, signRotation, signText, subText, arrow, theme]);

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
              <h2 className="text-lg font-bold text-white">Foto-vizualizátor navigační cedule</h2>
              <p className="text-xs text-slate-400">Vložení grafické navigační cedule do fotky pro bod: {pointLabel}</p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" type="button">
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Area */}
        <div className="grid flex-1 overflow-hidden lg:grid-cols-[1fr_360px]">
          {/* Canvas Interactive Viewport */}
          <div className="relative flex items-center justify-center bg-slate-950 p-4 overflow-auto">
            <canvas
              ref={canvasRef}
              className="max-h-full max-w-full rounded-2xl border border-slate-800 shadow-lg cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                setIsDragging(true);
                setDragStart({ x: e.clientX - signX, y: e.clientY - signY });
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                setSignX(e.clientX - dragStart.x);
                setSignY(e.clientY - dragStart.y);
              }}
              onMouseUp={() => setIsDragging(false)}
            />

            <div className="absolute bottom-6 left-6 rounded-xl bg-slate-900/90 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300">
              💡 Tip: Táhnutím myší po obrázku posunete ceduli na požadovaný sloup nebo budovu.
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
              <h3 className="text-sm font-bold text-sky-400">2. Text a smer navádění</h3>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Hlavní text na ceduli</label>
                <input className="input text-xs bg-slate-800 border-slate-700 text-white" value={signText} onChange={(e) => setSignText(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Doplňkový text / Vzdálenost</label>
                <input className="input text-xs bg-slate-800 border-slate-700 text-white" value={subText} onChange={(e) => setSubText(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Směrová šipka</label>
                <div className="flex gap-2">
                  {['⬅', '➔', '⬆', '↗', '↖'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setArrow(item)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold border transition ${
                        arrow === item ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Barevné provedení cedule</label>
                <div className="flex gap-2">
                  {[
                    { key: 'blue', label: 'Modrá', bg: 'bg-sky-600' },
                    { key: 'green', label: 'Zelená', bg: 'bg-emerald-600' },
                    { key: 'yellow', label: 'Žlutá', bg: 'bg-amber-500' },
                    { key: 'red', label: 'Červená', bg: 'bg-rose-600' },
                    { key: 'dark', label: 'Tmavá', bg: 'bg-slate-800' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTheme(t.key as SignTheme)}
                      className={`h-8 flex-1 rounded-xl font-bold text-[11px] border transition ${t.bg} ${
                        theme === t.key ? 'ring-2 ring-white border-transparent' : 'border-slate-700 opacity-80'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-bold text-sky-400">3. Velikost a poloha cedule</h3>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                  <span>Velikost cedule:</span>
                  <span>{Math.round(signScale * 100)} %</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.05"
                  value={signScale}
                  onChange={(e) => setSignScale(parseFloat(e.target.value))}
                  className="w-full accent-sky-500"
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
                  className="w-full accent-sky-500"
                />
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
