'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Compass, Crosshair, MapPin, Plus, Save, Search, Trash2, Image as ImageIcon } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';
import { GoogleNavigationOfferMap } from './GoogleNavigationOfferMap';
import { NavigationSignVisualizer } from '@/components/navigation-documentation/NavigationSignVisualizer';

type ClientOption = {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
};

type DraftPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address: string;
  navigationType: string;
  variant: string;
  orientation: string;
  quantity: string;
  unitPrice: string;
  installationPrice: string;
  removalPrice: string;
  productionPrice: string;
  internalNote: string;
  clientNote: string;
  realDistanceText?: string;
  visualizedPhotoUrl?: string;
  carrierId?: string | null;

  // New structured fields
  arrowDirectionEnum: 'LEFT' | 'RIGHT' | 'STRAIGHT' | 'SLANTED_LEFT' | 'SLANTED_RIGHT' | 'U_TURN' | 'TWO_WAY';
  pillarNumber: string;
  pillarType: string;
  manualDistanceValue: string;
  manualDistanceUnit: 'METERS' | 'KILOMETERS';
  distanceSource: 'CALCULATED' | 'MANUAL';
  routePolyline?: string;
  calculatedDistanceMeters?: number;
};

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `point-${Date.now()}-${Math.random()}`;

export function NavigationOfferForm({
  clients,
  initialOffer,
}: {
  clients: ClientOption[];
  initialOffer?: OfferView;
}) {
  const router = useRouter();
  const navigation = initialOffer?.navigation;

  const [clientId, setClientId] = useState(initialOffer?.clientId ?? clients[0]?.id ?? '');
  const [title, setTitle] = useState(initialOffer?.title ?? 'Navigační nabídka');
  const [campaignName, setCampaignName] = useState(initialOffer?.campaignName ?? '');
  const [validUntil, setValidUntil] = useState(initialOffer?.validUntil ?? '');

  const [targetName, setTargetName] = useState(navigation?.targetName ?? '');
  const [targetAddress, setTargetAddress] = useState(navigation?.targetAddress ?? '');
  const [target, setTarget] = useState(
    navigation ? { latitude: navigation.targetLatitude, longitude: navigation.targetLongitude } : undefined,
  );
  const [targetNote, setTargetNote] = useState(navigation?.targetNote ?? '');

  const [internalNote, setInternalNote] = useState(initialOffer?.internalNote ?? '');
  const [clientMessage, setClientMessage] = useState(initialOffer?.clientMessage ?? '');

  const [points, setPoints] = useState<DraftPoint[]>(
    () =>
      navigation?.points.map((point: Record<string, unknown>) => ({
        id: String(point.id),
        label: String(point.label),
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        carrierId: (point.carrierId as string) ?? null,
        address: String(point.address ?? ''),
        navigationType: String(point.navigationType ?? 'Směrová tabule'),
        variant: String(point.variant ?? '120x80 cm'),
        orientation: String(point.orientation ?? ''),
        quantity: String(point.quantity ?? 1),
        unitPrice: String(point.unitPrice ?? 1500),
        productionPrice: String(point.productionPrice ?? 1200),
        installationPrice: String(point.installationPrice ?? 800),
        removalPrice: String(point.removalPrice ?? 400),
        internalNote: String(point.internalNote ?? ''),
        clientNote: String(point.clientNote ?? ''),
        arrowDirectionEnum: (point.arrowDirectionEnum as DraftPoint['arrowDirectionEnum']) || 'STRAIGHT',
        pillarNumber: String(point.pillarNumber ?? ''),
        pillarType: String(point.pillarType ?? ''),
        manualDistanceValue: point.manualDistanceValue ? String(point.manualDistanceValue) : '',
        manualDistanceUnit: (point.manualDistanceUnit as DraftPoint['manualDistanceUnit']) || 'METERS',
        distanceSource: (point.distanceSource as DraftPoint['distanceSource']) || 'CALCULATED',
        routePolyline: (point.routePolyline as string) ?? undefined,
        calculatedDistanceMeters: (point.calculatedDistanceMeters as number) ?? undefined,
      })) ?? [],
  );

  const [mode, setMode] = useState<'target' | 'point'>(target ? 'point' : 'target');
  const [results, setResults] = useState<Array<{ latitude: number; longitude: number; label: string }>>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Active point selected for sign visualization overlay
  const [activeVisualizerPointId, setActiveVisualizerPointId] = useState<string | null>(null);

  // Default price list items fetched from Settings
  const [catalogDefaults, setCatalogDefaults] = useState({
    rentalPrice: '1500',
    productionPrice: '1200',
    installationPrice: '800',
    removalPrice: '400',
  });

  useEffect(() => {
    async function loadPriceCatalog() {
      try {
        const res = await fetch('/api/price-list-items');
        if (res.ok) {
          const items = (await res.json()) as Array<{ carrierType?: string; mediaType?: string; rentalPrice?: number; productionPrice?: number }>;
          const navItem = items.find((i) => i.carrierType === 'NAVIGATION' || i.mediaType === 'NAVIGATION_SIGN');
          if (navItem) {
            setCatalogDefaults({
              rentalPrice: String(navItem.rentalPrice || 1500),
              productionPrice: String(navItem.productionPrice || 1200),
              installationPrice: '800',
              removalPrice: '400',
            });
          }
        }
      } catch {
        /* fallback to defaults */
      }
    }
    void loadPriceCatalog();
  }, []);

  const selectedClient = clients.find((client) => client.id === clientId);

  // Financial summary breakdown
  const totals = useMemo(() => {
    let rental = 0;
    let production = 0;
    let installation = 0;
    let removal = 0;

    for (const p of points) {
      const q = Number(p.quantity || 0);
      rental += q * Number(p.unitPrice || 0);
      production += q * Number(p.productionPrice || 0);
      installation += q * Number(p.installationPrice || 0);
      removal += q * Number(p.removalPrice || 0);
    }

    const subtotal = rental + production + installation + removal;
    const tax = subtotal * 0.21;
    const totalWithTax = subtotal + tax;

    return { rental, production, installation, removal, subtotal, tax, totalWithTax };
  }, [points]);

  function mapClick(latitude: number, longitude: number) {
    if (mode === 'target') {
      setTarget({ latitude, longitude });
      setMode('point');
      return;
    }
    setPoints((current) => [
      ...current,
      {
        id: newId(),
        label: `Navigační bod ${current.length + 1}`,
        latitude,
        longitude,
        address: '',
        navigationType: 'Směrová tabule',
        variant: '120x80 cm',
        orientation: 'Obousměrný (A/B)',
        quantity: '1',
        unitPrice: catalogDefaults.rentalPrice,
        productionPrice: catalogDefaults.productionPrice,
        installationPrice: catalogDefaults.installationPrice,
        removalPrice: catalogDefaults.removalPrice,
        internalNote: '',
        clientNote: '',
        arrowDirectionEnum: 'STRAIGHT',
        pillarNumber: '',
        pillarType: 'Sloup VO',
        manualDistanceValue: '',
        manualDistanceUnit: 'METERS',
        distanceSource: 'CALCULATED',
      },
    ]);
  }

  function updatePoint(id: string, changes: Partial<DraftPoint>) {
    setPoints((current) => current.map((point) => (point.id === id ? { ...point, ...changes } : point)));
  }

  async function geocode() {
    setMessage('');
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(targetAddress)}`);
    const data = (await response.json()) as Array<{ latitude: number; longitude: number; label: string }> | { error?: string };
    if (!response.ok) return setMessage((data as { error?: string }).error ?? 'Adresu se nepodařilo najít.');
    setResults(data as Array<{ latitude: number; longitude: number; label: string }>);
  }

  async function save() {
    if (!target) return setMessage('Nejprve označte cílové místo (prodejnu) v mapě.');
    if (!targetName.trim()) return setMessage('Zadejte název cílového místa / prodejny.');

    setSaving(true);
    setMessage('');

    const body = {
      clientId,
      title,
      campaignName,
      validUntil,
      contactPerson: selectedClient?.contactPerson,
      contactEmail: selectedClient?.email,
      contactPhone: selectedClient?.phone,
      targetName,
      targetAddress,
      targetLatitude: target.latitude,
      targetLongitude: target.longitude,
      targetNote,
      internalNote,
      clientMessage,
      points,
    };

    const response = await fetch(initialOffer?.id ? `/api/offers/navigation/${initialOffer.id}` : '/api/offers/navigation', {
      method: initialOffer?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { id?: string; error?: string };
    setSaving(false);

    if (!response.ok) return setMessage(data.error ?? 'Nabídku se nepodařilo uložit.');
    router.push(`/offers/${data.id}`);
    router.refresh();
  }

  const activePointForVisualizer = points.find((p) => p.id === activeVisualizerPointId);

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      {/* Left Sidebar Form */}
      <aside className="space-y-4">
        <section className="card space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Zadání nabídky navigace</h2>
          <Field label="Klient">
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Název nabídky">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <Field label="Název kampaně / prodejny">
            <input className="input" placeholder="Např. Navigace Koupelny Ostrava" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </Field>

          <Field label="Platnost nabídky do">
            <input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </section>

        {/* Target Store / Destination */}
        <section className="card space-y-3 border-2 border-sky-100 bg-sky-50/30">
          <h2 className="flex items-center gap-2 text-base font-bold text-sky-900">
            <Crosshair size={18} className="text-sky-600" />
            Cílové místo (Prodejna / Areál)
          </h2>

          <Field label="Název provozovny">
            <input className="input" placeholder="Např. Showroom SeePOINT Brno" value={targetName} onChange={(e) => setTargetName(e.target.value)} />
          </Field>

          <Field label="Adresa provozovny">
            <div className="flex gap-2">
              <input className="input" placeholder="Ulice, č.p., Město" value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} />
              <button aria-label="Vyhledat adresu" className="rounded-xl border border-slate-200 bg-white px-3 hover:bg-slate-50" onClick={() => void geocode()} type="button">
                <Search size={16} />
              </button>
            </div>
          </Field>

          {results.map((result) => (
            <button
              className="block w-full rounded-lg bg-white p-2.5 text-left text-xs font-semibold hover:bg-sky-100 border border-sky-200 transition"
              key={`${result.latitude}-${result.longitude}`}
              onClick={() => {
                setTarget({ latitude: result.latitude, longitude: result.longitude });
                setTargetAddress(result.label);
                setResults([]);
                setMode('point');
              }}
              type="button"
            >
              📍 {result.label}
            </button>
          ))}

          <Field label="Poznámka k příjezdu pro klienta">
            <textarea className="input min-h-16 text-xs" placeholder="Instrukce k příjezdu, parkoviště…" value={targetNote} onChange={(e) => setTargetNote(e.target.value)} />
          </Field>

          <button className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900" onClick={() => setMode('target')} type="button">
            <MapPin size={15} /> Změnit cíl kliknutím na mapě
          </button>
        </section>

        {/* Financial Calculation Summary Card */}
        <section className="card space-y-3 bg-slate-900 text-white">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Calculator size={18} className="text-sky-400" />
            <h2 className="text-base font-bold text-white">Rozpad kalkulace nabídky</h2>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Pronájem bodů:</span>
              <strong className="text-white">{totals.rental.toLocaleString('cs-CZ')} Kč</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Tisk a výroba:</span>
              <strong className="text-white">{totals.production.toLocaleString('cs-CZ')} Kč</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Instalace:</span>
              <strong className="text-white">{totals.installation.toLocaleString('cs-CZ')} Kč</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Demontáž:</span>
              <strong className="text-white">{totals.removal.toLocaleString('cs-CZ')} Kč</strong>
            </div>

            <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm text-sky-400">
              <span>Celkem bez DPH:</span>
              <span>{totals.subtotal.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>DPH 21 %:</span>
              <span>{totals.tax.toLocaleString('cs-CZ')} Kč</span>
            </div>
            <div className="border-t border-slate-700 pt-2 flex justify-between font-black text-base text-white">
              <span>Celkem s DPH:</span>
              <span className="text-emerald-400">{totals.totalWithTax.toLocaleString('cs-CZ')} Kč</span>
            </div>
          </div>
        </section>

        <section className="card space-y-3">
          <Field label="Interní poznámka">
            <textarea className="input min-h-16 text-xs" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
          </Field>
          <Field label="Úvodní zpráva klientovi">
            <textarea className="input min-h-20 text-xs" placeholder="Vážený kliente, navrhujeme tyto navigační trasy k vaší provozovně…" value={clientMessage} onChange={(e) => setClientMessage(e.target.value)} />
          </Field>
        </section>

        <button className="btn-primary inline-flex w-full items-center justify-center gap-2 shadow-md" disabled={saving} onClick={() => void save()} type="button">
          <Save size={17} />
          {saving ? 'Ukládám nabídku…' : 'Uložit nabídku navigace'}
        </button>

        {message && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200" role="alert">{message}</p>}
      </aside>

      {/* Main Interactive Map & Navigation Points */}
      <main className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                mode === 'point' ? 'bg-sky-600 text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setMode('point')}
              type="button"
            >
              <Plus className="mr-1 inline" size={15} /> Přidávat navigační body
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                mode === 'target' ? 'bg-rose-600 text-white shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setMode('target')}
              type="button"
            >
              <Crosshair className="mr-1 inline" size={15} /> Určit cíl (Prodejnu)
            </button>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {points.length} zadaných bodů {target ? '· Cíl nastaven 🎯' : '· Chybí cíl ⚠️'}
          </span>
        </div>

        <GoogleNavigationOfferMap
          mode={mode}
          onTargetSelect={(place) => {
            setTarget({ latitude: place.latitude, longitude: place.longitude });
            setTargetName(place.label);
            setTargetAddress(place.address);
            setMode('point');
          }}
          onMapClick={mapClick}
          onPointMove={(id, latitude, longitude, calculatedDistanceMeters, polyline) => {
            updatePoint(id, {
              latitude,
              longitude,
              ...(calculatedDistanceMeters !== undefined ? { calculatedDistanceMeters } : {}),
              ...(polyline !== undefined ? { routePolyline: polyline } : {}),
            });
          }}
          points={points}
          target={target ? { ...target, label: targetName || 'Cíl navigace', address: targetAddress } : undefined}
        />

        {/* Itemized Points Editor & Photo Visualizer Trigger */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-xl font-bold text-slate-900">Vytipované navigační body na trase ({points.length})</h2>
            <p className="text-xs text-slate-500">Kliknutím do mapy výše přidáte nový navigační bod.</p>
          </div>

          {points.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">Zatím nebyly přidány žádné navigační body.</p>
              <p className="text-xs mt-1">Klikněte tlačítkem myši do mapy výše pro umístění prvního navigačního bodu na trase.</p>
            </div>
          ) : (
            points.map((point, index) => (
              <div className="card space-y-4 border border-slate-200 bg-white p-5 shadow-sm" key={point.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 font-mono text-xs font-bold text-sky-800">
                      #{index + 1}
                    </span>
                    <h3 className="font-bold text-slate-900">{point.label}</h3>

                    {point.realDistanceText && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        <Compass size={13} /> {point.realDistanceText}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
                      onClick={() => setActiveVisualizerPointId(point.id)}
                      type="button"
                    >
                      <ImageIcon size={15} /> Foto-vizualizátor cedule
                    </button>

                    <button
                      aria-label={`Odstranit ${point.label}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      onClick={() => setPoints((current) => current.filter((row) => row.id !== point.id))}
                      type="button"
                    >
                      <Trash2 size={15} /> Smazat bod
                    </button>
                  </div>
                </div>

                {/* Render preview of generated sign visualization if available */}
                {point.visualizedPhotoUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                    <img alt="Vizualizace" className="h-16 w-24 object-cover rounded-lg border" src={point.visualizedPhotoUrl} />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">✓ Vygenerována grafická vizualizace cedule</p>
                      <p className="text-[11px] text-emerald-700">Tento snímek se zobrazí klientovi v fotodokumentaci i v nabídce.</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Označení bodu">
                    <input className="input" value={point.label} onChange={(e) => updatePoint(point.id, { label: e.target.value })} />
                  </Field>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Směrová šipka (Enum)</label>
                    <select
                      className="input font-bold text-sky-800"
                      value={point.arrowDirectionEnum || 'STRAIGHT'}
                      onChange={(e) => updatePoint(point.id, { arrowDirectionEnum: e.target.value as DraftPoint['arrowDirectionEnum'] })}
                    >
                      <option value="STRAIGHT">⬆ Rovně (STRAIGHT)</option>
                      <option value="LEFT">⬅ Vlevo (LEFT)</option>
                      <option value="RIGHT">➔ Vpravo (RIGHT)</option>
                      <option value="SLANTED_LEFT">↖ Šikmo vlevo (SLANTED_LEFT)</option>
                      <option value="SLANTED_RIGHT">↗ Šikmo vpravo (SLANTED_RIGHT)</option>
                      <option value="U_TURN">↩ Otočení (U_TURN)</option>
                      <option value="TWO_WAY">↔ Obousměrný (TWO_WAY)</option>
                    </select>
                  </div>

                  <Field label="Číslo sloupu (pillarNumber)">
                    <input className="input" placeholder="např. VO #142" value={point.pillarNumber || ''} onChange={(e) => updatePoint(point.id, { pillarNumber: e.target.value })} />
                  </Field>

                  <Field label="Typ sloupu / konstrukcí">
                    <input className="input" placeholder="např. Sloup veřejného osvětlení" value={point.pillarType || ''} onChange={(e) => updatePoint(point.id, { pillarType: e.target.value })} />
                  </Field>

                  <Field label="Typ navigačního nosiče">
                    <input className="input" value={point.navigationType} onChange={(e) => updatePoint(point.id, { navigationType: e.target.value })} />
                  </Field>

                  <Field label="Rozměr / varianta">
                    <input className="input" value={point.variant} onChange={(e) => updatePoint(point.id, { variant: e.target.value })} />
                  </Field>

                  {/* Distance Source & Values */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Zdroj zobrazované vzdálenosti</label>
                    <select
                      className="input"
                      value={point.distanceSource || 'CALCULATED'}
                      onChange={(e) => updatePoint(point.id, { distanceSource: e.target.value as DraftPoint['distanceSource'] })}
                    >
                      <option value="CALCULATED">⚡ Automaticky z Google Routes API</option>
                      <option value="MANUAL">✏️ Ručně nastavená vzdálenost</option>
                    </select>
                  </div>

                  {point.distanceSource === 'MANUAL' ? (
                    <div>
                      <label className="block text-xs font-bold text-amber-800 mb-1">Ruční hodnota a jednotka</label>
                      <div className="flex gap-1">
                        <input
                          className="input flex-1"
                          type="number"
                          placeholder="250"
                          value={point.manualDistanceValue || ''}
                          onChange={(e) => updatePoint(point.id, { manualDistanceValue: e.target.value })}
                        />
                        <select
                          className="input w-20 text-xs font-bold"
                          value={point.manualDistanceUnit || 'METERS'}
                          onChange={(e) => updatePoint(point.id, { manualDistanceUnit: e.target.value as DraftPoint['manualDistanceUnit'] })}
                        >
                          <option value="METERS">m</option>
                          <option value="KILOMETERS">km</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">Vypočtená trasování z Google</label>
                      <div className="input bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-between">
                        <span>{point.calculatedDistanceMeters ? `${point.calculatedDistanceMeters} m` : 'Nepočítáno'}</span>
                        <span className="text-[10px] text-slate-400">Routes API</span>
                      </div>
                    </div>
                  )}

                  <Field label="Počet ks">
                    <input className="input" min="0.01" step="0.01" type="number" value={point.quantity} onChange={(e) => updatePoint(point.id, { quantity: e.target.value })} />
                  </Field>

                  <Field label="Pronájem (Cena/ks/měsíc)">
                    <input className="input" min="0" step="0.01" type="number" value={point.unitPrice} onChange={(e) => updatePoint(point.id, { unitPrice: e.target.value })} />
                  </Field>

                  <Field label="Tisk & Výroba (Cena/ks)">
                    <input className="input" min="0" step="0.01" type="number" value={point.productionPrice} onChange={(e) => updatePoint(point.id, { productionPrice: e.target.value })} />
                  </Field>

                  <Field label="Montáž (Cena/ks)">
                    <input className="input" min="0" step="0.01" type="number" value={point.installationPrice} onChange={(e) => updatePoint(point.id, { installationPrice: e.target.value })} />
                  </Field>

                  <Field label="Demontáž (Cena/ks)">
                    <input className="input" min="0" step="0.01" type="number" value={point.removalPrice} onChange={(e) => updatePoint(point.id, { removalPrice: e.target.value })} />
                  </Field>

                  <Field label="Adresa / Popis umístění">
                    <input className="input" placeholder="Ulice, křižovatka, sloup č. …" value={point.address} onChange={(e) => updatePoint(point.id, { address: e.target.value })} />
                  </Field>

                  <Field label="Poznámka pro klienta v nabídce">
                    <input className="input" placeholder="Vytipovaná křižovatka 350m před odbočkou…" value={point.clientNote} onChange={(e) => updatePoint(point.id, { clientNote: e.target.value })} />
                  </Field>

                  <Field label="Interní poznámka (skrytá)">
                    <input className="input" value={point.internalNote} onChange={(e) => updatePoint(point.id, { internalNote: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Visualizer Modal Dialog */}
      {activePointForVisualizer && (
        <NavigationSignVisualizer
          initialSignText={targetName || activePointForVisualizer.label}
          orientation={activePointForVisualizer.orientation}
          pointLabel={activePointForVisualizer.label}
          onClose={() => setActiveVisualizerPointId(null)}
          onSaveVisualization={(dataUrl) => {
            updatePoint(activePointForVisualizer.id, { visualizedPhotoUrl: dataUrl });
            setActiveVisualizerPointId(null);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="mb-1 block text-xs font-bold text-slate-800">{label}</span>
      {children}
    </label>
  );
}
