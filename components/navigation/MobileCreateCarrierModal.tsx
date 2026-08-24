'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Camera,
  MapPin,
  Compass,
  X,
  Building2,
  Tag,
  Layers,
  User,
  Plus,
  Check,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Info,
} from 'lucide-react';

type ClientItem = {
  id: string;
  name: string;
  tradingName?: string | null;
  companyId?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  coords: { lat: number; lng: number; accuracy: number } | null;
  initialFile: File | null;
  initialPreviewUrl: string | null;
  onRetake: () => void;
  onSuccess: (newCarrier: any, successMessage: string) => void;
};

const CARRIER_TYPES = [
  { value: 'BILLBOARD', label: 'Billboard', defaultSize: '5.1 x 2.4 m', icon: '🪧' },
  { value: 'CITYLIGHT', label: 'Citylight (CLV)', defaultSize: '118.5 x 175 cm', icon: '💡' },
  { value: 'BANNER', label: 'Plachta / Banner', defaultSize: 'Dle konstrukce', icon: '🚩' },
  { value: 'FACADE', label: 'Fasáda', defaultSize: 'Velkoformát', icon: '🏢' },
  { value: 'PROMO_TOWER', label: 'Promo věž', defaultSize: 'Trojboká věž', icon: '🗼' },
  { value: 'LED_SCREEN', label: 'LED obrazovka', defaultSize: 'Digitální plocha', icon: '📺' },
  { value: 'NAVIGATION', label: 'Navigační tabule', defaultSize: '100 x 50 cm', icon: '🧭' },
  { value: 'OTHER', label: 'Jiný typ', defaultSize: 'Atypický rozměr', icon: '➕' },
];

