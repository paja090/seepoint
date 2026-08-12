'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  CheckSquare,
  ShieldAlert,
} from 'lucide-react';

interface ClientSummary {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  category?: string | null;
  updatedAt: string;
}

interface OfferSummary {
  id: string;
  number?: string | null;
  title: string;
  clientName: string;
  clientId: string;
  totalPrice: number;
  status: string;
  createdAt: string;
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  title: string;
  clientName: string;
  clientId: string;
  status: string;
  createdAt: string;
}

interface TaskSummary {
  id: string;
  title: string;
  clientName?: string | null;
  clientId?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
  assignedUserName?: string | null;
}

interface InactiveClientSummary {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  lastContactDays: number;
}

interface ExpiringCampaignSummary {
  id: string;
  clientName: string;
  campaignName: string;
  surfaceName: string;
  dateTo: string;
  daysRemaining: number;
}

interface IntelligentCrmDashboardProps {
  metrics: {
    totalActiveClients: number;
    newLeadsCount: number;
    vipClientsCount: number;
    openOffersValue: number;
    wonDealsValue: number;
  };
  openOffers: OfferSummary[];
  activeOrders: OrderSummary[];
  pendingTasks: TaskSummary[];
  inactiveClients: InactiveClientSummary[];
  expiringCampaigns: ExpiringCampaignSummary[];
}

