'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, ExternalLink, Plus, Check } from 'lucide-react';
import type { Carrier } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { useOfferBasket } from '@/context/OfferBasketContext';

function getCarrierBadgeMeta(type: Carrier['type']) {
  switch (type) {
    case 'NAVIGATION':
      return { label: '🧭 Navigační tabule', badgeClass: 'bg-sky-100 text-sky-900 border-sky-300' };
    case 'PROMO_BENCH':
      return { label: '🪑 Reklamní Lavička', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'CITY_POSTER':
      return { label: '🖼️ City Poster (CLP)', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300' };
    case 'CITYLIGHT':
      return { label: '💡 Citylight', badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300' };
    case 'PROMO_TOWER':
      return { label: '🗼 Promo Tower', badgeClass: 'bg-teal-100 text-teal-900 border-teal-300' };
    case 'PROMO_HORIZON':
      return { label: '🌅 Promo Horizon', badgeClass: 'bg-orange-100 text-orange-900 border-orange-300' };
    case 'BILLBOARD':
      return { label: '📐 Billboard', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' };
    case 'BIGBOARD':
      return { label: '🏢 Bigboard', badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'LED_SCREEN':
      return { label: '📺 LED Obrazovka', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    default:
      return { label: `📍 ${type}`, badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}

export function CarrierMapCard({
  carrier,
  onStartLocationEdit,
  onFocusMap,
}: {
  carrier: Carrier;
  onStartLocationEdit: () => void;
  onFocusMap: () => void;
}) {
  const { toggleSurface, isSurfaceSelected } = useOfferBasket();
  const badgeMeta = getCarrierBadgeMeta(carrier.type);

  // Derive status and primary client
  const primarySurface = carrier.surfaces[0];
  const surfaceStatus = primarySurface?.status ?? 'AVAILABLE';
  const primaryClient = primarySurface?.currentClient?.name;

  const hasCoords = typeof carrier.latitude === 'number' && typeof carrier.longitude === 'number';

  // Primary photo from carrier or first surface
  const primaryPhoto =
    carrier.photos?.[0]?.url || primarySurface?.photos?.[0]?.url;

  const inBasket = primarySurface ? isSurfaceSelected(primarySurface.id) : false;

  return (
    <div className="space-y-4">
      {/* Header & Badges */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-black text-white shadow-2xs">
            {carrier.code}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black border ${badgeMeta.badgeClass}`}>
            {badgeMeta.label}
          </span>
        </div>
        <h2 className="text-xl font-black text-slate-950 mt-2 leading-snug">{carrier.name}</h2>
      </div>

      {/* Occupancy Status & Client Info */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-500 uppercase tracking-wide text-[10px]">Stav nosiče & Obsazenost</span>
          <StatusBadge value={surfaceStatus} />
        </div>
        <div className="text-xs pt-1 border-t border-slate-200/60">
          {primaryClient ? (
            <p className="font-extrabold text-slate-900">
              👤 Klient: <span className="text-sky-700">{primaryClient}</span>
            </p>
          ) : (
            <p className="font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300/50 px-2.5 py-1 rounded-xl inline-block">
              ✓ Na tomto nosiči je plocha volná k pronájmu
            </p>
          )}
        </div>
      </div>

      {/* Address & GPS */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1">
        <span className="block font-bold text-slate-400 uppercase tracking-wide text-[10px]">Lokalita & Adresa</span>
        <p className="font-bold text-slate-900">
          {[carrier.street ?? carrier.address, carrier.locality ?? carrier.cadastralArea, carrier.city]
            .filter(Boolean)
            .join(', ') || 'Lokalita neuvedena'}
        </p>
        <p className="text-[11px] text-slate-500 font-mono pt-0.5">
          GPS: {hasCoords ? `${carrier.latitude!.toFixed(6)}, ${carrier.longitude!.toFixed(6)}` : '⚠️ GPS chybí'}
        </p>
      </div>

      {/* Photo Preview Thumbnail */}
      {primaryPhoto ? (
        <div className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-2xs group">
          <img
            src={primaryPhoto}
            alt={carrier.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-400">
          📷 K tomuto nosiči zatím není nahraná fotografie
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="flex gap-2">
          {primarySurface && (
            <button
              type="button"
              onClick={() =>
                toggleSurface({
                  id: primarySurface.id,
                  name: primarySurface.name,
                  carrierId: carrier.id,
                  carrierCode: carrier.code,
                  carrierName: carrier.name,
                  city: carrier.city,
                  price: primarySurface.price,
                  mediaType: primarySurface.mediaType,
                  photoUrl: primaryPhoto,
                })
              }
              className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-black transition shadow-2xs ${
                inBasket
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  : 'border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
              }`}
            >
              {inBasket ? '✓ V nabídce' : '📋 + Do nabídky'}
            </button>
          )}

          <button
            type="button"
            onClick={onStartLocationEdit}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs"
          >
            📍 Upravit polohu
          </button>
        </div>

        <Link
          href={`/carriers/${carrier.id}`}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-950 py-3 text-xs font-black text-white hover:bg-slate-800 transition shadow-md cursor-pointer"
        >
          <span>🔍 Otevřít celý detail nosiče</span>
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  );
}
