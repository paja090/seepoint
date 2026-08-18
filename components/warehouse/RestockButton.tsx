'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, CheckCircle2, Loader2 } from 'lucide-react';

export function RestockButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleRestock() {
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouse/items/${itemId}/restock`, {
        method: 'POST',
      });
      if (res.ok) {
        setAdded(true);
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (added) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-900">
        <CheckCircle2 size={13} className="text-emerald-700" />
        <span>Přidáno do Nákupů</span>
      </span>
    );
  }

  return (
    <button
      onClick={handleRestock}
      disabled={loading || isPending}
      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-rose-700 transition shadow-2xs disabled:opacity-50"
      title={`Přidat požadavky na nákup ${itemName} do modulu Nákupy`}
    >
      {loading || isPending ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
      <span>🛒 Objednat / Přidat do Nákupů</span>
    </button>
  );
}
