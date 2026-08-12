'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  CheckSquare,
  Square,
  Building2,
  Wrench,
  Camera,
  Trash2,
  X,
  CheckCircle2,
  Filter,
  Image,
  Tag,
  Clock,
  UserCheck,
} from 'lucide-react';

export type ShoppingItem = {
  id: string;
  category: 'OFFICE' | 'WORKSHOP';
  title: string;
  quantity?: string | null;
  note?: string | null;
  imageUrl?: string | null;
  isPurchased: boolean;
  addedByUserName: string;
  purchasedByUserName?: string | null;
  purchasedAt?: string | null;
  createdAt: string;
};

export function CompanyShoppingListModal({
  isOpen,
  onClose,
  currentUserName,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserName: string;
}) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'OFFICE' | 'WORKSHOP'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'TO_BUY' | 'PURCHASED' | 'ALL'>('TO_BUY');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'OFFICE' | 'WORKSHOP'>('WORKSHOP');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Image preview popup & file input
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1600;
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Chyba při načítání obrázku.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Chyba při čtení souboru.'));
      reader.readAsDataURL(file);
    });
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSubmitting(true);
      const compressedDataUrl = await compressImage(file);
      setImageUrl(compressedDataUrl);
    } catch (err) {
      alert('Fotku se nepodařilo zpracovat.');
    } finally {
      setSubmitting(false);
    }
  };

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

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/shopping-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          quantity: quantity.trim() || undefined,
          note: note.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      const newItem = await res.json();
      if (!res.ok) throw new Error(newItem.error || 'Přidání selhalo.');

      setItems((prev) => [newItem, ...prev]);
      setTitle('');
      setQuantity('');
      setNote('');
      setImageUrl('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePurchased = async (item: ShoppingItem) => {
    try {
      const res = await fetch(`/api/shopping-items/${item.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const updated = await res.json();
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      }
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Opravdu chcete tuto položku smazat z nákupního seznamu?')) return;
    try {
      const res = await fetch(`/api/shopping-items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter((item) => {
    if (activeCategory !== 'ALL' && item.category !== activeCategory) return false;
    if (statusFilter === 'TO_BUY' && item.isPurchased) return false;
    if (statusFilter === 'PURCHASED' && !item.isPurchased) return false;
    return true;
  });

  const officeToBuyCount = items.filter((i) => i.category === 'OFFICE' && !i.isPurchased).length;
  const workshopToBuyCount = items.filter((i) => i.category === 'WORKSHOP' && !i.isPurchased).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 font-black text-slate-950 shadow-md">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                🛒 Firemní nákupy & Zásoby
              </h2>
              <p className="text-xs font-bold text-slate-400">
                Nákupní seznam pro Kancelář & Dílnu SeePOINT
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Tabs & Add Trigger Bar */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveCategory('ALL')}
                className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                  activeCategory === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Všechny sekce ({items.filter((i) => !i.isPurchased).length})
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('OFFICE')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                  activeCategory === 'OFFICE'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-400 hover:bg-purple-950/40'
                }`}
              >
                <Building2 size={14} />
                <span>🏢 Kancelář ({officeToBuyCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('WORKSHOP')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                  activeCategory === 'WORKSHOP'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-400 hover:bg-amber-950/40'
                }`}
              >
                <Wrench size={14} />
                <span>🛠️ Dílna & Výroba ({workshopToBuyCount})</span>
              </button>
            </div>

            {/* Right Controls: Filter & Add Button */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 outline-none focus:border-amber-500"
              >
                <option value="TO_BUY">🛒 Chybí (K nákupu)</option>
                <option value="PURCHASED">✓ Koupeno (Historie)</option>
                <option value="ALL">📋 Všechny položky</option>
              </select>

              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-3.5 py-1.5 text-xs font-black text-slate-950 hover:brightness-110 active:scale-95 transition shadow-md"
              >
                <Plus size={16} />
                <span>Přidat věc k nákupu</span>
              </button>
            </div>
          </div>

          {/* Collapsible Form to Add Item */}
          {showAddForm && (
            <form onSubmit={handleAddItem} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <p className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  ➕ Nový požadavek na nákup
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold"
                >
                  Zrušit
                </button>
              </div>

              {error && <p className="text-xs font-bold text-red-400">{error}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                    Co je potřeba koupit? *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Např. Papír A4, Vrtáky 8mm, Páska 50mm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                    Sekce / Oddělení *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  >
                    <option value="WORKSHOP">🛠️ Dílna & Výroba (Nářadí, pásky, materiál)</option>
                    <option value="OFFICE">🏢 Kancelář (Papír, toner, káva, potřeby)</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                    Množství / Balení (volitelné)
                  </label>
                  <input
                    type="text"
                    placeholder="Např. 2 krabice, 50 ks, 1 balení"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                    Poznámka / Značka / Kde koupit (volitelné)
                  </label>
                  <input
                    type="text"
                    placeholder="Např. BauMax Ostrava, značka Pattex"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                  Fotka dílu / štítku (Vyfotit mobilní kalkulačkou/galerií)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {imageUrl ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-800 bg-emerald-950/60 p-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={imageUrl} alt="Náhled fotky" className="h-10 w-10 rounded-lg object-cover border border-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-emerald-300 truncate">📷 Fotka z fotogalerie/fotoaparátu připojena</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-slate-900 p-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    <Camera size={16} className="text-amber-400" />
                    <span>📷 Vyfotit fotoaparátem / Vybrat z galerie</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 transition shadow-md disabled:opacity-50"
              >
                {submitting ? 'Ukládám…' : '✓ Přidat do nákupního seznamu'}
              </button>
            </form>
          )}
        </div>

        {/* Checklist Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Načítám nákupní seznam…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-xs font-bold text-slate-500 space-y-1">
              <p>V tomto výběru nejsou žádné položky.</p>
              <p className="text-slate-400">Přidejte novou věc tlačítkem výše.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.isPurchased
                    ? 'border-slate-800/80 bg-slate-950/60 opacity-60'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Interactive Checkbox */}
                  <button
                    type="button"
                    onClick={() => togglePurchased(item)}
                    className="mt-0.5 text-amber-400 hover:text-amber-300 transition shrink-0"
                    title={item.isPurchased ? 'Označit jako k nákupu' : 'Označit jako koupeno'}
                  >
                    {item.isPurchased ? (
                      <CheckSquare size={22} className="text-emerald-400" />
                    ) : (
                      <Square size={22} className="text-slate-400 hover:text-amber-400" />
                    )}
                  </button>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.category === 'OFFICE' ? (
                        <span className="rounded-md bg-purple-950 border border-purple-800 px-2 py-0.5 text-[10px] font-black text-purple-300">
                          🏢 Kancelář
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-950 border border-amber-800 px-2 py-0.5 text-[10px] font-black text-amber-300">
                          🛠️ Dílna & Výroba
                        </span>
                      )}

                      {item.quantity && (
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-200">
                          📦 {item.quantity}
                        </span>
                      )}

                      {item.isPurchased && (
                        <span className="rounded-md bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-black text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          Koupeno ({item.purchasedByUserName || 'Koupeno'})
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-sm font-black text-white ${
                        item.isPurchased ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {item.title}
                    </p>

                    {item.note && (
                      <p className="text-xs font-bold text-slate-400">
                        📝 {item.note}
                      </p>
                    )}

                    <p className="text-[11px] font-extrabold text-slate-500">
                      Zadal/a: {item.addedByUserName} · {new Date(item.createdAt).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>
                </div>

                {/* Right Photo Thumbnail & Delete Button */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {item.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(item.imageUrl!)}
                      className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 hover:scale-105 transition"
                      title="Zobrazit fotku dílu"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="rounded-xl p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                    title="Odstranit"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 p-2">
            <img
              src={previewImage}
              alt="Fotka položky"
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
            <p className="text-center text-xs font-bold text-slate-400 mt-2">
              Kliknutím zavřete
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
