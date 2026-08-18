'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Circle,
  CheckCircle2,
  Building2,
  Wrench,
  Camera,
  Trash2,
  X,
  Calendar,
  Info,
  Search,
  Filter as FilterIcon,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Package,
  User,
  Tag,
  Receipt,
  MoreVertical,
  Check,
  AlertCircle,
  Clock,
  Briefcase,
  Store,
  ArrowRight,
} from 'lucide-react';

export type ShoppingPriority = 'NORMAL' | 'THIS_WEEK' | 'URGENT';

export type ShoppingItem = {
  id: string;
  category: 'OFFICE' | 'WORKSHOP' | string;
  title: string;
  quantity?: string | null;
  unit?: string | null;
  store?: string | null;
  priority: ShoppingPriority;
  note?: string | null;
  imageUrl?: string | null;
  receiptUrl?: string | null;
  isPurchased: boolean;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string | null;
  crmOrderId?: string | null;
  crmOrder?: {
    id: string;
    title: string;
    orderNumber: string;
  } | null;
  addedByUserId?: string | null;
  addedByUserName: string;
  purchasedByUserId?: string | null;
  purchasedByUserName?: string | null;
  purchasedAt?: string | null;
  pricePaid?: number | string | null;
  createdAt: string;
  updatedAt?: string;
};

export type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export type CrmOrderOption = {
  id: string;
  title: string;
  orderNumber: string;
};

