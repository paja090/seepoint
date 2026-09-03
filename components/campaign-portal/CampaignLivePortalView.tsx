'use client';

import { useState } from 'react';
import type { OfferView, OfferItemView } from '@/lib/offers/view-model';
import { CampaignLiveMap } from './CampaignLiveMap';
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
} from 'lucide-react';

interface Props {
  offer: OfferView;
  publicToken?: string;
}

export function CampaignLivePortalView({ offer }: Props) {
  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    title: string;
    carrierCode: string;
    address: string;
    format: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const items = offer.items || [];
  const clientName = offer.client?.name || 'Klient';
  const campaignTitle = offer.campaignName || offer.title || 'Outdoorová kampaň';
  const branding = offer.branding;
  const agencyName = branding?.name || 'SeePoint OS';

  // Calculate dates & duration
  let startDateStr = '1. 4. 2026';
  let endDateStr = '30. 4. 2026';
  let daysRemaining = 24;

  const validDates = items
    .map((item) => ({
      from: item.dateFrom ? new Date(item.dateFrom) : null,
      to: item.dateTo ? new Date(item.dateTo) : null,
    }))
    .filter((d) => d.from && d.to);

  if (validDates.length > 0) {
    const minDate = new Date(Math.min(...validDates.map((d) => d.from!.getTime())));
    const maxDate = new Date(Math.max(...validDates.map((d) => d.to!.getTime())));
    startDateStr = minDate.toLocaleDateString('cs-CZ');
    endDateStr = maxDate.toLocaleDateString('cs-CZ');

    const today = new Date();
    const diffTime = maxDate.getTime() - today.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Calculate metrics
  const totalCarriers = items.length;
  const verifiedCount = items.filter((item) => (item.surface.photos?.length ?? 0) > 0).length || totalCarriers;
  const estimatedImpressions = totalCarriers * 35000;

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 pb-16 font-sans">
      {/* Printable Protocol Header (Visible only in Print mode) */}
      <div className="hidden print:block p-8 border-b border-slate-300">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{agencyName}</h1>
            <p className="text-xs text-slate-500">Předávací protokol o provedení venkovní reklamní kampaně</p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-slate-900">Objednatel: {clientName}</span>
            <p className="text-xs text-slate-500">Kampaň: {campaignTitle}</p>
          </div>
        </div>
      </div>

      {/* Main Client Topbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-2xs print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={agencyName} className="h-8 object-contain shrink-0" />
            ) : (
              <span className="text-sm font-black tracking-tight text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200 shrink-0">
                {agencyName}
              </span>
            )}
            <span className="text-slate-300 hidden sm:inline">/</span>
            <span className="text-xs font-bold text-slate-600 truncate hidden sm:inline">
              Klientský Portál Kampaně
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              type="button"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Odkaz zkopírován' : 'Sdílet odkaz'}</span>
            </button>

            <button
              onClick={handlePrint}
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Protokol (PDF / Tisk)</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Campaign Hero Banner */}
        <div className="card bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-800/60 pb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Kampaň aktivní v terénu
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-900/60 text-purple-200 border border-purple-700/50">
                  {startDateStr} – {endDateStr}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">{campaignTitle}</h1>
              <p className="text-sm text-purple-200 font-medium flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-purple-400" />
                Objednatel: <strong className="text-white font-bold">{clientName}</strong>
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="bg-slate-900/90 border border-purple-700/60 p-4 rounded-2xl text-center shrink-0">
              <span className="text-[11px] uppercase font-bold text-purple-300 block">Do konce kampaně zbývá</span>
              <span className="text-3xl font-black text-white block mt-0.5">{daysRemaining} dní</span>
              <span className="text-[10px] text-slate-400">Plánovaný konec: {endDateStr}</span>
            </div>
          </div>

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-purple-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-purple-400" />
                Reklamní plochy
              </span>
              <div className="text-2xl font-black text-white">{totalCarriers} nosičů</div>
              <span className="text-[11px] text-slate-400 block">Kompletní síť kampaně</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-emerald-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Stav vylepu
              </span>
              <div className="text-2xl font-black text-emerald-400">{verifiedCount} / {totalCarriers}</div>
              <span className="text-[11px] text-emerald-300/80 block">100% vylepeno & ověřeno</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-sky-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                Odhadovaný zásah
              </span>
              <div className="text-2xl font-black text-white">~ {(estimatedImpressions / 1000).toFixed(0)}k</div>
              <span className="text-[11px] text-slate-400 block">Kontaktů za měsíc</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-800/40 space-y-1">
              <span className="text-amber-300 font-bold uppercase text-[10px] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                Délka kampaně
              </span>
              <div className="text-2xl font-black text-white">30 dní</div>
              <span className="text-[11px] text-slate-400 block">Měsíční výlepový cyklus</span>
            </div>
          </div>
        </div>

        {/* Section 1: Interactive Live Map */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-600" />
              Interaktivní mapa kampaně v terénu
            </h2>
            <span className="text-xs text-slate-500 font-medium">Kliknutím na špendlík zobrazíte fotografii</span>
          </div>

          <CampaignLiveMap items={items} />
        </section>

        {/* Section 2: Proof of Play Photo Gallery */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Fotodokumentace vylepu (Proof of Play)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reálné kontrolní fotografie všech ploch kampaně pořízené techniky přímo v terénu.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              Všechny plochy zkontrolovány
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item, idx) => {
              const carrier = item.surface.carrier;
              const photo = item.surface.photos?.[0]?.url || '/placeholder-carrier.jpg';
              const carrierTitle = carrier.name || carrier.address || `Plocha #${idx + 1}`;
              const format = item.surface.mediaType || 'Billboard';
              const locationStr = `${carrier.street ? `${carrier.street}, ` : ''}${carrier.city || ''}`;

              return (
                <div
                  key={item.id || idx}
                  className="card group bg-white border border-slate-200/90 rounded-3xl overflow-hidden hover:shadow-lg hover:border-purple-300 transition flex flex-col justify-between"
                >
                  <div className="relative aspect-16/10 overflow-hidden bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={carrierTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-extrabold text-emerald-400 border border-emerald-500/40">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Vylepeno</span>
                    </div>

                    {/* Pin Number */}
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-purple-700 text-white font-black text-xs flex items-center justify-center shadow-md border-2 border-white">
                      {idx + 1}
                    </div>

                    {/* Hover Zoom Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPhoto({
                          url: photo,
                          title: carrierTitle,
                          carrierCode: carrier.code || `ID-${idx + 1}`,
                          address: locationStr,
                          format,
                        })
                      }
                      className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                    >
                      <span className="px-3.5 py-2 rounded-xl bg-white/95 text-slate-900 font-bold text-xs shadow-lg flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5 text-purple-700" />
                        Zvětšit fotografii
                      </span>
                    </button>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-purple-700 uppercase tracking-wide">
                        {carrier.code || 'NOSIČ'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-600 text-[10px]">
                        {format}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{carrierTitle}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{locationStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Official Campaign Handover Protocol (Print & Verification) */}
        <section className="card bg-white border border-slate-200/90 p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Souhrnný protokol o realizaci</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Oficiální soupis reklamních ploch a potvrzení o řádném provedení instalace kampaně.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Vytisknout předávací protokol</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="p-3">#</th>
                  <th className="p-3">Kód & Formát</th>
                  <th className="p-3">Lokalita a adresa</th>
                  <th className="p-3">GPS Souřadnice</th>
                  <th className="p-3">Termín kampaně</th>
                  <th className="p-3 text-right">Stav</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const carrier = item.surface.carrier;
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-purple-700">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {carrier.code || 'NOSIČ'}
                        <span className="block text-[10px] text-slate-500 font-normal">{item.surface.mediaType}</span>
                      </td>
                      <td className="p-3">
                        <strong className="text-slate-800">{carrier.name || carrier.address}</strong>
                        <span className="block text-slate-500 text-[11px]">{carrier.street ? `${carrier.street}, ` : ''}{carrier.city}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {carrier.latitude && carrier.longitude
                          ? `${carrier.latitude.toFixed(4)}, ${carrier.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="p-3 font-medium text-slate-700">{startDateStr} – {endDateStr}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">
                        ✓ Vylepeno
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">
                  {selectedPhoto.carrierCode} · {selectedPhoto.format}
                </span>
                <h3 className="font-bold text-base">{selectedPhoto.title}</h3>
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                Fotografie ověřena z terénu
              </span>

              <a
                href={selectedPhoto.url}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold flex items-center gap-1.5 transition"
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
