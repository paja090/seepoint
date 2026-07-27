'use client';

import { useState } from 'react';
import {
  MapPin,
  Camera,
  Edit3,
  Image as ImageIcon,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowLeft,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import type { NavigationOrderDetail, NavigationPointItem } from '@/lib/navigation/types';
import {
  NAVIGATION_ORDER_STATUS_COLORS,
  NAVIGATION_ORDER_STATUS_LABELS,
  NAVIGATION_BLOCK_STATUS_LABELS,
  NAVIGATION_PHASES,
} from '@/lib/navigation/types';
import Link from 'next/link';

export type NavigationTabKey = 'overview' | 'points' | 'graphics' | 'installation' | 'photos' | 'billing' | 'history';

export function NavigationOrderDetailView({ order }: { order: NavigationOrderDetail }) {
  const [currentOrder, setCurrentOrder] = useState<NavigationOrderDetail>(order);
  const [activeTab, setActiveTab] = useState<NavigationTabKey>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Revert Status Modal
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [revertTargetStatus, setRevertTargetStatus] = useState<string>('POPTAVKA');

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

  // Determine current active phase index in the 5-phase operational workflow
  const currentPhaseIndex = NAVIGATION_PHASES.findIndex((p) => p.statuses.includes(currentOrder.status));

  // Determine readiness checklist items
  const missingChecks = [
    {
      key: 'graphics',
      label: 'Schválené grafické podklady',
      isDone: Boolean(currentOrder.graphicsApprovedAt || ['TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE', 'PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'].includes(currentOrder.status)),
      actionLabel: 'Nahrát grafiku',
      tabTarget: 'graphics',
    },
    {
      key: 'carriers',
      label: 'Přiřazené nosiče u všech bodů',
      isDone: currentOrder.points.every((p) => p.carrierId !== null && p.carrierId !== undefined),
      actionLabel: 'Přiřadit nosiče',
      tabTarget: 'points',
    },
    {
      key: 'installationDate',
      label: 'Naplánovaný termín montáže',
      isDone: Boolean(currentOrder.installationDate),
      actionLabel: 'Naplánovat termín',
      tabTarget: 'installation',
    },
    {
      key: 'photos',
      label: 'Fotodokumentace po instalaci',
      isDone: currentOrder.points.length > 0 && currentOrder.points.every((p) => p.installedPhotoId !== null),
      actionLabel: 'Doplnit fotky',
      tabTarget: 'photos',
    },
    {
      key: 'billing',
      label: 'Vygenerovaná fakturační období',
      isDone: currentOrder.billingPeriods.length > 0,
      actionLabel: 'Správa fakturace',
      tabTarget: 'billing',
    },
  ];

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

  async function handleRevertStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!revertReason) return;
    setTransitioning(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: revertTargetStatus, revertReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Návrat do předchozího stavu se nepodařil.');

      setSuccessMsg(`Zakázka byla s odůvodněním vrácena do stavu "${NAVIGATION_ORDER_STATUS_LABELS[revertTargetStatus as keyof typeof NAVIGATION_ORDER_STATUS_LABELS]}".`);
      setCurrentOrder((prev) => ({
        ...prev,
        status: data.order.status,
        blockStatus: data.order.blockStatus,
      }));
      setShowRevertModal(false);
      setRevertReason('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při návratu stavu.');
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

  // Next primary action helper based on status
  const getPrimaryNextAction = () => {
    switch (currentOrder.status) {
      case 'POPTAVKA':
        return { label: 'Vystavit nabídku ➔', status: 'NABIDKA', btnClass: 'bg-blue-600 hover:bg-blue-700' };
      case 'NABIDKA':
        return { label: 'Potvrdit přijetí nabídky klientem ➔', status: 'POTVRZENO_KLIENTEM', btnClass: 'bg-sky-600 hover:bg-sky-700' };
      case 'POTVRZENO_KLIENTEM':
        return { label: 'Zadat smlouvu / objednávku ➔', status: 'SMLOUVA_OBJEDNAVKA', btnClass: 'bg-indigo-600 hover:bg-indigo-700' };
      case 'SMLOUVA_OBJEDNAVKA':
        return { label: 'Odeslat grafické podklady ➔', status: 'GRAFICKE_PODKLADY', btnClass: 'bg-amber-600 hover:bg-amber-700' };
      case 'GRAFICKE_PODKLADY':
        return { label: 'Odeslat grafiku ke schválení ➔', status: 'SCHVALENI_GRAFIKY', btnClass: 'bg-yellow-600 hover:bg-yellow-700' };
      case 'SCHVALENI_GRAFIKY':
        return { label: 'Schválit grafiku a zadat do výroby ➔', status: 'TISK_VYROBA', btnClass: 'bg-purple-600 hover:bg-purple-700' };
      case 'TISK_VYROBA':
        return { label: 'Označit výrobu jako dokončenou ➔', status: 'PRIPRAVENO_K_INSTALACI', btnClass: 'bg-sky-600 hover:bg-sky-700' };
      case 'PRIPRAVENO_K_INSTALACI':
        return { label: 'Naplánovat a zahájit montáž ➔', status: 'INSTALACE', btnClass: 'bg-orange-600 hover:bg-orange-700' };
      case 'INSTALACE':
        return { label: 'Odeslat fotodokumentaciju ke kontrole ➔', status: 'FOTODOKUMENTACE', btnClass: 'bg-teal-600 hover:bg-teal-700' };
      case 'FOTODOKUMENTACE':
        return { label: 'Schválit fotodokumentaci k fakturaci ➔', status: 'PRIPRAVENO_K_FAKTURACI', btnClass: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'PRIPRAVENO_K_FAKTURACI':
        return { label: 'Vyfakturovat zakázku ➔', status: 'FAKTUROVANO', btnClass: 'bg-green-600 hover:bg-green-700' };
      case 'FAKTUROVANO':
        return { label: 'Uzavřít a dokončit zakázku ✔', status: 'DOKONCENO', btnClass: 'bg-slate-900 hover:bg-slate-800' };
      default:
        return null;
    }
  };

  const mainAction = getPrimaryNextAction();

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/navigation" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-800">
                  {currentOrder.orderNumber}
                </span>
                <h1 className="text-xl font-bold text-slate-900">{currentOrder.targetName}</h1>
              </div>
              <p className="text-xs text-slate-500">Klient: <b>{currentOrder.clientName}</b> | Obchodník: <b>{currentOrder.assignedUserName || 'Nepřiřazen'}</b></p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusColor}`}>
              {statusLabel}
            </span>
            {blockLabel && (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                ⏳ {blockLabel}
              </span>
            )}
            <div className="text-right ml-2 border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Celková cena</span>
              <span className="text-lg font-black text-slate-900">{currentOrder.totalPrice?.toLocaleString('cs-CZ')} Kč</span>
            </div>

            {mainAction && (
              <button
                onClick={() => handleStatusChange(mainAction.status)}
                disabled={transitioning}
                className={`btn text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all ${mainAction.btnClass}`}
              >
                {mainAction.label}
              </button>
            )}

            <button
              onClick={() => setShowRevertModal(true)}
              className="btn border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:text-amber-800 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1"
              title="Vrátit do předchozího stavu s odůvodněním"
            >
              <RotateCcw size={14} /> Vrátit stav
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
            ✅ {successMsg}
          </div>
        )}

        {/* Visual Stepper */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {NAVIGATION_PHASES.map((phase, idx) => {
              const isCompleted = currentPhaseIndex > idx;
              const isCurrent = currentPhaseIndex === idx;

              return (
                <div
                  key={phase.key}
                  className={`rounded-xl border p-2.5 text-xs transition-all ${
                    isCurrent
                      ? 'border-sky-500 bg-sky-50/80 font-bold text-sky-900 shadow-xs'
                      : isCompleted
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 font-semibold'
                      : 'border-slate-200 bg-slate-50/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold">{phase.label}</span>
                    {isCompleted ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : isCurrent ? (
                      <Clock size={14} className="text-sky-600 animate-pulse" />
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{phase.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Grid: Detail Content + Readiness Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Detail Tabs & Content (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs Bar */}
          <div className="flex overflow-x-auto border-b border-slate-200 gap-4 pb-1">
            {[
              { id: 'overview', label: '📌 Přehled' },
              { id: 'points', label: `📍 Navigační body (${currentOrder.points.length})` },
              { id: 'graphics', label: '🎨 Grafika & Výroba' },
              { id: 'installation', label: '🛠️ Montáž' },
              { id: 'photos', label: '📷 Fotodokumentace' },
              { id: 'billing', label: `💳 Fakturace (${currentOrder.billingPeriods.length})` },
              { id: 'history', label: `📜 Aktivita (${currentOrder.auditLogs?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavigationTabKey)}
                className={`pb-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="card space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin size={18} className="text-rose-600" /> Cílová provozovna
                </h3>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>Název:</strong> {currentOrder.targetName}</p>
                  <p><strong>Adresa:</strong> {currentOrder.targetAddress || 'Neuvedena'}</p>
                  <p><strong>GPS:</strong> {currentOrder.targetLatitude}, {currentOrder.targetLongitude}</p>
                  {currentOrder.targetNote && <p className="italic text-slate-500">Poznámka: {currentOrder.targetNote}</p>}
                </div>
              </div>

              <div className="card space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User size={18} className="text-sky-600" /> Kontaktní údaje
                </h3>
                <div className="space-y-2 text-xs text-slate-700">
                  <p><strong>Klient:</strong> {currentOrder.clientName}</p>
                  {currentOrder.contactPerson && <p className="flex items-center gap-2"><User size={12} /> {currentOrder.contactPerson}</p>}
                  {currentOrder.contactEmail && <p className="flex items-center gap-2"><Mail size={12} /> {currentOrder.contactEmail}</p>}
                  {currentOrder.contactPhone && <p className="flex items-center gap-2"><Phone size={12} /> {currentOrder.contactPhone}</p>}
                  <p><strong>Odpovědný obchodník:</strong> {currentOrder.assignedUserName || 'Nepřiřazen'}</p>
                </div>
              </div>

              <div className="card space-y-4 md:col-span-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={18} className="text-amber-600" /> Termíny a harmonogram
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Začátek pronájmu</span>
                    <span className="font-bold text-slate-900">{currentOrder.rentStart ? new Date(currentOrder.rentStart).toLocaleDateString('cs-CZ') : 'Neuveden'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Konec pronájmu</span>
                    <span className="font-bold text-slate-900">{currentOrder.rentEnd ? new Date(currentOrder.rentEnd).toLocaleDateString('cs-CZ') : 'Neuveden'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Plánovaná montáž</span>
                    <span className="font-bold text-slate-900">{currentOrder.installationDate ? new Date(currentOrder.installationDate).toLocaleDateString('cs-CZ') : 'Neuvedena'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Plánovaná demontáž</span>
                    <span className="font-bold text-slate-900">{currentOrder.deinstallationDate ? new Date(currentOrder.deinstallationDate).toLocaleDateString('cs-CZ') : 'Neuvedena'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Points & Prices */}
          {activeTab === 'points' && (
            <div className="card space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Seznam navigačních bodů</h3>
                <span className="text-xs text-slate-500 font-medium">Kliknutím na „Upravit cenu“ změníte cenu s verzováním od data</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
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
                          <div className="text-[11px] text-slate-500">{p.orientation}</div>
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

          {/* Tab: Graphics */}
          {activeTab === 'graphics' && (
            <div className="card space-y-4">
              <h3 className="text-base font-bold text-slate-900">Grafické podklady & Výroba</h3>
              <p className="text-xs text-slate-500">
                Schválené grafické podklady pro výrobu navigačních cedulí a klientské vizualizace.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                🎨 Všechny podklady jsou schváleny a připraveny k výrobě.
              </div>
            </div>
          )}

          {/* Tab: Installation */}
          {activeTab === 'installation' && (
            <div className="card space-y-4">
              <h3 className="text-base font-bold text-slate-900">Plán a stav montáže</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <span className="font-bold text-slate-900">Termín montáže</span>
                  <p className="text-slate-600">{currentOrder.installationDate ? new Date(currentOrder.installationDate).toLocaleDateString('cs-CZ') : 'Zatím nenaplánováno'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <span className="font-bold text-slate-900">Přiřazený montážní pracovník</span>
                  <p className="text-slate-600">Montážní tým terén</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Photos */}
          {activeTab === 'photos' && (
            <div className="card space-y-4">
              <h3 className="text-base font-bold text-slate-900">Fotodokumentace realizace</h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {currentOrder.points.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">{p.label}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{p.navigationType}</span>
                    </div>
                    {p.installedPhotoUrl ? (
                      <div className="aspect-video rounded-lg overflow-hidden border border-slate-300 relative bg-slate-900">
                        <img src={p.installedPhotoUrl} alt={p.label} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon size={28} />
                        <span className="text-[11px] mt-1">Chybí fotka</span>
                      </div>
                    )}
                    <button
                      onClick={() => setSelectedPointForPhoto(p)}
                      className="w-full mt-2 btn bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1"
                    >
                      <Camera size={13} /> {p.installedPhotoUrl ? 'Změnit fotku' : 'Nahrát fotku'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Billing */}
          {activeTab === 'billing' && (
            <div className="card space-y-4">
              <h3 className="text-base font-bold text-slate-900">Fakturační období zakázky</h3>
              {currentOrder.billingPeriods.length === 0 ? (
                <p className="text-xs text-slate-500">Zatím nebylo vygenerováno žádné fakturační období.</p>
              ) : (
                <div className="space-y-2">
                  {currentOrder.billingPeriods.map((bp) => (
                    <div key={bp.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">
                          {new Date(bp.dateFrom).toLocaleDateString('cs-CZ')} – {new Date(bp.dateTo).toLocaleDateString('cs-CZ')}
                        </span>
                        {bp.invoiceNumber && <span className="ml-3 font-semibold text-sky-800">Faktura: {bp.invoiceNumber}</span>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-900">{bp.amount.toLocaleString('cs-CZ')} Kč</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                          {bp.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Audit History */}
          {activeTab === 'history' && (
            <div className="card space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock size={18} className="text-slate-600" /> Auditní historie zakázky
              </h3>
              {!currentOrder.auditLogs || currentOrder.auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">Žádné auditní záznamy nebyly nalezeny.</p>
              ) : (
                <div className="space-y-3 border-l-2 border-slate-200 pl-4">
                  {currentOrder.auditLogs.map((log) => (
                    <div key={log.id} className="relative text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.action}</span>
                        <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString('cs-CZ')}</span>
                      </div>
                      {log.userEmail && <p className="text-[11px] text-slate-600">Uživatel: {log.userEmail}</p>}
                      {log.details && <pre className="text-[10px] bg-slate-100 p-2 rounded text-slate-700 overflow-x-auto">{log.details}</pre>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Readiness Checklist ("Co chybí k dalšímu kroku") (1 col) */}
        <div className="space-y-4">
          <div className="card border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-sky-600" /> Co chybí k dalšímu kroku
            </h3>
            <p className="text-[11px] text-slate-500">
              Kontrolní seznam připravenosti podkladů pro posun zakázky v provozním workflow.
            </p>

            <div className="space-y-2 pt-1">
              {missingChecks.map((item) => (
                <div
                  key={item.key}
                  className={`rounded-xl border p-2.5 text-xs transition-all ${
                    item.isDone
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                      : 'border-amber-200 bg-amber-50/60 text-amber-900'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {item.isDone ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-[11px]">{item.label}</p>
                      {!item.isDone && (
                        <button
                          onClick={() => setActiveTab(item.tabTarget as NavigationTabKey)}
                          className="mt-1 text-[10px] font-bold text-amber-800 hover:underline flex items-center gap-0.5"
                        >
                          {item.actionLabel} <ChevronRight size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Revert Status */}
      {showRevertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleRevertStatus} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Vrátit zakázku do předchozího stavu</h3>
            <p className="text-xs text-slate-500">
              Umožňuje auditovaný návrat do předchozího povoleného stavu s povinným zdůvodněním.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cílový předchozí stav</label>
              <select
                value={revertTargetStatus}
                onChange={(e) => setRevertTargetStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
              >
                {Object.entries(NAVIGATION_ORDER_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Důvod návratu stavu (Audit log)</label>
              <textarea
                required
                rows={3}
                placeholder="Napište důvod vrácení zakázky..."
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRevertModal(false)}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={transitioning}
                className="btn bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Potvrdit návrat
              </button>
            </div>
          </form>
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
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Datum účinnosti (validFrom)</label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
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
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
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
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Typ fotografie</label>
              <select
                value={photoType}
                onChange={(e) => setPhotoType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
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
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
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
