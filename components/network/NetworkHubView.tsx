'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Globe,
  Handshake,
  MapPin,
  Tag,
  Clock,
  ShieldCheck,
  Building2,
  TrendingUp,
  Search,
  CheckCircle2,
  Plus,
  RefreshCw,
  ArrowRight,
  Filter,
  Eye,
  Lock,
  Layers,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

type Partner = {
  id: string;
  name: string;
  city: string;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  status: 'CONNECTED' | 'AVAILABLE';
  discountPercent: number;
  sharedSurfacesCount: number;
  partnershipType: string;
  canBookHold: boolean;
};

type InventoryItem = {
  id: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  city: string;
  street?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  surfaceName: string;
  mediaType: string;
  size: string;
  orientation: string;
  listPrice: number;
  b2bWholesalePrice: number;
  b2bDiscountPercent: number;
  visibility: string;
  isOwn: boolean;
  ownerLabel: string;
  thumbnailUrl: string;
};

type HoldItem = {
  id: string;
  direction: 'OUTGOING' | 'INCOMING';
  partnerName: string;
  surfaceName: string;
  carrierCode: string;
  city: string;
  street: string;
  b2bPrice: number;
  clientPrice: number;
  marginCzk: number;
  createdAt: string;
  expiresAt: string;
  status: string;
  daysLeft: number;
};

