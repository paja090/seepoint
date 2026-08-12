'use client';

import { DollarSign, TrendingUp, Percent, PanelsTopLeft, Building2, Calendar, Award } from 'lucide-react';
function getCarrierBadgeMeta(type: string) {
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
    default:
      return { label: `📍 ${type}`, badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' };
  }
}

type AnalyticsDashboardProps = {
  metrics: {
    totalRevenue: number;
    totalCarriers: number;
    totalSurfaces: number;
    occupiedSurfaces: number;
    overallOccupancyRate: number;
    avgPricePerSurface: number;
  };
  typeList: Array<{
    type: string;
    surfaceCount: number;
    occupiedCount: number;
    occupancyRate: number;
    revenue: number;
  }>;
  cityList: Array<{
    city: string;
    carrierCount: number;
    surfaceCount: number;
    occupiedCount: number;
    occupancyRate: number;
    revenue: number;
  }>;
  recentOccupancies: Array<{
    id: string;
    clientName: string;
    campaignName: string;
    status: string;
    price: number;
    dateFrom: string;
    dateTo: string;
  }>;
};

export function AnalyticsDashboard({
  metrics,
  typeList,
  cityList,
  recentOccupancies,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <span className="text-xs font-bold text-sky-700 uppercase tracking-widest block mb-1">
          📊 Finanční & Provozní Analýza
        </span>
        <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
          Analytics & Přehled Tržeb SeePOINT
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Analýza vytíženosti reklamních nosičů, výnosnosti měsíčních nájmů a žebříček ziskovosti měst.
        </p>
      </div>

      {/* 4 TOP KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Monthly Revenue */}
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-teal-700 p-5 text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between text-emerald-100">
            <span className="text-xs font-black uppercase tracking-wider">Měsíční tržby</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight">{Math.round(metrics.totalRevenue).toLocaleString('cs-CZ')} Kč</p>
          <p className="text-[11px] font-semibold text-emerald-100">Z aktivně obsazených reklamních ploch</p>
        </div>

        {/* Card 2: Overall Occupancy Rate */}
        <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-600 to-indigo-700 p-5 text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between text-sky-100">
            <span className="text-xs font-black uppercase tracking-wider">Celková obsazenost</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white">
              <Percent size={20} />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight">{metrics.overallOccupancyRate}%</p>
          <p className="text-[11px] font-semibold text-sky-100">{metrics.occupiedSurfaces} z {metrics.totalSurfaces} ploch obsazeno</p>
        </div>

        {/* Card 3: Avg Price Per Surface */}
        <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg space-y-2">
          <div className="flex items-center justify-between text-amber-100">
            <span className="text-xs font-black uppercase tracking-wider">Průměrný nájem / plocha</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight">{Math.round(metrics.avgPricePerSurface).toLocaleString('cs-CZ')} Kč</p>
          <p className="text-[11px] font-semibold text-amber-100">Průměrná měsíční cenová hladina</p>
        </div>

        {/* Card 4: Database Infrastructure */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Databáze nosičů</span>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-800">
              <PanelsTopLeft size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-950">{metrics.totalCarriers} nosičů</p>
          <p className="text-[11px] font-bold text-slate-500">{metrics.totalSurfaces} samostatných reklamních ploch</p>
        </div>
      </div>

      {/* SECTION 2: REVENUE & OCCUPANCY BY CARRIER TYPE */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Vytíženost & Tržby podle Typu Nosičů</h2>
            <p className="text-xs font-semibold text-slate-500">Porovnání ziskovosti laviček, navigace VO, billboardů a LED obrazovek.</p>
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {typeList.length} kategorií
          </span>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-950 flex items-start gap-2.5">
          <span className="text-base">🧭</span>
          <div>
            <strong className="font-extrabold block">Logika výpočtu Měsíčních Nájmů (MRR) & Obsazenosti:</strong>
            <p className="text-[11px] text-sky-900 mt-0.5 font-medium leading-relaxed">
              Systém u všech reklamních i navigačních nosičů započítává <strong>výhradně stálý měsíční nájem</strong> po dobu platnosti smlouvy. Jednorázové poplatky za výrobu grafiky, tisk, montáž nebo demontáž se do opakovaného měsíčního výnosu nezapočítávají.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {typeList.map((t) => {
            const badge = getCarrierBadgeMeta(t.type);
            return (
              <div key={t.type} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 shadow-2xs hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black border ${badge.badgeClass}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">{t.occupancyRate}% obsazeno</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${t.occupancyRate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-bold">{t.occupiedCount} z {t.surfaceCount} ploch</span>
                  <span className="font-black text-slate-900">{Math.round(t.revenue).toLocaleString('cs-CZ')} Kč / měsíc</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: TOP CITIES & LOCATIONS BY REVENUE */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Top Města & Lokality Podle Ziskovosti</h2>
              <p className="text-xs font-semibold text-slate-500">Žebříček měst s nejvyšším měsíčním výnosem a vytížením.</p>
            </div>
          </div>
          <span className="rounded-xl bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
            Top 12 Lokalita
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
              <tr>
                <th className="py-2 pr-3">Pořadí & Město</th>
                <th className="py-2 pr-3">Počet Nosičů</th>
                <th className="py-2 pr-3">Reklamní Plochy</th>
                <th className="py-2 pr-3">Obsazenost (%)</th>
                <th className="py-2 pr-3">Měsíční Výnos (Kč)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {cityList.map((c, index) => (
                <tr key={c.city} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 pr-3 flex items-center gap-2">
                    <span className={`grid h-6 w-6 place-items-center rounded-lg font-black text-[10px] ${index < 3 ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>
                      {index + 1}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">{c.city}</span>
                  </td>
                  <td className="py-3 pr-3 text-slate-700 font-bold">{c.carrierCount} nosičů</td>
                  <td className="py-3 pr-3 text-slate-600">{c.occupiedCount} z {c.surfaceCount} ploch</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden shrink-0">
                        <div className="h-full bg-sky-600 rounded-full" style={{ width: `${c.occupancyRate}%` }} />
                      </div>
                      <span className="font-bold text-slate-900">{c.occupancyRate}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-extrabold text-emerald-700 text-sm">
                    {Math.round(c.revenue).toLocaleString('cs-CZ')} Kč
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: RECENT ACTIVE CAMPAIGNS AUDIT */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-extrabold text-slate-950">Poslední Aktivní Kampaně & Pronájmy</h2>
          </div>
          <span className="text-xs font-bold text-slate-500">Posledních 100 záznamů</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentOccupancies.slice(0, 6).map((occ) => (
            <div key={occ.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-900 uppercase">
                  {occ.status === 'OCCUPIED' ? 'Aktivní kampaň' : 'Rezervace'}
                </span>
                <span className="font-extrabold text-slate-900">{occ.price ? `${Math.round(occ.price).toLocaleString('cs-CZ')} Kč` : 'Dle smlouvy'}</span>
              </div>
              <h4 className="font-extrabold text-slate-950 text-sm leading-snug">{occ.clientName}</h4>
              <p className="text-slate-600 font-medium">Kampaň: <strong>{occ.campaignName}</strong></p>
              <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-200">
                Platnost: {new Date(occ.dateFrom).toLocaleDateString('cs-CZ')} – {new Date(occ.dateTo).toLocaleDateString('cs-CZ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
