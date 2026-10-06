'use client';

import { useState } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Upload,
  Search,
  Check,
  Building,
  Image as ImageIcon,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { ClientOption, DraftPoint, DraftTarget } from './types';
import { TARGET_COLORS } from './types';
import { GoogleNavigationOfferMap } from '../GoogleNavigationOfferMap';

interface NavigationTargetsStepProps {
  targets: DraftTarget[];
  onTargetsChange: (targets: DraftTarget[]) => void;
  selectedClient?: ClientOption;
  points: DraftPoint[];
  onContinueToMap: () => void;
}

export function NavigationTargetsStep({
  targets,
  onTargetsChange,
  selectedClient,
  points,
  onContinueToMap,
}: NavigationTargetsStepProps) {
  const [activeTargetId, setActiveTargetId] = useState<string>(targets[0]?.id || '');
  const [geocodingId, setGeocodingId] = useState<string | null>(null);
  const [geocodeMessage, setGeocodeMessage] = useState<string>('');

  const activeTarget = targets.find((t) => t.id === activeTargetId) || targets[0];

  function countPointsForTarget(targetId: string) {
    return points.filter((p) => p.targetId === targetId || (!p.targetId && targetId === targets[0]?.id)).length;
  }

  function handleAddTarget() {
    const nextIdx = targets.length;
    const newTarget: DraftTarget = {
      id: `target-${Date.now()}`,
      name: `Prodejna ${nextIdx + 1}`,
      address: '',
      latitude: targets[0]?.latitude ? targets[0].latitude + 0.005 : 49.8346,
      longitude: targets[0]?.longitude ? targets[0].longitude + 0.005 : 18.282,
      color: TARGET_COLORS[nextIdx % TARGET_COLORS.length],
    };

    const next = [...targets, newTarget];
    onTargetsChange(next);
    setActiveTargetId(newTarget.id);
  }

  function handleRemoveTarget(id: string) {
    if (targets.length <= 1) return;
    const next = targets.filter((t) => t.id !== id);
    onTargetsChange(next);
    if (activeTargetId === id) {
      setActiveTargetId(next[0]?.id || '');
    }
  }

  function handleUpdateTarget(id: string, updates: Partial<DraftTarget>) {
    onTargetsChange(
      targets.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }

  // Load client branches manually on click (never automatically forced)
  function handleLoadClientBranches() {
    if (!selectedClient?.branches || selectedClient.branches.length === 0) return;

    const newBranches: DraftTarget[] = selectedClient.branches.map((b, idx) => {
      const fullAddr = [b.street, b.city, b.zip].filter(Boolean).join(', ');
      return {
        id: `branch-${b.id || idx + 1}`,
        name: b.name || `Pobočka ${idx + 1}`,
        address: fullAddr,
        latitude: b.latitude || targets[0]?.latitude || 49.8346,
        longitude: b.longitude || targets[0]?.longitude || 18.282,
        color: TARGET_COLORS[(targets.length + idx) % TARGET_COLORS.length],
      };
    });

    onTargetsChange([...targets, ...newBranches]);
    setActiveTargetId(newBranches[0].id);
  }

  async function handleGeocodeTarget(targetId: string, address: string) {
    if (!address.trim()) return;
    setGeocodingId(targetId);
    setGeocodeMessage('');

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data) && data.length > 0) {
        const first = data[0];
        handleUpdateTarget(targetId, {
          latitude: first.latitude,
          longitude: first.longitude,
          address: first.label || address,
        });
        setGeocodeMessage(`✓ GPS souřadnice nalezeny: ${first.latitude.toFixed(5)}, ${first.longitude.toFixed(5)}`);
      } else {
        setGeocodeMessage('Adresu se nepodařilo vyhledat. Zkontrolujte zadání nebo zadejte GPS ručně.');
      }
    } catch {
      setGeocodeMessage('Chyba při vyhledávání GPS.');
    } finally {
      setGeocodingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <MapPin className="text-rose-600" size={18} />
              <span>Cílové provozovny a prodejny klienta</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Definujte místa, ke kterým navigační trasa a cedule směřují. Můžete přidat více provozoven pro jednu kampaň.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedClient?.branches && selectedClient.branches.length > 0 && (
              <button
                type="button"
                onClick={handleLoadClientBranches}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition cursor-pointer"
              >
                <Building size={14} className="text-sky-600" />
                <span>Načíst pobočky klienta ({selectedClient.branches.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAddTarget}
              className="btn btn-secondary text-xs px-3 py-2 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> + Přidat pobočku
            </button>
          </div>
        </div>

        {geocodeMessage && (
          <div className="rounded-xl bg-sky-50 p-3 text-xs font-semibold text-sky-900 border border-sky-200 flex items-center justify-between">
            <span>{geocodeMessage}</span>
            <button
              type="button"
              onClick={() => setGeocodeMessage('')}
              className="text-sky-700 hover:text-sky-950"
            >
              ✕
            </button>
          </div>
        )}

        {/* Target Tabs / Cards List */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((t, idx) => {
            const isSelected = t.id === (activeTarget?.id || targets[0]?.id);
            const ptsCount = countPointsForTarget(t.id);

            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setActiveTargetId(t.id)}
                className={`relative rounded-xl border p-4 text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-slate-800 bg-slate-50/80 ring-2 ring-slate-800/20 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
                style={{ borderLeftColor: t.color || TARGET_COLORS[idx % TARGET_COLORS.length], borderLeftWidth: '5px' }}
              >
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: t.color || TARGET_COLORS[idx % TARGET_COLORS.length] }}
                      />
                      <span>{t.name || `Prodejna ${idx + 1}`} ({ptsCount} bodů)</span>
                    </span>
                    {targets.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTarget(t.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                        title="Odstranit provozovnu"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 truncate">
                    {t.address || 'Adresa nezadána'}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] w-full">
                  <span className="font-semibold text-slate-600">
                    🎯 {ptsCount} {ptsCount === 1 ? 'přiřazený bod' : ptsCount < 5 ? 'přiřazené body' : 'přiřazených bodů'}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {t.latitude?.toFixed(4)}, {t.longitude?.toFixed(4)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Target Editor Details */}
        {activeTarget && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <span>Úprava provozovny:</span>
                <span className="text-sky-800 font-bold">{activeTarget.name}</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600">Barva špendlíku:</span>
                {TARGET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleUpdateTarget(activeTarget.id, { color: c })}
                    className={`h-5 w-5 rounded-full border-2 transition transform hover:scale-110 cursor-pointer ${
                      activeTarget.color === c ? 'ring-2 ring-slate-800 scale-105 border-white' : 'border-white'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Název provozovny *</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="např. Lidl Ostrava-Poruba"
                  value={activeTarget.name}
                  onChange={(e) => handleUpdateTarget(activeTarget.id, { name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                  <span>Adresa provozovny</span>
                  {activeTarget.address && (
                    <button
                      type="button"
                      disabled={geocodingId === activeTarget.id}
                      onClick={() => handleGeocodeTarget(activeTarget.id, activeTarget.address)}
                      className="text-[10px] text-sky-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Search size={11} /> Vyhledat GPS
                    </button>
                  )}
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    className="input text-xs flex-1"
                    placeholder="Ulice, č.p., Město..."
                    value={activeTarget.address}
                    onChange={(e) => handleUpdateTarget(activeTarget.id, { address: e.target.value })}
                  />
                  <button
                    type="button"
                    title="Vyhledat souřadnice podle adresy"
                    disabled={geocodingId === activeTarget.id || !activeTarget.address.trim()}
                    onClick={() => handleGeocodeTarget(activeTarget.id, activeTarget.address)}
                    className="btn btn-secondary px-2.5 py-1 text-xs cursor-pointer"
                  >
                    <Search size={13} className={geocodingId === activeTarget.id ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">GPS souřadnice (Lat, Lng)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step="any"
                    className="input text-xs font-mono"
                    placeholder="Zeměp. šířka"
                    value={activeTarget.latitude || ''}
                    onChange={(e) => handleUpdateTarget(activeTarget.id, { latitude: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="any"
                    className="input text-xs font-mono"
                    placeholder="Zeměp. délka"
                    value={activeTarget.longitude || ''}
                    onChange={(e) => handleUpdateTarget(activeTarget.id, { longitude: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">Poznámka k provozovně</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="např. Vjezd z jižní křižovatky, parkoviště za budovou..."
                  value={activeTarget.note || ''}
                  onChange={(e) => handleUpdateTarget(activeTarget.id, { note: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Foto provozovny (URL)</label>
                <input
                  type="text"
                  className="input text-xs"
                  placeholder="https://..."
                  value={activeTarget.photoUrl || ''}
                  onChange={(e) => handleUpdateTarget(activeTarget.id, { photoUrl: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Live Target Map */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-rose-600" />
              <span>Mapa provozoven (cíle navigace)</span>
            </span>
            <span className="text-[11px] text-slate-500 font-normal">
              Pozici provozovny lze upřesnit tažením špendlíku na mapě
            </span>
          </div>
          <GoogleNavigationOfferMap
            compact
            mode="target"
            targets={targets.map((t) => ({
              id: t.id,
              latitude: t.latitude,
              longitude: t.longitude,
              label: t.name,
              address: t.address,
              color: t.color,
            }))}
            target={activeTarget ? {
              id: activeTarget.id,
              latitude: activeTarget.latitude,
              longitude: activeTarget.longitude,
              label: activeTarget.name || 'Cíl navigace',
              address: activeTarget.address,
              color: activeTarget.color,
            } : undefined}
            points={points.map((p) => ({
              id: p.id,
              label: p.label,
              latitude: p.latitude,
              longitude: p.longitude,
              navigationType: p.navigationType,
              color: p.color,
              targetId: p.targetId,
            }))}
            onTargetSelect={(place, targetId) => {
              const moved = targetId ? targets.find((t) => t.id === targetId) : activeTarget;
              if (moved) {
                handleUpdateTarget(moved.id, {
                  latitude: place.latitude,
                  longitude: place.longitude,
                  name: moved.name || place.label,
                  address: place.address || moved.address,
                });
              }
            }}
            onPointMove={() => {}}
            onMapClick={(lat, lng, addr) => {
              if (activeTarget) {
                handleUpdateTarget(activeTarget.id, {
                  latitude: lat,
                  longitude: lng,
                  address: addr || activeTarget.address,
                });
              }
            }}
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onContinueToMap}
            className="btn btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Pokračovat na mapu</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
