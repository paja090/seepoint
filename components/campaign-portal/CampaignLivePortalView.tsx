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
} from 'lucide-react';

interface Props {
  offer: OfferView;
  publicToken?: string;
}

function getPrintJobPhase(status: string) {
  switch (status) {
    case 'PREPARATION':
      return { label: 'Ceka na graficka data', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400' };
    case 'CLIENT_APPROVAL':
      return { label: 'Ceka na schvaleni klientem', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-400 animate-pulse' };
    case 'IN_PRINT':
      return { label: 'Ve vyrobe (Tiskne se)', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', dot: 'bg-blue-400 animate-pulse' };
    case 'DELIVERED_TO_WAREHOUSE':
      return { label: 'Naskladneno / K vylepu', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-400' };
    default:
      return null;
  }
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

  const items = offer.items || [];
  const clientName = offer.client?.name || 'Klient';
  const campaignTitle = offer.campaignName || offer.title || 'Outdoorova kampan';
  const branding = offer.branding;
  const agencyName = branding?.name || 'SeePoint OS';
  const realization = offer.realizationSummary;

  const validDates = items
    .map((item) => ({ from: item.dateFrom ? new Date(item.dateFrom) : null, to: item.dateTo ? new Date(item.dateTo) : null }))
    .filter((d) => d.from && d.to);

  let startDateStr = '-';
  let endDateStr = '-';
  let campaignDays = 0;
  let daysRemaining = 0;

  if (validDates.length > 0) {
    const minDate = new Date(Math.min(...validDates.map((d) => d.from!.getTime())));
    const maxDate = new Date(Math.max(...validDates.map((d) => d.to!.getTime())));
    startDateStr = minDate.toLocaleDateString('cs-CZ');
    endDateStr = maxDate.toLocaleDateString('cs-CZ');
    const today = new Date();
    campaignDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, Math.ceil((maxDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const totalCarriers = items.length;
  const installedItems = items.filter((item) => (item.surface.photos ?? []).some((p) => p.isInstallation === true));
  const verifiedCount = installedItems.length;
  const estimatedImpressions = totalCarriers * 35000;

  let liveStatus = 'Priprava zakazky';
  let liveStatusColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  let liveStatusDot = 'bg-sky-400';

  if (offer.printJob) {
    const phase = getPrintJobPhase(offer.printJob.status);
    if (phase) { liveStatus = phase.label; liveStatusColor = phase.color; liveStatusDot = phase.dot; }
  }
  if (verifiedCount > 0 && verifiedCount < totalCarriers) {
    liveStatus = 'Probiha instalace v terenu';
    liveStatusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    liveStatusDot = 'bg-amber-400 animate-pulse';
  } else if (verifiedCount === totalCarriers && totalCarriers > 0) {
    liveStatus = 'Kampan aktivni v terenu';
    liveStatusColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    liveStatusDot = 'bg-emerald-400 animate-pulse';
  }

  const printJob = offer.printJob;
  const printStatus = printJob?.status;
  const isApproved = ['ACCEPTED', 'CONVERTED'].includes(offer.status);
  const hasPrintData = printStatus === 'CLIENT_APPROVAL' || !!printJob?.artworkUrl;
  const isPrinting = printStatus === 'IN_PRINT';
  const isDelivered = printStatus === 'DELIVERED_TO_WAREHOUSE';
  const isInstalling = verifiedCount > 0 && verifiedCount < totalCarriers;
  const isInstalled = verifiedCount === totalCarriers && totalCarriers > 0;
  const isPhotographed = realization ? realization.photographed > 0 : isInstalled;
  const isCompleted = realization ? realization.completed === realization.total && realization.total > 0 : false;

  type StepStatus = 'done' | 'active' | 'pending';
  const steps: { icon: React.ReactNode; label: string; sublabel?: string; status: StepStatus }[] = [
    { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Nabidka schvalena', sublabel: offer.acceptedAt ? new Date(offer.acceptedAt).toLocaleDateString('cs-CZ') : undefined, status: isApproved ? 'done' : 'pending' },
    { icon: <FileCheck className="h-4 w-4" />, label: 'Tiskova data', sublabel: hasPrintData ? 'Grafika nahrana' : printJob ? 'Ceka na grafiku' : 'Ceka na spusteni vyroby', status: isPrinting || isDelivered || isInstalling || isInstalled ? 'done' : hasPrintData ? 'active' : 'pending' },
    { icon: <Printer className="h-4 w-4" />, label: 'Ve vyrobe', sublabel: isPrinting ? 'Tiskne se...' : isDelivered || isInstalling || isInstalled ? 'Vytisknuto' : undefined, status: isDelivered || isInstalling || isInstalled ? 'done' : isPrinting ? 'active' : 'pending' },
    { icon: <Package className="h-4 w-4" />, label: 'Naskladneno', sublabel: isDelivered || isInstalling || isInstalled ? 'Pripraveno k vylepu' : undefined, status: isInstalling || isInstalled ? 'done' : isDelivered ? 'active' : 'pending' },
    { icon: <MapPin className="h-4 w-4" />, label: 'Instalace', sublabel: isInstalled ? `${verifiedCount}/${totalCarriers} vylepeno` : isInstalling ? `${verifiedCount}/${totalCarriers} probiha` : undefined, status: isInstalled ? 'done' : isInstalling ? 'active' : 'pending' },
    { icon: <Camera className="h-4 w-4" />, label: 'Fotodokumentace', sublabel: isPhotographed ? 'Fotky k dispozici' : undefined, status: isCompleted ? 'done' : isPhotographed ? 'active' : 'pending' },
    { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Predani a report', sublabel: isCompleted ? 'Dokonceno' : undefined, status: isCompleted ? 'done' : 'pending' },
  ];

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

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 pb-16 font-sans">
      <div className="hidden print:block p-8 border-b border-slate-300">
        <div className="flex justify-between items-start">
          <div><h1 className="text-2xl font-bold">{agencyName}</h1><p className="text-xs text-slate-500">Predavaci protokol o provedeni venkovni reklamni kampane</p></div>
          <div className="text-right"><span className="text-sm font-bold text-slate-900">Objednatel: {clientName}</span><p className="text-xs text-slate-500">Kampan: {campaignTitle}</p></div>
        </div>
      </div>

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
            <span className="text-xs font-bold text-slate-600 truncate hidden sm:inline">Klientsky Portal Kampane</span>
          </div>
          <div className="flex items-center gap-2">
            {publicToken && (
              <a href={`/offer/${publicToken}?view=proposal`} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-500 transition flex items-center gap-1.5 shadow-2xs">
                <ExternalLink className="h-3.5 w-3.5" /><span className="hidden sm:inline">Puvodni nabidka</span>
              </a>
            )}
            <button onClick={handleShare} type="button" className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Zkopirovan' : 'Sdilet'}</span>
            </button>
            <button onClick={() => window.print()} type="button" className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs">
              <Printer className="h-3.5 w-3.5" /><span>Protokol</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 print:hidden">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Clock className="h-4 w-4" />Prubeh zakazky
          </h2>
          <div className="flex items-start gap-1 overflow-x-auto pb-2">
            {steps.map((step, idx) => {
              const isDone = step.status === 'done';
              const isActive = step.status === 'active';
              return (
                <div key={idx} className="flex items-center gap-1 shrink-0">
                  <div className={`flex flex-col items-center gap-1.5 min-w-[80px] max-w-[96px] ${isDone || isActive ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 font-bold transition-all ${isDone ? 'bg-emerald-500 border-emerald-400 text-white' : isActive ? 'bg-purple-600 border-purple-400 text-white ring-4 ring-purple-200' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      {step.icon}
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] font-extrabold leading-tight ${isDone ? 'text-emerald-700' : isActive ? 'text-purple-700' : 'text-slate-500'}`}>{step.label}</p>
                      {step.sublabel && <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{step.sublabel}</p>}
                    </div>
                  </div>
                  {idx < steps.length - 1 && <ChevronRight className={`h-4 w-4 shrink-0 mt-[-14px] ${isDone ? 'text-emerald-400' : 'text-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        </section>

        {offer.printJob && publicToken ? (
          <PrintApprovalModule printJob={offer.printJob} token={publicToken} clientName={clientName} />
        ) : publicToken && !offer.printJob ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 sm:p-8 flex items-start gap-4 print:hidden">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0"><Printer className="w-5 h-5 text-purple-500" /></div>
            <div>
              <h2 className="text-base font-black text-slate-800">Priprava vyroby</h2>
              <p className="mt-1 text-sm text-slate-500">Obchodnik zpracovava Vasi zakazku do produkce. Jakmile bude vyroba spustena, zobrazí se zde moznost nahrat tiskova data a schvalit grafiku.</p>
            </div>
          </div>
        ) : null}

        <div className="bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-800/60 pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border ${liveStatusColor}`}>
                  <span className={`w-2 h-2 rounded-full ${liveStatusDot}`} />{liveStatus}
                </span>
                {validDates.length > 0 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-900/60 text-purple-200 border border-purple-700/50">{startDateStr} - {endDateStr}</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">{campaignTitle}</h1>
              <p className="text-sm text-purple-200 font-medium flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-purple-400" />Objednatel: <strong className="text-white font-bold">{clientName}</strong>
              </p>
            </div>
            <div className="bg-slate-900/90 border border-purple-700/60 p-4 rounded-2xl text-center shrink-0">
              {daysRemaining > 0 ? (
                <><span className="text-[11px] uppercase font-bold text-purple-300 block">Do konce kampane zbyva</span><span className="text-3xl font-black text-white block mt-0.5">{daysRemaining} dni</span><span className="text-[10px] text-slate-400">Planovany konec: {endDateStr}</span></>
              ) : validDates.length > 0 ? (
                <><span className="text-[11px] uppercase font-bold text-emerald-300 block">Kampan ukoncena</span><span className="text-3xl font-black text-white block mt-0.5">{campaignDays} dni</span><span className="text-[10px] text-slate-400">Celkova delka kampane</span></>
              ) : (
                <><span className="text-[11px] uppercase font-bold text-purple-300 block">Terminy</span><span className="text-3xl font-black text-slate-400 block mt-0.5">-</span><span className="text-[10px] text-slate-500">Budou upresneny</span></>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-purple-300 font-bold uppercase text-[10px] flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-purple-400" />Reklamni plochy</span>
              <div className="text-2xl font-black text-white">{totalCarriers} nosicu</div>
              <span className="text-[11px] text-slate-400 block">Kompletni sit kampane</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-emerald-300 font-bold uppercase text-[10px] flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />Stav vylepu</span>
              <div className={`text-2xl font-black ${verifiedCount === totalCarriers && totalCarriers > 0 ? 'text-emerald-400' : verifiedCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>{verifiedCount} / {totalCarriers}</div>
              <span className="text-[11px] text-emerald-300/80 block">{verifiedCount === totalCarriers && totalCarriers > 0 ? '100% overeno v terenu' : verifiedCount === 0 ? 'Ceka na instalaci' : 'Probiha instalace'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-sky-300 font-bold uppercase text-[10px] flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-sky-400" />Odhadovany zasah</span>
              <div className="text-2xl font-black text-white">~ {(estimatedImpressions / 1000).toFixed(0)}k</div>
              <span className="text-[11px] text-slate-400 block">Kontaktu za mesic</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-amber-300 font-bold uppercase text-[10px] flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-amber-400" />Delka kampane</span>
              <div className="text-2xl font-black text-white">{campaignDays > 0 ? `${campaignDays} dni` : '-'}</div>
              <span className="text-[11px] text-slate-400 block">{campaignDays > 0 ? 'Celkova delka' : 'Bude upresnena'}</span>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><MapPin className="h-5 w-5 text-purple-600" />Interaktivni mapa kampane v terenu</h2>
            <span className="text-xs text-slate-500 font-medium hidden sm:block">Kliknutim na spendlik zobrazite fotografii</span>
          </div>
          <CampaignLiveMap items={items} />
        </section>

        {itemsWithInstallationPhotos.length > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Fotodokumentace vylepu (Proof of Play)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Realne kontrolni fotografie porizene montazni cetou primo po instalaci v terenu.</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${verifiedCount === totalCarriers ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {verifiedCount === totalCarriers ? 'Vsechny plochy overeny' : `${verifiedCount} z ${totalCarriers} overeno`}
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
                  <div key={item.id || idx} className="group bg-white border border-slate-200/90 rounded-3xl overflow-hidden hover:shadow-lg hover:border-purple-300 transition flex flex-col">
                    <div className="relative aspect-16/10 overflow-hidden bg-slate-950">
                      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/90 backdrop-blur-md text-[11px] font-extrabold text-white border border-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /><span>Nainstalovano</span>
                      </div>
                      <img src={primaryInstallPhoto.url} alt={carrierTitle} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-purple-700 text-white font-black text-xs flex items-center justify-center shadow-md border-2 border-white">{idx + 1}</div>
                      {installationPhotos.length > 1 && <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[10px] font-bold">+{installationPhotos.length - 1} fotek</div>}
                      <button type="button" onClick={() => setSelectedPhoto({ url: primaryInstallPhoto.url, title: carrierTitle, address: locationStr, carrierCode: carrier.code || 'Neznam', format, isInstallation: true })} className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                        <span className="px-3.5 py-2 rounded-xl bg-white/95 text-slate-900 font-bold text-xs shadow-lg flex items-center gap-1.5"><Maximize2 className="h-3.5 w-3.5 text-purple-700" />Zvetsit fotografii</span>
                      </button>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-purple-700 uppercase tracking-wide">{carrier.code || 'NOSIC'}</span>
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
            <h2 className="text-base font-black text-slate-600">Fotodokumentace vylepu</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">Jakmile montazni ceta provede instalaci a nahraje fotky z terenu, zobrazı se zde jako Proof of Play.</p>
          </section>
        )}

        <section className="bg-white border border-slate-200/90 p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Souhrnny protokol o realizaci</h2>
              <p className="text-xs text-slate-500 mt-0.5">Oficialní soupis reklamnich ploch a jejich aktualní stav realizace.</p>
            </div>
            <button type="button" onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shrink-0">
              <Printer className="h-3.5 w-3.5" /><span>Vytisknout protokol</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="p-3">#</th><th className="p-3">Kod & Format</th><th className="p-3">Lokalita a adresa</th><th className="p-3">GPS</th><th className="p-3">Termin</th><th className="p-3 text-right">Stav</th>
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
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-purple-700">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{carrier.code || 'NOSIC'}<span className="block text-[10px] text-slate-500 font-normal">{item.surface.mediaType}</span></td>
                      <td className="p-3"><strong className="text-slate-800">{carrier.name || carrier.address}</strong><span className="block text-slate-500 text-[11px]">{carrier.street ? `${carrier.street}, ` : ''}{carrier.city}</span></td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">{carrier.latitude && carrier.longitude ? `${carrier.latitude.toFixed(4)}, ${carrier.longitude.toFixed(4)}` : '-'}</td>
                      <td className="p-3 font-medium text-slate-700">{itemStart} - {itemEnd}</td>
                      <td className="p-3 text-right">{isItemInstalled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 className="h-3.5 w-3.5" />Vylepeno</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold"><Clock className="h-3.5 w-3.5" />Ceka</span>
                      )}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">{selectedPhoto.carrierCode} - {selectedPhoto.format}</span>
                  {selectedPhoto.isInstallation && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">Proof of Play</span>}
                </div>
                <h3 className="font-bold text-base leading-tight">{selectedPhoto.title}</h3>
                <p className="text-xs text-slate-400">{selectedPhoto.address}</p>
              </div>
              <button type="button" onClick={() => setSelectedPhoto(null)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img src={selectedPhoto.url} alt={selectedPhoto.title} className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg" />
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold"><CheckCircle2 className="h-4 w-4" />Fotografie overena z terenu</span>
              <a href={selectedPhoto.url} target="_blank" rel="noreferrer" download className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold flex items-center gap-1.5 transition">
                <Download className="h-3.5 w-3.5" /><span>Stahnout original</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