export function NetworkHubView() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'PARTNERS' | 'HOLDS' | 'PRIVACY'>('INVENTORY');

  // State
  const [partners, setPartners] = useState<Partner[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [holds, setHolds] = useState<HoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('ALL');
  const [searchMediaType, setSearchMediaType] = useState('ALL');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; message: string; severity: string; createdAt: string; isRead: boolean }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  // Fetch all network data on load
  useEffect(() => {
    let isMounted = true;
    const fetchNetworkData = async () => {
      setLoading(true);
      try {
        const [partnersRes, inventoryRes, holdsRes, notifRes] = await Promise.all([
          fetch('/api/network/partners'),
          fetch('/api/network/inventory'),
          fetch('/api/network/holds'),
          fetch('/api/network/notifications'),
        ]);

        if (isMounted) {
          if (partnersRes.ok) {
            const pData = await partnersRes.json();
            setPartners(pData.partners || []);
          }
          if (inventoryRes.ok) {
            const iData = await inventoryRes.json();
            setInventory(iData.items || []);
          }
          if (holdsRes.ok) {
            const hData = await holdsRes.json();
            setHolds(hData.holds || []);
          }
          if (notifRes.ok) {
            const nData = await notifRes.json();
            setNotifications(nData.notifications || []);
            setUnreadCount(nData.unreadCount || 0);
          }
        }
      } catch (err) {
        console.error('Failed to load network data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNetworkData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePartnerAction = async (targetOrgId: string, action: string, discount = 20) => {
    try {
      const res = await fetch('/api/network/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetOrgId, action, discountPercent: discount }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        setPartners((prev) =>
          prev.map((p) => (p.id === targetOrgId ? { ...p, status: data.status, discountPercent: discount } : p))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateHold = async (surfaceId: string) => {
    try {
      const res = await fetch('/api/network/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surfaceId, action: 'CREATE' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Dočasný B2B Hold na 5 dní byl úspěšně aktivován!');
        if (data.hold) {
          setHolds((prev) => [data.hold, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleHoldAction = async (holdId: string, action: 'CONFIRM' | 'EXTEND' | 'RELEASE') => {
    try {
      const res = await fetch('/api/network/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        if (action === 'RELEASE') {
          setHolds((prev) => prev.filter((h) => h.id !== holdId));
        } else if (action === 'EXTEND') {
          setHolds((prev) =>
            prev.map((h) => (h.id === holdId ? { ...h, daysLeft: h.daysLeft + 3 } : h))
          );
        } else if (action === 'CONFIRM') {
          setHolds((prev) =>
            prev.map((h) => (h.id === holdId ? { ...h, status: 'CONFIRMED' } : h))
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await fetch('/api/network/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_ALL_READ' }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    if (searchCity !== 'ALL' && !item.city.toLowerCase().includes(searchCity.toLowerCase())) return false;
    if (searchMediaType !== 'ALL' && item.mediaType !== searchMediaType) return false;
    return true;
  });

  const connectedPartnersCount = partners.filter((p) => p.status === 'CONNECTED').length;
  const partnerSurfacesCount = inventory.filter((i) => !i.isOwn).length;
  const activeHoldsCount = holds.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 text-slate-900">
      {/* Top Network Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>B2B Media Network & Burza kapacit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Partnerská síť reklamních ploch
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Sdílejte a poptávejte volné reklamní kapacity mezi ověřenými outdoorovými agenturami v ČR za velkoobchodní B2B ceny se 100% ochranou vašich koncových klientů.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowNotifDrawer(!showNotifDrawer)}
              className="relative inline-flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <span>🔔 B2B Události</span>
              {unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <Link
              href="/offers/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Sestavit B2B nabídku</span>
            </Link>
          </div>
        </div>

        {/* Real-time B2B Notifications Drawer */}
        {showNotifDrawer && (
          <div className="mt-6 rounded-2xl bg-slate-900/95 p-4 border border-indigo-500/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">
                🔔 Upozornění sítě & Holdů v reálném čase
              </span>
              <button
                type="button"
                onClick={handleMarkAllNotifsRead}
                className="text-[11px] font-bold text-slate-400 hover:text-white"
              >
                Označit vše jako přečtené
              </button>
            </div>

            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                    n.severity === 'HIGH'
                      ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                      : n.severity === 'MEDIUM'
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300'
                  }`}
                >
                  <div>
                    <h4 className="font-black text-white">{n.title}</h4>
                    <p className="mt-0.5 text-[11px] opacity-90">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(n.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global KPI Metrics */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-800/80">
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Propojení partneři</span>
            <span className="text-xl font-black text-indigo-400 mt-0.5 block">{connectedPartnersCount} agentur</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Dostupné plochy v síti</span>
            <span className="text-xl font-black text-emerald-400 mt-0.5 block">{partnerSurfacesCount + 24} ploch</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Aktivní B2B Holdy</span>
            <span className="text-xl font-black text-amber-400 mt-0.5 block">{activeHoldsCount} rezervace</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Průměrná B2B sleva</span>
            <span className="text-xl font-black text-teal-400 mt-0.5 block">20 – 25 % marže</span>
          </div>
        </div>
      </div>

      {/* Action Toast Alert */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-950 p-4 text-xs font-bold text-emerald-300 border border-emerald-700 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 text-xs font-bold scrollbar-thin">
        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'INVENTORY'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe size={15} />
          <span>🌐 Burza kapacit ({filteredInventory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PARTNERS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'PARTNERS'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Handshake size={15} />
          <span>🤝 Moji B2B partneři ({connectedPartnersCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('HOLDS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'HOLDS'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={15} />
          <span>⏳ Poptávky & Holdy ({holds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PRIVACY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'PRIVACY'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck size={15} />
          <span>🛡️ Bezpečnost & Pravidla sítě</span>
        </button>
      </div>

      {/* Tab 1: Burza kapacit (Inventory) */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Filter size={14} /> Filtry:
              </span>

              <select
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">Všechna města</option>
                <option value="Praha">Praha</option>
                <option value="Brno">Brno</option>
                <option value="Ostrava">Ostrava</option>
                <option value="Plzeň">Plzeň</option>
              </select>

              <select
                value={searchMediaType}
                onChange={(e) => setSearchMediaType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value="ALL">Všechny typy médií</option>
                <option value="BILLBOARD">Billboardy (5,1×2,4)</option>
                <option value="PROMO_BENCH">Promo lavičky</option>
                <option value="CITYLIGHT">Citylighty (CLV)</option>
                <option value="FACADE">Fasády & LED</option>
                <option value="PROMO_TOWER">Promo věže</option>
              </select>
            </div>

            <span className="text-xs font-bold text-slate-500">
              Nalezeno <strong className="text-slate-900">{filteredInventory.length}</strong> volných ploch k přeprodeji
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs hover:border-indigo-400 hover:shadow-lg transition group"
              >
                <div>
                  {/* Photo with B2B Tag */}
                  <div className="relative h-44 w-full bg-slate-900">
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.carrierName}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-3 left-3 flex gap-1">
                      <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-black uppercase text-white backdrop-blur border border-slate-700">
                        {item.mediaType}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase border backdrop-blur ${
                        item.isOwn
                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                          : 'bg-indigo-950/90 text-indigo-300 border-indigo-600'
                      }`}>
                        {item.ownerLabel}
                      </span>
                    </div>

                    {item.b2bDiscountPercent > 0 && (
                      <div className="absolute bottom-3 left-3">
                        <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-md flex items-center gap-1">
                          <Tag size={10} /> B2B Sleva -{item.b2bDiscountPercent} %
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-indigo-600">{item.carrierCode}</span>
                      <span className="text-[11px] font-semibold text-slate-500">{item.size}</span>
                    </div>

                    <h3 className="font-black text-sm text-slate-900 line-clamp-1">{item.carrierName}</h3>

                    <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <MapPin size={13} className="text-amber-500 shrink-0" />
                      <span>{[item.city, item.street].filter(Boolean).join(' · ')}</span>
                    </p>

                    {/* Pricing Box */}
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Ceníková cena:</span>
                        <span className="text-xs font-bold text-slate-500 line-through">
                          {item.listPrice.toLocaleString('cs-CZ')} Kč
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-emerald-700 font-bold block uppercase">Vaše B2B nákupní cena:</span>
                        <span className="text-sm font-black text-slate-950">
                          {item.b2bWholesalePrice.toLocaleString('cs-CZ')} Kč / měsíc
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 pt-0">
                  <button
                    type="button"
                    onClick={() => handleCreateHold(item.id)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 py-2.5 text-xs font-black text-white shadow-sm transition active:scale-98 cursor-pointer"
                  >
                    <Clock size={14} />
                    <span>Aktivovat B2B Hold (5 dní)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Moji B2B partneři (Partners Directory) */}
      {activeTab === 'PARTNERS' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
            <div>
              <h2 className="text-base font-black text-slate-900">Adresář propojených B2B partnerů</h2>
              <p className="text-xs text-slate-500">
                Spravujte provizní slevy a B2B smlouvy s ostatními agenturami registrovanými na platformě.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {partners.map((partner) => (
                <div key={partner.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 font-black text-base border border-indigo-100 shrink-0">
                      {partner.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-900">{partner.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          partner.status === 'CONNECTED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {partner.status === 'CONNECTED' ? '🤝 Propojeno' : 'K dispozici'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        📍 {partner.city} · {partner.sharedSurfacesCount} sdílených ploch v síti
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {partner.status === 'CONNECTED' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                          B2B Sleva: {partner.discountPercent} %
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePartnerAction(partner.id, 'DISCONNECT')}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-xs transition"
                        >
                          Odpojit
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePartnerAction(partner.id, 'REQUEST_CONNECTION', 20)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-sm"
                      >
                        + Navázat B2B partnerství
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Poptávky a Holdy (Holds) */}
      {activeTab === 'HOLDS' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {holds.map((hold) => (
              <div key={hold.id} className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    hold.direction === 'OUTGOING'
                      ? 'bg-blue-50 text-blue-800 border border-blue-200'
                      : 'bg-purple-50 text-purple-800 border border-purple-200'
                  }`}>
                    {hold.direction === 'OUTGOING' ? '📤 Naše odchozí rezervace' : '📥 Příchozí poptávka od partnera'}
                  </span>

                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    <Clock size={12} /> Vyprší za {hold.daysLeft} dny
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-sm text-slate-900">{hold.carrierCode} — {hold.surfaceName}</h3>
                  <p className="text-xs text-slate-500">{hold.city}, {hold.street}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Partner:</span>
                    <span className="font-bold text-slate-800">{hold.partnerName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">B2B Nákupní cena:</span>
                    <span className="font-black text-slate-950">{hold.b2bPrice.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleHoldAction(hold.id, 'RELEASE')}
                    className="flex-1 min-w-[100px] py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                  >
                    Uvolnit hold
                  </button>

                  <button
                    type="button"
                    onClick={() => handleHoldAction(hold.id, 'EXTEND')}
                    className="flex-1 min-w-[110px] py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs hover:bg-amber-100 transition cursor-pointer"
                  >
                    + Prodloužit (3 dny)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleHoldAction(hold.id, 'CONFIRM')}
                    className="flex-1 min-w-[130px] py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-xs cursor-pointer"
                  >
                    Potvrdit do zakázky
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Bezpečnost a pravidla sítě (Privacy) */}
      {activeTab === 'PRIVACY' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Lock size={20} />
            </div>
            <h3 className="font-black text-base text-slate-900">100% Ochrana inzerentů</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vlastník plochy nikdy nevidí, pro jakého klienta plochu poptáváte, ani za jakou koncovou cenu ji inzerentovi prodáváte. Všechny nabídky vystupují výhradně pod vaší značkou.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-black text-base text-slate-900">Prevence Double-Bookingu</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Díky dočasnému stavu B2B Hold (5 dní) máte jistotu, že partner plochu neprodá někomu jinému, zatímco klient zvažuje vaši nabídku.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-black text-base text-slate-900">Automatický clearing & Provize</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Systém na konci měsíce automaticky vygeneruje přesné subdodavatelské podklady a faktury s vaší sjednanou velkoobchodní marží.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
