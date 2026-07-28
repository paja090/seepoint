'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Clock, Plus, Image as ImageIcon, UserCheck, Calendar } from 'lucide-react';

type CarrierItem = {
  id: string;
  code: string;
  name: string;
  city: string;
  street?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  structureCode?: string | null;
  status: string;
};

type HistoryLogItem = {
  id: string;
  eventType: string;
  title: string;
  description?: string | null;
  performedBy?: string | null;
  performedAt: string;
  clientName?: string | null;
  surface?: { id: string; name: string; sidePosition?: string | null } | null;
};

type SurfaceItem = {
  id: string;
  name: string;
  sidePosition?: string | null;
  mediaType: string;
  currentClient?: { id: string; name: string } | null;
  contract?: { id: string; contractNumber: string; endDate: string } | null;
  artworkUrl?: string | null;
  graphicNotes?: string | null;
  currentRentStart?: string | null;
  currentRentEnd?: string | null;
  price?: number | null;
  status: string;
};

export function CarrierDetailTimelineView({
  carrier,
  history,
  surfaces,
  clients,
}: {
  carrier: CarrierItem;
  history: HistoryLogItem[];
  surfaces: SurfaceItem[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'surfaces' | 'history'>('surfaces');

  // New History Event Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [eventType, setEventType] = useState('SERVICE');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [selectedSurfaceId, setSelectedSurfaceId] = useState('');
  const [savingHistory, setSavingHistory] = useState(false);

  // New Surface Modal State
  const [showSurfaceModal, setShowSurfaceModal] = useState(false);
  const [surfaceName, setSurfaceName] = useState('Plástev 670×900 mm');
  const [sidePosition, setSidePosition] = useState('Strana B');
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [rentPrice, setRentPrice] = useState('1500');
  const [savingSurface, setSavingSurface] = useState(false);

  async function handleCreateHistoryLog(e: React.FormEvent) {
    e.preventDefault();
    setSavingHistory(true);
    try {
      const res = await fetch(`/api/navigation/carriers/${carrier.id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          title: eventTitle || `Záznam zásahu: ${eventType}`,
          description: eventDescription,
          surfaceId: selectedSurfaceId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Zápis do historie selhal');
      setShowHistoryModal(false);
      setEventTitle('');
      setEventDescription('');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při zápisu do historie');
    } finally {
      setSavingHistory(false);
    }
  }

  async function handleCreateSurface(e: React.FormEvent) {
    e.preventDefault();
    setSavingSurface(true);
    try {
      const res = await fetch(`/api/navigation/carriers/${carrier.id}/surfaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: surfaceName,
          sidePosition,
          currentClientId: selectedClientId || undefined,
          artworkUrl: artworkUrl || undefined,
          price: parseFloat(rentPrice) || 0,
        }),
      });
      if (!res.ok) throw new Error('Vytvoření reklamní plochy selhalo');
      setShowSurfaceModal(false);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při vytváření reklamní plochy');
    } finally {
      setSavingSurface(false);
    }
  }

  const eventBadges: Record<string, { label: string; color: string }> = {
    INSTALLATION: { label: '🔨 Instalace', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    REINSTALLATION: { label: '🔄 Reinstalace', color: 'bg-sky-100 text-sky-900 border-sky-300' },
    GRAPHICS_CHANGE: { label: '🎨 Výměna grafiky', color: 'bg-purple-100 text-purple-900 border-purple-300' },
    REPAIR: { label: '🛠️ Oprava', color: 'bg-amber-100 text-amber-900 border-amber-300' },
    SERVICE: { label: '⚙️ Servis', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
    DEINSTALLATION: { label: '❌ Demontáž', color: 'bg-rose-100 text-rose-900 border-rose-300' },
    CLIENT_CHANGE: { label: '👤 Změna klienta', color: 'bg-teal-100 text-teal-900 border-teal-300' },
    RENTAL_CHANGE: { label: '💰 Změna pronájmu', color: 'bg-blue-100 text-blue-900 border-blue-300' },
  };

  return (
    <div className="space-y-6">
      {/* Carrier Top Header Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
                Sloup VO #{carrier.code}
              </span>
              {carrier.structureCode && (
                <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Číslo sloupu: {carrier.structureCode}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-slate-900">
              {carrier.city}, {carrier.street || carrier.address || 'Sloup veřejného osvětlení'}
            </h2>
            {carrier.latitude && carrier.longitude && (
              <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-500">
                <MapPin size={14} className="text-rose-500" />
                <span>GPS: {carrier.latitude.toFixed(6)}, {carrier.longitude.toFixed(6)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSurfaceModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-500 transition shadow-xs cursor-pointer"
            >
              <Plus size={16} /> Přidat reklamní plochu na sloup
            </button>
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
            >
              <Clock size={16} /> Zapsat zásah do historie
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 gap-6 pt-2 font-bold text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('surfaces')}
            className={`pb-3 border-b-2 transition ${activeTab === 'surfaces' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            🖼️ Reklamní plochy na sloupu ({surfaces.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 border-b-2 transition ${activeTab === 'history' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            📜 Časová osa & Audit historii ({history.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Multiple Independent Surfaces per Carrier */}
      {activeTab === 'surfaces' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Každá plocha na tomto sloupu má samostatného klienta, pronájem, grafiku a historii:
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {surfaces.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 relative hover:shadow-md transition">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-900 uppercase">
                      {s.sidePosition || 'Plocha'}
                    </span>
                    <h3 className="mt-1 text-base font-extrabold text-slate-900">{s.name}</h3>
                  </div>
                  <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-800 border border-emerald-200">
                    {s.currentClient ? 'Obsazeno' : 'Volná k pronájmu'}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <UserCheck size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-500">Klient:</span>
                    <span className="font-extrabold text-slate-900">{s.currentClient?.name || 'Zatím nepřiřazen'}</span>
                  </div>

                  {s.contract && (
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="font-semibold text-slate-500">Smlouva:</span>
                      <span className="font-mono font-bold text-sky-800">#{s.contract.contractNumber}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500">Měsíční nájemné:</span>
                    <span className="font-bold text-slate-900">{s.price ? `${Math.round(s.price).toLocaleString('cs-CZ')} Kč` : 'Dle smlouvy'}</span>
                  </div>

                  {s.artworkUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <ImageIcon size={16} className="text-purple-600" />
                        <span>Grafika nahraná</span>
                      </div>
                      <a href={s.artworkUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline font-bold">Zobrazit</a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {surfaces.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 font-medium">
                Zatím na tomto sloupu nebyla založena žádná samostatná reklamní plocha. Klikněte na &quot;Přidat reklamní plochu&quot;.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Carrier History Timeline Audit Trail */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Časová osa všech auditovaných úkonů (instalace, servis, výměna grafiky, opravy, demontáže):
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <ol className="relative border-l-2 border-slate-200 space-y-6 ml-3">
              {history.map((h) => {
                const badge = eventBadges[h.eventType] || { label: h.eventType, color: 'bg-slate-100 text-slate-800 border-slate-200' };

                return (
                  <li key={h.id} className="ml-6 space-y-1.5">
                    <span className="absolute -left-2.5 top-1 size-4 rounded-full border-2 border-white bg-sky-600 shadow-xs" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-black uppercase ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {new Date(h.performedAt).toLocaleString('cs-CZ')}
                      </span>
                      <span className="text-xs font-bold text-slate-600">• Provvedl: {h.performedBy || 'Technik'}</span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900">{h.title}</h4>

                    {h.surface && (
                      <div className="text-xs text-sky-700 font-bold">
                        Plocha: {h.surface.name} ({h.surface.sidePosition || 'Strana A'})
                      </div>
                    )}

                    {h.description && (
                      <p className="text-xs font-medium text-slate-600 whitespace-pre-wrap">{h.description}</p>
                    )}
                  </li>
                );
              })}

              {history.length === 0 && (
                <div className="py-6 text-center text-xs font-medium text-slate-400">
                  Zatím nebyl zaznamenán žádný auditní úkon v historii tohoto nosiče.
                </div>
              )}
            </ol>
          </div>
        </div>
      )}

      {/* History Event Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Zapsat zásah do historie nosiče</h3>
              <button type="button" className="text-slate-400 font-bold" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateHistoryLog} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Typ úkonu</label>
                <select className="input w-full" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                  <option value="INSTALLATION">🔨 Instalace (První montáž)</option>
                  <option value="REINSTALLATION">🔄 Reinstalace</option>
                  <option value="GRAPHICS_CHANGE">🎨 Výměna grafiky</option>
                  <option value="REPAIR">🛠️ Oprava</option>
                  <option value="SERVICE">⚙️ Servis / Kontrola</option>
                  <option value="DEINSTALLATION">❌ Demontáž</option>
                  <option value="CLIENT_CHANGE">👤 Změna klienta</option>
                  <option value="RENTAL_CHANGE">💰 Změna pronájmu</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Název úkonu / Popis</label>
                <input className="input w-full" placeholder="Např. Výměna poničené plástve po bouřce" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Plocha na sloupu (volitelné)</label>
                <select className="input w-full" value={selectedSurfaceId} onChange={(e) => setSelectedSurfaceId(e.target.value)}>
                  <option value="">Celý sloup VO</option>
                  {surfaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.sidePosition || 'Plocha'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Podrobná poznámka</label>
                <textarea className="input w-full h-20" placeholder="Podrobnosti provedené práce..." value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowHistoryModal(false)}>Zrušit</button>
                <button type="submit" disabled={savingHistory} className="btn btn-primary text-xs">
                  {savingHistory ? 'Ukládám…' : 'Zapsat do historie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Surface Modal */}
      {showSurfaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Nová reklamní plocha na sloupu</h3>
              <button type="button" className="text-slate-400 font-bold" onClick={() => setShowSurfaceModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSurface} className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pozice na sloupu</label>
                  <input className="input w-full" value={sidePosition} onChange={(e) => setSidePosition(e.target.value)} required />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Název / Typ nosiče</label>
                  <input className="input w-full" value={surfaceName} onChange={(e) => setSurfaceName(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Klient (volitelné)</label>
                <select className="input w-full" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                  <option value="">Volná k pronájmu</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Měsíční nájemné (Kč)</label>
                <input className="input w-full" type="number" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">URL grafického motivu (volitelné)</label>
                <input className="input w-full" placeholder="https://..." value={artworkUrl} onChange={(e) => setArtworkUrl(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowSurfaceModal(false)}>Zrušit</button>
                <button type="submit" disabled={savingSurface} className="btn btn-primary text-xs">
                  {savingSurface ? 'Ukládám…' : 'Vytvořit plochu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
