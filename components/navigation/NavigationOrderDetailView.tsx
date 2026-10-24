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
  Upload,
  ExternalLink,
  FileText,
  FolderOpen,
} from 'lucide-react';
import type { NavigationOrderDetail, NavigationPointItem } from '@/lib/navigation/types';
import {
  NAVIGATION_ORDER_STATUS_COLORS,
  NAVIGATION_ORDER_STATUS_LABELS,
  NAVIGATION_BLOCK_STATUS_LABELS,
  NAVIGATION_PHASES,
} from '@/lib/navigation/types';
import Link from 'next/link';
import { NavigationSurveyTab } from './NavigationSurveyTab';
import { QuickCompanySettingsModal, type CompanySettingsForm } from '@/components/settings/QuickCompanySettingsModal';
import { ActionableResolutionCard } from '@/components/ui/ActionableResolutionCard';
import { NavigationInvoiceModal } from './NavigationInvoiceModal';
import { NavigationContactModal } from './NavigationContactModal';
import { NavigationScheduleModal } from './NavigationScheduleModal';

export type NavigationTabKey = 'overview' | 'survey' | 'points' | 'graphics' | 'installation' | 'photos' | 'billing' | 'history';

export interface ActionableResolutionState {
  title?: string;
  message: string;
  missingFields?: string[];
  errorType?: string;
  supplierData?: Partial<CompanySettingsForm>;
  resolution?: {
    type?: string;
    url?: string;
    label?: string;
    target?: string;
    clientId?: string;
    tab?: string;
  };
}

const navigationDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'UTC' });
const navigationDateTimeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Prague',
});
const navigationNumberFormatter = new Intl.NumberFormat('cs-CZ');

function formatNavigationDate(value: string) {
  return navigationDateFormatter.format(new Date(value));
}

