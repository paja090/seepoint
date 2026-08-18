'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Calendar,
  List,
  Route,
  Clock,
  CalendarRange,
  AlertCircle,
  FileCheck,
  X,
  CheckCircle2,
  Briefcase,
  History,
} from 'lucide-react';
import { WorkWeekView } from './WorkWeekView';
import { WorkPlanListView, type WorkOrderData } from './WorkPlanListView';
import { WorkOrderForm } from './WorkOrderForm';

type Option = { id: string; label: string };
type CarrierOption = Option & { code: string };
type EmployeeOption = { id: string; name: string };

export type WorkModuleClientProps = {
  orders: WorkOrderData[];
  clients: Option[];
  carriers: CarrierOption[];
  employees: EmployeeOption[];
  currentUserName: string;
  initialCarrierCode?: string;
  initialClientName?: string;
  initialCampaignDateFrom?: string;
  initialCampaignDateTo?: string;
  canCreateWorkOrder: boolean;
};

export function WorkModuleClient({
  orders,
  clients,
  carriers,
  employees,
  currentUserName,
  initialCarrierCode = '',
  initialClientName = '',
  initialCampaignDateFrom = '',
  initialCampaignDateTo = '',
  canCreateWorkOrder,
}: WorkModuleClientProps) {
  // Open create modal automatically if redirected with initial carrier or client
  const autoOpenModal = Boolean(initialCarrierCode || initialClientName || initialCampaignDateFrom);
  const [createModalOpen, setCreateModalOpen] = useState(autoOpenModal);
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');
  const [selectedFilter, setSelectedFilter] = useState<'open' | 'today' | 'week' | 'urgent' | 'invoicing' | 'history' | 'all'>('open');

  // Dates & Stats Calculation
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(dayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(dayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const openOrders = orders.filter((o) => !['DONE', 'CANCELLED'].includes(o.status));
  const completedOrders = orders.filter((o) => ['DONE', 'CANCELLED'].includes(o.status));

  const openCount = openOrders.length;
  const historyCount = completedOrders.length;

  const todayCount = openOrders.filter((o) => {
    const d = new Date(o.scheduledAt);
    return d >= dayStart && d < tomorrow;
  }).length;

  const weekCount = openOrders.filter((o) => {
    const d = new Date(o.scheduledAt);
    return d >= dayStart && d < weekEnd;
  }).length;

  const urgentCount = openOrders.filter((o) => o.priority === 'URGENT').length;
  const invoicingCount = orders.filter((o) => o.ftdSent && !o.invoiced && o.status !== 'CANCELLED').length;

  // Filter orders based on active stat tile selection
  const filteredOrders = orders.filter((o) => {
    const d = new Date(o.scheduledAt);
    const isCompleted = ['DONE', 'CANCELLED'].includes(o.status);

    if (selectedFilter === 'open') return !isCompleted;
    if (selectedFilter === 'today') return !isCompleted && d >= dayStart && d < tomorrow;
    if (selectedFilter === 'week') return !isCompleted && d >= dayStart && d < weekEnd;
    if (selectedFilter === 'urgent') return !isCompleted && o.priority === 'URGENT';
    if (selectedFilter === 'invoicing') return o.ftdSent && !o.invoiced && o.status !== 'CANCELLED';
    if (selectedFilter === 'history') return isCompleted;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* PAGE HEADER & PRIMARY ACTION BUTTONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
              <Briefcase size={12} /> Provoz SeePOINT
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Plán práce & Zakázky
          </h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">
            Přehled aktivních úkolů k řešení, plánování výjezdů a historie hotových zakázek.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedFilter(selectedFilter === 'history' ? 'open' : 'history')}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold shadow-sm transition ${
              selectedFilter === 'history'
                ? 'border-purple-600 bg-purple-600 text-white shadow-md ring-2 ring-purple-400/30'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <History size={16} className={selectedFilter === 'history' ? 'text-white' : 'text-purple-600'} />
            <span>📜 Historie ({historyCount})</span>
          </button>

          <Link
            href="/work/route"
            className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Route size={16} className="text-emerald-600" />
            <span>🚗 Naplánovat výjezd</span>
          </Link>

          {canCreateWorkOrder && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-sky-500 hover:to-emerald-500 transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Přidat nový úkol</span>
            </button>
          )}
        </div>
      </div>

      {/* STAT TILES / QUICK FILTERS */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'open' ? 'all' : 'open')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedFilter === 'open'
              ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/30'
              : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">K řešení</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-slate-900">{openCount}</p>
          <span className="text-[10px] font-semibold text-slate-400">aktivní úkoly</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'today' ? 'open' : 'today')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedFilter === 'today'
              ? 'border-sky-500 bg-sky-50/90 ring-2 ring-sky-500/30'
              : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Dnes</span>
            <Clock size={16} className="text-sky-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-slate-900">{todayCount}</p>
          <span className="text-[10px] font-semibold text-slate-400">zakázek na dnešek</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'week' ? 'open' : 'week')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedFilter === 'week'
              ? 'border-sky-500 bg-sky-50/90 ring-2 ring-sky-500/30'
              : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Příštích 7 dní</span>
            <CalendarRange size={16} className="text-sky-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-slate-900">{weekCount}</p>
          <span className="text-[10px] font-semibold text-slate-400">plánované výjezdy</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'urgent' ? 'open' : 'urgent')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedFilter === 'urgent'
              ? 'border-rose-500 bg-rose-50/90 ring-2 ring-rose-500/30'
              : 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Urgentní</span>
            <AlertCircle size={16} className="text-rose-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-rose-900">{urgentCount}</p>
          <span className="text-[10px] font-semibold text-rose-600">vysoká priorita</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'invoicing' ? 'open' : 'invoicing')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedFilter === 'invoicing'
              ? 'border-purple-500 bg-purple-50/90 ring-2 ring-purple-500/30'
              : 'border-purple-200 bg-purple-50/50 hover:bg-purple-50 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">K fakturaci</span>
            <FileCheck size={16} className="text-purple-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-purple-950">{invoicingCount}</p>
          <span className="text-[10px] font-semibold text-purple-700">fotky hotové</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter(selectedFilter === 'history' ? 'open' : 'history')}
          className={`rounded-2xl border p-4 text-left transition ${
            selectedFilter === 'history'
              ? 'border-purple-600 bg-purple-50/90 ring-2 ring-purple-500/30'
              : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Historie</span>
            <History size={16} className="text-purple-600" />
          </div>
          <p className="mt-1 text-2xl font-black text-purple-950">{historyCount}</p>
          <span className="text-[10px] font-semibold text-slate-400">hotové úkoly</span>
        </button>
      </div>

      {/* FILTER CLEAR BANNER IF ACTIVE */}
      {selectedFilter !== 'open' && (
        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
          <span>
            Zobrazený filtr:{' '}
            <strong className="text-slate-900">
              {selectedFilter === 'today' && 'Dnešní zakázky'}
              {selectedFilter === 'week' && 'Zakázky v příštích 7 dnech'}
              {selectedFilter === 'urgent' && 'Urgentní zakázky'}
              {selectedFilter === 'invoicing' && 'Zakázky čekající na fakturaci'}
              {selectedFilter === 'history' && '📜 Historie a hotové úkoly'}
              {selectedFilter === 'all' && 'Všechny zakázky (včetně historie)'}
            </strong>{' '}
            ({filteredOrders.length} výsledků)
          </span>
          <button
            onClick={() => setSelectedFilter('open')}
            className="font-bold text-sky-600 hover:underline flex items-center gap-1"
          >
            <X size={14} /> Návrat k aktivním úkolům ({openCount})
          </button>
        </div>
      )}

      {/* MAIN VIEW CONTROLS & TABS */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-5 py-3 font-extrabold text-sm border-b-2 transition ${
              activeTab === 'calendar'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar size={18} />
            Týdenní kalendář
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-5 py-3 font-extrabold text-sm border-b-2 transition ${
              activeTab === 'list'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <List size={18} />
            Seznam zakázek ({filteredOrders.length})
          </button>
        </div>
      </div>

      {/* VIEW TAB 1: WEEKLY CALENDAR */}
      {activeTab === 'calendar' && (
        <WorkWeekView
          initialOrders={filteredOrders.map((o) => ({
            id: o.id,
            title: o.title,
            clientName: o.clientName,
            requestedBy: o.requestedBy,
            scheduledAt: o.scheduledAt,
            deadlineAt: o.deadlineAt || undefined,
            status: o.status as any,
            priority: o.priority as any,
            price: o.price,
            workType: o.workType as any,
            ftdSent: o.ftdSent || false,
            invoiced: o.invoiced || false,
            workers: o.assignments.map((a) => a.workerName),
            carrierCode: o.carrierCode,
          }))}
        />
      )}

      {/* VIEW TAB 2: DETAILED LIST */}
      {activeTab === 'list' && (
        <WorkPlanListView orders={filteredOrders} canCleanup={canCreateWorkOrder} />
      )}

      {/* MODAL DIALOG: ADD NEW TASK (WorkOrderForm) */}
      {createModalOpen && canCreateWorkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-3xl my-8 rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <Plus className="text-emerald-600" size={22} />
                  Zadání nového úkolu / zakázky
                </h2>
                <p className="text-xs text-slate-500">
                  Vyplňte údaje o zakázce. Systém automaticky vygeneruje úkoly pro montážníky.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <WorkOrderForm
              clients={clients}
              carriers={carriers}
              employees={employees}
              currentUserName={currentUserName}
              initialCarrierCode={initialCarrierCode}
              initialClientName={initialClientName}
              initialCampaignDateFrom={initialCampaignDateFrom}
              initialCampaignDateTo={initialCampaignDateTo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
