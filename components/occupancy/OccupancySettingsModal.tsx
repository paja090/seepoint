'use client';

import { useEffect, useState } from 'react';
import { Settings, X, Save, RefreshCw, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';

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

export function OccupancySettingsModal({
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
  const [automaticChecksEnabled, setAutomaticChecksEnabled] = useState(true);
  const [checkReservationConflicts, setCheckReservationConflicts] = useState(true);
  const [checkCampaignConflicts, setCheckCampaignConflicts] = useState(true);
  const [checkStatusMismatch, setCheckStatusMismatch] = useState(true);
  const [checkOfferConflicts, setCheckOfferConflicts] = useState(true);
  const [checkExpiringCampaigns, setCheckExpiringCampaigns] = useState(true);
  const [checkUnderutilizedMedia, setCheckUnderutilizedMedia] = useState(true);
  const [checkCalendarGaps, setCheckCalendarGaps] = useState(true);
  const [checkMissingData, setCheckMissingData] = useState(true);

  const [reservationHoldDays, setReservationHoldDays] = useState(14);
  const [expiringCampaignWarningDays, setExpiringCampaignWarningDays] = useState(14);
  const [underutilizedAfterDays, setUnderutilizedAfterDays] = useState(60);
  const [calendarGapMaxDays, setCalendarGapMaxDays] = useState(21);

  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [citiesInput, setCitiesInput] = useState('');
  const [preferredMediaTypes, setPreferredMediaTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    setSuccess('');

    fetch('/api/occupancy/intelligence/profile')
      .then(async (res) => {
        if (!res.ok) throw new Error('Nepodařilo se načíst profil nastavení.');
        return res.json();
      })
      .then((data) => {
        setEnabled(data.enabled ?? true);
        setAutomaticChecksEnabled(data.automaticChecksEnabled ?? true);
        setCheckReservationConflicts(data.checkReservationConflicts ?? true);
        setCheckCampaignConflicts(data.checkCampaignConflicts ?? true);
        setCheckStatusMismatch(data.checkStatusMismatch ?? true);
        setCheckOfferConflicts(data.checkOfferConflicts ?? true);
        setCheckExpiringCampaigns(data.checkExpiringCampaigns ?? true);
        setCheckUnderutilizedMedia(data.checkUnderutilizedMedia ?? true);
        setCheckCalendarGaps(data.checkCalendarGaps ?? true);
        setCheckMissingData(data.checkMissingData ?? true);

        setReservationHoldDays(data.reservationHoldDays ?? 14);
        setExpiringCampaignWarningDays(data.expiringCampaignWarningDays ?? 14);
        setUnderutilizedAfterDays(data.underutilizedAfterDays ?? 60);
        setCalendarGapMaxDays(data.calendarGapMaxDays ?? 21);

        setTargetRegions(data.targetRegions || []);
        setCitiesInput((data.targetCities || []).join(', '));
        setPreferredMediaTypes(data.preferredMediaTypes || []);
      })
      .catch((err) => {
        setError(err.message || 'Chyba při načítání.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const cities = citiesInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/occupancy/intelligence/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          automaticChecksEnabled,
          checkReservationConflicts,
          checkCampaignConflicts,
          checkStatusMismatch,
          checkOfferConflicts,
          checkExpiringCampaigns,
          checkUnderutilizedMedia,
          checkCalendarGaps,
          checkMissingData,
          reservationHoldDays: Number(reservationHoldDays),
          expiringCampaignWarningDays: Number(expiringCampaignWarningDays),
          underutilizedAfterDays: Number(underutilizedAfterDays),
          calendarGapMaxDays: Number(calendarGapMaxDays),
          targetRegions,
          targetCities: cities,
          preferredMediaTypes,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Uložení nastavení selhalo.');
      }

      setSuccess('Nastavení AI Obsazenosti bylo úspěšně uloženo.');
      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-bold">Nastavení AI Obsazenosti</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Načítám profil...
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}

              {/* General Toggles */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Aktivace modulu
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-800">Modul AI Obsazenost aktivní</span>
                    <p className="text-xs text-slate-500">Umožňuje detekci kolizí, neshod a příležitostí pro celou firmu.</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={automaticChecksEnabled}
                    onChange={(e) => setAutomaticChecksEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-800">Automatické plánované audity (Cron)</span>
                    <p className="text-xs text-slate-500">Pravidelný noční přepočet a automatické generování systémových notifikací.</p>
                  </div>
                </label>
              </div>

              {/* Rules Toggles */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Aktivní pravidla detekce
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkCampaignConflicts}
                      onChange={(e) => setCheckCampaignConflicts(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Dvojité rezervace (kolize)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkStatusMismatch}
                      onChange={(e) => setCheckStatusMismatch(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Neshody stavu plochy vs kalendář</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkOfferConflicts}
                      onChange={(e) => setCheckOfferConflicts(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Kolize nabídek (SENT / ACCEPTED)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkExpiringCampaigns}
                      onChange={(e) => setCheckExpiringCampaigns(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Končící kampaně (retence klienta)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkUnderutilizedMedia}
                      onChange={(e) => setCheckUnderutilizedMedia(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Dlouhodobě neobsazené plochy (ležáky)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checkCalendarGaps}
                      onChange={(e) => setCheckCalendarGaps(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Nevyužitá okna mezi kampaněmi</span>
                  </label>
                </div>
              </div>

              {/* Thresholds */}
              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Časové prahy a limity pravidel
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Varování před koncem kampaně (dny)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={expiringCampaignWarningDays}
                      onChange={(e) => setExpiringCampaignWarningDays(Number(e.target.value))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Plocha je ležák po (dny bez kampaně)
                    </label>
                    <input
                      type="number"
                      min={14}
                      max={365}
                      value={underutilizedAfterDays}
                      onChange={(e) => setUnderutilizedAfterDays(Number(e.target.value))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Maximální délka volného okna (dny)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={calendarGapMaxDays}
                      onChange={(e) => setCalendarGapMaxDays(Number(e.target.value))}
                      className="input mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Platnost předběžné rezervace (dny)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={reservationHoldDays}
                      onChange={(e) => setReservationHoldDays(Number(e.target.value))}
                      className="input mt-1 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Scope (Cities & Regions) */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sledovaná města (oddělená čárkou)
                </h3>
                <input
                  type="text"
                  value={citiesInput}
                  onChange={(e) => setCitiesInput(e.target.value)}
                  placeholder="Ostrava, Havířov, Frýdek-Místek..."
                  className="input w-full"
                />
                <p className="text-xs text-slate-400">Pokud ponecháte prázdné, kontrolují se všechna města firmy.</p>
              </div>

              {/* Media Types */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Preferované typy médií
                </h3>
                <div className="flex flex-wrap gap-2">
                  {MEDIA_TYPE_OPTIONS.map((opt) => {
                    const selected = preferredMediaTypes.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPreferredMediaTypes((prev) =>
                            selected ? prev.filter((x) => x !== opt.id) : [...prev, opt.id]
                          );
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          selected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Zavřít
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Uložit profil
          </button>
        </div>
      </div>
    </div>
  );
}