export function IntelligentCrmDashboard({
  metrics,
  openOffers,
  activeOrders,
  pendingTasks,
  inactiveClients,
  expiringCampaigns,
}: IntelligentCrmDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'reengage' | 'tasks'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      {/* 🚀 Top Header & Intelligent AI Insights Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
              <Sparkles size={14} className="text-emerald-400" />
              <span>Chytrý Obchodní Asistent SeePOINT</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              CRM Dashboard & Komerční Potenciál
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Automatizované vyhodnocování otevřených nabídek, inaktivních klientů a končících smluv pro maximální vytížení reklamních nosičů.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/offers/new"
              className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-emerald-400 active:scale-95 transition"
            >
              <Plus size={16} />
              <span>Nová Nabídka</span>
            </Link>
            <Link
              href="/clients"
              className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              <Building2 size={16} />
              <span>Správa Klientů</span>
            </Link>
          </div>
        </div>

        {/* 📊 High-Impact Metric Cards */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Potenciál v nabídkách</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {metrics.openOffersValue.toLocaleString('cs-CZ')} Kč
            </p>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <TrendingUp size={12} className="text-emerald-400" />
              <span>{openOffers.length} otevřených klientských návrhů</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aktivní Klienti & VIP</p>
            <p className="text-2xl font-black text-amber-400 mt-1">
              {metrics.totalActiveClients} <span className="text-xs font-semibold text-slate-400">({metrics.vipClientsCount} VIP)</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Building2 size={12} className="text-amber-400" />
              <span>{metrics.newLeadsCount} nových poptávek v CRM</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ohrožené Vztahy (60+ dní)</p>
            <p className="text-2xl font-black text-rose-400 mt-1">
              {inactiveClients.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <AlertCircle size={12} className="text-rose-400" />
              <span>Klienti bez reakce / vyžadující kontakt</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Končící Kampaně (30 dní)</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">
              {expiringCampaigns.length}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock size={12} className="text-indigo-400" />
              <span>Plochy k prodloužení rezervace</span>
            </p>
          </div>
        </div>
      </div>

      {/* 🟢 Interactive Filter Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-slate-950 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText size={15} />
          <span>Přehled Nabídek & Zakázek</span>
        </button>

        <button
          onClick={() => setActiveTab('reengage')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'reengage'
              ? 'bg-slate-950 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <PhoneCall size={15} className="text-rose-500" />
          <span>Obvolat / Obnovit Kampaně ({inactiveClients.length + expiringCampaigns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'tasks'
              ? 'bg-slate-950 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CheckSquare size={15} className="text-emerald-600" />
          <span>Moje Obchodní Úkoly ({pendingTasks.length})</span>
        </button>
      </div>

      {/* 📄 TAB 1: OVERVIEW (Otevřené Nabídky & Realizace) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Open Offers */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                <span>Otevřené Nabídky u Klientů</span>
              </h3>
              <Link href="/offers" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                <span>Všechny nabídky</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-2.5">
              {openOffers.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">Žádné rozpracované nabídky.</p>
              ) : (
                openOffers.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 hover:bg-slate-100/80 transition"
                  >
                    <div>
                      <Link href={`/offers/${o.id}`} className="font-bold text-sm text-slate-950 hover:text-emerald-700">
                        {o.title}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Klient: <strong className="text-slate-700">{o.clientName}</strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-slate-950">
                        {o.totalPrice ? `${Number(o.totalPrice).toLocaleString('cs-CZ')} Kč` : '0 Kč'}
                      </p>
                      <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-200/80 px-2 py-0.5 rounded-md">
                        {o.status === 'SENT' ? '✉️ Odesláno' : '✏️ Koncept'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Orders */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp size={18} className="text-sky-600" />
                <span>Zakázky v Realizaci</span>
              </h3>
              <Link href="/occupancy" className="text-xs font-bold text-sky-700 hover:underline flex items-center gap-1">
                <span>Obsazenost ploch</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="space-y-2.5">
              {activeOrders.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">Žádné probíhající zakázky.</p>
              ) : (
                activeOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 hover:bg-slate-100/80 transition"
                  >
                    <div>
                      <p className="font-bold text-sm text-slate-950">{ord.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Klient: <strong className="text-slate-700">{ord.clientName}</strong> · Číslo: {ord.orderNumber}
                      </p>
                    </div>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-xl border border-emerald-300 shrink-0">
                      Realizace
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚨 TAB 2: RE-ENGAGE (Inaktivní Klienti & Končící Kampaně) */}
      {activeTab === 'reengage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inactive Clients Warning */}
          <div className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-600" />
                <span>Klienti bez kontaktu (&gt; 60 dní)</span>
              </h3>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                {inactiveClients.length} klientů k obvolání
              </span>
            </div>

            <div className="space-y-2.5">
              {inactiveClients.length === 0 ? (
                <p className="py-8 text-center text-xs text-emerald-700 font-semibold">
                  🎉 Všichni klienti mají aktivní komunikaci!
                </p>
              ) : (
                inactiveClients.map((ic) => (
                  <div
                    key={ic.id}
                    className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5 hover:bg-rose-50 transition"
                  >
                    <div>
                      <Link href={`/clients/${ic.id}`} className="font-bold text-sm text-slate-950 hover:text-rose-600">
                        {ic.name}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ic.contactPerson ? `Kontakt: ${ic.contactPerson}` : ''} {ic.phone ? `· ${ic.phone}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-md">
                        {ic.lastContactDays} dní bez kontaktu
                      </span>
                      <Link
                        href={`/clients/${ic.id}`}
                        className="rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                      >
                        Detail
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expiring Campaigns */}
          <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock size={18} className="text-amber-600" />
                <span>Končící Kampaně (Prodloužení)</span>
              </h3>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {expiringCampaigns.length} rezervací
              </span>
            </div>

            <div className="space-y-2.5">
              {expiringCampaigns.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  V nejbližších 30 dnech nekončí žádné kampaně.
                </p>
              ) : (
                expiringCampaigns.map((ec) => (
                  <div
                    key={ec.id}
                    className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/40 p-3.5 hover:bg-amber-50 transition"
                  >
                    <div>
                      <p className="font-bold text-sm text-slate-950">{ec.clientName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ec.campaignName} · Plocha: <strong className="text-slate-700">{ec.surfaceName}</strong>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-amber-800">
                        Končí za {ec.daysRemaining} dní
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(ec.dateTo).toLocaleDateString('cs-CZ')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ TAB 3: TASKS (Moje Úkoly) */}
      {activeTab === 'tasks' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CheckSquare size={18} className="text-emerald-600" />
              <span>Otevřené Obchodní Úkoly</span>
            </h3>
            <Link href="/tasks" className="text-xs font-bold text-emerald-700 hover:underline">
              Všechny úkoly →
            </Link>
          </div>

          <div className="space-y-2">
            {pendingTasks.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Žádné otevřené úkoly k řešení.</p>
            ) : (
              pendingTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3.5 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <div>
                      <p className="font-bold text-sm text-slate-950">{t.title}</p>
                      <p className="text-xs text-slate-500">
                        {t.clientName ? `Klient: ${t.clientName}` : 'Interní úkol'} {t.assignedUserName ? `· Řeší: ${t.assignedUserName}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">
                      {t.dueDate ? `Do: ${new Date(t.dueDate).toLocaleDateString('cs-CZ')}` : 'Bez termínu'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
