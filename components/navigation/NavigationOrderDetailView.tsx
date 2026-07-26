'use client';

import { useState } from 'react';
import {
  Compass,
  MapPin,
  Camera,
  Edit3,
  Image as ImageIcon,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import type { NavigationOrderDetail, NavigationPointItem } from '@/lib/navigation/types';
import {
  NAVIGATION_ORDER_STATUS_COLORS,
  NAVIGATION_ORDER_STATUS_LABELS,
  NAVIGATION_BLOCK_STATUS_LABELS,
} from '@/lib/navigation/types';

export function NavigationOrderDetailView({ order }: { order: NavigationOrderDetail }) {
  const [currentOrder, setCurrentOrder] = useState<NavigationOrderDetail>(order);
  const [activeTab, setActiveTab] = useState<'overview' | 'points' | 'photos' | 'billing' | 'history'>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Price Edit Modal
  const [selectedPointForPrice, setSelectedPointForPrice] = useState<NavigationPointItem | null>(null);
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [priceReason, setPriceReason] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Photo Upload Modal
  const [selectedPointForPhoto, setSelectedPointForPhoto] = useState<NavigationPointItem | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoType, setPhotoType] = useState('AFTER_INSTALLATION');
  const [photoNote, setPhotoNote] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const statusLabel = NAVIGATION_ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status;
  const statusColor = NAVIGATION_ORDER_STATUS_COLORS[currentOrder.status] || 'bg-slate-100 text-slate-800';
  const blockLabel = currentOrder.blockStatus ? NAVIGATION_BLOCK_STATUS_LABELS[currentOrder.blockStatus] : null;

  async function handleStatusChange(targetStatus: string) {
    setTransitioning(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nepodařilo se změnit stav zakázky.');

      setSuccessMsg(`Stav zakázky byl změněn na "${NAVIGATION_ORDER_STATUS_LABELS[targetStatus as keyof typeof NAVIGATION_ORDER_STATUS_LABELS]}"`);
      setCurrentOrder((prev) => ({
        ...prev,
        status: data.order.status,
        blockStatus: data.order.blockStatus,
      }));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při přechodu stavu.');
    } finally {
      setTransitioning(false);
    }
  }

  async function handleSavePriceChange(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPointForPrice || !newUnitPrice || !priceReason) return;
    setSavingPrice(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navigationPointId: selectedPointForPrice.id,
          newUnitPrice: parseFloat(newUnitPrice),
          effectiveDate,
          reason: priceReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při ukládání nové ceny.');

      setSuccessMsg(`Cena bodu "${selectedPointForPrice.label}" byla úspěšně aktualizována od ${effectiveDate}.`);
      setSelectedPointForPrice(null);
      // Reload order details
      const detailRes = await fetch(`/api/navigation/orders/${currentOrder.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        if (detailData.order) setCurrentOrder(detailData.order);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při ukládání ceny.');
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleUploadPhoto(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPointForPhoto || !photoUrl) return;
    setUploadingPhoto(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navigationPointId: selectedPointForPhoto.id,
          photoUrl,
          photoType,
          note: photoNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při nahrávání fotky.');

      setSuccessMsg(`Fotografie pro bod "${selectedPointForPhoto.label}" byla úspěšně nahrána a propojena s plochou i nosičem.`);
      setSelectedPointForPhoto(null);
      setPhotoUrl('');
      setPhotoNote('');

      const detailRes = await fetch(`/api/navigation/orders/${currentOrder.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        if (detailData.order) setCurrentOrder(detailData.order);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při nahrávání fotky.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-sky-100 p-2 text-sky-700">
                <Compass size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{currentOrder.orderNumber}: {currentOrder.targetName}</h1>
                <p className="text-sm font-semibold text-slate-600">Klient: {currentOrder.clientName}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${statusColor}`}>
              {statusLabel}
            </span>
            {blockLabel && (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                ⏳ {blockLabel}
              </span>
            )}
            <div className="text-right ml-4">
              <span className="text-xs text-slate-500 uppercase tracking-wider block font-bold">Celková cena</span>
              <span className="text-xl font-black text-slate-900">{currentOrder.totalPrice?.toLocaleString('cs-CZ')} Kč</span>
            </div>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm font-semibold text-rose-800">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-800">
            ✅ {successMsg}
          </div>
        )}

        {/* Workflow Action Controllers */}
        <div className="mt-6 border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500 uppercase">Posun workflow:</span>
          <div className="flex flex-wrap gap-2">
            {currentOrder.status === 'POPTAVKA' && (
              <button
                onClick={() => handleStatusChange('NABIDKA')}
                disabled={transitioning}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-3 py-1.5 rounded-lg"
              >
                Vystavit nabídku ➔
              </button>
            )}
            {currentOrder.status === 'NABIDKA' && (
              <button
                onClick={() => handleStatusChange('POTVRZENO_KLIENTEM')}
                disabled={transitioning}
                className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Potvrdit klientem ➔
              </button>
            )}
            {currentOrder.status === 'POTVRZENO_KLIENTEM' && (
              <button
                onClick={() => handleStatusChange('SMLOUVA_OBJEDNAVKA')}
                disabled={transitioning}
                className="btn bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Smlouva / Objednávka ➔
              </button>
            )}
            {currentOrder.status === 'SMLOUVA_OBJEDNAVKA' && (
              <button
                onClick={() => handleStatusChange('GRAFICKE_PODKLADY')}
                disabled={transitioning}
                className="btn bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Zadat podklady grafiky ➔
              </button>
            )}
            {currentOrder.status === 'GRAFICKE_PODKLADY' && (
              <button
                onClick={() => handleStatusChange('SCHVALENI_GRAFIKY')}
                disabled={transitioning}
                className="btn bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Schválit grafiku ➔
              </button>
            )}
            {currentOrder.status === 'SCHVALENI_GRAFIKY' && (
              <button
                onClick={() => handleStatusChange('TISK_VYROBA')}
                disabled={transitioning}
                className="btn bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Zadat do výroby / tisku ➔
              </button>
            )}
            {currentOrder.status === 'TISK_VYROBA' && (
              <button
                onClick={() => handleStatusChange('PRIPRAVENO_K_INSTALACI')}
                disabled={transitioning}
                className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Připraveno k instalaci ➔
              </button>
            )}
            {currentOrder.status === 'PRIPRAVENO_K_INSTALACI' && (
              <button
                onClick={() => handleStatusChange('INSTALACE')}
                disabled={transitioning}
                className="btn bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Zahájit instalaci ➔
              </button>
            )}
            {currentOrder.status === 'INSTALACE' && (
              <button
                onClick={() => handleStatusChange('FOTODOKUMENTACE')}
                disabled={transitioning}
                className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Potvrdit fotodokumentaci ➔
              </button>
            )}
            {currentOrder.status === 'FOTODOKUMENTACE' && (
              <button
                onClick={() => handleStatusChange('PRIPRAVENO_K_FAKTURACI')}
                disabled={transitioning}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Připraveno k fakturaci ➔
              </button>
            )}
            {currentOrder.status === 'PRIPRAVENO_K_FAKTURACI' && (
              <button
                onClick={() => handleStatusChange('FAKTUROVANO')}
                disabled={transitioning}
                className="btn bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Vyfakturováno ➔
              </button>
            )}
            {currentOrder.status === 'FAKTUROVANO' && (
              <button
                onClick={() => handleStatusChange('DOKONCENO')}
                disabled={transitioning}
                className="btn bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Uzavřít a dokončit zakázku ✔
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-bold border-b-2 ${activeTab === 'overview' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          📌 Přehled & Cíl
        </button>
        <button
          onClick={() => setActiveTab('points')}
          className={`pb-3 text-sm font-bold border-b-2 ${activeTab === 'points' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          📍 Navigační body & Ceny ({currentOrder.points.length})
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          className={`pb-3 text-sm font-bold border-b-2 ${activeTab === 'photos' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          📷 Fotodokumentace
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-3 text-sm font-bold border-b-2 ${activeTab === 'billing' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          💳 Fakturační období ({currentOrder.billingPeriods.length})
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin size={20} className="text-rose-600" /> Cílová provozovna
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Název:</strong> {currentOrder.targetName}</p>
              <p><strong>Adresa:</strong> {currentOrder.targetAddress || 'Neuvedena'}</p>
              <p><strong>GPS:</strong> {currentOrder.targetLatitude}, {currentOrder.targetLongitude}</p>
              {currentOrder.targetNote && <p className="italic text-slate-500">Poznámka: {currentOrder.targetNote}</p>}
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User size={20} className="text-sky-600" /> Kontaktní údaje
            </h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Klient:</strong> {currentOrder.clientName}</p>
              {currentOrder.contactPerson && <p className="flex items-center gap-2"><User size={14} /> {currentOrder.contactPerson}</p>}
              {currentOrder.contactEmail && <p className="flex items-center gap-2"><Mail size={14} /> {currentOrder.contactEmail}</p>}
              {currentOrder.contactPhone && <p className="flex items-center gap-2"><Phone size={14} /> {currentOrder.contactPhone}</p>}
              <p><strong>Odpovědný obchodník:</strong> {currentOrder.assignedUserName || 'Nepřiřazen'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Points & Prices */}
      {activeTab === 'points' && (
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Seznam navigačních bodů</h3>
            <span className="text-xs text-slate-500 font-medium">Kliknutím na „Upravit cenu“ změníte cenu s verzováním od data</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Název / Označení</th>
                  <th className="p-3">Typ & Směr</th>
                  <th className="p-3">Fyzický nosič / Plocha</th>
                  <th className="p-3">Množství</th>
                  <th className="p-3">Cena za ks</th>
                  <th className="p-3">Celkem без DPH</th>
                  <th className="p-3 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentOrder.points.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-900">{p.label}</td>
                    <td className="p-3">
                      <div>{p.navigationType}</div>
                      <div className="text-xs text-slate-500">{p.orientation}</div>
                    </td>
                    <td className="p-3">
                      {p.carrierCode ? (
                        <span className="inline-flex items-center text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                          Nosič: {p.carrierCode} {p.surfaceName ? `(${p.surfaceName})` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Plánovaný bod</span>
                      )}
                    </td>
                    <td className="p-3">{p.quantity} ks</td>
                    <td className="p-3 font-semibold">{p.unitPrice.toLocaleString('cs-CZ')} Kč</td>
                    <td className="p-3 font-bold text-slate-900">{p.subtotal.toLocaleString('cs-CZ')} Kč</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedPointForPrice(p);
                          setNewUnitPrice(String(p.unitPrice));
                        }}
                        className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Edit3 size={13} /> Upravit cenu
                      </button>
                      <button
                        onClick={() => setSelectedPointForPhoto(p)}
                        className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Camera size={13} /> Nahrát fotku
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Photos */}
      {activeTab === 'photos' && (
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Fotodokumentace realizace</h3>
          <p className="text-xs text-slate-500">
            Všechny nahrávané fotografie jsou uchovávány jako jediný fotorecord propojený s bodem, plochou i nosičem pro celkový přehled.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {currentOrder.points.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-900">{p.label}</span>
                  <span className="text-xs text-slate-500 font-medium">{p.navigationType}</span>
                </div>
                {p.installedPhotoUrl ? (
                  <div className="aspect-video rounded-lg overflow-hidden border border-slate-300 relative bg-slate-900">
                    <img src={p.installedPhotoUrl} alt={p.label} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={32} />
                    <span className="text-xs mt-1">Chybí fotka</span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedPointForPhoto(p)}
                  className="w-full mt-2 btn bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1"
                >
                  <Camera size={14} /> {p.installedPhotoUrl ? 'Změnit fotku' : 'Nahrát fotku realizace'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Billing */}
      {activeTab === 'billing' && (
        <div className="card space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Fakturační období zakázky</h3>
          {currentOrder.billingPeriods.length === 0 ? (
            <p className="text-sm text-slate-500">Zatím nebylo vygenerováno žádné fakturační období.</p>
          ) : (
            <div className="space-y-2">
              {currentOrder.billingPeriods.map((bp) => (
                <div key={bp.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div>
                    <span className="font-bold text-sm text-slate-900">
                      {new Date(bp.dateFrom).toLocaleDateString('cs-CZ')} – {new Date(bp.dateTo).toLocaleDateString('cs-CZ')}
                    </span>
                    {bp.invoiceNumber && <span className="ml-3 text-xs font-semibold text-sky-800">Faktura: {bp.invoiceNumber}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-900">{bp.amount.toLocaleString('cs-CZ')} Kč</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                      {bp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Edit Price with Versioning */}
      {selectedPointForPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleSavePriceChange} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Změna ceny: {selectedPointForPrice.label}</h3>
            <p className="text-xs text-slate-500">
              Nová cena bude zapsána s verzováním platnosti. Minulá fakturovaná období zůstanou nedotčena.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nová cena za kus (bez DPH)</label>
              <input
                type="number"
                step="0.01"
                required
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Datum účinnosti (validFrom)</label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Důvod změny ceny (Audit log)</label>
              <input
                type="text"
                required
                placeholder="např. Úprava dle dodatku smlouvy č. 2"
                value={priceReason}
                onChange={(e) => setPriceReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPointForPrice(null)}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={savingPrice}
                className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {savingPrice ? 'Ukládám...' : 'Uložit novou cenu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Upload Photo */}
      {selectedPointForPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleUploadPhoto} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Nahrát fotku: {selectedPointForPhoto.label}</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">URL fotografie</label>
              <input
                type="text"
                required
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Typ fotografie</label>
              <select
                value={photoType}
                onChange={(e) => setPhotoType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-semibold"
              >
                <option value="AFTER_INSTALLATION">Po instalaci</option>
                <option value="BEFORE_INSTALLATION">Před instalací</option>
                <option value="SURFACE">Konkrétní plocha</option>
                <option value="CARRIER">Celý nosič</option>
                <option value="CONTROL">Kontrolní fotografie</option>
                <option value="DAMAGE">Závada</option>
                <option value="AFTER_DEINSTALLATION">Po deinstalaci</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Poznámka k fotografii</label>
              <input
                type="text"
                placeholder="Volitelná poznámka montéra..."
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPointForPhoto(null)}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={uploadingPhoto}
                className="btn bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {uploadingPhoto ? 'Ukládám...' : 'Uložit fotografii'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
