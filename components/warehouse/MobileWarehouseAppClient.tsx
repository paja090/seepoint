'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Mic,
  Camera,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wrench,
  Layers,
  UserCheck,
} from 'lucide-react';
import { WarehouseVoiceInputModal } from './WarehouseVoiceInputModal';
import { WarehousePhotoScannerModal } from './WarehousePhotoScannerModal';
import { WarehouseAiImportModal } from './WarehouseAiImportModal';

type WarehouseItemData = {
  id: string;
  code: string | null;
  name: string;
  category: 'CONSUMABLE' | 'RETURNABLE';
  unit: string;
  quantityInStock: number | string;
  minQuantity: number | string | null;
  location: string | null;
  supplierName: string | null;
};

type MovementData = {
  id: string;
  type: string;
  quantity: number | string;
  performedByName: string | null;
  assignedEmployeeName: string | null;
  createdAt: Date | string;
  item: {
    id: string;
    name: string;
    category: string;
    unit: string;
  };
  workOrder?: {
    id: string;
    title: string;
    clientName: string;
  } | null;
};

export function MobileWarehouseAppClient({
  items,
  workOrders,
  employees,
  recentMovements,
  currentUserName,
}: {
  items: WarehouseItemData[];
  workOrders: { id: string; title: string; clientName: string }[];
  employees: { id: string; firstName: string; lastName: string }[];
  recentMovements: MovementData[];
  currentUserName?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'quick' | 'borrowed' | 'catalog' | 'history'>('quick');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'CONSUMABLE' | 'RETURNABLE'>('ALL');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingItemIds, setProcessingItemIds] = useState<Record<string, boolean>>({});

  // Compute active borrowings (net quantity issued minus quantity returned per item)
  const activeBorrowingsMap = new Map<string, { itemId: string; name: string; unit: string; qty: number }>();

  recentMovements.forEach((m) => {
    if (!m.item || m.item.category !== 'RETURNABLE') return;

    const matchesUser = currentUserName
      ? m.performedByName?.includes(currentUserName) || m.assignedEmployeeName?.includes(currentUserName)
      : true;

    if (!matchesUser) return;

    const current = activeBorrowingsMap.get(m.item.id) || {
      itemId: m.item.id,
      name: m.item.name,
      unit: m.item.unit,
      qty: 0,
    };

    const qty = Number(m.quantity) || 1;
    if (m.type === 'ISSUE') {
      current.qty += qty;
    } else if (m.type === 'RETURN') {
      current.qty = Math.max(0, current.qty - qty);
    }

    activeBorrowingsMap.set(m.item.id, current);
  });

  const activeBorrowings = Array.from(activeBorrowingsMap.values()).filter((b) => b.qty > 0);

  // Fast movement handler (take or return) with instant double-click protection
  const handleQuickMovement = async (itemId: string, type: 'ISSUE' | 'RETURN', quantity = 1, note = '') => {
    if (processingItemIds[itemId]) return;

    setProcessingItemIds((prev) => ({ ...prev, [itemId]: true }));
    setStatusMessage(null);

    try {
      const res = await fetch('/api/warehouse/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          type,
          quantity,
          note: note || (type === 'ISSUE' ? 'Mobilní rychlý výdej' : 'Mobilní rychlé vracení'),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pohyb se nepodařilo uložit.');
      }

      setStatusMessage({
        type: 'success',
        text: type === 'ISSUE' ? `✅ Vzato: ${quantity}x ze skladu.` : `🟢 Vráceno: ${quantity}x do skladu.`,
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `⚠️ ${err.message}` });
    } finally {
      setProcessingItemIds((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.code && item.code.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Hero Header Banner */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-3.5 sm:p-6 text-slate-100 shadow-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Package size={22} className="sm:h-6 sm:w-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                Mobilní Sklad <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">Live ⚡</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">Příchod do skladu, rychlé vyzvednutí a vracení nářadí</p>
            </div>
          </div>
        </div>

        {/* 3 Action Boxes - Grid 3 cols fitting 100% on mobile */}
        <div className="mt-3.5 grid grid-cols-3 gap-1.5 w-full">
          <WarehouseVoiceInputModal
            workOrders={workOrders}
            employees={employees}
            triggerClassName="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-1.5 sm:px-3 py-2 text-[10px] sm:text-xs font-black text-white shadow-md hover:from-purple-500 hover:to-indigo-500 transition text-center w-full min-w-0"
          />
          <WarehousePhotoScannerModal
            workOrders={workOrders}
            employees={employees}
            triggerClassName="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-1.5 sm:px-3 py-2 text-[10px] sm:text-xs font-black text-white shadow-md hover:from-emerald-500 hover:to-teal-500 transition text-center w-full min-w-0"
          />
          <WarehouseAiImportModal
            triggerClassName="flex flex-col sm:flex-row items-center justify-center gap-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 px-1.5 sm:px-3 py-2 text-[10px] sm:text-xs font-black text-white shadow-md hover:from-purple-600 hover:to-indigo-600 transition text-center w-full min-w-0"
          />
        </div>

        {/* Quick Action Navigation Tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-slate-950/70 p-1 border border-slate-800 w-full overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveTab('quick')}
            className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'quick' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight size={16} />
            <span>Rychlý výdej</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('borrowed')}
            className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'borrowed' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw size={16} />
            <span>Moje výpůjčky</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'catalog' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={16} />
            <span>Katalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'history' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck size={16} />
            <span>Pohyby</span>
          </button>
        </div>
      </div>

      {/* Notification status banner */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-2xl p-3.5 text-sm font-bold animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'border border-emerald-500/40 bg-emerald-950/80 text-emerald-200'
              : 'border border-rose-500/40 bg-rose-950/80 text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB 1: RYCHLÝ VÝDEJ (Fast item checkout) */}
      {activeTab === 'quick' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Vyhledat materiál nebo nářadí k vyzvednutí..."
              className="input pl-10 h-12 text-sm bg-white text-slate-900 border-slate-300 shadow-sm rounded-2xl focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(
              [
                ['ALL', 'Všechny položky'],
                ['CONSUMABLE', 'Spotřební (pásky, lepidla)'],
                ['RETURNABLE', 'Vratné (nářadí, žebříky)'],
              ] as const
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.slice(0, 30).map((item) => {
              const inStock = Number(item.quantityInStock);
              const isLow = item.minQuantity !== null && inStock < Number(item.minQuantity);
              const isBusy = Boolean(processingItemIds[item.id]) || isPending;

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-900 text-base leading-snug">{item.name}</h4>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${
                          item.category === 'RETURNABLE'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {item.category === 'RETURNABLE' ? 'Vratné nářadí' : 'Spotřební'}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Skladem: <b className="text-slate-900">{inStock} {item.unit}</b></span>
                      {item.location && <span>Pozice: <b className="text-slate-800">{item.location}</b></span>}
                    </div>

                    {isLow && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <AlertCircle size={12} /> Nízký stav ve skladu
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isBusy || inStock <= 0}
                      onClick={() => handleQuickMovement(item.id, 'ISSUE', 1)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 px-3 text-xs font-black text-slate-950 shadow-sm active:scale-95 transition disabled:opacity-50"
                    >
                      <ArrowUpRight size={14} />
                      <span>{isBusy ? 'Ukládám...' : `VZÍT 1 ${item.unit.toUpperCase()}`}</span>
                    </button>

                    {item.category === 'CONSUMABLE' && (
                      <button
                        type="button"
                        disabled={isBusy || inStock < 5}
                        onClick={() => handleQuickMovement(item.id, 'ISSUE', 5)}
                        className="flex items-center justify-center rounded-xl bg-slate-900 py-2.5 px-3 text-xs font-black text-white shadow-sm active:scale-95 transition disabled:opacity-50"
                      >
                        +5 {item.unit}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MOJE VÝPŮJČKY & VRACENÍ */}
      {activeTab === 'borrowed' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4">
            <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
              <RotateCcw size={18} className="text-purple-600" />
              <span>Vracení vypůjčeného nářadí a materiálu</span>
            </div>
            <p className="mt-1 text-xs text-purple-700">
              Přišli jste zpět do skladu? Klepnutím na zelené tlačítko položku ihned vrátíte zpět na pozici.
            </p>
          </div>

          {activeBorrowings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <h4 className="font-bold text-slate-800">Nemáte žádné aktivní výpůjčky</h4>
              <p className="text-xs text-slate-500 mt-1">Všechno vypůjčené nářadí je řádně vráceno ve skladu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBorrowings.map((borrowing) => {
                const isProcessing = Boolean(processingItemIds[borrowing.itemId]) || isPending;
                return (
                  <div key={borrowing.itemId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <strong className="text-slate-900 text-sm font-black">{borrowing.name}</strong>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Aktivně u sebe: <b className="text-purple-700 font-bold">{borrowing.qty} {borrowing.unit}</b>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleQuickMovement(borrowing.itemId, 'RETURN', borrowing.qty)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-black text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      <span>{isProcessing ? 'Ukládám...' : 'VRÁTIT DO SKLADU'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KATALOG A KOMPLETNÍ KARTA SKLADU */}
      {activeTab === 'catalog' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-2">Kompletní stav skladových zásob ({items.length} položek)</h4>
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <div className="text-slate-400 text-[11px]">{item.code || 'Bez kódu'} · {item.location || 'Bez pozice'}</div>
                  </div>
                  <div className="text-right">
                    <b className="text-sm text-slate-900">{Number(item.quantityInStock)} {item.unit}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORIE POHYBŮ */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-3">Poslední pohyby ve skladu</h4>
            <div className="space-y-2">
              {recentMovements.slice(0, 15).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-bold text-slate-900">{m.item.name}</span>
                    <div className="text-slate-400 text-[11px]">
                      {m.performedByName || 'Systém'} · {new Date(m.createdAt).toLocaleString('cs-CZ')}
                    </div>
                  </div>
                  <span
                    className={`font-black rounded-lg px-2 py-0.5 text-[10px] ${
                      m.type === 'ISSUE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {m.type === 'ISSUE' ? `- ${Number(m.quantity)} ${m.item.unit}` : `+ ${Number(m.quantity)} ${m.item.unit}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
