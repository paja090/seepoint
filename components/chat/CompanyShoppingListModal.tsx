'use client';

import React, { useState, useEffect } from 'react';
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
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
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

  // Split unpurchased items by section
  const officeToBuy = items.filter((i) => i.category === 'OFFICE' && !i.isPurchased);
  const workshopToBuy = items.filter((i) => i.category === 'WORKSHOP' && !i.isPurchased);

  // Filter items purchased in the last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
  const recentPurchased = items.filter(
    (i) => i.isPurchased && i.purchasedAt && new Date(i.purchasedAt) >= fourteenDaysAgo
  );

  const officePurchased = recentPurchased.filter((i) => i.category === 'OFFICE');
  const workshopPurchased = recentPurchased.filter((i) => i.category === 'WORKSHOP');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overscroll-none animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-3xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden flex flex-col h-[90dvh] sm:max-h-[92vh]">
        {/* Header - NÁKUPY */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 font-black text-slate-950 shadow-md">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-widest uppercase">
                NÁKUPY
              </h2>
              <p className="text-xs font-bold text-slate-400">
                Firemní nákupní seznam SeePOINT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-3.5 py-1.5 text-xs font-black text-slate-950 hover:brightness-110 active:scale-95 transition shadow-md"
            >
              <Plus size={16} />
              <span>Přidat věc k nákupu</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Collapsible Form to Add Item */}
        {showAddForm && (
          <div className="p-4 bg-slate-950/90 border-b border-slate-800">
            <form onSubmit={handleAddItem} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3 animate-in fade-in duration-200">
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
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                    Sekce / Oddělení *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  >
                    <option value="WORKSHOP">🛠️ DÍLNA (Nářadí, pásky, materiál)</option>
                    <option value="OFFICE">🏢 KANCELÁŘ (Papír, toner, káva, potřeby)</option>
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
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                    Poznámka / Značka (volitelné)
                  </label>
                  <input
                    type="text"
                    placeholder="Např. BauMax Ostrava, značka Pattex"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-400 block mb-1">
                  Fotka dílu / štítku (Vyfotit z fotoaparátu / Vybrat z galerie)
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
                      <span className="text-xs font-bold text-emerald-300 truncate">📷 Fotka z mobilu připojena</span>
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-800 bg-slate-950 p-3 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition"
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
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain touch-pan-y">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-500">
              Načítám nákupní seznam…
            </div>
          ) : (
            <>
              {/* TOP SPLIT SECTION: 💼 KANCELÁŘ vs 🛠️ DÍLNA (2-Column Layout) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 🏢 KANCELÁŘ COLUMN */}
                <div className="rounded-2xl border border-blue-500/20 bg-slate-950/60 p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-blue-500/30 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-400" />
                        <h3 className="font-extrabold text-sm text-blue-400 tracking-wider uppercase">
                          🏢 KANCELÁŘ
                        </h3>
                      </div>
                      <span className="rounded-full bg-blue-950 border border-blue-800 px-2.5 py-0.5 text-[10px] font-black text-blue-300">
                        {officeToBuy.length} chybí
                      </span>
                    </div>

                    <div className="space-y-2">
                      {officeToBuy.length === 0 ? (
                        <div className="py-6 text-center text-xs font-bold text-slate-500 border border-dashed border-slate-800/80 rounded-xl">
                          V Kanceláři nic nechybí 👍
                        </div>
                      ) : (
                        officeToBuy.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 p-3 hover:border-slate-700 transition"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => togglePurchased(item)}
                                className="mt-0.5 text-slate-500 hover:text-emerald-400 transition shrink-0"
                                title="Označit jako koupeno"
                              >
                                <Circle size={20} />
                              </button>

                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-black text-white leading-snug">
                                  {item.title}
                                </p>

                                {item.quantity && (
                                  <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-extrabold text-slate-300">
                                    📦 {item.quantity}
                                  </span>
                                )}

                                {item.note && (
                                  <p className="text-[11px] font-medium text-slate-400">
                                    📝 {item.note}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(item.imageUrl!)}
                                  className="h-10 w-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 hover:scale-105 transition"
                                  title="Zobrazit fotku dílu"
                                >
                                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                                title="Odstranit"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 🛠️ DÍLNA COLUMN */}
                <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-emerald-400" />
                        <h3 className="font-extrabold text-sm text-emerald-400 tracking-wider uppercase">
                          🛠️ DÍLNA & VÝROBA
                        </h3>
                      </div>
                      <span className="rounded-full bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                        {workshopToBuy.length} chybí
                      </span>
                    </div>

                    <div className="space-y-2">
                      {workshopToBuy.length === 0 ? (
                        <div className="py-6 text-center text-xs font-bold text-slate-500 border border-dashed border-slate-800/80 rounded-xl">
                          Na Dílně nic nechybí 👍
                        </div>
                      ) : (
                        workshopToBuy.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 p-3 hover:border-slate-700 transition"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => togglePurchased(item)}
                                className="mt-0.5 text-slate-500 hover:text-emerald-400 transition shrink-0"
                                title="Označit jako koupeno"
                              >
                                <Circle size={20} />
                              </button>

                              <div className="min-w-0 space-y-0.5">
                                <p className="text-xs font-black text-white leading-snug">
                                  {item.title}
                                </p>

                                {item.quantity && (
                                  <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-extrabold text-slate-300">
                                    📦 {item.quantity}
                                  </span>
                                )}

                                {item.note && (
                                  <p className="text-[11px] font-medium text-slate-400">
                                    📝 {item.note}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(item.imageUrl!)}
                                  className="h-10 w-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 hover:scale-105 transition"
                                  title="Zobrazit fotku dílu"
                                >
                                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                                title="Odstranit"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM SECTION: 📅 ZAKOUPENO V POSLEDNÍCH 14 DNECH */}
              <div className="rounded-2xl border border-amber-500/20 bg-slate-950/80 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest">
                      📅 ZAKOUPENO V POSLEDNÍCH 14 DNECH
                    </h4>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400">
                    {recentPurchased.length} položek
                  </span>
                </div>

                {recentPurchased.length === 0 ? (
                  <div className="py-4 text-center text-xs font-bold text-slate-500">
                    V posledních 14 dnech nebyly zakoupeny žádné položky.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Office Purchased */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase text-purple-400 tracking-wider">🏢 Kancelář</p>
                      {officePurchased.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">Žádné zakoupené položky</p>
                      ) : (
                        officePurchased.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 p-2 text-xs border border-slate-800/60 opacity-75 hover:opacity-100 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => togglePurchased(item)}
                                className="text-emerald-400 hover:text-amber-400 shrink-0"
                                title="Vrátit k nákupu"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <span className="line-through text-slate-300 font-semibold truncate">{item.title}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString('cs-CZ') : '_ / _ / _'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Workshop Purchased */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">🛠️ Dílna & Výroba</p>
                      {workshopPurchased.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">Žádné zakoupené položky</p>
                      ) : (
                        workshopPurchased.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/60 p-2 text-xs border border-slate-800/60 opacity-75 hover:opacity-100 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => togglePurchased(item)}
                                className="text-emerald-400 hover:text-amber-400 shrink-0"
                                title="Vrátit k nákupu"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <span className="line-through text-slate-300 font-semibold truncate">{item.title}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString('cs-CZ') : '_ / _ / _'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Footer Info Note */}
                <div className="pt-2 border-t border-slate-900 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                  <Info size={14} className="text-amber-400 shrink-0" />
                  <span>Položky se automaticky odstraní po 14 dnech od zakoupení.</span>
                </div>
              </div>
            </>
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