export function NavigationOrderDetailView({
  order,
  canInvoice,
  currentDate,
  salesUsers = [],
}: {
  order: NavigationOrderDetail;
  canInvoice: boolean;
  currentDate: string;
  salesUsers?: Array<{ id: string; name: string; email: string }>;
}) {
  const [currentOrder, setCurrentOrder] = useState<NavigationOrderDetail>(order);
  const [activeTab, setActiveTab] = useState<NavigationTabKey>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [actionableError, setActionableError] = useState<ActionableResolutionState | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Quick Installation Date in Montáž Tab
  const [quickInstallationDate, setQuickInstallationDate] = useState(() => {
    if (!order.installationDate) return '';
    try {
      return new Date(order.installationDate).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  });
  const [savingInstallationDate, setSavingInstallationDate] = useState(false);

  // Graphics & Production Tab State
  const [artworkUrlInput, setArtworkUrlInput] = useState(order.graphicArtworkUrl || '');
  const [cloudDriveUrl, setCloudDriveUrl] = useState(order.clientArtworkUrl || '');
  const [savingGraphics, setSavingGraphics] = useState(false);
  const [uploadingArtwork, setUploadingArtwork] = useState(false);

  // Revert Status Modal
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [revertTargetStatus, setRevertTargetStatus] = useState<string>('POPTAVKA');

  // Price Edit Modal
  const [selectedPointForPrice, setSelectedPointForPrice] = useState<NavigationPointItem | null>(null);
  const [newUnitPrice, setNewUnitPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(currentDate);
  const [priceReason, setPriceReason] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

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
      key: 'points',
      label: 'Body převzaté ze schválené nabídky',
      isDone: currentOrder.points.length > 0,
      actionLabel: 'Zkontrolovat body',
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
    if (targetStatus === 'FAKTUROVANO') {
      const hasInvoicedPeriod = currentOrder.billingPeriods.some((p) => p.invoiceId && p.status === 'SENT');
      if (!hasInvoicedPeriod) {
        setShowInvoiceModal(true);
        return;
      }
    }

    setTransitioning(true);
    setErrorMsg('');
    setActionableError(null);
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.resolution || data.errorType) {
          setActionableError({
            title: 'Změna stavu zakázky byla zablokována',
            message: data.error || 'Nepodařilo se změnit stav zakázky.',
            errorType: data.errorType,
            resolution: data.resolution,
          });
        }
        throw new Error(data.error || 'Nepodařilo se změnit stav zakázky.');
      }

      setSuccessMsg(`Stav zakázky byl změněn na "${NAVIGATION_ORDER_STATUS_LABELS[targetStatus as keyof typeof NAVIGATION_ORDER_STATUS_LABELS]}"`);
      setCurrentOrder((prev) => ({
        ...prev,
        status: data.order.status,
        blockStatus: data.order.blockStatus,
      }));
      setActionableError(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při přechodu stavu.');
    } finally {
      setTransitioning(false);
    }
  }

  async function handleCreateAndSendInvoice() {
    setCreatingInvoice(true);
    setErrorMsg('');
    setActionableError(null);
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/navigation/orders/${currentOrder.id}/invoice`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        if (data.errorType || data.resolution) {
          setActionableError({
            title: data.errorType === 'MISSING_INVOICE_DATA' ? 'Chybí fakturační údaje dodavatele' : 'Fakturu nelze vystavit',
            message: data.error || 'Fakturu se nepodařilo vytvořit nebo odeslat.',
            errorType: data.errorType,
            missingFields: data.missingFields,
            supplierData: data.supplierData,
            resolution: data.resolution,
          });
        }
        throw new Error(data.error || 'Fakturu se nepodařilo vytvořit nebo odeslat.');
      }
      setCurrentOrder((previous) => ({
        ...previous,
        billingPeriods: [
          ...previous.billingPeriods.filter((period) => period.id !== data.billingPeriod.id),
          data.billingPeriod,
        ],
      }));
      setSuccessMsg(data.message || 'Faktura byla úspěšně vystavena.');
      setActionableError(null);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Fakturu se nepodařilo vytvořit nebo odeslat.');
    } finally {
      setCreatingInvoice(false);
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

  async function handleSaveInstallationDate(dateStr: string) {
    if (!dateStr) return;
    setSavingInstallationDate(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installationDate: new Date(dateStr).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při ukládání termínu montáže.');
      setCurrentOrder(data.order);
      setSuccessMsg('Termín montáže byl úspěšně naplánován.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při ukládání termínu.');
    } finally {
      setSavingInstallationDate(false);
    }
  }

  async function handleSaveGraphics(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSavingGraphics(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const bodyPayload: Record<string, any> = {
        graphicArtworkUrl: artworkUrlInput.trim() || null,
      };
      if (cloudDriveUrl.trim()) {
        bodyPayload.clientArtworkUrl = cloudDriveUrl.trim();
        bodyPayload.clientArtworkFileName = 'Externí tisková data (Cloud disk)';
      }
      const res = await fetch(`/api/navigation/orders/${currentOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při ukládání grafických podkladů.');
      setCurrentOrder(data.order);
      setSuccessMsg('Grafické podklady a odkazy na tisková data byly úspěšně uloženy.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při ukládání grafických podkladů.');
    } finally {
      setSavingGraphics(false);
    }
  }

  function handleArtworkFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Soubor náhledu je příliš velký (max 8 MB). Pro objemná tisková data vložte níže odkaz na Google Disk nebo OneDrive.');
      return;
    }
    setUploadingArtwork(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setArtworkUrlInput(reader.result);
      }
      setUploadingArtwork(false);
    };
    reader.onerror = () => {
      setErrorMsg('Chyba při čtení souboru.');
      setUploadingArtwork(false);
    };
    reader.readAsDataURL(file);
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
        return { label: 'Odeslat fotodokumentaci ke kontrole ➔', status: 'FOTODOKUMENTACE', btnClass: 'bg-teal-600 hover:bg-teal-700' };
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
              <p className="text-xs text-slate-500">
                Klient: <b>{currentOrder.clientName}</b> | Obchodník: <b>{currentOrder.assignedUserName || 'Nepřiřazen'}</b>
                {currentOrder.clientOrderCode && (
                  <> | Objednávka: <b className="text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">{currentOrder.clientOrderCode}</b></>
                )}
              </p>
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
              <span className="text-lg font-black text-slate-900">{typeof currentOrder.totalPrice === 'number' ? navigationNumberFormatter.format(currentOrder.totalPrice) : null} Kč</span>
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

        {/* Feedback Messages & Actionable Error Resolutions */}
        {actionableError ? (
          <div className="mt-3">
            <ActionableResolutionCard
              title={actionableError.title}
              message={actionableError.message}
              missingFields={actionableError.missingFields}
              severity="error"
              primaryAction={
                actionableError.errorType === 'MISSING_INVOICE_DATA' && actionableError.resolution?.target === 'company'
                  ? {
                      label: '✏️ Rychle doplnit firemní údaje a vystavit fakturu',
                      onClick: () => setShowCompanyModal(true),
                    }
                  : actionableError.errorType === 'MISSING_CLIENT_EMAIL' || actionableError.resolution?.target === 'client'
                  ? {
                      label: actionableError.resolution?.label || 'Doplnit v kartě klienta ↗',
                      href: actionableError.resolution?.url || `/clients/${currentOrder.clientId}`,
                    }
                  : actionableError.resolution?.type === 'TAB_SWITCH' && actionableError.resolution?.tab
                  ? {
                      label: actionableError.resolution?.label || 'Přejít k vyřešení',
                      onClick: () => setActiveTab(actionableError.resolution!.tab as NavigationTabKey),
                    }
                  : undefined
              }
              secondaryAction={
                actionableError.errorType === 'MISSING_INVOICE_DATA'
                  ? {
                      label: 'Nastavení firmy ↗',
                      href: '/settings/company',
                    }
                  : undefined
              }
              onDismiss={() => {
                setActionableError(null);
                setErrorMsg('');
              }}
            />
          </div>
        ) : errorMsg ? (
          <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
            ⚠️ {errorMsg}
          </div>
        ) : null}
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
              { id: 'survey', label: '📍 Průzkum lokalit' },
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
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <User size={18} className="text-sky-600" /> Kontaktní údaje
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-900 transition"
                    title="Upravit kontaktní údaje v zakázce i v CRM"
                  >
                    <Edit3 size={13} /> Upravit
                  </button>
                </div>
                <div className="space-y-2 text-xs text-slate-700">
                  <p>
                    <strong>Klient:</strong>{' '}
                    <Link
                      href={`/clients/${currentOrder.clientId}`}
                      target="_blank"
                      className="font-semibold text-sky-700 hover:underline inline-flex items-center gap-1"
                      title="Otevřít kartu klienta v CRM v novém okně"
                    >
                      {currentOrder.clientName} ↗
                    </Link>
                  </p>
                  {currentOrder.contactPerson && <p className="flex items-center gap-2"><User size={12} className="text-slate-400" /> {currentOrder.contactPerson}</p>}
                  {currentOrder.contactEmail && (
                    <p className="flex items-center gap-2">
                      <Mail size={12} className="text-slate-400" />{' '}
                      <a href={`mailto:${currentOrder.contactEmail}`} className="text-slate-700 hover:text-sky-700 hover:underline">
                        {currentOrder.contactEmail}
                      </a>
                    </p>
                  )}
                  {currentOrder.contactPhone && (
                    <p className="flex items-center gap-2">
                      <Phone size={12} className="text-slate-400" />{' '}
                      <a href={`tel:${currentOrder.contactPhone}`} className="text-slate-700 hover:text-sky-700 hover:underline">
                        {currentOrder.contactPhone}
                      </a>
                    </p>
                  )}
                  <p><strong>Odpovědný obchodník:</strong> {currentOrder.assignedUserName || 'Nepřiřazen'}</p>
                </div>
              </div>

              <div className="card space-y-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar size={18} className="text-amber-600" /> Termíny a harmonogram
                    </h3>
                    {currentOrder.clientOrderCode && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Objednávka / smlouva klienta: <b className="text-slate-800">{currentOrder.clientOrderCode}</b>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 transition"
                    title="Upravit termíny nájmu, montáže a kód objednávky"
                  >
                    <Edit3 size={13} /> Upravit termíny
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Začátek pronájmu</span>
                    <span className="font-bold text-slate-900">{currentOrder.rentStart ? formatNavigationDate(currentOrder.rentStart) : 'Neuveden'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Konec pronájmu</span>
                    <span className="font-bold text-slate-900">{currentOrder.rentEnd ? formatNavigationDate(currentOrder.rentEnd) : 'Neuveden'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Plánovaná montáž</span>
                    <span className="font-bold text-slate-900">{currentOrder.installationDate ? formatNavigationDate(currentOrder.installationDate) : 'Neuvedena'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-slate-400 font-medium block">Plánovaná demontáž</span>
                    <span className="font-bold text-slate-900">{currentOrder.deinstallationDate ? formatNavigationDate(currentOrder.deinstallationDate) : 'Neuvedena'}</span>
                  </div>
                </div>
                {currentOrder.targetNote && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <strong>Poznámka k realizaci:</strong> {currentOrder.targetNote}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tab: Survey */}
          {activeTab === 'survey' && <NavigationSurveyTab navigationOrderId={currentOrder.id} />}

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
                      <th className="p-3">Vybraný bod / Pozice</th>
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
                          {p.carrierId ? (
                            <a
                              href={`/navigation/carriers/${p.carrierId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 bg-sky-50 px-2 py-1 rounded hover:bg-sky-100 transition"
                              title="Tento unikátní nosič vznikl potvrzením realizace bodu"
                            >
                              ✅ Založeno realizací: {p.carrierCode || p.label}
                            </a>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex rounded-md bg-violet-50 px-2 py-1 text-xs font-bold text-violet-800">
                                Nový unikátní bod
                              </span>
                              <p className="max-w-64 text-[10px] text-slate-500">
                                {p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}
                                {' · '}Nosič a plocha vzniknou až potvrzením montáže.
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="p-3">{p.quantity} ks</td>
                        <td className="p-3 font-semibold">{navigationNumberFormatter.format(p.unitPrice)} Kč</td>
                        <td className="p-3 font-bold text-slate-900">{navigationNumberFormatter.format(p.subtotal)} Kč</td>
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
            <div className="card space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ImageIcon size={18} className="text-purple-600" /> Grafické podklady & Výroba
                  </h3>
                  <p className="text-xs text-slate-500">
                    Správa grafických motivů, odkazů na velká tisková data (Google Disk) a schválení do výroby.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {currentOrder.graphicsApprovedAt || ['TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE', 'PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'].includes(currentOrder.status) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      <CheckCircle2 size={14} /> Grafika schválena pro výrobu
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('TISK_VYROBA')}
                      className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} /> Schválit grafiku a zadat do výroby ➔
                    </button>
                  )}
                </div>
              </div>

              {/* Existing artwork view */}
              <div className="grid gap-4 md:grid-cols-2">
                {currentOrder.graphicArtworkUrl ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-sky-900">Motiv vložený do nabídky / zakázky</p>
                      <a
                        href={currentOrder.graphicArtworkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Zvětšit
                      </a>
                    </div>
                    <img
                      src={currentOrder.graphicArtworkUrl}
                      alt="Grafický motiv z nabídky"
                      className="h-56 w-full rounded-lg bg-white object-contain border border-sky-100"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center space-y-2">
                    <ImageIcon size={32} className="text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">Zatím nebyl nahrán náhled motivu</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">Můžete níže nahrát obrázek (PNG, JPG) nebo vložit URL odkaz.</p>
                  </div>
                )}

                {currentOrder.clientArtworkUrl ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-emerald-900">Podklady / tisková data</p>
                      <a
                        href={currentOrder.clientArtworkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Otevřít odkaz
                      </a>
                    </div>
                    {currentOrder.clientArtworkUrl.startsWith('data:image/') || currentOrder.clientArtworkUrl.match(/\.(png|jpe?g|webp|gif)$/i) ? (
                      <img
                        src={currentOrder.clientArtworkUrl}
                        alt="Grafické podklady klienta"
                        className="h-56 w-full rounded-lg bg-white object-contain border border-emerald-100"
                      />
                    ) : (
                      <div className="h-56 w-full rounded-lg bg-white border border-emerald-100 p-6 flex flex-col items-center justify-center text-center space-y-3">
                        <FolderOpen size={36} className="text-emerald-600" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">Složka s tiskovými daty</p>
                          <p className="text-[11px] text-slate-500 mt-1">{currentOrder.clientArtworkFileName || 'Externí úložiště'}</p>
                        </div>
                        <a
                          href={currentOrder.clientArtworkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <ExternalLink size={14} /> Přejít na složku v novém okně
                        </a>
                      </div>
                    )}
                    <p className="text-[11px] text-emerald-800 font-medium">{currentOrder.clientArtworkFileName || 'Grafické podklady'}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center space-y-2">
                    <FolderOpen size={32} className="text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">Zatím nebyl zadán odkaz na tisková data</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">Pro velkoformátový tisk (PDF v křivkách, TIFF) vložte odkaz na Google Disk níže.</p>
                  </div>
                )}
              </div>

              {/* Upload & Form Section */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Upload size={14} /> Nahrát nebo upravit grafické podklady
                </h4>

                <form onSubmit={handleSaveGraphics} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Visual Preview / Upload */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 block">
                        Náhled grafického motivu (obrázek / PDF)
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,.pdf"
                        onChange={handleArtworkFileSelect}
                        disabled={uploadingArtwork}
                        className="file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-100 file:text-sky-800 hover:file:bg-sky-200 text-xs text-slate-600 block w-full cursor-pointer border border-slate-200 bg-white rounded-xl p-1.5"
                      />
                      <div className="pt-1">
                        <span className="text-[11px] text-slate-500 block mb-1">Nebo zadejte přímé URL obrázku motivu:</span>
                        <input
                          type="text"
                          value={artworkUrlInput}
                          onChange={(e) => setArtworkUrlInput(e.target.value)}
                          placeholder="https://.../motiv.png"
                          className="input text-xs"
                        />
                      </div>
                    </div>

                    {/* External Cloud Storage URL */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FolderOpen size={14} className="text-amber-600" /> Odkaz na externí úložiště s tiskovými daty
                      </label>
                      <input
                        type="url"
                        value={cloudDriveUrl}
                        onChange={(e) => setCloudDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/... nebo OneDrive"
                        className="input text-xs"
                      />
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Tisková data mívají stovky megabajtů (tiskové PDF v křivkách, TIFF pro tiskárnu). Pro výrobu stačí vložit odkaz na sdílenou složku.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingGraphics || uploadingArtwork}
                      className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {savingGraphics ? 'Ukládám podklady...' : (
                        <>
                          <CheckCircle2 size={14} /> Uložit grafické podklady
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tab: Installation */}
          {activeTab === 'installation' && (
            <div className="card space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calendar size={18} className="text-orange-600" /> Plán a stav montáže
                  </h3>
                  <p className="text-xs text-slate-500">
                    Plánování termínu montáže navigačních cedulí a předání montážnímu týmu.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/navigation/installations"
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-sm transition"
                  >
                    <Camera size={14} /> Otevřít montážní rozhraní ↗
                  </Link>
                </div>
              </div>

              {/* Status and Date Planning Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-xs text-slate-900 block">Termín montáže v terénu</span>
                  {currentOrder.installationDate ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-orange-100 border border-orange-200 px-3 py-1.5 text-sm font-black text-orange-900">
                          📅 {formatNavigationDate(currentOrder.installationDate)}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                          ✅ Termín stanoven
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowScheduleModal(true)}
                        className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Edit3 size={12} /> Změnit datum nebo harmonogram
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                        ⚠️ Termín montáže zatím nebyl stanoven.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={quickInstallationDate}
                          onChange={(e) => setQuickInstallationDate(e.target.value)}
                          className="input text-xs max-w-44 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveInstallationDate(quickInstallationDate)}
                          disabled={savingInstallationDate || !quickInstallationDate}
                          className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition shadow-sm"
                        >
                          {savingInstallationDate ? 'Ukládám...' : 'Naplánovat termín'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                  <span className="font-bold text-xs text-slate-900 block">Přiřazený montážní tým</span>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800 font-bold">
                      👷
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Montážní tým terén</p>
                      <p className="text-[11px] text-slate-500">Technici obdrží zakázku do mobilního rozhraní</p>
                    </div>
                  </div>
                  {currentOrder.status === 'PRIPRAVENO_K_INSTALACI' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('INSTALACE')}
                      className="w-full mt-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 shadow-sm transition"
                    >
                      Zahájit montáž v terénu ➔
                    </button>
                  )}
                </div>
              </div>

              {/* Points Summary for Installation */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Navigační body k instalaci ({currentOrder.points.length} ks)
                </h4>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                  {currentOrder.points.map((p, idx) => (
                    <div key={p.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-400">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-slate-900">{p.label}</p>
                          <p className="text-[11px] text-slate-500">
                            {p.navigationType} · {p.orientation || 'Standard'} · {p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.installedPhotoUrl ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            📷 Nainstalováno s fotkou
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            ⏳ Čeká na montáž
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Photos */}
          {activeTab === 'photos' && (
            <div className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Fotodokumentace realizace</h3>
                  <p className="text-xs text-slate-500">Fotografie se pořizují a ukládají výhradně v montážním rozhraní.</p>
                </div>
                <Link href="/navigation/installations" className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700">
                  <Camera size={14} /> Otevřít montážní rozhraní
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {currentOrder.points.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">{p.label}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{p.navigationType}</span>
                    </div>
                    {p.installedPhotoUrl ? (
                      <div className="aspect-video rounded-lg overflow-hidden border border-slate-300 relative bg-slate-900 group">
                        <img
                          src={p.installedPhotoId ? `/api/photos/${encodeURIComponent(p.installedPhotoId)}/thumbnail` : p.installedPhotoUrl}
                          alt={p.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                        <a
                          href={p.installedPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold"
                          title="Zobrazit plné rozlišení"
                        >
                          Zvětšit foto
                        </a>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon size={28} />
                        <span className="text-[11px] mt-1">Chybí fotka</span>
                      </div>
                    )}
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
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">Zatím nebylo vygenerováno žádné fakturační období.</p>
                  {canInvoice && currentOrder.status === 'PRIPRAVENO_K_FAKTURACI' && (
                    <button
                      type="button"
                      onClick={() => setShowInvoiceModal(true)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
                    >
                      Návrh, úprava položek a odeslání faktury
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {currentOrder.billingPeriods.map((bp) => (
                    <div key={bp.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">
                          {bp.dateFromLabel} – {bp.dateToLabel}
                        </span>
                        {bp.invoiceNumber && <span className="ml-3 font-semibold text-sky-800">Faktura: {bp.invoiceNumber}</span>}
                        {bp.invoiceId && (
                          <a href={`/api/crm/invoices/${bp.invoiceId}/pdf`} target="_blank" rel="noreferrer" className="ml-3 font-semibold text-sky-700 hover:underline">
                            Otevřít PDF
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-slate-900">{navigationNumberFormatter.format(bp.amount)} Kč</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                          {bp.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {canInvoice && currentOrder.status === 'PRIPRAVENO_K_FAKTURACI' && currentOrder.billingPeriods.some((period) => period.status !== 'SENT') && (
                    <button
                      type="button"
                      onClick={() => setShowInvoiceModal(true)}
                      className="mt-3 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-sm transition"
                    >
                      Náhled dokladu, úprava e-mailu a odeslání faktury
                    </button>
                  )}
                </div>
              )}

              {actionableError && (
                <div className="pt-2">
                  <ActionableResolutionCard
                    title={actionableError.title}
                    message={actionableError.message}
                    missingFields={actionableError.missingFields}
                    severity="error"
                    primaryAction={
                      actionableError.errorType === 'MISSING_INVOICE_DATA' && actionableError.resolution?.target === 'company'
                        ? {
                            label: '✏️ Rychle doplnit firemní údaje a vystavit fakturu',
                            onClick: () => setShowCompanyModal(true),
                          }
                        : actionableError.errorType === 'MISSING_CLIENT_EMAIL' || actionableError.resolution?.target === 'client'
                        ? {
                            label: actionableError.resolution?.label || 'Doplnit v kartě klienta ↗',
                            href: actionableError.resolution?.url || `/clients/${currentOrder.clientId}`,
                          }
                        : undefined
                    }
                    secondaryAction={
                      actionableError.errorType === 'MISSING_INVOICE_DATA'
                        ? {
                            label: 'Nastavení firmy ↗',
                            href: '/settings/company',
                          }
                        : undefined
                    }
                    onDismiss={() => setActionableError(null)}
                  />
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
                        <span className="text-[10px] text-slate-400">{navigationDateTimeFormatter.format(new Date(log.createdAt))}</span>
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

      {/* Modal: Quick Company Settings */}
      <QuickCompanySettingsModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        missingFields={actionableError?.missingFields || []}
        initialData={actionableError?.supplierData}
        actionLabel="Uložit údaje a vystavit fakturu"
        onSuccess={async () => {
          await handleCreateAndSendInvoice();
        }}
      />

      {/* Modal: Navigation Invoice Drafting & Delivery */}
      {showInvoiceModal && (
        <NavigationInvoiceModal
          orderId={currentOrder.id}
          orderNumber={currentOrder.orderNumber}
          orderTitle={currentOrder.targetName || currentOrder.title || ''}
          clientName={currentOrder.clientName}
          initialRecipientEmail={currentOrder.contactEmail}
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={async (result) => {
            setShowInvoiceModal(false);
            setSuccessMsg(
              `Faktura ${result.invoiceNumber} byla úspěšně zpracována${result.delivered ? ' a odeslána na e-mail klienta.' : '.'}`
            );
            try {
              const res = await fetch(`/api/navigation/orders/${currentOrder.id}`);
              const json = await res.json();
              if (res.ok && json.success && json.order) {
                setCurrentOrder(json.order);
              }
            } catch {
              // Ignore refresh error
            }
          }}
        />
      )}

      {/* Modal: Edit Contact Details & Sync with CRM */}
      <NavigationContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        orderId={currentOrder.id}
        clientId={currentOrder.clientId}
        clientName={currentOrder.clientName}
        initialContactPerson={currentOrder.contactPerson}
        initialContactEmail={currentOrder.contactEmail}
        initialContactPhone={currentOrder.contactPhone}
        initialAssignedUserId={currentOrder.assignedUserId}
        salesUsers={salesUsers}
        onSuccess={(updatedOrder) => {
          setCurrentOrder(updatedOrder);
          setSuccessMsg('✅ Kontaktní údaje byly úspěšně uloženy do CRM i zakázky.');
        }}
      />

      {/* Modal: Edit Schedule, Dates & Client Order Code */}
      <NavigationScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        orderId={currentOrder.id}
        orderNumber={currentOrder.orderNumber}
        clientName={currentOrder.clientName}
        initialRentStart={currentOrder.rentStart}
        initialRentEnd={currentOrder.rentEnd}
        initialInstallationDate={currentOrder.installationDate}
        initialDeinstallationDate={currentOrder.deinstallationDate}
        initialClientOrderCode={currentOrder.clientOrderCode}
        initialTargetNote={currentOrder.targetNote}
        onSuccess={(updatedOrder) => {
          setCurrentOrder(updatedOrder);
          setQuickInstallationDate(updatedOrder.installationDate ? new Date(updatedOrder.installationDate).toISOString().slice(0, 10) : '');
          setSuccessMsg('✅ Termíny a harmonogram zakázky byly úspěšně uloženy.');
        }}
      />

    </div>
  );
}