export function MobileCreateCarrierModal({
  isOpen,
  onClose,
  coords,
  initialFile,
  initialPreviewUrl,
  onRetake,
  onSuccess,
}: Props) {
  // Form State
  const [carrierType, setCarrierType] = useState('BILLBOARD');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('Praha');
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [surfaceCount, setSurfaceCount] = useState<1 | 2>(1);
  const [surfaceSize, setSurfaceSize] = useState('5.1 x 2.4 m');
  const [note, setNote] = useState('');

  // Client Selection State
  const [clientMode, setClientMode] = useState<'FREE' | 'ASSIGNED'>('FREE');
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Status & Geocoding State
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto Reverse Geocode on load or coords update
  useEffect(() => {
    if (!isOpen || !coords) return;

    let isMounted = true;
    const runReverseGeocode = async () => {
      setGeocoding(true);
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${coords.lat}&lng=${coords.lng}`);
        const data = await res.json();
        if (isMounted && data.success) {
          if (data.city) setCity(data.city);
          if (data.street) setStreet(data.street);
          if (data.locality) setLocality(data.locality);

          // Auto-generate a readable placeholder name if empty
          if (!name) {
            const place = data.street || data.locality || data.city || 'Nová plocha';
            setName(`${place} – Billboard`);
          }
        }
      } catch (err) {
        console.warn('Reverse geocode error:', err);
      } finally {
        if (isMounted) setGeocoding(false);
      }
    };

    runReverseGeocode();
    return () => {
      isMounted = false;
    };
  }, [isOpen, coords]);

  // Load clients list for autocomplete
  useEffect(() => {
    if (!isOpen || clientMode !== 'ASSIGNED' || clients.length > 0) return;

    let isMounted = true;
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const res = await fetch('/api/clients');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setClients(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Fetch clients error:', err);
      } finally {
        if (isMounted) setLoadingClients(false);
      }
    };

    fetchClients();
    return () => {
      isMounted = false;
    };
  }, [isOpen, clientMode, clients.length]);

  // Auto-update size placeholder when type changes
  const handleTypeChange = (typeVal: string) => {
    setCarrierType(typeVal);
    const found = CARRIER_TYPES.find((c) => c.value === typeVal);
    if (found) {
      setSurfaceSize(found.defaultSize);
      if (street || city) {
        const place = street || locality || city;
        setName(`${place} – ${found.label}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialFile) {
      setErrorMsg('Nejprve pořiďte fotografii plochy.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Vyplňte prosím název reklamní plochy.');
      return;
    }
    if (!city.trim()) {
      setErrorMsg('Vyplňte prosím město / obec.');
      return;
    }
    if (!coords) {
      setErrorMsg('Je vyžadována GPS poloha pro zaměření v terénu.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append('file', initialFile);
      fd.append('latitude', String(coords.lat));
      fd.append('longitude', String(coords.lng));
      fd.append('accuracyMeters', String(coords.accuracy || 10));
      fd.append('name', name.trim());
      if (code.trim()) fd.append('code', code.trim().toUpperCase());
      fd.append('type', carrierType);
      fd.append('city', city.trim());
      if (street.trim()) fd.append('street', street.trim());
      if (locality.trim()) fd.append('locality', locality.trim());
      fd.append('surfacesCount', String(surfaceCount));
      if (surfaceSize.trim()) fd.append('surfaceSize', surfaceSize.trim());
      if (note.trim()) fd.append('note', note.trim());

      if (clientMode === 'ASSIGNED') {
        if (isCreatingNewClient && newClientName.trim()) {
          fd.append('newClientName', newClientName.trim());
        } else if (selectedClientId) {
          fd.append('clientId', selectedClientId);
        }
      }

      const res = await fetch('/api/mobile-photos/create-carrier', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se vytvořit nosič.');
      }

      onSuccess(data.carrier, data.message || 'Nová reklamní plocha byla úspěšně založena!');
      onClose();
    } catch (err: unknown) {
      console.error('Submit create carrier error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při ukládání do databáze.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredClients = clients.filter((c) => {
    if (!clientSearchQuery.trim()) return true;
    const q = clientSearchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.tradingName && c.tradingName.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">Nová reklamní plocha z fotky</h2>
              <p className="text-[11px] text-slate-400">Založení nosiče do inventáře v terénu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Photo & GPS Banner */}
          <div className="flex gap-3 items-center rounded-2xl bg-slate-900 p-3 border border-slate-800">
            {initialPreviewUrl ? (
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                <Image
                  src={initialPreviewUrl}
                  alt="Náhled plochy"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-500 border border-slate-700">
                <Camera size={24} />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Compass size={14} className="animate-pulse" />
                <span>GPS zaměřeno (±{Math.round(coords?.accuracy || 0)} m)</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400 truncate">
                {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Čekám na GPS...'}
              </div>
              <button
                type="button"
                onClick={onRetake}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:underline"
              >
                <Camera size={12} /> Vyfotit znovu
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-950/80 p-3 text-xs font-bold text-rose-300 border border-rose-700">
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Type of Carrier Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Tag size={12} /> 1. Typ reklamního nosiče
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {CARRIER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value)}
                  className={`rounded-xl p-2 text-left border transition ${
                    carrierType === t.value
                      ? 'border-emerald-500 bg-emerald-950/70 text-white font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-base">{t.icon}</div>
                  <div className="text-[11px] font-bold text-slate-200 mt-0.5">{t.label}</div>
                  <div className="text-[9px] text-slate-500 truncate">{t.defaultSize}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Basic Details & Address */}
          <div className="space-y-2.5 rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <MapPin size={12} /> 2. Název a adresa umístění
              </label>
              {geocoding && (
                <span className="text-[10px] text-sky-400 font-bold flex items-center gap-1">
                  <RefreshCw size={10} className="animate-spin" /> Načítám adresu...
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Název reklamní plochy:</span>
              <input
                type="text"
                placeholder="Např. Vinohradská – u křižovatky"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Město / Obec:</span>
                <input
                  type="text"
                  placeholder="Praha, Brno, ..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Ulice / Č.P.:</span>
                <input
                  type="text"
                  placeholder="Vinohradská 14"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Vlastní kód (volitelné):</span>
                <input
                  type="text"
                  placeholder="Automaticky vygenerovat"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs uppercase text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Rozměr plochy:</span>
                <input
                  type="text"
                  placeholder="5.1 x 2.4 m"
                  value={surfaceSize}
                  onChange={(e) => setSurfaceSize(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Number of Surfaces (Strana A vs Strana A + B) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Layers size={12} /> 3. Počet reklamních ploch (stran)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSurfaceCount(1)}
                className={`rounded-xl p-2.5 border text-left transition ${
                  surfaceCount === 1
                    ? 'border-emerald-500 bg-emerald-950/70 text-white font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">🅰️ 1 plocha (Jednostranný)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Pouze Strana A</div>
              </button>

              <button
                type="button"
                onClick={() => setSurfaceCount(2)}
                className={`rounded-xl p-2.5 border text-left transition ${
                  surfaceCount === 2
                    ? 'border-emerald-500 bg-emerald-950/70 text-white font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">🅰️🅱️ 2 plochy (Oboustranný)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Strana A + Strana B</div>
              </button>
            </div>
          </div>

          {/* 4. Client Assignment / Availability */}
          <div className="space-y-2 rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <label className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <User size={12} /> 4. Obsazenost / Klient
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setClientMode('FREE');
                  setSelectedClientId('');
                  setIsCreatingNewClient(false);
                }}
                className={`rounded-xl p-2.5 border text-center transition ${
                  clientMode === 'FREE'
                    ? 'border-emerald-500 bg-emerald-950/70 text-emerald-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">🟢 Volná plocha</div>
                <div className="text-[9px] text-slate-400">Přidat do volného inventáře</div>
              </button>

              <button
                type="button"
                onClick={() => setClientMode('ASSIGNED')}
                className={`rounded-xl p-2.5 border text-center transition ${
                  clientMode === 'ASSIGNED'
                    ? 'border-blue-500 bg-blue-950/70 text-blue-300 font-bold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">👤 Obsazeno klientem</div>
                <div className="text-[9px] text-slate-400">Přiřadit ke klientovi</div>
              </button>
            </div>

            {clientMode === 'ASSIGNED' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {!isCreatingNewClient ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Vyberte klienta ze seznamu:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewClient(true);
                          setSelectedClientId('');
                        }}
                        className="text-[10px] font-bold text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={10} /> + Vytvořit nového klienta
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Hledat existujícího klienta..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                    />

                    <div className="max-h-28 overflow-y-auto space-y-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
                      {loadingClients && (
                        <div className="p-2 text-center text-slate-500">Načítám klienty...</div>
                      )}
                      {!loadingClients && filteredClients.length === 0 && (
                        <div className="p-2 text-center text-slate-500">
                          Žádný klient nenalezen.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNewClient(true);
                              setNewClientName(clientSearchQuery);
                            }}
                            className="text-emerald-400 font-bold underline"
                          >
                            Založit nového
                          </button>
                        </div>
                      )}
                      {filteredClients.slice(0, 15).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClientId(c.id)}
                          className={`w-full rounded-lg px-2.5 py-1.5 text-left flex items-center justify-between transition ${
                            selectedClientId === c.id
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {selectedClientId === c.id && <Check size={14} className="shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl bg-emerald-950/40 p-2.5 border border-emerald-800/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-300">Založit nového klienta:</span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingNewClient(false)}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        Zpět na výběr
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Název nové firmy / inzerenta"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full rounded-lg border border-emerald-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Optional Note */}
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Doplňující poznámka k nosiči:</span>
            <input
              type="text"
              placeholder="Např. výborná viditelnost, nutno opravit spodní lem..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Action Footer Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-98 transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Ukládám do databáze...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>ULOŽIT NOVOU PLOCHU</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
