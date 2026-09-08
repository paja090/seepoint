'use client';

import { useState } from 'react';
import type { OfferView, OfferItemView } from '@/lib/offers/view-model';
import { CampaignLiveMap } from './CampaignLiveMap';
import { PrintApprovalModule } from './PrintApprovalModule';
import {
  MapPin,
  Calendar,
  Eye,
  CheckCircle2,
  Printer,
  Share2,
  Maximize2,
  X,
  Download,
  Building2,
  ShieldCheck,
  Check,
  Clock,
  Package,
  Camera,
  FileCheck,
  ChevronRight,
  ExternalLink,
  Compass,
  Navigation,
} from 'lucide-react';

interface Props {
  offer: OfferView;
  publicToken?: string;
}

function getPrintJobPhase(status: string) {
  switch (status) {
    case 'PREPARATION':
      return { label: 'Čeká na grafická data', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' };
    case 'CLIENT_APPROVAL':
      return { label: 'Čeká na schválení klientem', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400 animate-pulse' };
    case 'IN_PRINT':
      return { label: 'Ve výrobě (Tiskne se)', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40', dot: 'bg-sky-400 animate-pulse' };
    case 'DELIVERED_TO_WAREHOUSE':
      return { label: 'Naskladněno / K montáži', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' };
    default:
      return null;
  }
}

function formatArrowText(direction?: string | null): string {
  switch (direction) {
    case 'RIGHT':
      return '➡️ Doprava';
    case 'LEFT':
      return '⬅️ Doleva';
    case 'SLIGHT_RIGHT':
      return '↗️ Mírně doprava';
    case 'SLIGHT_LEFT':
      return '↖️ Mírně doleva';
    case 'ROUNDABOUT':
      return '🔄 Kruhový objezd';
    case 'STRAIGHT':
    default:
      return '⬆️ Rovně';
  }
}

function formatDistanceText(point: { distanceSource?: string | null; manualDistanceValue?: number | null; manualDistanceUnit?: string | null; calculatedDistanceMeters?: number | null }): string {
  if (point.distanceSource === 'MANUAL' && point.manualDistanceValue) {
    const unit = point.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm';
    return `${point.manualDistanceValue} ${unit} od cíle`;
  }
  if (typeof point.calculatedDistanceMeters === 'number') {
    if (point.calculatedDistanceMeters >= 1000) {
      return `${(point.calculatedDistanceMeters / 1000).toFixed(1).replace('.', ',')} km od cíle`;
    }
    return `${point.calculatedDistanceMeters} m od cíle`;
  }
  return '';
}

export function CampaignLivePortalView({ offer, publicToken }: Props) {
  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    title: string;
    carrierCode: string;
    address: string;
    format: string;
    isInstallation?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const isNavigation = offer.offerType === 'NAVIGATION' && Boolean(offer.navigation);
  const navPoints = (offer.navigation?.points || []).filter((p) => p.isSelectedByClient !== false);
  const navTarget = offer.navigation ? {
    latitude: offer.navigation.targetLatitude,
    longitude: offer.navigation.targetLongitude,
    name: offer.navigation.targetName,
    address: offer.navigation.targetAddress,
  } : null;

  const items = offer.items || [];
  const clientName = offer.client?.name || 'Klient';
  const campaignTitle = offer.campaignName || offer.title || (isNavigation ? `Navigační systém pro ${offer.navigation?.targetName || 'klienta'}` : 'Venkovní reklamní kampaň');
  const branding = offer.branding;
  const agencyName = branding?.name || 'SeePOINT';
  const realization = offer.realizationSummary;

  const strategy = offer.campaignStrategy as { dateFrom?: string; dateTo?: string } | null | undefined;

  const validDates = items
    .map((item) => ({ from: item.dateFrom ? new Date(item.dateFrom) : null, to: item.dateTo ? new Date(item.dateTo) : null }))
    .filter((d) => d.from && d.to);

  let startDateStr = '-';
  let endDateStr = '-';
  let campaignDays = 0;
  let daysRemaining = 0;

  if (strategy?.dateFrom && strategy?.dateTo) {
    const from = new Date(strategy.dateFrom);
    const to = new Date(strategy.dateTo);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      startDateStr = from.toLocaleDateString('cs-CZ');
      endDateStr = to.toLocaleDateString('cs-CZ');
      const today = new Date();
      campaignDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
      daysRemaining = Math.max(0, Math.ceil((to.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
  } else if (validDates.length > 0) {
    const minDate = new Date(Math.min(...validDates.map((d) => d.from!.getTime())));
    const maxDate = new Date(Math.max(...validDates.map((d) => d.to!.getTime())));
    startDateStr = minDate.toLocaleDateString('cs-CZ');
    endDateStr = maxDate.toLocaleDateString('cs-CZ');
    const today = new Date();
    campaignDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, Math.ceil((maxDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (isNavigation) {
    campaignDays = 365;
    const baseDate = offer.acceptedAt ? new Date(offer.acceptedAt) : new Date(offer.createdAt);
    startDateStr = baseDate.toLocaleDateString('cs-CZ');
    const end = new Date(baseDate);
    end.setFullYear(end.getFullYear() + 1);
    endDateStr = end.toLocaleDateString('cs-CZ');
    const today = new Date();
    daysRemaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const totalUnits = isNavigation ? navPoints.length : items.length;
  const installedNavPoints = navPoints.filter((p) => p.status === 'INSTALLED' || Boolean(p.installedPhotoUrl));
  const installedItems = items.filter((item) => (item.surface.photos ?? []).some((p) => p.isInstallation === true));

  const verifiedCount = isNavigation
    ? (realization ? realization.installed : installedNavPoints.length)
    : (realization ? realization.installed : installedItems.length);

  const estimatedImpressions = isNavigation ? totalUnits * 25000 : totalUnits * 35000;

  let liveStatus = isNavigation ? 'Příprava navigačního značení' : 'Příprava zakázky';
  let liveStatusColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  let liveStatusDot = 'bg-sky-400';

  if (offer.printJob) {
    const phase = getPrintJobPhase(offer.printJob.status);
    if (phase) { liveStatus = phase.label; liveStatusColor = phase.color; liveStatusDot = phase.dot; }
  }
  if (verifiedCount > 0 && verifiedCount < totalUnits) {
    liveStatus = isNavigation ? 'Probíhá montáž na sloupech VO' : 'Probíhá instalace v terénu';
    liveStatusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    liveStatusDot = 'bg-amber-400 animate-pulse';
  } else if (verifiedCount === totalUnits && totalUnits > 0) {
    liveStatus = isNavigation ? 'Navigační systém aktivní v terénu' : 'Kampaň aktivní v terénu';
    liveStatusColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    liveStatusDot = 'bg-emerald-400 animate-pulse';
  }

  const printJob = offer.printJob;
  const printStatus = printJob?.status;
  const isApproved = ['ACCEPTED', 'CONVERTED'].includes(offer.status);
  const hasPrintData = printStatus === 'CLIENT_APPROVAL' || !!printJob?.artworkUrl || (isNavigation && navPoints.some((p) => Boolean(p.visualizedPhotoUrl)));
  const isPrinting = printStatus === 'IN_PRINT';
  const isDelivered = printStatus === 'DELIVERED_TO_WAREHOUSE';
  const isInstalling = verifiedCount > 0 && verifiedCount < totalUnits;
  const isInstalled = verifiedCount === totalUnits && totalUnits > 0;
  const isPhotographed = realization
    ? realization.photographed > 0
    : (isNavigation ? navPoints.some((p) => Boolean(p.installedPhotoUrl)) : isInstalled);
  const isFullyPhotographed = isNavigation
    ? (navPoints.length > 0 && navPoints.every((p) => Boolean(p.installedPhotoUrl)))
    : isInstalled;
  const isCompleted = realization ? realization.completed === realization.total && realization.total > 0 : isInstalled;

  type StepStatus = 'done' | 'active' | 'pending';

  const standardSteps: { icon: React.ReactNode; label: string; sublabel?: string; status: StepStatus }[] = [
    { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Nabídka schválena', sublabel: offer.acceptedAt ? new Date(offer.acceptedAt).toLocaleDateString('cs-CZ') : undefined, status: isApproved ? 'done' : 'pending' },
    { icon: <FileCheck className="h-4 w-4" />, label: 'Tisková data', sublabel: hasPrintData ? 'Grafika nahrána' : printJob ? 'Čeká na grafiku' : 'Čeká na spuštění výroby', status: isPrinting || isDelivered || isInstalling || isInstalled ? 'done' : hasPrintData ? 'active' : 'pending' },
    { icon: <Printer className="h-4 w-4" />, label: 'Ve výrobě', sublabel: isPrinting ? 'Tiskne se...' : isDelivered || isInstalling || isInstalled ? 'Vytisknuto' : undefined, status: isDelivered || isInstalling || isInstalled ? 'done' : isPrinting ? 'active' : 'pending' },
    { icon: <Package className="h-4 w-4" />, label: 'Naskladněno', sublabel: isDelivered || isInstalling || isInstalled ? 'Připraveno k výlepu' : undefined, status: isInstalling || isInstalled ? 'done' : isDelivered ? 'active' : 'pending' },
    { icon: <MapPin className="h-4 w-4" />, label: 'Instalace', sublabel: isInstalled ? `${verifiedCount}/${totalUnits} vylepeno` : isInstalling ? `${verifiedCount}/${totalUnits} probíhá` : undefined, status: isInstalled ? 'done' : isInstalling ? 'active' : 'pending' },
    { icon: <Camera className="h-4 w-4" />, label: 'Fotodokumentace', sublabel: isPhotographed ? 'Fotky k dispozici' : undefined, status: isCompleted ? 'done' : isPhotographed ? 'active' : 'pending' },
    { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Předání a report', sublabel: isCompleted ? 'Dokončeno' : undefined, status: isCompleted ? 'done' : 'pending' },
  ];

  const navigationSteps: { icon: React.ReactNode; label: string; sublabel?: string; status: StepStatus }[] = [
    { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Nabídka schválena', sublabel: offer.acceptedAt ? new Date(offer.acceptedAt).toLocaleDateString('cs-CZ') : undefined, status: isApproved ? 'done' : 'pending' },
    { icon: <FileCheck className="h-4 w-4" />, label: 'Grafický návrh', sublabel: hasPrintData ? 'Návrhy zpracovány' : 'Příprava grafiky', status: hasPrintData || isInstalled ? 'done' : isApproved ? 'active' : 'pending' },
    { icon: <ShieldCheck className="h-4 w-4" />, label: 'Inženýring VO', sublabel: 'Správa sítě a vytyčení', status: isInstalled || isInstalling ? 'done' : isApproved ? 'active' : 'pending' },
    { icon: <Printer className="h-4 w-4" />, label: 'Výroba DIBOND 3 mm', sublabel: isDelivered || isInstalling || isInstalled ? 'Panely vyrobeny' : isPrinting ? 'Ve výrobě' : undefined, status: isDelivered || isInstalling || isInstalled ? 'done' : isPrinting ? 'active' : 'pending' },
    { icon: <MapPin className="h-4 w-4" />, label: 'Montáž na sloupech', sublabel: isInstalled ? `${verifiedCount}/${totalUnits} osazeno (Bandimex)` : isInstalling ? `${verifiedCount}/${totalUnits} probíhá` : undefined, status: isInstalled ? 'done' : isInstalling ? 'active' : 'pending' },
    {
      icon: <Camera className="h-4 w-4" />,
      label: 'Pasport & Foto',
      sublabel: isFullyPhotographed
        ? 'Fotodokumentace hotova'
        : isPhotographed
          ? `${installedNavPoints.length}/${totalUnits} vyfoceno`
          : 'Čeká na montáž v terénu',
      status: isFullyPhotographed ? 'done' : isPhotographed ? 'active' : 'pending',
    },
    { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Předání a dohled', sublabel: isCompleted && isFullyPhotographed ? 'Záruční servis aktivní' : 'Záruční servis a pasport', status: isCompleted && isFullyPhotographed ? 'done' : 'pending' },
  ];

  const steps = isNavigation ? navigationSteps : standardSteps;

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function getItemPhotos(item: OfferItemView) {
    const photos = item.surface.photos ?? [];
    const installationPhotos = photos.filter((p) => p.isInstallation === true);
    const catalogPhotos = photos.filter((p) => !p.isInstallation);
    return { installationPhotos, catalogPhotos, primaryPhoto: installationPhotos[0] ?? catalogPhotos[0] ?? null };
  }

  const itemsWithInstallationPhotos = items.filter((item) => (item.surface.photos ?? []).some((p) => p.isInstallation === true));

  // Build photo cards list for navigation
  const navPhotoCards = isNavigation
    ? navPoints.flatMap((point, idx) => {
        const list: Array<{
          id: string;
          url: string;
          title: string;
          carrierCode: string;
          address: string;
          format: string;
          isInstallation?: boolean;
          badgeText: string;
          badgeColor: string;
          index: number;
        }> = [];

        if (point.installedPhotoUrl) {
          list.push({
            id: `install-${point.id}`,
            url: point.installedPhotoUrl,
            title: point.label || `Sloup VO ${point.pillarNumber || idx + 1}`,
            carrierCode: point.pillarNumber ? `VO ${point.pillarNumber}` : `BOD ${idx + 1}`,
            address: point.address || offer.navigation?.city || 'Ostrava',
            format: point.navigationType || 'Směrová tabule',
            isInstallation: true,
            badgeText: '✓ Osazeno na sloupu VO (Proof of Play)',
            badgeColor: 'bg-emerald-500/90 text-white border-emerald-400',
            index: idx + 1,
          });
        }

        if (point.visualizedPhotoUrl) {
          list.push({
            id: `visual-${point.id}`,
            url: point.visualizedPhotoUrl,
            title: point.label || `Sloup VO ${point.pillarNumber || idx + 1}`,
            carrierCode: point.pillarNumber ? `VO ${point.pillarNumber}` : `BOD ${idx + 1}`,
            address: point.address || offer.navigation?.city || 'Ostrava',
            format: 'Vizualizace SeePOINT',
            isInstallation: false,
            badgeText: '🎨 Schválený grafický návrh',
            badgeColor: 'bg-sky-500/90 text-white border-sky-400',
            index: idx + 1,
          });
        } else if (!point.installedPhotoUrl && point.sitePhotoUrl) {
          list.push({
            id: `site-${point.id}`,
            url: point.sitePhotoUrl,
            title: point.label || `Sloup VO ${point.pillarNumber || idx + 1}`,
            carrierCode: point.pillarNumber ? `VO ${point.pillarNumber}` : `BOD ${idx + 1}`,
            address: point.address || offer.navigation?.city || 'Ostrava',
            format: 'Zaměření sloupu VO',
            isInstallation: false,
            badgeText: '🧭 Zaměření sloupu VO',
            badgeColor: 'bg-slate-700/90 text-white border-slate-600',
            index: idx + 1,
          });
        }

        return list;
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 pb-16 font-sans">
      {/* Print protocol header */}
      <div className="hidden print:block p-8 border-b border-slate-300">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{agencyName}</h1>
            <p className="text-xs text-slate-500">
              {isNavigation ? 'Předávací protokol o provedení městského navigačního značení' : 'Předávací protokol o provedení venkovní reklamní kampaně'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-slate-900">Objednatel: {clientName}</span>
            <p className="text-xs text-slate-500">Kampaň: {campaignTitle}</p>
          </div>
        </div>
      </div>

      {/* Top sticky bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              {branding?.logoUrl ? (
                <img alt={agencyName} className="h-8 max-w-44 object-contain" src={branding.logoUrl} />
              ) : offer.client?.logoUrl ? (
                <img alt={`Logo ${offer.client.name}`} className="h-8 max-w-44 object-contain" src={offer.client.logoUrl} />
              ) : (
                <img alt="SeePOINT" className="h-8 w-auto object-contain" src="/seepoint-logo.svg" />
              )}
            </div>
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <span className="text-xs font-bold text-slate-600 truncate hidden sm:inline">
              {isNavigation ? 'Klientský Portál · Městská navigace (VO)' : 'Klientský Portál Kampaně'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {publicToken && (
              <a
                href={`/offer/${publicToken}?view=proposal`}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition flex items-center gap-1.5 shadow-2xs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Původní nabídka</span>
              </a>
            )}
            <button
              onClick={handleShare}
              type="button"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Zkopírován' : 'Sdílet'}</span>
            </button>
            <button
              onClick={() => window.print()}
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Protokol</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Workflow Timeline */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 print:hidden">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-600" />
            {isNavigation ? 'Průběh realizace navigačního značení' : 'Průběh zakázky'}
          </h2>
          <div className="flex items-start gap-1 overflow-x-auto pb-2">
            {steps.map((step, idx) => {
              const isDone = step.status === 'done';
              const isActive = step.status === 'active';
              return (
                <div key={idx} className="flex items-center gap-1 shrink-0">
                  <div className={`flex flex-col items-center gap-1.5 min-w-[80px] max-w-[100px] ${isDone || isActive ? 'opacity-100' : 'opacity-40'}`}>
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 font-bold transition-all ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-400 text-white'
                          : isActive
                            ? 'bg-sky-600 border-sky-400 text-white ring-4 ring-sky-200'
                            : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] font-extrabold leading-tight ${isDone ? 'text-emerald-700' : isActive ? 'text-sky-700' : 'text-slate-500'}`}>
                        {step.label}
                      </p>
                      {step.sublabel && <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{step.sublabel}</p>}
                    </div>
                  </div>
                  {idx < steps.length - 1 && <ChevronRight className={`h-4 w-4 shrink-0 mt-[-14px] ${isDone ? 'text-emerald-400' : 'text-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        </section>

        {/* Print approval module or Navigation technical spec banner */}
        {offer.printJob && publicToken ? (
          <PrintApprovalModule printJob={offer.printJob} token={publicToken} clientName={clientName} />
        ) : isNavigation ? (
          <div className="rounded-2xl border border-sky-800/40 bg-gradient-to-r from-slate-900 to-sky-950/80 p-6 text-white shadow-sm flex items-start gap-4 print:hidden">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Technická specifikace navigačního systému</h2>
              <p className="mt-1 text-xs text-sky-200 leading-relaxed">
                Panely jsou zhotoveny z prémiového hliníkového sendviče <strong>DIBOND® (tloušťka 3 mm)</strong> s UV stálým potiskem a ochrannou laminací. Uchycení na sloupy veřejného osvětlení je realizováno certifikovaným nerezovým systémem <strong>Bandimex</strong> bez poškození stožáru.
              </p>
            </div>
          </div>
        ) : publicToken && !offer.printJob ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 sm:p-8 flex items-start gap-4 print:hidden">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">Příprava výroby</h2>
              <p className="mt-1 text-sm text-slate-500">
                Obchodník zpracovává Vaši zakázku do produkce. Jakmile bude výroba spuštěna, zobrazí se zde možnost nahrát tisková data a schválit grafiku.
              </p>
            </div>
          </div>
        ) : null}

        {/* Dark Hero Card with Stats */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-sky-900/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-sky-800/60 pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${liveStatusColor}`}>
                  <span className={`w-2 h-2 rounded-full ${liveStatusDot}`} />
                  {liveStatus}
                </span>
                {isNavigation && navTarget && (
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-sky-950/90 text-sky-300 border border-sky-800/60 flex items-center gap-1.5">
                    🎯 Cíl: {navTarget.name}
                  </span>
                )}
                {startDateStr !== '-' && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-900/60 text-sky-200 border border-sky-700/50">
                    {startDateStr} – {endDateStr}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">{campaignTitle}</h1>
              <p className="text-sm text-sky-200 font-medium flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-sky-400" />
                Objednatel: <strong className="text-white font-bold">{clientName}</strong>
                {isNavigation && navTarget?.address && (
                  <span className="text-slate-300 text-xs font-normal">· {navTarget.address}</span>
                )}
              </p>
            </div>
            <div className="bg-slate-900/90 border border-sky-700/60 p-4 rounded-2xl text-center shrink-0">
              {daysRemaining > 0 ? (
                <>
                  <span className="text-[11px] uppercase font-bold text-sky-300 block">
                    {isNavigation ? 'Platnost licence' : 'Do konce kampaně zbývá'}
                  </span>
                  <span className="text-3xl font-black text-white block mt-0.5">{daysRemaining} dní</span>
                  <span className="text-[10px] text-slate-400">Do: {endDateStr}</span>
                </>
              ) : validDates.length > 0 || isNavigation ? (
                <>
                  <span className="text-[11px] uppercase font-bold text-emerald-300 block">Kampaň ukončena</span>
                  <span className="text-3xl font-black text-white block mt-0.5">{campaignDays} dní</span>
                  <span className="text-[10px] text-slate-400">Celková délka</span>
                </>
              ) : (
                <>
                  <span className="text-[11px] uppercase font-bold text-sky-300 block">Termíny</span>
                  <span className="text-3xl font-black text-slate-400 block mt-0.5">-</span>
                  <span className="text-[10px] text-slate-500">Budou upřesněny</span>
                </>
              )}
            </div>
          </div>

          {/* 4 Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-sky-800/40 space-y-1">
              <span className="text-sky-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-sky-400" />
                {isNavigation ? 'Navigační body' : 'Reklamní plochy'}
              </span>
              <div className="text-2xl font-black text-white">
                {totalUnits} {isNavigation ? 'sloupů VO' : 'nosičů'}
              </div>
              <span className="text-[11px] text-slate-400 block">
                {isNavigation ? 'Směrové tabule v síti' : 'Kompletní síť kampaně'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-sky-800/40 space-y-1">
              <span className="text-emerald-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                {isNavigation ? 'Stav osazení' : 'Stav výlepu'}
              </span>
              <div className={`text-2xl font-black ${verifiedCount === totalUnits && totalUnits > 0 ? 'text-emerald-400' : verifiedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {verifiedCount} / {totalUnits}
              </div>
              <span className="text-[11px] text-emerald-300/80 block">
                {verifiedCount === totalUnits && totalUnits > 0
                  ? '100% osazeno v terénu'
                  : verifiedCount === 0
                    ? 'Čeká na montáž'
                    : 'Probíhá montáž'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-sky-800/40 space-y-1">
              <span className="text-sky-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                Odhadovaný zásah
              </span>
              <div className="text-2xl font-black text-white">
                ~ {(estimatedImpressions / 1000).toFixed(0)}k
              </div>
              <span className="text-[11px] text-slate-400 block">
                {isNavigation ? 'Navigovaných řidičů / měsíc' : 'Kontaktů za měsíc'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-sky-800/40 space-y-1">
              <span className="text-amber-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                {isNavigation ? 'Licenční správa' : 'Délka kampaně'}
              </span>
              <div className="text-2xl font-black text-white">
                {campaignDays > 0 ? `${campaignDays} dní` : '-'}
              </div>
              <span className="text-[11px] text-slate-400 block">
                {isNavigation ? 'Dlouhodobé navigační značení' : campaignDays > 0 ? 'Celková délka' : 'Bude upřesněna'}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Map */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-600" />
              {isNavigation ? 'Interaktivní mapa navigačních bodů a trasy k cíli' : 'Interaktivní mapa kampaně v terénu'}
            </h2>
            <span className="text-xs text-slate-500 font-medium hidden sm:block">
              Kliknutím na špendlík zobrazíte fotografii a detail bodu
            </span>
          </div>
          <CampaignLiveMap
            items={items}
            navigationPoints={isNavigation ? navPoints : undefined}
            target={isNavigation ? navTarget : undefined}
          />
        </section>

        {/* Photo Gallery / Proof of Play */}
        {isNavigation && navPhotoCards.length > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  {installedNavPoints.length > 0 ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Fotodokumentace realizace (Proof of Play)
                    </>
                  ) : (
                    <>
                      <Camera className="h-5 w-5 text-sky-600" />
                      Grafické vizualizace a pasport návrhu
                    </>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {installedNavPoints.length > 0
                    ? 'Reálné kontrolní fotografie pořízené montážní četou přímo po osazení na sloupech VO v terénu.'
                    : 'Grafické vizualizace z návrhu nabídky a zaměření sloupů VO. Ostré fotografie hotové montáže (Proof of Play) se zde zobrazí ihned po realizaci v terénu.'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${
                installedNavPoints.length === totalUnits && totalUnits > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : installedNavPoints.length > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {installedNavPoints.length === totalUnits && totalUnits > 0
                  ? 'Všechny body osazeny'
                  : installedNavPoints.length > 0
                    ? `${installedNavPoints.length} z ${totalUnits} osazeno`
                    : 'Čeká na montáž v terénu (zatím návrh)'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {navPhotoCards.map((card) => (
                <div key={card.id} className="group bg-white border border-slate-200/90 rounded-3xl overflow-hidden hover:shadow-lg hover:border-sky-300 transition flex flex-col">
                  <div className="relative aspect-16/10 overflow-hidden bg-slate-950">
                    <div className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-extrabold border ${card.badgeColor}`}>
                      {card.isInstallation ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                      <span>{card.badgeText}</span>
                    </div>
                    <img src={card.url} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-sky-600 text-white font-black text-xs flex items-center justify-center shadow-md border-2 border-white">
                      {card.index}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPhoto({ url: card.url, title: card.title, address: card.address, carrierCode: card.carrierCode, format: card.format, isInstallation: card.isInstallation })}
                      className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                    >
                      <span className="px-3.5 py-2 rounded-xl bg-white/95 text-slate-900 font-bold text-xs shadow-lg flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5 text-sky-600" />
                        Zvětšit fotografii
                      </span>
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-sky-600 uppercase tracking-wide">{card.carrierCode}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-600 text-[10px]">{card.format}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{card.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{card.address}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : !isNavigation && itemsWithInstallationPhotos.length > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Fotodokumentace výlepu (Proof of Play)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reálné kontrolní fotografie pořízené montážní četou přímo po instalaci v terénu.
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${verifiedCount === totalUnits ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {verifiedCount === totalUnits ? 'Všechny plochy ověřeny' : `${verifiedCount} z ${totalUnits} ověřeno`}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {itemsWithInstallationPhotos.map((item, idx) => {
                const carrier = item.surface.carrier;
                const { installationPhotos } = getItemPhotos(item);
                const primaryInstallPhoto = installationPhotos[0];
                const carrierTitle = carrier.name || carrier.address || `Plocha #${idx + 1}`;
                const format = item.surface.mediaType || 'Billboard';
                const locationStr = `${carrier.street ? `${carrier.street}, ` : ''}${carrier.city || ''}`;
                return (
                  <div key={item.id || idx} className="group bg-white border border-slate-200/90 rounded-3xl overflow-hidden hover:shadow-lg hover:border-sky-300 transition flex flex-col">
                    <div className="relative aspect-16/10 overflow-hidden bg-slate-950">
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 backdrop-blur-md text-[11px] font-extrabold text-white border border-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Nainstalováno</span>
                      </div>
                      <img src={primaryInstallPhoto.url} alt={carrierTitle} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-sky-600 text-white font-black text-xs flex items-center justify-center shadow-md border-2 border-white">
                        {idx + 1}
                      </div>
                      {installationPhotos.length > 1 && (
                        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[10px] font-bold">
                          +{installationPhotos.length - 1} fotek
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto({ url: primaryInstallPhoto.url, title: carrierTitle, address: locationStr, carrierCode: carrier.code || 'Neznám', format, isInstallation: true })}
                        className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                      >
                        <span className="px-3.5 py-2 rounded-xl bg-white/95 text-slate-900 font-bold text-xs shadow-lg flex items-center gap-1.5">
                          <Maximize2 className="h-3.5 w-3.5 text-sky-600" />
                          Zvětšit fotografii
                        </span>
                      </button>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-sky-600 uppercase tracking-wide">{carrier.code || 'NOSIČ'}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-600 text-[10px]">{format}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{carrierTitle}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1">{locationStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center print:hidden">
            <Camera className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-black text-slate-600">
              {isNavigation ? 'Fotodokumentace a Pasportizace' : 'Fotodokumentace výlepu'}
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              {isNavigation
                ? 'Jakmile montážní četa osadí panely na sloupech VO a nahraje fotky z terénu, zobrazí se zde jako pasport realizace.'
                : 'Jakmile montážní četa provede instalaci a nahraje fotky z terénu, zobrazí se zde jako Proof of Play.'}
            </p>
          </section>
        )}

        {/* Realization Protocol Table */}
        <section className="bg-white border border-slate-200/90 p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {isNavigation ? 'Soupis navigačních bodů a pasport sloupu VO' : 'Souhrnný protokol o realizaci'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isNavigation
                  ? 'Oficiální pasport osazení směrových panelů na sloupech veřejného osvětlení.'
                  : 'Oficiální soupis reklamních ploch a jejich aktuální stav realizace.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Vytisknout protokol</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            {isNavigation ? (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-3">#</th>
                    <th className="p-3">Sloup VO & Panel</th>
                    <th className="p-3">Lokalita a křižovatka</th>
                    <th className="p-3">Směr & Vzdálenost</th>
                    <th className="p-3">GPS souřadnice</th>
                    <th className="p-3">Materiál</th>
                    <th className="p-3 text-right">Stav osazení</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {navPoints.map((point, idx) => {
                    const isPointInstalled = point.status === 'INSTALLED' || Boolean(point.installedPhotoUrl);
                    const arrowText = formatArrowText(point.arrowDirectionEnum);
                    const distText = formatDistanceText(point);
                    return (
                      <tr key={point.id || idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-bold text-sky-600">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {point.pillarNumber ? `Sloup VO ${point.pillarNumber}` : `Navigační bod #${idx + 1}`}
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {point.navigationType || 'Směrová tabule'}
                          </span>
                        </td>
                        <td className="p-3">
                          <strong className="text-slate-800">{point.address || point.label}</strong>
                          <span className="block text-slate-500 text-[11px]">{offer.navigation?.city || 'Ostrava'}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-800 block">{arrowText}</span>
                          {distText && <span className="text-[11px] text-slate-500">{distText}</span>}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {point.latitude && point.longitude ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : '-'}
                        </td>
                        <td className="p-3 font-medium text-slate-600">
                          DIBOND® 3 mm · Bandimex
                        </td>
                        <td className="p-3 text-right">
                          {isPointInstalled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Osazeno
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sky-600 font-bold">
                              <Clock className="h-3.5 w-3.5" />
                              V přípravě
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-3">#</th>
                    <th className="p-3">Kód & Formát</th>
                    <th className="p-3">Lokalita a adresa</th>
                    <th className="p-3">GPS</th>
                    <th className="p-3">Termín</th>
                    <th className="p-3 text-right">Stav</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const carrier = item.surface.carrier;
                    const { installationPhotos } = getItemPhotos(item);
                    const isItemInstalled = installationPhotos.length > 0;
                    const itemStart = item.dateFrom ? new Date(item.dateFrom).toLocaleDateString('cs-CZ') : startDateStr;
                    const itemEnd = item.dateTo ? new Date(item.dateTo).toLocaleDateString('cs-CZ') : endDateStr;
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-bold text-sky-600">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {carrier.code || 'NOSIČ'}
                          <span className="block text-[10px] text-slate-500 font-normal">{item.surface.mediaType}</span>
                        </td>
                        <td className="p-3">
                          <strong className="text-slate-800">{carrier.name || carrier.address}</strong>
                          <span className="block text-slate-500 text-[11px]">{carrier.street ? `${carrier.street}, ` : ''}{carrier.city}</span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {carrier.latitude && carrier.longitude ? `${carrier.latitude.toFixed(4)}, ${carrier.longitude.toFixed(4)}` : '-'}
                        </td>
                        <td className="p-3 font-medium text-slate-700">{itemStart} – {itemEnd}</td>
                        <td className="p-3 text-right">
                          {isItemInstalled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Vylepeno
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              <Clock className="h-3.5 w-3.5" />
                              Čeká
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Enlarged Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wide">{selectedPhoto.carrierCode} · {selectedPhoto.format}</span>
                  {selectedPhoto.isInstallation && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">
                      Proof of Play
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base leading-tight">{selectedPhoto.title}</h3>
                <p className="text-xs text-slate-400">{selectedPhoto.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img src={selectedPhoto.url} alt={selectedPhoto.title} className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg" />
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold">
                {selectedPhoto.isInstallation ? (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Fotografie ověřena z terénu po montáži (Proof of Play)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <Compass className="h-4 w-4" />
                    Grafická vizualizace / zaměření z návrhu nabídky
                  </span>
                )}
              </span>
              <a
                href={selectedPhoto.url}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Stáhnout originál</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

