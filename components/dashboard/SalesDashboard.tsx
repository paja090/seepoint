'use client';

import Link from 'next/link';
import {
  BadgeDollarSign,
  Building2,
  CalendarClock,
  ChevronRight,
  Clock,
  FilePlus,
  FileText,
  Phone,
  RadioTower,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';

interface SalesDashboardProps {
  salesName: string;
  activeOffers: Array<{
    id: string;
    title: string;
    clientName: string;
    totalAmount: number;
    validUntil: Date | null;
    status: string;
    createdAt: Date;
  }>;
  renewals: Array<{
    id: string;
    campaignName: string | null;
    clientName: string;
    dateTo: Date;
    status: string;
    contactPhone?: string | null;
    contactEmail?: string | null;
    surface: {
      carrier: { code: string; city: string; name: string };
    };
  }>;
  availableSurfacesCount: number;
  totalSurfacesCount: number;
  occupancyPercent: number;
  topCities: Array<{
    city: string;
    total: number;
    occupied: number;
    percent: number;
  }>;
  mediaBreakdown: Array<{
    type: string;
    label: string;
    count: number;
    occupiedCount: number;
    occupancyPercent: number;
    knownMonthlyRent: number;
  }>;
}

export function SalesDashboard({
  salesName,
  activeOffers,
  renewals,
  availableSurfacesCount,
  totalSurfacesCount,
  occupancyPercent,
  topCities,
  mediaBreakdown,
}: SalesDashboardProps) {
  const activeOffersVolume = activeOffers.reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* 🚀 Welcome & Sales Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
              <Sparkles size={14} />
              <span>Obchodní Portál SeePOINT</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white">
              Vítejte, {salesName}! 💼
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Váš obchodní přehled: aktivní nabídky, volná kapacita nosičů v regionech a nadcházející obchody k prodloužení.
            </p>

            {/* Quick Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href="/offers/new"
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 active:scale-95 transition"
              >
                <FilePlus size={16} />
                <span>Vytvořit Nabídku</span>
              </Link>

              <Link
                href="/occupancy?status=available"
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 backdrop-blur transition"
              >
                <Search size={16} />
                <span>Hledat Volné Nosiče ({availableSurfacesCount})</span>
              </Link>

              <Link
                href="/clients"
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 backdrop-blur transition"
              >
                <UserPlus size={16} />
                <span>Nový Klient</span>
              </Link>

              <Link
                href="/work"
                className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 backdrop-blur transition"
              >
                <CalendarClock size={16} />
                <span>Plán Práce</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Badge */}
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Aktivní Nabídky</p>
              <p className="mt-1 text-2xl font-black text-white">{activeOffers.length}</p>
              <p className="text-xs text-slate-300">{activeOffersVolume.toLocaleString('cs-CZ')} Kč</p>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-300">Volné Plochy</p>
              <p className="mt-1 text-2xl font-black text-white">{availableSurfacesCount}</p>
              <p className="text-xs text-slate-300">z {totalSurfacesCount} nosičů ({occupancyPercent}% obsazeno)</p>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 2-Column Section: Active Offers & Renewal Opportunities */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 📄 Active Offers */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <BadgeDollarSign size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Aktivní Rozpracované Nabídky</h2>
                  <p className="text-xs text-slate-500">Čekající na schválení či podpis klienta</p>
                </div>
              </div>

              <Link
                href="/offers"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
              >
                <span>Všechny nabídky</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {activeOffers.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">Žádné rozpracované nabídky.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Vytvořte novou nabídku pro klienta tlačítkem nahoře.</p>
                </div>
              ) : (
                activeOffers.map((offer) => (
                  <div key={offer.id} className="py-3.5 flex items-center justify-between gap-3 group">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition">
                          {offer.clientName}
                        </h3>
                        <span className="text-xs text-slate-400 font-normal">({offer.title})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Platnost: <b>{offer.validUntil ? new Date(offer.validUntil).toLocaleDateString('cs-CZ') : 'Neuvedeno'}</b>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-slate-950">
                        {offer.totalAmount.toLocaleString('cs-CZ')} Kč
                      </p>
                      <Link
                        href={`/offers/${offer.id}`}
                        className="inline-block mt-1 text-[11px] font-bold text-emerald-600 hover:underline"
                      >
                        Detail nabídky →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Celkový potenciál odeslaných nabídek:</span>
            <span className="text-sm font-black text-emerald-700">{activeOffersVolume.toLocaleString('cs-CZ')} Kč</span>
          </div>
        </div>

        {/* 🔔 Renewal Opportunities (Expiring Campaigns in 30 days) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Příležitosti k Prodloužení (Upsell)</h2>
                  <p className="text-xs text-slate-500">Kampaně končící v následujících 30 dnech</p>
                </div>
              </div>

              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                {renewals.length} příležitostí
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
              {renewals.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">Žádné končící kampaně v 30 dnech.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Všechny běžící klientské smlouvy jsou stabilní.</p>
                </div>
              ) : (
                renewals.map((item) => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil((new Date(item.dateTo).getTime() - new Date().getTime()) / 86400000)
                  );

                  return (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900">{item.clientName}</h3>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            {item.surface.carrier.city} · {item.surface.carrier.code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Kampaň: <b>{item.campaignName || 'Bez názvu'}</b> (Končí za <b>{daysLeft} dní</b>)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.contactPhone && (
                          <a
                            href={`tel:${item.contactPhone.replace(/\s/g, '')}`}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-sm"
                            title={`Zavolat klientovi: ${item.contactPhone}`}
                          >
                            <Phone size={15} />
                          </a>
                        )}
                        <Link
                          href={`/offers/new?clientName=${encodeURIComponent(item.clientName)}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100 transition"
                        >
                          Prodloužit
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Doporučení pro obchodníka:</span>
            <span className="text-xs font-bold text-amber-700">Kontaktujte klienty 14 dní před koncem kampaně</span>
          </div>
        </div>
      </div>

      {/* 🏙️ Volné Kapacity dle Měst & Regionů */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <Building2 size={20} className="text-indigo-600" />
              <span>Dostupné Kapacity Nosičů v Regionu</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stav volných nosičů pro nabídky klientům (Ostrava, Havířov, Orlová, Karviná...)
            </p>
          </div>

          <Link
            href="/occupancy"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            <span>Otevřít Matice Obsazenosti</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topCities.map((city) => (
            <Link
              key={city.city}
              href={`/occupancy?city=${encodeURIComponent(city.city)}`}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-500 hover:bg-emerald-50/40 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 group-hover:text-emerald-800 transition">{city.city}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-700 shadow-xs border border-slate-200">
                  {city.percent}% obsazeno
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-emerald-700">{Math.max(0, city.total - city.occupied)}</span>
                  <span className="text-xs text-slate-500 ml-1">volných nosičů</span>
                </div>
                <span className="text-xs text-slate-400 font-semibold">z {city.total} celkem</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 🏓 Volné Kapacity dle Typu Média */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
            <RadioTower size={20} className="text-emerald-600" />
            <span>Přehled Volného Inventáře dle Typu Média</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Počty volných promo laviček, věží, promohorizontů a plakátovacích stojanů k okamžitému pronájmu
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mediaBreakdown.map((media) => {
            const availableCount = Math.max(0, media.count - media.occupiedCount);

            return (
              <div key={media.type} className="rounded-2xl border border-slate-200 p-4 bg-white">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{media.label}</span>
                  <span className="text-xs font-bold text-emerald-700">{availableCount} volných</span>
                </div>

                <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${media.occupancyPercent}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>{media.occupiedCount} obsazeno ({media.occupancyPercent}%)</span>
                  <span>Evidované nájemné: {media.knownMonthlyRent.toLocaleString('cs-CZ')} Kč/m</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