export function ShoppingListModule({
  currentUserId,
  currentUserName,
  initialCategory = 'ALL',
  isEmbeddedModal = false,
  onCloseModal,
}: {
  currentUserId?: string;
  currentUserName?: string;
  initialCategory?: string;
  isEmbeddedModal?: boolean;
  onCloseModal?: () => void;
}) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [orders, setOrders] = useState<CrmOrderOption[]>([]);

  // Filtering states
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Accordion states for categories & history
  const [officeCollapsed, setOfficeCollapsed] = useState(false);
  const [workshopCollapsed, setWorkshopCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Item Form states (Create & Edit)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<'OFFICE' | 'WORKSHOP'>('WORKSHOP');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnit, setFormUnit] = useState('ks');
  const [formStore, setFormStore] = useState('');
  const [formPriority, setFormPriority] = useState<ShoppingPriority>('NORMAL');
  const [formAssignedEmployeeId, setFormAssignedEmployeeId] = useState('');
  const [formCrmOrderId, setFormCrmOrderId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Item Detail & Action Bottom Sheet
  const [selectedDetailItem, setSelectedDetailItem] = useState<ShoppingItem | null>(null);

  // Receipt Modal
  const [receiptItem, setReceiptItem] = useState<ShoppingItem | null>(null);
  const [pricePaidInput, setPricePaidInput] = useState('');
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Fetch shopping items, employees, and orders on mount
  useEffect(() => {
    fetchItems();
    fetchOptions();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shopping-items');
      const data = await res.json();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load shopping list:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [empRes, orderRes] = await Promise.all([
        fetch('/api/employees').catch(() => null),
        fetch('/api/crm/orders').catch(() => null),
      ]);
      if (empRes && empRes.ok) {
        const empData = await empRes.json();
        if (Array.isArray(empData)) {
          setEmployees(empData.map((e: any) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName })));
        }
      }
      if (orderRes && orderRes.ok) {
        const orderData = await orderRes.json();
        if (Array.isArray(orderData)) {
          setOrders(orderData.map((o: any) => ({ id: o.id, title: o.title, orderNumber: o.orderNumber })));
        }
      }
    } catch (e) {
      console.error('Failed to load filter options:', e);
    }
  };

  // Scroll Lock for Body when Modals or Bottom Sheets are active
  const isAnyModalOpen = Boolean(
    showFormModal || showFilterModal || selectedDetailItem || receiptItem || previewImage
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isAnyModalOpen]);

  // Helper image compressor (Optimized for fast mobile upload and payload size)
  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.70));
        };
        img.onerror = () => reject(new Error('Chyba obrázku'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Chyba souboru'));
      reader.readAsDataURL(file);
    });
  }

  // Handle Photo selection
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, isReceipt = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      if (isReceipt && receiptItem) {
        setReceiptSubmitting(true);
        const res = await fetch(`/api/shopping-items/${receiptItem.id}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPurchased: true, receiptUrl: compressed, pricePaid: pricePaidInput }),
        });
        if (res.ok) {
          const updated = await res.json();
          setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          setReceiptItem(updated);
        }
      } else {
        setFormImageUrl(compressed);
      }
    } catch (err) {
      alert('Fotku se nepodařilo zpracovat.');
    } finally {
      setReceiptSubmitting(false);
    }
  };

  // Open Form Modal for Create or Edit
  const openAddForm = (defaultCategory?: 'OFFICE' | 'WORKSHOP') => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory(defaultCategory || 'WORKSHOP');
    setFormQuantity('');
    setFormUnit('ks');
    setFormStore('');
    setFormPriority('NORMAL');
    setFormAssignedEmployeeId('');
    setFormCrmOrderId('');
    setFormNote('');
    setFormImageUrl('');
    setFormError('');
    setShowFormModal(true);
  };

  const openEditForm = (item: ShoppingItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory((item.category as 'OFFICE' | 'WORKSHOP') || 'WORKSHOP');

    let rawQty = item.quantity || '';
    const unit = item.unit || 'ks';
    if (rawQty && unit && rawQty.endsWith(unit)) {
      rawQty = rawQty.slice(0, -unit.length).trim();
    }
    setFormQuantity(rawQty);
    setFormUnit(unit);

    setFormStore(item.store || '');
    setFormPriority(item.priority || 'NORMAL');
    setFormAssignedEmployeeId(item.assignedEmployeeId || '');
    setFormCrmOrderId(item.crmOrderId || '');
    setFormNote(item.note || '');
    setFormImageUrl(item.imageUrl || '');
    setFormError('');
    setSelectedDetailItem(null);
    setShowFormModal(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Zadejte název položky.');
      return;
    }
    setFormSubmitting(true);
    setFormError('');

    const cleanQty = formQuantity.trim();
    const formattedQty = cleanQty ? (formUnit ? `${cleanQty} ${formUnit}` : cleanQty) : null;

    const payload = {
      title: formTitle.trim(),
      category: formCategory,
      quantity: formattedQty,
      unit: formUnit,
      store: formStore.trim() || null,
      priority: formPriority,
      assignedEmployeeId: formAssignedEmployeeId || null,
      crmOrderId: formCrmOrderId || null,
      note: formNote.trim() || null,
      imageUrl: formImageUrl || null,
    };

    try {
      if (editingItem) {
        // Edit existing
        const res = await fetch(`/api/shopping-items/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Položku se nepodařilo upravit.');
        }
        const updated = await res.json();
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        // Create new
        const res = await fetch('/api/shopping-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Položku se nepodařilo vytvořit.');
        }
        const created = await res.json();
        setItems((prev) => [created, ...prev]);
      }
      setShowFormModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Nastala chyba při ukládání.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Purchased State
  const togglePurchased = async (item: ShoppingItem) => {
    // Optimistic Update
    const nextPurchased = !item.isPurchased;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isPurchased: nextPurchased, purchasedAt: nextPurchased ? new Date().toISOString() : null } : i))
    );
    try {
      const res = await fetch(`/api/shopping-items/${item.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPurchased: nextPurchased }),
      });
      if (!res.ok) throw new Error('Failed toggle');
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      if (selectedDetailItem?.id === item.id) {
        setSelectedDetailItem(updated);
      }
    } catch (err) {
      // Rollback on error
      fetchItems();
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/shopping-items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (selectedDetailItem?.id === id) setSelectedDetailItem(null);
        setDeletingItemId(null);
      }
    } catch (err) {
      alert('Smazání se nepodařilo.');
    }
  };

  // Change priority directly
  const handleChangePriority = async (item: ShoppingItem, newPriority: ShoppingPriority) => {
    try {
      const res = await fetch(`/api/shopping-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        if (selectedDetailItem?.id === item.id) setSelectedDetailItem(updated);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculated Stats (real-time from DB data)
  const fourteenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.getTime();
  }, []);

  const stats = useMemo(() => {
    const unpurchased = items.filter((i) => !i.isPurchased);
    const missingCount = unpurchased.length;
    const urgentCount = unpurchased.filter((i) => i.priority === 'URGENT').length;
    const assignedToMeCount = unpurchased.filter(
      (i) => (currentUserId && i.assignedEmployeeId === currentUserId) || (currentUserName && i.assignedEmployeeName?.toLowerCase().includes(currentUserName.toLowerCase()))
    ).length;
    const purchased14DaysCount = items.filter(
      (i) => i.isPurchased && i.purchasedAt && new Date(i.purchasedAt).getTime() >= fourteenDaysAgo
    ).length;

    return { missingCount, urgentCount, assignedToMeCount, purchased14DaysCount };
  }, [items, currentUserId, currentUserName, fourteenDaysAgo]);

  // Derived Filtered Lists
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      // Category Tab filter
      if (activeCategoryTab === 'OFFICE' && item.category !== 'OFFICE') return false;
      if (activeCategoryTab === 'WORKSHOP' && item.category !== 'WORKSHOP') return false;
      if (activeCategoryTab === 'PURCHASED' && !item.isPurchased) return false;

      // Filter modal / dropdown filters
      if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;
      if (assignmentFilter === 'MINE' && currentUserId && item.assignedEmployeeId !== currentUserId) return false;
      if (assignmentFilter === 'UNASSIGNED' && item.assignedEmployeeId) return false;
      if (assignmentFilter !== 'ALL' && assignmentFilter !== 'MINE' && assignmentFilter !== 'UNASSIGNED' && item.assignedEmployeeId !== assignmentFilter) return false;
      if (storeFilter !== 'ALL' && item.store?.toLowerCase() !== storeFilter.toLowerCase()) return false;

      // Search Query
      if (query) {
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesStore = item.store?.toLowerCase().includes(query) ?? false;
        const matchesNote = item.note?.toLowerCase().includes(query) ?? false;
        const matchesWorker = item.assignedEmployeeName?.toLowerCase().includes(query) ?? false;
        const matchesOrder = item.crmOrder?.title.toLowerCase().includes(query) || item.crmOrder?.orderNumber.toLowerCase().includes(query) || false;
        return matchesTitle || matchesStore || matchesNote || matchesWorker || matchesOrder;
      }
      return true;
    });
  }, [items, activeCategoryTab, priorityFilter, assignmentFilter, storeFilter, searchQuery, currentUserId]);

  // Grouped active items
  const activeOfficeItems = useMemo(() => filteredItems.filter((i) => !i.isPurchased && i.category === 'OFFICE'), [filteredItems]);
  const activeWorkshopItems = useMemo(() => filteredItems.filter((i) => !i.isPurchased && i.category !== 'OFFICE'), [filteredItems]);

  // History purchased items (last 14 days)
  const purchasedHistoryItems = useMemo(() => {
    return items
      .filter((i) => i.isPurchased && i.purchasedAt && new Date(i.purchasedAt).getTime() >= fourteenDaysAgo)
      .sort((a, b) => new Date(b.purchasedAt || b.createdAt).getTime() - new Date(a.purchasedAt || a.createdAt).getTime());
  }, [items, fourteenDaysAgo]);

  const displayedHistoryItems = showAllHistory ? purchasedHistoryItems : purchasedHistoryItems.slice(0, 5);

  // Available unique stores for filter
  const availableStores = useMemo(() => {
    return [...new Set(items.map((i) => i.store).filter((s): s is string => Boolean(s)))].sort();
  }, [items]);

  // Helper Badge for Priority
  const renderPriorityBadge = (priority: ShoppingPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-2xs">
            <AlertCircle size={12} /> Nutné dnes
          </span>
        );
      case 'THIS_WEEK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <Clock size={12} /> Tento týden
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Až bude cesta
          </span>
        );
    }
  };

  return (
    <div className={`min-h-screen text-slate-100 font-sans selection:bg-orange-500 selection:text-white ${isEmbeddedModal ? 'p-0 bg-[#0B1120]' : 'p-3 sm:p-6 bg-[#0B1120]'}`}>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* 1. HEADER NÁKUPŮ */}
        <div className="flex items-center justify-between gap-4 bg-[#151F32] p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 flex-shrink-0">
              <ShoppingBag size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                NÁKUPY
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-400">
                Firemní nákupní seznam SeePOINT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Team preview avatars */}
            <div className="hidden sm:flex items-center -space-x-2 overflow-hidden py-1">
              <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#151F32] bg-blue-500 flex items-center justify-center font-bold text-xs text-white">
                P
              </div>
              <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#151F32] bg-emerald-500 flex items-center justify-center font-bold text-xs text-white">
                E
              </div>
              <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#151F32] bg-amber-500 flex items-center justify-center font-bold text-xs text-white">
                T
              </div>
              <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#151F32] bg-slate-700 flex items-center justify-center font-semibold text-2xs text-slate-300">
                +3
              </div>
            </div>

            {isEmbeddedModal && onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                title="Zavřít"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* 2. RYCHLÝ STATISTICKÝ PŘEHLED (4 KPI KARTY) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card 1: Chybí */}
          <div
            onClick={() => setActiveCategoryTab('ALL')}
            className={`p-3.5 sm:p-4 rounded-2xl bg-[#151F32] border transition cursor-pointer ${
              activeCategoryTab === 'ALL' ? 'border-orange-500/80 bg-orange-500/5' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <ClipboardListIcon size={16} className="text-orange-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chybí</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{stats.missingCount}</div>
            <div className="text-2xs text-slate-400 mt-0.5">položek chybí</div>
          </div>

          {/* Card 2: Urgentní */}
          <div
            onClick={() => setPriorityFilter(priorityFilter === 'URGENT' ? 'ALL' : 'URGENT')}
            className={`p-3.5 sm:p-4 rounded-2xl bg-[#151F32] border transition cursor-pointer ${
              priorityFilter === 'URGENT' ? 'border-rose-500/80 bg-rose-500/10' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-rose-400 mb-1">
              <AlertCircle size={16} />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Urgentní</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-400">{stats.urgentCount}</div>
            <div className="text-2xs text-slate-400 mt-0.5">nutné dnes</div>
          </div>

          {/* Card 3: Přiřazeno mně */}
          <div
            onClick={() => setAssignmentFilter(assignmentFilter === 'MINE' ? 'ALL' : 'MINE')}
            className={`p-3.5 sm:p-4 rounded-2xl bg-[#151F32] border transition cursor-pointer ${
              assignmentFilter === 'MINE' ? 'border-blue-500/80 bg-blue-500/10' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <User size={16} />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Přiřazeno mně</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-400">{stats.assignedToMeCount}</div>
            <div className="text-2xs text-slate-400 mt-0.5">moje nákupy</div>
          </div>

          {/* Card 4: Koupeno (14 dní) */}
          <div
            onClick={() => setActiveCategoryTab('PURCHASED')}
            className={`p-3.5 sm:p-4 rounded-2xl bg-[#151F32] border transition cursor-pointer ${
              activeCategoryTab === 'PURCHASED' ? 'border-emerald-500/80 bg-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <CheckCircle2 size={16} />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Koupeno</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{stats.purchased14DaysCount}</div>
            <div className="text-2xs text-slate-400 mt-0.5">za 14 dní</div>
          </div>
        </div>

        {/* 3. FILTRY KATEGORIÍ (HORIZONTÁLNÍ PŘEPÍNAČE) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 flex-shrink-0 cursor-pointer ${
              activeCategoryTab === 'ALL'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-md'
                : 'bg-[#151F32] text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            Vše <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-2xs text-slate-300">{items.filter((i) => !i.isPurchased).length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategoryTab('OFFICE')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 flex-shrink-0 cursor-pointer ${
              activeCategoryTab === 'OFFICE'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50 shadow-md'
                : 'bg-[#151F32] text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Building2 size={14} className="text-blue-400" /> Kancelář{' '}
            <span className="px-1.5 py-0.5 rounded-full bg-blue-950 text-2xs text-blue-300">{items.filter((i) => !i.isPurchased && i.category === 'OFFICE').length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategoryTab('WORKSHOP')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 flex-shrink-0 cursor-pointer ${
              activeCategoryTab === 'WORKSHOP'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md'
                : 'bg-[#151F32] text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Wrench size={14} className="text-emerald-400" /> Dílna & výroba{' '}
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-2xs text-emerald-300">{items.filter((i) => !i.isPurchased && i.category !== 'OFFICE').length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategoryTab('PURCHASED')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 flex-shrink-0 cursor-pointer ${
              activeCategoryTab === 'PURCHASED'
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50 shadow-md'
                : 'bg-[#151F32] text-slate-400 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <ShoppingBag size={14} className="text-orange-400" /> Zakoupeno{' '}
            <span className="px-1.5 py-0.5 rounded-full bg-orange-950 text-2xs text-orange-300">{stats.purchased14DaysCount}</span>
          </button>
        </div>

        {/* 4. VYHLEDÁVÁNÍ A HLAVNÍ CTA TLAČÍTKO */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat položku, obchod, zakázku…"
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#151F32] border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/80 transition"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              priorityFilter !== 'ALL' || assignmentFilter !== 'ALL' || storeFilter !== 'ALL'
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/60'
                : 'bg-[#151F32] text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>Filtr</span>
            {(priorityFilter !== 'ALL' || assignmentFilter !== 'ALL' || storeFilter !== 'ALL') && (
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            )}
          </button>

          {/* MAIN CTA BUTTON */}
          <button
            type="button"
            onClick={() => openAddForm()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-black shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
          >
            <Plus size={20} className="stroke-[3]" />
            <span>Přidat položku</span>
          </button>
        </div>

        {/* 5. SEZNAMEK POLOŽEK KATEGORIE KANCELÁŘ */}
        {(activeCategoryTab === 'ALL' || activeCategoryTab === 'OFFICE') && (
          <div className="bg-[#151F32] rounded-2xl border border-blue-500/20 overflow-hidden shadow-lg">
            <div
              onClick={() => setOfficeCollapsed(!officeCollapsed)}
              className="px-4 sm:px-5 py-3.5 bg-blue-950/40 border-b border-blue-500/20 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5">
                <Building2 size={18} className="text-blue-400" />
                <h2 className="text-sm font-black tracking-wide uppercase text-blue-300">KANCELÁŘ</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">
                  {activeOfficeItems.length} položky
                </span>
              </div>
              <button type="button" className="text-blue-400 hover:text-blue-200">
                {officeCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>

            {!officeCollapsed && (
              <div className="divide-y divide-slate-800/80">
                {activeOfficeItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                    <CheckCircle2 size={24} className="text-slate-600" />
                    <span>V nabídce kanceláře nic nechybí 🎉</span>
                  </div>
                ) : (
                  activeOfficeItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onToggle={togglePurchased}
                      onSelectDetail={setSelectedDetailItem}
                      renderPriorityBadge={renderPriorityBadge}
                    />
                  ))
                )}
                <div className="p-3 bg-blue-950/20 text-center">
                  <button
                    type="button"
                    onClick={() => openAddForm('OFFICE')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition"
                  >
                    <Plus size={14} /> Přidat položku do této kategorie
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. SEZNAMEK POLOŽEK KATEGORIE DÍLNA & VÝROBA */}
        {(activeCategoryTab === 'ALL' || activeCategoryTab === 'WORKSHOP') && (
          <div className="bg-[#151F32] rounded-2xl border border-emerald-500/20 overflow-hidden shadow-lg">
            <div
              onClick={() => setWorkshopCollapsed(!workshopCollapsed)}
              className="px-4 sm:px-5 py-3.5 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5">
                <Wrench size={18} className="text-emerald-400" />
                <h2 className="text-sm font-black tracking-wide uppercase text-emerald-300">DÍLNA & VÝROBA</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                  {activeWorkshopItems.length} položky
                </span>
              </div>
              <button type="button" className="text-emerald-400 hover:text-emerald-200">
                {workshopCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>

            {!workshopCollapsed && (
              <div className="divide-y divide-slate-800/80">
                {activeWorkshopItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                    <CheckCircle2 size={24} className="text-slate-600" />
                    <span>V dílně a výrobě nic nechybí 🎉</span>
                  </div>
                ) : (
                  activeWorkshopItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onToggle={togglePurchased}
                      onSelectDetail={setSelectedDetailItem}
                      renderPriorityBadge={renderPriorityBadge}
                    />
                  ))
                )}
                <div className="p-3 bg-emerald-950/20 text-center">
                  <button
                    type="button"
                    onClick={() => openAddForm('WORKSHOP')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <Plus size={14} /> Přidat položku do této kategorie
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. ZAKOUPENO V POSLEDNÍCH 14 DNECH (HISTORIE) */}
        {(activeCategoryTab === 'ALL' || activeCategoryTab === 'PURCHASED') && purchasedHistoryItems.length > 0 && (
          <div className="bg-[#151F32] rounded-2xl border border-orange-500/30 overflow-hidden shadow-lg">
            <div
              onClick={() => setHistoryCollapsed(!historyCollapsed)}
              className="px-4 sm:px-5 py-3.5 bg-orange-950/30 border-b border-orange-500/20 flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={18} className="text-orange-400" />
                <h2 className="text-sm font-black tracking-wide uppercase text-orange-300">ZAKOUPENO V POSLEDNÍCH 14 DNECH</h2>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold">
                  {purchasedHistoryItems.length}
                </span>
              </div>
              <button type="button" className="text-orange-400 hover:text-orange-200">
                {historyCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>

            {!historyCollapsed && (
              <div className="divide-y divide-slate-800/80">
                {displayedHistoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => setSelectedDetailItem(item)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePurchased(item);
                        }}
                        className="text-emerald-500 hover:text-emerald-400 transition flex-shrink-0"
                      >
                        <CheckCircle2 size={22} className="fill-emerald-500/20" />
                      </button>

                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(item.imageUrl!);
                          }}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 flex-shrink-0">
                          <Package size={18} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-400 line-through truncate">{item.title}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 truncate mt-0.5">
                          <span>{item.store || 'Obchod neuveden'}</span>
                          <span>•</span>
                          <span>{item.purchasedByUserName || item.addedByUserName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 text-right">
                      <div>
                        <div className="text-xs font-semibold text-slate-400">
                          {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString('cs-CZ') : ''}
                        </div>
                        <div className="text-xs font-black text-slate-300 mt-0.5">{item.quantity || '1 ks'}</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptItem(item);
                          setPricePaidInput(item.pricePaid ? String(item.pricePaid) : '');
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition ${
                          item.receiptUrl
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <Receipt size={14} /> Účtenka
                      </button>
                    </div>
                  </div>
                ))}

                {purchasedHistoryItems.length > 5 && (
                  <div className="p-3 bg-slate-900/40 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="text-xs font-bold text-orange-400 hover:text-orange-300 transition"
                    >
                      {showAllHistory ? 'Zobrazit méně' : `Zobrazit všechny zakoupené (${purchasedHistoryItems.length})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* 8. MODAL / BOTTOM SHEET PRO FORMULÁŘ (+ PŘIDAT / UPRAVIT POLOŽKU) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#151F32] rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                {editingItem ? 'Upravit položku' : 'Přidat položku do nákupů'}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Název položky */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Název položky <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Např. Vrut 4x50, Papír A4, Kotouče řezné"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Kategorie & Priorita */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Kategorie</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as 'OFFICE' | 'WORKSHOP')}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="WORKSHOP">🛠️ Dílna & výroba</option>
                    <option value="OFFICE">🏢 Kancelář</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Priorita</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as ShoppingPriority)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="NORMAL">Až bude cesta</option>
                    <option value="THIS_WEEK">Tento týden</option>
                    <option value="URGENT">🚨 Nutné dnes</option>
                  </select>
                </div>
              </div>

              {/* Množství + Jednotka & Obchod */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Množství</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      placeholder="Např. 2, 100"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                    <select
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="px-2 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
                    >
                      <option value="ks">ks</option>
                      <option value="bal.">bal.</option>
                      <option value="m">m</option>
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Obchod</label>
                  <input
                    type="text"
                    value={formStore}
                    onChange={(e) => setFormStore(e.target.value)}
                    placeholder="Hornbach, Alza, DEK..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Přiřadit zaměstnanci & Zakázka */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Přiřadit komu</label>
                  <select
                    value={formAssignedEmployeeId}
                    onChange={(e) => setFormAssignedEmployeeId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Nepřiřazeno --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        👤 {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Zakázka (volitelné)</label>
                  <select
                    value={formCrmOrderId}
                    onChange={(e) => setFormCrmOrderId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="">-- Bez zakázky --</option>
                    {orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        🛒 {ord.orderNumber} - {ord.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Poznámka */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Poznámka (volitelné)</label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Bližší specifikace, rozměry nebo pokyny..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Foto položky */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Foto položky</label>
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e)} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-2"
                  >
                    <Camera size={16} /> Otevřít foto / kameru
                  </button>
                  {formImageUrl && (
                    <div className="relative">
                      <img src={formImageUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                      <button type="button" onClick={() => setFormImageUrl('')} className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 text-white text-xs font-black shadow-lg shadow-orange-500/20 flex items-center gap-2 transition cursor-pointer"
                >
                  {formSubmitting ? 'Ukládám...' : editingItem ? 'Uložit změny' : 'Přidat položku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. DETAIL POLOŽKY BOTTOM SHEET / DIALOG */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-[#151F32] rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Detail položky</h3>
              <button type="button" onClick={() => setSelectedDetailItem(null)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            {/* Title & Badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {selectedDetailItem.imageUrl ? (
                  <img
                    src={selectedDetailItem.imageUrl}
                    alt=""
                    onClick={() => setPreviewImage(selectedDetailItem.imageUrl!)}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-700 flex-shrink-0 cursor-pointer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Package size={24} />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-black text-white">{selectedDetailItem.title}</h2>
                  <div className="mt-1">{renderPriorityBadge(selectedDetailItem.priority)}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-black text-orange-400">{selectedDetailItem.quantity || '1 ks'}</div>
                {selectedDetailItem.pricePaid && (
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">{selectedDetailItem.pricePaid} Kč</div>
                )}
              </div>
            </div>

            {/* Properties Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Building2 size={14} /> Kategorie
                </span>
                <span className="font-bold text-slate-200">
                  {selectedDetailItem.category === 'OFFICE' ? '🏢 Kancelář' : '🛠️ Dílna & výroba'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Store size={14} /> Obchod
                </span>
                <span className="font-bold text-slate-200">{selectedDetailItem.store || 'Neuvedeno'}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <User size={14} /> Přiřazeno
                </span>
                <span className="font-bold text-slate-200">{selectedDetailItem.assignedEmployeeName || 'Nepřiřazeno'}</span>
              </div>

              {selectedDetailItem.crmOrder && (
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Briefcase size={14} /> Zakázka
                  </span>
                  <span className="font-bold text-orange-400">{selectedDetailItem.crmOrder.orderNumber} - {selectedDetailItem.crmOrder.title}</span>
                </div>
              )}

              {selectedDetailItem.note && (
                <div className="pt-1">
                  <span className="text-slate-400 font-semibold block mb-0.5">Poznámka:</span>
                  <p className="text-slate-300 font-normal italic">{selectedDetailItem.note}</p>
                </div>
              )}
            </div>

            {/* Meta info */}
            <div className="bg-slate-900/40 rounded-xl p-3 text-2xs text-slate-400 space-y-1">
              <div>
                Stav: <strong className={selectedDetailItem.isPurchased ? 'text-emerald-400' : 'text-amber-400'}>
                  {selectedDetailItem.isPurchased ? 'Koupeno' : 'Chybí v nákupech'}
                </strong>
              </div>
              <div>Přidáno: {new Date(selectedDetailItem.createdAt).toLocaleDateString('cs-CZ')} • {selectedDetailItem.addedByUserName}</div>
              {selectedDetailItem.purchasedAt && (
                <div>Nákup: {new Date(selectedDetailItem.purchasedAt).toLocaleDateString('cs-CZ')} • {selectedDetailItem.purchasedByUserName}</div>
              )}
            </div>

            {/* Actions Menu */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-slate-500">Akce</h4>

              <button
                type="button"
                onClick={() => togglePurchased(selectedDetailItem)}
                className="w-full p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 transition"
              >
                <CheckCircle2 size={16} />
                <span>{selectedDetailItem.isPurchased ? 'Vrátit zpět mezi chybějící' : 'Označit jako koupeno'}</span>
              </button>

              <button
                type="button"
                onClick={() => openEditForm(selectedDetailItem)}
                className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition"
              >
                <SlidersHorizontal size={16} />
                <span>Upravit položku</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleChangePriority(selectedDetailItem, selectedDetailItem.priority === 'URGENT' ? 'NORMAL' : 'URGENT')}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <AlertCircle size={15} /> Změnit prioritu
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReceiptItem(selectedDetailItem);
                    setSelectedDetailItem(null);
                  }}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Receipt size={15} /> Účtenka & Cena
                </button>
              </div>

              {deletingItemId === selectedDetailItem.id ? (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-center space-y-2">
                  <p className="text-xs text-rose-200 font-bold">Opravdu chcete tuto položku smazat?</p>
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => handleDeleteItem(selectedDetailItem.id)} className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold">Ano, smazat</button>
                    <button type="button" onClick={() => setDeletingItemId(null)} className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Zrušit</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeletingItemId(selectedDetailItem.id)}
                  className="w-full p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 transition"
                >
                  <Trash2 size={16} /> Smazat položku
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. FILTER MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#151F32] rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <SlidersHorizontal size={18} /> Filtrovat položky
              </h3>
              <button type="button" onClick={() => setShowFilterModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Priorita</label>
              <div className="grid grid-cols-2 gap-2">
                {['ALL', 'URGENT', 'THIS_WEEK', 'NORMAL'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriorityFilter(p)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      priorityFilter === p ? 'bg-orange-500/20 text-orange-300 border-orange-500/60' : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {p === 'ALL' ? 'Všechny priority' : p === 'URGENT' ? '🚨 Nutné dnes' : p === 'THIS_WEEK' ? 'Tento týden' : 'Až bude cesta'}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Přiřazení</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentFilter('ALL')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${assignmentFilter === 'ALL' ? 'bg-orange-500/20 text-orange-300 border-orange-500/60' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                >
                  Všichni
                </button>
                <button
                  type="button"
                  onClick={() => setAssignmentFilter('MINE')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${assignmentFilter === 'MINE' ? 'bg-blue-500/20 text-blue-300 border-blue-500/60' : 'bg-slate-900 text-slate-400 border-slate-800'}`}
                >
                  Moje nákupy
                </button>
              </div>
            </div>

            {/* Store Filter */}
            {availableStores.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Obchod</label>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value="ALL">Všechny obchody</option>
                  {availableStores.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter('ALL');
                  setAssignmentFilter('ALL');
                  setStoreFilter('ALL');
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-200"
              >
                Zrušit filtry
              </button>

              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/20"
              >
                Zobrazit výsledky
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. RECEIPT & PRICE PAID MODAL */}
      {receiptItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#151F32] rounded-3xl border border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Receipt size={18} className="text-emerald-400" /> Účtenka & Cena nákupu
              </h3>
              <button type="button" onClick={() => setReceiptItem(null)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Zaplacená cena (Kč)</label>
              <input
                type="number"
                step="0.01"
                value={pricePaidInput}
                onChange={(e) => setPricePaidInput(e.target.value)}
                placeholder="Např. 998"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Foto účtenky</label>
              <input ref={receiptFileInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoSelect(e, true)} className="hidden" />
              <button
                type="button"
                onClick={() => receiptFileInputRef.current?.click()}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-2"
              >
                <Camera size={16} /> {receiptItem.receiptUrl ? 'Změnit fotku účtenky' : 'Nahrát foto účtenky'}
              </button>

              {receiptItem.receiptUrl && (
                <div className="mt-2 text-center">
                  <img
                    src={receiptItem.receiptUrl}
                    alt=""
                    onClick={() => setPreviewImage(receiptItem.receiptUrl!)}
                    className="w-full h-32 rounded-xl object-cover border border-slate-700 cursor-pointer"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  setReceiptSubmitting(true);
                  const res = await fetch(`/api/shopping-items/${receiptItem.id}/toggle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isPurchased: true, pricePaid: pricePaidInput }),
                  });
                  if (res.ok) {
                    const updated = await res.json();
                    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                  }
                  setReceiptSubmitting(false);
                  setReceiptItem(null);
                }}
                disabled={receiptSubmitting}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black"
              >
                {receiptSubmitting ? 'Ukládám...' : 'Uložit cenu a účtenku'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. FULLIMAGE PREVIEW POPUP */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl max-h-[90vh]">
            <img src={previewImage} alt="" className="rounded-2xl max-w-full max-h-[85vh] object-contain shadow-2xl" />
            <button type="button" onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Single Item Row Component
function ShoppingItemRow({
  item,
  onToggle,
  onSelectDetail,
  renderPriorityBadge,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onSelectDetail: (item: ShoppingItem) => void;
  renderPriorityBadge: (p: ShoppingPriority) => React.ReactNode;
}) {
  return (
    <div
      onClick={() => onSelectDetail(item)}
      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-800/50 transition cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(item);
          }}
          className="text-slate-500 hover:text-emerald-400 transition flex-shrink-0"
        >
          {item.isPurchased ? (
            <CheckCircle2 size={22} className="text-emerald-500 fill-emerald-500/20" />
          ) : (
            <Circle size={22} className="group-hover:border-emerald-500" />
          )}
        </button>

        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700 flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
            <Package size={18} />
          </div>
        )}

        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-100 group-hover:text-orange-400 transition truncate">{item.title}</div>
          <div className="text-xs text-slate-400 flex items-center gap-2 truncate mt-0.5">
            <span>{item.store || 'Obchod neuveden'}</span>
            <span>•</span>
            <span>{item.assignedEmployeeName || item.addedByUserName}</span>
            {item.crmOrder && (
              <>
                <span>•</span>
                <span className="text-orange-400/90 font-semibold">{item.crmOrder.orderNumber}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 text-right">
        {renderPriorityBadge(item.priority)}
        <div className="text-xs font-black text-slate-200 min-w-[36px]">{item.quantity || '1 ks'}</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectDetail(item);
          }}
          className="p-1 text-slate-500 hover:text-slate-300"
        >
          <MoreVertical size={16} />
        </button>
      </div>
    </div>
  );
}

function ClipboardListIcon(props: any) {
  return <ShoppingBag {...props} />;
}
