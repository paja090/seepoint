'use client';

import { useEffect, useState } from 'react';
import type { Carrier, Client } from '@/lib/types';
import { mediaTypeLabel, carrierTypeLabel } from '@/lib/carrier-filters';
import { CarrierArchiveActions } from './CarrierArchiveActions';
import { LocationMiniMap } from './LocationMiniMap';
import { NavigationSurfaceManager } from './NavigationSurfaceManager';
import { OccupancyActions } from './OccupancyActions';
import { PhotoGallery } from './PhotoGallery';
import { StatusBadge } from './StatusBadge';
import { QrCodeGeneratorModal } from './qr/QrCodeGeneratorModal';
import { useOfferBasket } from '@/context/OfferBasketContext';
import { MapPin, Navigation, Compass, Layers, Monitor, Image, Info, QrCode, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

function getCarrierBadgeMeta(type: Carrier['type']) {
  switch (type) {
    case 'NAVIGATION':
      return { label: '🧭 Navigační tabule (VO / Troleje)', badgeClass: 'bg-sky-100 text-sky-900 border-sky-300' };
    case 'PROMO_BENCH':
      return { label: '🪑 Reklamní Lavička', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'CITY_POSTER':
    case 'CITYLIGHT':
      return { label: '🖼️ City Poster / City Light (CLP)', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300' };
    case 'BILLBOARD':
      return { label: '📐 Billboard (Euroformát 5.1x2.4 m)', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' };
    case 'BIGBOARD':
      return { label: '🏢 Bigboard (9.6x3.6 m)', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'LED_SCREEN':
      return { label: '📺 Digitální LED Obrazovka', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    case 'BANNER':
    case 'FACADE':
      return { label: '🏬 Plachta / Reklamní Fasáda', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300' };
    default:
      return { label: `📍 ${carrierTypeLabel(type)}`, badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}

export function CarrierDetail({
  carrier,
  showLocationMap = false,
  clients = [],
  canEdit = false,
  prevCarrier,
  nextCarrier,
}: {
  carrier: Carrier;
  showLocationMap?: boolean;
  clients?: Array<Pick<Client, 'id' | 'name'>>;
  canEdit?: boolean;
  prevCarrier?: { id: string; code: string; name: string } | null;
  nextCarrier?: { id: string; code: string; name: string } | null;
}) {
  const isNavigation = carrier.type === 'NAVIGATION';
  const badgeMeta = getCarrierBadgeMeta(carrier.type);
  const { toggleSurface, isSurfaceSelected } = useOfferBasket();

  const [resolvingDamage, setResolvingDamage] = useState(false);
  const [damageResolved, setDamageResolved] = useState(false);

  const damagePhotos = [
    ...carrier.photos.filter((p) => p.type === 'DAMAGE'),
    ...carrier.surfaces.flatMap((s) => (s.photos || []).filter((p) => p.type === 'DAMAGE')),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const latestDamagePhoto = damagePhotos[0];
  const hasDamageNote = carrier.note?.includes('[ZÁVADA:') || carrier.note?.includes('ZÁVADA');
  const isDamaged = (damagePhotos.length > 0 || hasDamageNote) && !damageResolved;

  const handleResolveDamage = async () => {
    setResolvingDamage(true);
    try {
      const cleanedNote = (carrier.note || '')
        .replace(/\[ZÁVADA:[^\]]+\]/g, '')
        .replace(/ZÁVADA:[^\n]+/g, '')
        .trim();

      await fetch(`/api/carriers/${carrier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: cleanedNote }),
      });

      setDamageResolved(true);
      window.location.reload();
    } catch (err) {
      console.error('Failed to resolve damage:', err);
    } finally {
      setResolvingDamage(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const campaigns = carrier.surfaces.flatMap((surface) =>
    surface.occupancies.map((occupancy) => ({ ...occupancy, surface: surface.name }))
  );
  
  // Currently active campaign running today (dateFrom <= today && dateTo >= today)
  const activeCampaigns = campaigns.filter(
    (campaign) =>
      ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(campaign.status) &&
      campaign.dateFrom <= todayStr &&
      campaign.dateTo >= todayStr
  );

  // Upcoming reservation in the future (dateFrom > today)
  const upcomingCampaigns = campaigns.filter(
    (campaign) =>
      ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(campaign.status) &&
      campaign.dateFrom > todayStr
  );

  const primaryCampaign = activeCampaigns[0] ?? upcomingCampaigns[0];
  const daysToEnd = primaryCampaign
    ? Math.ceil((new Date(`${primaryCampaign.dateTo}T00:00:00.000Z`).getTime() - Date.now()) / 86_400_000)
    : undefined;

  const coordinates =
    typeof carrier.latitude === 'number' &&
    Number.isFinite(carrier.latitude) &&
    typeof carrier.longitude === 'number' &&
    Number.isFinite(carrier.longitude)
      ? { latitude: carrier.latitude, longitude: carrier.longitude }
      : null;

  const totalPhotosCount = new Set([
    ...carrier.photos.map((p) => p.id),
    ...carrier.surfaces.flatMap((s) => (s.photos || []).map((p) => p.id)),
  ]).size;

  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
      if (e.key === 'ArrowLeft' && prevCarrier) {
        window.location.href = `/carriers/${prevCarrier.id}`;
      } else if (e.key === 'ArrowRight' && nextCarrier) {
        window.location.href = `/carriers/${nextCarrier.id}`;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevCarrier, nextCarrier]);

  return (
    <div className="space-y-6">
      {/* 🧭 Prev / Next Carrier Bar */}
      {(prevCarrier || nextCarrier) && (
        <div className="flex items-center justify-between bg-slate-900 text-white p-2.5 px-3.5 sm:px-4 rounded-2xl border border-slate-800 shadow-md">
          {prevCarrier ? (
            <a
              href={`/carriers/${prevCarrier.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/80 transition"
              title={`Předchozí nosič (Klávesa ←): ${prevCarrier.code} — ${prevCarrier.name}`}
            >
              <ChevronLeft size={16} className="text-amber-400" />
              <span className="font-mono">{prevCarrier.code}</span>
              <span className="hidden md:inline text-slate-400 font-normal text-[11px] truncate max-w-[140px]">({prevCarrier.name})</span>
            </a>
          ) : (
            <span className="text-2xs text-slate-600 font-medium px-2">První nosič</span>
          )}

          <div className="text-center px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Listování v evidenci (Klávesy ← / →)</span>
            <span className="text-xs font-black text-amber-400 font-mono">{carrier.code}</span>
          </div>

          {nextCarrier ? (
            <a
              href={`/carriers/${nextCarrier.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/80 transition"
              title={`Další nosič (Klávesa →): ${nextCarrier.code} — ${nextCarrier.name}`}
            >
              <span className="hidden md:inline text-slate-400 font-normal text-[11px] truncate max-w-[140px]">({nextCarrier.name})</span>
              <span className="font-mono">{nextCarrier.code}</span>
              <ChevronRight size={16} className="text-amber-400" />
            </a>
          ) : (
            <span className="text-2xs text-slate-600 font-medium px-2">Poslední nosič</span>
          )}
        </div>
      )}

      {/* 🚀 Header & Category Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs ${badgeMeta.badgeClass}`}>
              {badgeMeta.label}
            </span>
            <StatusBadge value={carrier.archivedAt ? 'ARCHIVED' : carrier.status} />
            {isDamaged && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-600 text-white border border-rose-700 shadow-sm animate-pulse">
                <AlertTriangle size={14} /> 🚨 ZÁVADA NA PLOŠE
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">{carrier.name}</h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Kód nosiče: <strong className="text-slate-900">{carrier.code}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-sky-500 transition cursor-pointer"
          >
            <QrCode size={15} /> QR Štítek
          </button>
          <a className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition" href="#carrier-form">
            Upravit nosič
          </a>
          <a className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" href="#photo-gallery">
            Fotografie ({totalPhotosCount})
          </a>
          <a className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" href="#surfaces">
            Plochy ({carrier.surfaces.length})
          </a>
          <CarrierArchiveActions carrier={carrier} />
        </div>
      </div>

      {/* 🚨 DAMAGE & REPAIR ALERT BANNER */}
      {isDamaged && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-950/90 p-4 sm:p-5 text-white shadow-xl space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle size={22} className="animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">Aktivní poškození / Závada k opravení</span>
                <h3 className="text-base font-black text-white">⚠️ Na tomto nosiči je nahlášena závada</h3>
              </div>
            </div>
            {latestDamagePhoto?.createdAt && (
              <span className="text-xs font-bold text-rose-200 bg-rose-900/80 px-3 py-1 rounded-xl border border-rose-700/80 self-start sm:self-auto">
                Nahlášeno: {new Date(latestDamagePhoto.createdAt).toLocaleDateString('cs-CZ')}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5 text-xs text-rose-100">
              {latestDamagePhoto?.note && (
                <p className="font-bold text-sm text-white bg-rose-900/60 p-3 rounded-xl border border-rose-800">
                  {latestDamagePhoto.note}
                </p>
              )}
              {!latestDamagePhoto?.note && carrier.note && (
                <p className="font-bold text-sm text-white bg-rose-900/60 p-3 rounded-xl border border-rose-800">
                  {carrier.note}
                </p>
              )}
              {latestDamagePhoto?.capturedByWorkerName && (
                <p className="text-xs text-rose-300 font-medium pt-1">
                  👤 Nahlásil/a z terénu: <strong className="text-white">{latestDamagePhoto.capturedByWorkerName}</strong>
                </p>
              )}
            </div>

            {latestDamagePhoto?.url && (
              <div className="relative group shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={latestDamagePhoto.url}
                  alt="Fotografie poškození"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-rose-400/80 shadow-md cursor-pointer hover:scale-105 transition"
                  onClick={() => window.open(latestDamagePhoto.url, '_blank')}
                />
                <span className="absolute bottom-1 right-1 bg-slate-950/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-slate-700">
                  Detail 🔍
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-rose-800/80 flex flex-wrap items-center justify-between gap-3">
            <span className="text-2xs text-rose-300 font-medium">
              🛠️ Karta vyžaduje výjezd servisu nebo výměnu poškozené části.
            </span>
            <button
              type="button"
              onClick={handleResolveDamage}
              disabled={resolvingDamage}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{resolvingDamage ? 'Ukládám...' : 'Označit závadu jako OPRAVENOU'}</span>
            </button>
          </div>
        </div>
      )}

      <QrCodeGeneratorModal
        carrier={{
          id: carrier.id,
          code: carrier.code,
          name: carrier.name,
          city: carrier.city,
          type: carrier.type,
          structureCode: carrier.structureCode,
        }}
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />

      {carrier.archivedAt && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-900">
          <p className="font-bold">Tento nosič je v současnosti archivovaný.</p>
          <p className="mt-1 text-rose-700">
            Datum archivace: {new Date(carrier.archivedAt).toLocaleDateString('cs-CZ')}
            {carrier.archiveReason ? ` · Důvod: ${carrier.archiveReason}` : ''}
          </p>
        </section>
      )}

      {/* 📊 Spec & Metadata Box */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 grid gap-3 text-xs md:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Adresa & Lokalita</span>
          <p className="font-bold text-slate-950 mt-0.5">
            {[carrier.street ?? carrier.address, carrier.locality ?? carrier.cadastralArea, carrier.city]
              .filter(Boolean)
              .join(', ') || 'Neuvedena'}
          </p>
        </div>

        <div>
          <span className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">GPS Souřadnice</span>
          <p className="font-mono font-bold text-slate-950 mt-0.5">
            {coordinates ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}` : '⚠️ GPS chybí'}
          </p>
        </div>

        {/* 🧭 STRUCTURE CODE - ONLY FOR NAVIGATION CARRIERS */}
        {isNavigation ? (
          <div>
            <span className="block font-bold text-sky-700 uppercase tracking-wide text-[10px]">Uchycení Navigace (VO / Stožár)</span>
            <p className="font-bold text-slate-950 mt-0.5">
              {carrier.structureCode ? `Číslo sloupu: ${carrier.structureCode}` : 'Číslo sloupu neuvedeno'}
              {carrier.mountingType ? ` (${carrier.mountingType})` : ''}
            </p>
          </div>
        ) : (
          <div>
            <span className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Typ reklamního nosiče</span>
            <p className="font-bold text-slate-950 mt-0.5">
              {carrierTypeLabel(carrier.type)} · {carrier.surfaces.length} {carrier.surfaces.length === 1 ? 'plocha' : 'plochy'}
            </p>
          </div>
        )}

        {carrier.placementDescription && (
          <div className="md:col-span-2">
            <span className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Umístění v terénu</span>
            <p className="text-slate-800 font-medium mt-0.5">{carrier.placementDescription}</p>
          </div>
        )}

        {carrier.description && (
          <div className="md:col-span-2">
            <span className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Popis nosiče</span>
            <p className="text-slate-800 font-medium mt-0.5">{carrier.description}</p>
          </div>
        )}

        {carrier.note && (
          <div className="md:col-span-2">
            <span className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Interní poznámka</span>
            <p className="text-slate-800 font-medium mt-0.5">{carrier.note}</p>
          </div>
        )}
      </div>

      {/* 🧭 NAVIGATION-SPECIFIC SURFACE MANAGER VS STANDARD CARRIER OCCUPANCY */}
      {isNavigation ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/30 p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="font-black text-sky-950 text-base flex items-center gap-2">
              <Compass size={18} className="text-sky-600" />
              <span>Správa Navigačních Tabulí & Směrových Šipek</span>
            </h3>
            <p className="text-xs text-sky-800 mt-0.5">
              Navigační cedule umístěné na sloupech VO a trolejového vedení s evidencí šipek, textů a klientů.
            </p>
          </div>
          <NavigationSurfaceManager
            canEdit={canEdit}
            carrierId={carrier.id}
            clients={clients}
            surfaces={carrier.surfaces}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-950 text-sm">Aktuální Kampaň & Obsazenost Plochy</h3>
              <p className="text-xs text-slate-500">Přímá rezervace nebo prodloužení pronájmu pro obchodníka.</p>
            </div>
            {primaryCampaign ? <StatusBadge value={primaryCampaign.status} /> : <StatusBadge value="AVAILABLE" />}
          </div>

          {primaryCampaign ? (
            <div className="grid gap-2 text-xs md:grid-cols-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
              <p><b>Klient:</b> {primaryCampaign.clientName}</p>
              <p><b>Kampaň:</b> {primaryCampaign.campaignName}</p>
              <p><b>Plocha:</b> {primaryCampaign.surface}</p>
              <p><b>Termín:</b> {primaryCampaign.dateFrom} – {primaryCampaign.dateTo}</p>
              <p><b>Do konce:</b> {daysToEnd !== undefined ? `${daysToEnd} dnů` : 'neuvedeno'}</p>
              {primaryCampaign.price && <p><b>Cena:</b> {primaryCampaign.price.toLocaleString('cs-CZ')} Kč</p>}
              {primaryCampaign.note && <p className="md:col-span-2"><b>Poznámka:</b> {primaryCampaign.note}</p>}
            </div>
          ) : (
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              ✓ Na tomto nosiči je plocha plně volná k okamžité rezervaci.
            </p>
          )}

          <OccupancyActions
            activeOccupancy={primaryCampaign}
            clients={clients}
            surfaces={carrier.surfaces.map((surface) => ({ id: surface.id, name: surface.name, price: surface.price }))}
          />
        </section>
      )}

      {showLocationMap && coordinates && (
        <LocationMiniMap
          carrierId={carrier.id}
          carrierName={carrier.name}
          latitude={coordinates.latitude}
          longitude={coordinates.longitude}
        />
      )}

      <div id="photo-gallery" className="scroll-mt-6">
        <PhotoGallery carrierId={carrier.id} carrierPhotos={carrier.photos} surfaces={carrier.surfaces} canEdit={canEdit} />
      </div>

      <section id="surfaces" className="scroll-mt-6">
        <h3 className="mb-2 font-bold text-slate-900 text-sm">Evidované reklamní plochy & Klienti</h3>
        {carrier.surfaces.length > 0 ? (
          <div className="grid gap-2 text-xs md:grid-cols-2">
            {carrier.surfaces.map((surface) => (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-2" key={surface.id}>
                <div>
                  <p className="font-bold text-slate-950">{surface.name}</p>
                  <p className="text-slate-500 mt-0.5">
                    {mediaTypeLabel(surface.mediaType)} · Klient: <strong className="text-slate-800">{surface.currentClient?.name ?? 'bez klienta'}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={surface.status} />
                  <button
                    type="button"
                    onClick={() =>
                      toggleSurface({
                        id: surface.id,
                        name: surface.name,
                        carrierId: carrier.id,
                        carrierCode: carrier.code,
                        carrierName: carrier.name,
                        city: carrier.city,
                        price: surface.price,
                        mediaType: surface.mediaType,
                        photoUrl: surface.photos?.[0]?.url,
                      })
                    }
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
                      isSurfaceSelected(surface.id)
                        ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                        : 'border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                    }`}
                  >
                    {isSurfaceSelected(surface.id) ? '✓ V nabídce' : '📋 + Nabídka'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Žádné evidované plochy.</p>
        )}
      </section>

      <section id="campaign-history" className="scroll-mt-6">
        <h3 className="mb-2 font-bold text-slate-900 text-sm">Historie kampaní a rezervací</h3>
        {campaigns.length > 0 ? (
          <div className="space-y-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <b className="text-slate-950 font-bold">{campaign.campaignName}</b>
                    <StatusBadge value={campaign.status} />
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Klient: {campaign.clientName} · Plocha: {campaign.surface}
                  </p>
                </div>
                <div className="text-right font-mono text-slate-500 shrink-0">
                  {campaign.dateFrom} – {campaign.dateTo}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Historie kampaní zatím není doplněna.</p>
        )}
      </section>
    </div>
  );
}
