'use client';

import { useEffect, useState } from 'react';
import { Settings, X, Save, RefreshCw } from 'lucide-react';

const REGION_OPTIONS = [
  'Moravskoslezský kraj',
  'Hlavní město Praha',
  'Středočeský kraj',
  'Jihomoravský kraj',
  'Olomoucký kraj',
  'Zlínský kraj',
  'Plzeňský kraj',
  'Ústecký kraj',
  'Jihočeský kraj',
  'Královéhradecký kraj',
  'Pardubický kraj',
  'Liberecký kraj',
  'Karlovarský kraj',
  'Kraj Vysočina',
];

const MEDIA_TYPE_OPTIONS = [
  { id: 'BILLBOARD', label: '📐 Billboardy' },
  { id: 'BIGBOARD', label: '🏢 Bigboardy' },
  { id: 'CITYLIGHT', label: '💡 Citylighty (CLV)' },
  { id: 'CITY_POSTER', label: '🖼️ City Postery (CLP)' },
  { id: 'PROMO_BENCH', label: '🪑 Reklamní lavičky' },
  { id: 'NAVIGATION_SIGN', label: '🧭 Navigace VO' },
  { id: 'LED_SCREEN', label: '📺 LED Obrazovky' },
  { id: 'BANNER', label: '🖨️ Plachty & Bannery' },
];

const EVENT_TYPE_OPTIONS = [
  { id: 'STORE_OPENING', label: '🛒 Otevření prodejen' },
  { id: 'NEW_BRANCH', label: '🏬 Nové pobočky / Provozovny' },
  { id: 'RETAIL_PARK', label: '🏛️ Retail parky' },
  { id: 'EXPANSION', label: '📈 Expanze firem' },
  { id: 'RESTAURANT_OPENING', label: '🍔 Gastro & Restaurace' },
  { id: 'MARKETING_EVENT', label: '📣 Marketingové akce' },
  { id: 'EVENT_EXHIBITION', label: '🎪 Výstavy & Festivaly' },
];

export function RadarSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [enabled, setEnabled] = useState(true);
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [citiesInput, setCitiesInput] = useState('');
  const [preferredMediaTypes, setPreferredMediaTypes] = useState<string[]>([]);
  const [focusEventTypes, setFocusEventTypes] = useState<string[]>([]);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [minScoreThreshold, setMinScoreThreshold] = useState(40);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setSuccess('');

    fetch('/api/sales/radar/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          const p = data.profile;
          setEnabled(p.enabled ?? true);
          setTargetRegions(p.targetRegions || []);
          setCitiesInput((p.targetCities || []).join(', '));
          setPreferredMediaTypes(p.preferredMediaTypes || []);
          setFocusEventTypes(p.focusEventTypes || []);
          setKeywordsInput((p.customKeywords || []).join(', '));
          setMinScoreThreshold(p.minScoreThreshold ?? 40);
        }
      })
      .catch(() => {
        setError('Nepodařilo se načíst profil radaru.');
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleRegion = (reg: string) => {
    setTargetRegions((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg]
    );
  };

  const toggleMedia = (mId: string) => {
    setPreferredMediaTypes((prev) =>
      prev.includes(mId) ? prev.filter((m) => m !== mId) : [...prev, mId]
    );
  };

  const toggleEvent = (eId: string) => {
    setFocusEventTypes((prev) =>
      prev.includes(eId) ? prev.filter((e) => e !== eId) : [...prev, eId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const cities = citiesInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/sales/radar/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          targetRegions,
          targetCities: cities,
          preferredMediaTypes,
          focusEventTypes,
          customKeywords: keywords,
          minScoreThreshold,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení profilu selhalo.');

      setSuccess('Nastavení OOH radaru bylo úspěšně uloženo.');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Nastavení AI Radaru</h2>
              <p className="text-xs text-slate-400">Specifická OOH konfigurace pro vaši společnost</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-800/70 bg-rose-950/60 p-3 text-xs font-semibold text-rose-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-200">
              {success}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-purple-400" />
              <span className="text-sm font-semibold">Načítám konfiguraci radaru...</span>
            </div>
          ) : (
            <div className="space-y-5 text-sm">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/40 border border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-sm">Aktivní monitoring radaru</h3>
                  <p className="text-xs text-slate-400">Povolit automatické i ruční skenování signálů trhu</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Target Regions */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Cílové kraje působnosti
                </label>
                <p className="text-xs text-slate-400">
                  Vyberte kraje, kde máte reklamní nosiče a chcete sledovat příležitosti.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {REGION_OPTIONS.map((reg) => {
                    const active = targetRegions.includes(reg);
                    return (
                      <button
                        key={reg}
                        type="button"
                        onClick={() => toggleRegion(reg)}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition ${
                          active
                            ? 'border-purple-500 bg-purple-950/50 text-purple-200'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {reg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Cities */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Cílová města a lokality (oddělená čárkou)
                </label>
                <input
                  type="text"
                  value={citiesInput}
                  onChange={(e) => setCitiesInput(e.target.value)}
                  placeholder="např. Brno, Vyškov, Znojmo nebo Ostrava, Opava..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Preferred Media Types */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Preferované typy OOH nosičů
                </label>
                <p className="text-xs text-slate-400">
                  Typy nosičů ve vašem portfoliu, které má radar primárně navrhovat klientům.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {MEDIA_TYPE_OPTIONS.map((m) => {
                    const active = preferredMediaTypes.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMedia(m.id)}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition ${
                          active
                            ? 'border-purple-500 bg-purple-950/50 text-purple-200'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Focus Event Types */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Sledované typy událostí
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {EVENT_TYPE_OPTIONS.map((e) => {
                    const active = focusEventTypes.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleEvent(e.id)}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition ${
                          active
                            ? 'border-purple-500 bg-purple-950/50 text-purple-200'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {e.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Keywords */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Vlastní klíčová slova (oddělená čárkou)
                </label>
                <input
                  type="text"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="např. autosalon, stavebniny, supermarket, developerský projekt..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Min Score Threshold */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Minimální skóre pro zařazení
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-400">
                    {minScoreThreshold} bodů
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={minScoreThreshold}
                  onChange={(e) => setMinScoreThreshold(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>20 (benevolentní)</span>
                  <span>40 (doporučeno)</span>
                  <span>80 (velmi přísné)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4 bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Uložit nastavení radaru</span>
          </button>
        </div>
      </div>
    </div>
  );
}
