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
  TrendingUp,
  CheckCircle2,
  Plus,
  Filter,
  Lock,
  AlertCircle,
  Camera,
  FileCheck,
  ExternalLink,
  DollarSign,
  Receipt,
  Megaphone,
  Send,
} from 'lucide-react';
import { NETWORK_BETA_MESSAGE, NETWORK_TRANSACTIONS_ENABLED } from '@/lib/network-capabilities';

type Partner = {
  id: string;
  name: string;
  city: string;
  logoUrl?: string | null;
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

type ProofItem = {
  id: string;
  direction: 'INCOMING' | 'OUTGOING';
  partnerName: string;
  campaignName: string;
  carrierCode: string;
  surfaceName: string;
  city: string;
  location: string;
  latitude: number;
  longitude: number;
  installedAt: string;
  installerName: string;
  photoUrl: string;
  status: 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED';
  gpsVerified: boolean;
  clientReportReady: boolean;
};

type SettlementItem = {
  id: string;
  period: string;
  partnerId: string;
  partnerName: string;
  type: 'PAYABLE' | 'RECEIVABLE';
  itemsCount: number;
  clientBilledAmount: number;
  wholesaleB2BAmount: number;
  netMarginAmount: number;
  marginPercent: number;
  status: 'PENDING' | 'INVOICED' | 'SETTLED';
  invoiceNumber: string | null;
  dueDate: string;
  items: Array<{ code: string; name: string; clientPrice: number; b2bPrice: number; margin: number }>;
};

type DemandItem = {
  id: string;
  direction: 'INCOMING' | 'OUTGOING';
  requesterOrg: string;
  title: string;
  city: string;
  mediaType: string;
  period: string;
  quantityNeeded: number;
  budgetMax: number;
  clientSegment: string;
  status: 'ACTIVE' | 'FULFILLED' | 'CLOSED';
  createdAt: string;
  bidsCount: number;
  bids: Array<{ id: string; partnerName: string; offeredSurfacesCount: number; totalB2BPrice: number; note: string }>;
};

export function NetworkHubView() {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'PARTNERS' | 'HOLDS' | 'PROOFS' | 'SETTLEMENTS' | 'DEMANDS' | 'PRIVACY'>('INVENTORY');

  // State
  const [partners, setPartners] = useState<Partner[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [holds, setHolds] = useState<HoldItem[]>([]);
  const [proofs, setProofs] = useState<ProofItem[]>([]);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [settlementMetrics, setSettlementMetrics] = useState<{ totalB2BRevenue: number; totalNetMargin: number; totalPayable: number; totalReceivable: number }>({
    totalB2BRevenue: 0,
    totalNetMargin: 0,
    totalPayable: 0,
    totalReceivable: 0,
  });
  const [searchCity, setSearchCity] = useState('ALL');
  const [searchMediaType, setSearchMediaType] = useState('ALL');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; message: string; severity: string; createdAt: string; isRead: boolean }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  // Modals
  const [showCreateDemandModal, setShowCreateDemandModal] = useState(false);
  const [newDemandTitle, setNewDemandTitle] = useState('');
  const [newDemandCity, setNewDemandCity] = useState('Praha');
  const [newDemandMediaType, setNewDemandMediaType] = useState('BILLBOARD');
  const [newDemandPeriod, setNewDemandPeriod] = useState('Září 2026');
  const [newDemandQty, setNewDemandQty] = useState(4);
  const [newDemandBudget, setNewDemandBudget] = useState(35000);
  const newDemandSegment = 'Automotive / FMCG';

  const [bidDemandId, setBidDemandId] = useState<string | null>(null);
  const [bidQty, setBidQty] = useState(2);
  const [bidPrice, setBidPrice] = useState(16000);
  const [bidNote, setBidNote] = useState('');

  // Fetch all network data on load
  useEffect(() => {
    let isMounted = true;
    const fetchNetworkData = async () => {
      try {
        const [partnersRes, inventoryRes, holdsRes, notifRes, proofsRes, settlementsRes, demandsRes] = await Promise.all([
          fetch('/api/network/partners'),
          fetch('/api/network/inventory'),
          fetch('/api/network/holds'),
          fetch('/api/network/notifications'),
          fetch('/api/network/proofs'),
          fetch('/api/network/settlements'),
          fetch('/api/network/demands'),
        ]);

        if (isMounted) {
          const failedResources = [
            ['organizace', partnersRes],
            ['katalog', inventoryRes],
            ['holdy', holdsRes],
            ['notifikace', notifRes],
            ['fotodokumentace', proofsRes],
            ['clearing', settlementsRes],
            ['poptávky', demandsRes],
          ].filter(([, response]) => !(response as Response).ok).map(([label]) => label);

          setLoadError(
            failedResources.length > 0
              ? `Část B2B dat se nepodařilo načíst: ${failedResources.join(', ')}. Zobrazené nuly proto nemusí znamenat prázdná data.`
              : null
          );

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
          if (proofsRes.ok) {
            const prData = await proofsRes.json();
            setProofs(prData.proofs || []);
          }
          if (settlementsRes.ok) {
            const sData = await settlementsRes.json();
            setSettlements(sData.settlements || []);
            if (sData.metrics) setSettlementMetrics(sData.metrics);
          }
          if (demandsRes.ok) {
            const dData = await demandsRes.json();
            setDemands(dData.demands || []);
          }
        }
      } catch (err) {
        console.error('Failed to load network data:', err);
        if (isMounted) {
          setLoadError('B2B data se nepodařilo načíst. Zkuste stránku obnovit; žádná transakční operace nebyla provedena.');
        }
      }
    };

    fetchNetworkData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePartnerAction = async (targetOrgId: string, action: string, discount = 20) => {
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
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
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
    try {
      const res = await fetch('/api/network/holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surfaceId, action: 'CREATE' }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        if (data.hold) {
          setHolds((prev) => [data.hold, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleHoldAction = async (holdId: string, action: 'CONFIRM' | 'EXTEND' | 'RELEASE') => {
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
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
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
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

  const handleProofAction = async (proofId: string, action: 'APPROVE' | 'REJECT') => {
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
    try {
      const res = await fetch('/api/network/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        setProofs((prev) =>
          prev.map((p) =>
            p.id === proofId
              ? { ...p, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', clientReportReady: action === 'APPROVE' }
              : p
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettlementAction = async (settlementId: string, action: 'GENERATE_INVOICE' | 'MARK_SETTLED') => {
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
    try {
      const res = await fetch('/api/network/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        if (data.settlement) {
          setSettlements((prev) => prev.map((s) => (s.id === settlementId ? data.settlement : s)));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDemandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
    try {
      const res = await fetch('/api/network/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_DEMAND',
          demandData: {
            title: newDemandTitle,
            city: newDemandCity,
            mediaType: newDemandMediaType,
            period: newDemandPeriod,
            quantityNeeded: newDemandQty,
            budgetMax: newDemandBudget,
            clientSegment: newDemandSegment,
          },
        }),
      });
      const data = await res.json();
      if (data.success && data.demand) {
        setActionSuccess(data.message);
        setDemands((prev) => [data.demand, ...prev]);
        setShowCreateDemandModal(false);
        setNewDemandTitle('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitBidForDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!NETWORK_TRANSACTIONS_ENABLED) return setActionError(NETWORK_BETA_MESSAGE);
    if (!bidDemandId) return;
    try {
      const res = await fetch('/api/network/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_BID',
          demandId: bidDemandId,
          bidData: {
            offeredSurfacesCount: bidQty,
            totalB2BPrice: bidPrice,
            note: bidNote,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message);
        if (data.demand) {
          setDemands((prev) => prev.map((d) => (d.id === bidDemandId ? data.demand : d)));
        }
        setBidDemandId(null);
        setBidNote('');
      }
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
              Pilotní katalog ploch, které organizace výslovně zveřejnily do marketplace. Transakční partnerství a obchodní workflow zatím nejsou aktivní.
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
                🔔 Události sítě (transakční režim zatím není aktivní)
              </span>
              <button
                type="button"
                onClick={handleMarkAllNotifsRead}
                disabled={!NETWORK_TRANSACTIONS_ENABLED}
                title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                className="text-[11px] font-bold text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
              {notifications.length === 0 && (
                <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400">
                  Žádné události. Transakční notifikace zatím nejsou aktivní.
                </p>
              )}
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
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Dostupné plochy v katalogu</span>
            <span className="text-xl font-black text-emerald-400 mt-0.5 block">{partnerSurfacesCount} ploch</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Aktivní B2B Holdy</span>
            <span className="text-xl font-black text-amber-400 mt-0.5 block">{activeHoldsCount} rezervace</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Průměrná B2B sleva</span>
            <span className="text-xl font-black text-teal-400 mt-0.5 block">Není aktivní</span>
          </div>
        </div>
      </div>

      {!NETWORK_TRANSACTIONS_ENABLED && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong className="block font-black">B2B síť je zatím v režimu katalogu</strong>
          <span>{NETWORK_BETA_MESSAGE}</span>
        </div>
      )}

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

      {actionError && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs font-bold text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-950">✕</button>
        </div>
      )}

      {loadError && (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
          {loadError}
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
          onClick={() => setActiveTab('PROOFS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'PROOFS'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Camera size={15} />
          <span>📸 Fotodokumentace ({proofs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SETTLEMENTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'SETTLEMENTS'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>💰 Finanční clearing ({settlements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DEMANDS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'DEMANDS'
              ? 'bg-slate-900 text-white font-black shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Megaphone size={15} />
          <span>📢 Poptávková burza ({demands.length})</span>
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
                    disabled={!NETWORK_TRANSACTIONS_ENABLED}
                    title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-indigo-600 py-2.5 text-xs font-black text-white shadow-sm transition active:scale-98 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Clock size={14} />
                    <span>Aktivovat B2B Hold (5 dní)</span>
                  </button>
                </div>
              </div>
            ))}
            {filteredInventory.length === 0 && (
              <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Žádná plocha není pro zvolené filtry výslovně zveřejněna v B2B katalogu.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Moji B2B partneři (Partners Directory) */}
      {activeTab === 'PARTNERS' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
            <div>
              <h2 className="text-base font-black text-slate-900">Adresář organizací dostupných na platformě</h2>
              <p className="text-xs text-slate-500">
                Kontaktní údaje ani smluvní stav se nezpřístupňují, dokud není implementováno bezpečné perzistentní partnerství.
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
                          disabled={!NETWORK_TRANSACTIONS_ENABLED}
                          title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Odpojit
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePartnerAction(partner.id, 'REQUEST_CONNECTION', 20)}
                        disabled={!NETWORK_TRANSACTIONS_ENABLED}
                        title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        + Navázat B2B partnerství
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {partners.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">Na platformě zatím není dostupná další organizace.</p>
              )}
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
                    disabled={!NETWORK_TRANSACTIONS_ENABLED}
                    title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                    className="flex-1 min-w-[100px] py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                  >
                    Uvolnit hold
                  </button>

                  <button
                    type="button"
                    onClick={() => handleHoldAction(hold.id, 'EXTEND')}
                    disabled={!NETWORK_TRANSACTIONS_ENABLED}
                    title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                    className="flex-1 min-w-[110px] py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs hover:bg-amber-100 transition cursor-pointer"
                  >
                    + Prodloužit (3 dny)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleHoldAction(hold.id, 'CONFIRM')}
                    disabled={!NETWORK_TRANSACTIONS_ENABLED}
                    title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                    className="flex-1 min-w-[130px] py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-xs cursor-pointer"
                  >
                    Potvrdit do zakázky
                  </button>
                </div>
              </div>
            ))}
            {holds.length === 0 && (
              <p className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Holdy nejsou aktivní. Jejich API zatím záměrně neprovádí žádné zápisy.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Sdílená fotodokumentace (Proofs) */}
      {activeTab === 'PROOFS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-black text-slate-900">Sdílená fotodokumentace montáže z terénu</h2>
              <p className="text-xs text-slate-500">
                Příchozí a odchozí fotoreporty realizací mezi agenturami s GPS ověřením a časovým razítkem.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActionError(NETWORK_BETA_MESSAGE)}
              disabled={!NETWORK_TRANSACTIONS_ENABLED}
              title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FileCheck size={15} />
              <span>📥 Vygenerovat klientský fotoreport (PDF)</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proofs.map((proof) => (
              <div
                key={proof.id}
                className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs hover:border-indigo-400 hover:shadow-lg transition group"
              >
                <div>
                  <div className="relative h-48 w-full bg-slate-900">
                    <Image
                      src={proof.photoUrl}
                      alt={proof.carrierCode}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />

                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border backdrop-blur ${
                        proof.direction === 'INCOMING'
                          ? 'bg-indigo-950/90 text-indigo-300 border-indigo-600'
                          : 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                      }`}>
                        {proof.direction === 'INCOMING' ? '📥 Subdodávka od partnera' : '📤 Naše realizace pro partnera'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border backdrop-blur ${
                        proof.status === 'APPROVED'
                          ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600'
                          : proof.status === 'REJECTED'
                          ? 'bg-rose-950/90 text-rose-300 border-rose-600'
                          : 'bg-amber-950/90 text-amber-300 border-amber-600'
                      }`}>
                        {proof.status === 'APPROVED' ? '✓ Schváleno' : proof.status === 'REJECTED' ? '✕ K přefocení' : '⏳ Ke kontrole'}
                      </span>
                    </div>

                    {proof.gpsVerified && (
                      <div className="absolute bottom-3 left-3">
                        <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950 shadow-md flex items-center gap-1">
                          <MapPin size={10} /> GPS Ověřeno ({proof.latitude.toFixed(3)}, {proof.longitude.toFixed(3)})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-black text-indigo-600">{proof.carrierCode}</span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(proof.installedAt).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    <h3 className="font-black text-sm text-slate-900">{proof.surfaceName}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={13} className="text-amber-500 shrink-0" />
                      <span>{proof.city} · {proof.location}</span>
                    </p>

                    <div className="mt-2 rounded-2xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Partner:</span>
                        <span className="font-bold text-slate-800">{proof.partnerName}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Montážník:</span>
                        <span className="font-semibold text-slate-700">{proof.installerName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 flex gap-2">
                  {proof.status === 'PENDING_REVIEW' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleProofAction(proof.id, 'REJECT')}
                        disabled={!NETWORK_TRANSACTIONS_ENABLED}
                        title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                        className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                      >
                        Požádat o přefocení
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProofAction(proof.id, 'APPROVE')}
                        disabled={!NETWORK_TRANSACTIONS_ENABLED}
                        title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-xs cursor-pointer"
                      >
                        ✓ Schválit foto
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActionError(NETWORK_BETA_MESSAGE)}
                      disabled={!NETWORK_TRANSACTIONS_ENABLED}
                      title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                      className="w-full py-2 rounded-xl bg-slate-100 text-slate-800 font-bold text-xs hover:bg-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ExternalLink size={13} />
                      <span>Zobrazit v reportu kampaně</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {proofs.length === 0 && (
              <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Fotodokumentace partnerů není aktivní a nejsou zde žádné simulované reporty.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Finanční clearing & Fakturace (Settlements) */}
      {activeTab === 'SETTLEMENTS' && (
        <div className="space-y-6">
          {/* Financial KPIs Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Celkový obrat B2B sítě</span>
              <span className="text-xl font-black text-slate-900 block">
                {settlementMetrics.totalB2BRevenue.toLocaleString('cs-CZ')} Kč
              </span>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-700">Čistá B2B marže (Zisk)</span>
              <span className="text-xl font-black text-emerald-800 block">
                +{settlementMetrics.totalNetMargin.toLocaleString('cs-CZ')} Kč
              </span>
            </div>

            <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase text-rose-700">K úhradě partnerům (Závazky)</span>
              <span className="text-xl font-black text-rose-800 block">
                {settlementMetrics.totalPayable.toLocaleString('cs-CZ')} Kč
              </span>
            </div>

            <div className="rounded-3xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-xs space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-700">Pohledávky za partnery</span>
              <span className="text-xl font-black text-indigo-800 block">
                {settlementMetrics.totalReceivable.toLocaleString('cs-CZ')} Kč
              </span>
            </div>
          </div>

          {/* Settlements Table */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Měsíční zúčtovací protokoly se subdodavateli</h2>
                <p className="text-xs text-slate-500">
                  Přehled vzájemných zúčtování nákupních velkoobchodních cen, marží a stavu B2B faktur.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActionError(NETWORK_BETA_MESSAGE)}
                disabled={!NETWORK_TRANSACTIONS_ENABLED}
                title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Receipt size={15} />
                <span>📥 Exportovat měsíční clearing</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {settlements.map((set) => (
                <div key={set.id} className="py-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          set.type === 'PAYABLE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {set.type === 'PAYABLE' ? '📤 Náš závazek partnerovi' : '📥 Pohledávka za partnerem'}
                        </span>

                        <span className="font-mono text-xs font-black text-slate-500">[{set.period}]</span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          set.status === 'SETTLED'
                            ? 'bg-emerald-50 text-emerald-800'
                            : set.status === 'INVOICED'
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}>
                          {set.status === 'SETTLED' ? '✓ Vyrovnáno' : set.status === 'INVOICED' ? '📄 Vyfakturováno' : '⏳ K fakturaci'}
                        </span>
                      </div>

                      <h3 className="font-black text-sm text-slate-900">{set.partnerName}</h3>
                      <p className="text-xs text-slate-500">
                        {set.itemsCount} zúčtovaných ploch · Splatnost: {new Date(set.dueDate).toLocaleDateString('cs-CZ')}
                        {set.invoiceNumber && <span className="ml-2 font-mono font-bold text-slate-700">· Faktura: {set.invoiceNumber}</span>}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">B2B Nákupní částka:</span>
                        <span className="text-sm font-black text-slate-900">
                          {set.wholesaleB2BAmount.toLocaleString('cs-CZ')} Kč
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600 block">
                          (Marže +{set.netMarginAmount.toLocaleString('cs-CZ')} Kč)
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {set.status !== 'SETTLED' && (
                          <>
                            {set.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => handleSettlementAction(set.id, 'GENERATE_INVOICE')}
                                disabled={!NETWORK_TRANSACTIONS_ENABLED}
                                title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition shadow-xs cursor-pointer"
                              >
                                Vygenerovat B2B fakturu
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSettlementAction(set.id, 'MARK_SETTLED')}
                              disabled={!NETWORK_TRANSACTIONS_ENABLED}
                              title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-xs cursor-pointer"
                            >
                              ✓ Označit jako vyrovnané
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items List Breakdown */}
                  <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-slate-50">
                    {set.items.map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-mono font-black text-indigo-600">{item.code}</span>
                          <p className="font-bold text-slate-800">{item.name}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 font-medium">Klient: {item.clientPrice.toLocaleString('cs-CZ')} Kč</span>
                          <p className="font-black text-slate-900">B2B: {item.b2bPrice.toLocaleString('cs-CZ')} Kč</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {settlements.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Clearing není aktivní; žádné částky ani doklady nejsou dopočítávány nebo simulovány.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Poptávková burza kapacit (Demands) */}
      {activeTab === 'DEMANDS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-black text-slate-900">Poptávková burza kapacit (Demand Board)</h2>
              <p className="text-xs text-slate-500">
                Zadávejte chybějící kapacity v regionech a reagujte na poptávky ostatních agentur v síti.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateDemandModal(true)}
              disabled={!NETWORK_TRANSACTIONS_ENABLED}
              title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-xs font-black text-white hover:brightness-110 transition shadow-xs shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
            >
              <Plus size={15} />
              <span>+ Zadat novou poptávku do sítě</span>
            </button>
          </div>

          {/* Demands Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {demands.map((demand) => (
              <div key={demand.id} className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs hover:border-indigo-300 transition">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                      demand.direction === 'OUTGOING'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-purple-50 text-purple-800 border border-purple-200'
                    }`}>
                      {demand.direction === 'OUTGOING' ? '📤 Naše poptávka' : '📥 Poptávka z B2B sítě'}
                    </span>

                    <span className="text-[11px] font-bold text-slate-500">
                      {demand.bidsCount} {demand.bidsCount === 1 ? 'nabídka' : demand.bidsCount >= 2 && demand.bidsCount <= 4 ? 'nabídky' : 'nabídek'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-sm text-slate-900">{demand.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={13} className="text-amber-500 shrink-0" />
                      <span>{demand.city} · {demand.period}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Počet ploch:</span>
                      <span className="font-black text-slate-900">{demand.quantityNeeded}×</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Max rozpočet:</span>
                      <span className="font-black text-slate-900">{demand.budgetMax.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Zadavatel:</span>
                      <span className="font-bold text-slate-800 truncate block">{demand.requesterOrg}</span>
                    </div>
                  </div>

                  {/* Bids received */}
                  {demand.bids.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-black uppercase text-indigo-600 block">
                        Přijaté nabídky kapacit ({demand.bids.length}):
                      </span>
                      {demand.bids.map((b) => (
                        <div key={b.id} className="rounded-xl bg-indigo-50/50 p-2.5 border border-indigo-100 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 block">{b.partnerName}</span>
                            <span className="text-[11px] text-slate-500">{b.note}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-black text-indigo-700">{b.totalB2BPrice.toLocaleString('cs-CZ')} Kč</span>
                            <span className="text-[10px] text-slate-400 block">{b.offeredSurfacesCount} plochy</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  {demand.direction === 'INCOMING' ? (
                    <button
                      type="button"
                      onClick={() => setBidDemandId(demand.id)}
                      disabled={!NETWORK_TRANSACTIONS_ENABLED}
                      title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send size={13} />
                      <span>🎯 Nabídnout naše volné kapacity</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActionError(NETWORK_BETA_MESSAGE)}
                      disabled={!NETWORK_TRANSACTIONS_ENABLED}
                      title={!NETWORK_TRANSACTIONS_ENABLED ? NETWORK_BETA_MESSAGE : undefined}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>✓ Vytvořit nabídku z přijatých kapacit</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {demands.length === 0 && (
              <p className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Poptávková burza zatím nepřijímá zápisy a neobsahuje žádná simulovaná data.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Demand */}
      {showCreateDemandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Zadat novou poptávku do B2B sítě</h3>
              <button onClick={() => setShowCreateDemandModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateDemandSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Název poptávky:</label>
                <input
                  type="text"
                  required
                  placeholder="např. Hledáme 4× Eurobillboard v Liberci na září"
                  value={newDemandTitle}
                  onChange={(e) => setNewDemandTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Město / Region:</label>
                  <input
                    type="text"
                    required
                    value={newDemandCity}
                    onChange={(e) => setNewDemandCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Typ média:</label>
                  <select
                    value={newDemandMediaType}
                    onChange={(e) => setNewDemandMediaType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="BILLBOARD">Billboard (5,1×2,4)</option>
                    <option value="PROMO_BENCH">Promo lavička</option>
                    <option value="CITYLIGHT">Citylight (CLV)</option>
                    <option value="FACADE">Fasáda / LED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Počet ploch:</label>
                  <input
                    type="number"
                    min="1"
                    value={newDemandQty}
                    onChange={(e) => setNewDemandQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max rozpočet (Kč):</label>
                  <input
                    type="number"
                    step="1000"
                    value={newDemandBudget}
                    onChange={(e) => setNewDemandBudget(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Termín:</label>
                  <input
                    type="text"
                    value={newDemandPeriod}
                    onChange={(e) => setNewDemandPeriod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateDemandModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs"
                >
                  Odeslat do B2B sítě
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Submit Bid */}
      {bidDemandId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Nabídnout kapacity zadavateli</h3>
              <button onClick={() => setBidDemandId(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSubmitBidForDemand} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Počet nabízených ploch:</label>
                  <input
                    type="number"
                    min="1"
                    value={bidQty}
                    onChange={(e) => setBidQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Celková B2B cena (Kč):</label>
                  <input
                    type="number"
                    step="500"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lokalita a specifikace ploch:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="např. Máme 2 volné billboardy na hlavní třídě u nákupní zóny."
                  value={bidNote}
                  onChange={(e) => setBidNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBidDemandId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs"
                >
                  Odeslat nabídku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 7: Bezpečnost a pravidla sítě (Privacy) */}
      {activeTab === 'PRIVACY' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Lock size={20} />
            </div>
            <h3 className="font-black text-base text-slate-900">Požadavek: ochrana inzerentů</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Před aktivací transakcí musí server oddělit identitu koncového klienta a koncovou cenu od dat dostupných vlastníkovi plochy. Současný katalog tyto údaje vůbec nepřenáší.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-black text-base text-slate-900">Požadavek: prevence double-bookingu</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Budoucí hold musí být atomický, časově omezený a kontrolovat kolize s obsazeností. Dokud tento databázový mechanismus neexistuje, tlačítka holdů zůstávají vypnutá.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-black text-base text-slate-900">Požadavek: auditovatelný clearing</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vyúčtování musí vznikat pouze ze schválených realizací, mít neměnný auditní záznam a generovat čísla dokladů na serveru. Automatická fakturace zatím není aktivní.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
