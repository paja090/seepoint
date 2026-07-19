'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, Loader2, Pencil, Plus, X } from 'lucide-react';

type PriceListItemJson = {
  id: string;
  name: string;
  carrierType: string | null;
  mediaType: string | null;
  rentalMonths: number;
  minQuantity: number;
  rentalPrice: string;
  productionPrice: string;
  totalPrice: string;
  validFrom: string;
};

const carrierTypes = [
  'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE',
  'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER',
  'NAVIGATION', 'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'
] as const;

const mediaTypes = [
  'NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER',
  'FACADE', 'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER',
  'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'
] as const;

const money = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });

const emptyForm = {
  id: '',
  name: '',
  carrierType: '',
  mediaType: '',
  rentalMonths: 1,
  minQuantity: 1,
  rentalPrice: '0',
  productionPrice: '0',
  validFrom: new Date().toISOString().split('T')[0],
};

export function PriceListSettings({ initialPrices }: { initialPrices: PriceListItemJson[] }) {
  const router = useRouter();
  const [prices, setPrices] = useState<PriceListItemJson[]>(initialPrices);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = Boolean(form.id);
      const url = isEdit ? `/api/price-list-items/${form.id}` : '/api/price-list-items';
      const method = isEdit ? 'PATCH' : 'POST';

      const payload = {
        name: form.name.trim(),
        carrierType: form.carrierType || null,
        mediaType: form.mediaType || null,
        rentalMonths: form.rentalMonths,
        minQuantity: form.minQuantity,
        rentalPrice: parseFloat(form.rentalPrice) || 0,
        productionPrice: parseFloat(form.productionPrice) || 0,
        validFrom: form.validFrom,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Uložení ceníku selhalo.');
      }

      const savedItem = await response.json();
      
      if (isEdit) {
        setPrices((prev) => prev.map((p) => (p.id === savedItem.id ? savedItem : p)));
        setSuccess('Položka ceníku byla upravena.');
      } else {
        setPrices((prev) => [savedItem, ...prev]);
        setSuccess('Nová ceníková položka byla vytvořena.');
      }

      setForm(emptyForm);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!window.confirm('Opravdu chcete tuto ceníkovou položku archivovat?')) return;
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/price-list-items/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Archivace ceníku selhala.');
      }

      setPrices((prev) => prev.filter((p) => p.id !== id));
      setSuccess('Položka byla úspěšně archivována.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se smazat položku.');
    }
  }

  function handleEdit(item: PriceListItemJson) {
    setForm({
      id: item.id,
      name: item.name,
      carrierType: item.carrierType || '',
      mediaType: item.mediaType || '',
      rentalMonths: item.rentalMonths,
      minQuantity: item.minQuantity,
      rentalPrice: parseFloat(item.rentalPrice).toString(),
      productionPrice: parseFloat(item.productionPrice).toString(),
      validFrom: new Date(item.validFrom).toISOString().split('T')[0],
    });
    document.getElementById('price-list-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <section className="mt-8 space-y-5" aria-labelledby="price-list-heading">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950" id="price-list-heading">Správa ceníku nosičů</h2>
        <p className="mt-1 text-sm text-slate-500">
          Zde spravujete základní ceník nosičů (Pronájem a Tisk/Instalace) z Excelu, na který je napojena cenotvorba standardních nabídek.
        </p>
      </div>

      {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{success}</p>}
      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="status">{error}</p>}

      <form className="card grid gap-4 md:grid-cols-2 xl:grid-cols-4" id="price-list-form" onSubmit={handleSave}>
        <h3 className="flex items-center gap-2 text-lg font-semibold md:col-span-2 xl:col-span-4">
          <Plus size={18} />
          {form.id ? 'Upravit ceníkovou položku' : 'Přidat ceníkovou položku'}
        </h3>
        
        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Název nosiče</span>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            placeholder="PROMO Lavičky Ostrava"
            disabled={saving}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Typ nosiče (CarrierType)</span>
          <select
            className="input"
            value={form.carrierType}
            onChange={(e) => setForm((v) => ({ ...v, carrierType: e.target.value }))}
            disabled={saving}
          >
            <option value="">Jakýkoliv</option>
            {carrierTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Typ média (MediaType)</span>
          <select
            className="input"
            value={form.mediaType}
            onChange={(e) => setForm((v) => ({ ...v, mediaType: e.target.value }))}
            disabled={saving}
          >
            <option value="">Jakýkoliv</option>
            {mediaTypes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Délka pronájmu (měsíce)</span>
          <input
            className="input"
            type="number"
            min="1"
            required
            value={form.rentalMonths}
            onChange={(e) => setForm((v) => ({ ...v, rentalMonths: parseInt(e.target.value) || 1 }))}
            disabled={saving}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Minimální množství (ks)</span>
          <input
            className="input"
            type="number"
            min="1"
            required
            value={form.minQuantity}
            onChange={(e) => setForm((v) => ({ ...v, minQuantity: parseInt(e.target.value) || 1 }))}
            disabled={saving}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Cena za pronájem (Kč bez DPH)</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.rentalPrice}
            onChange={(e) => setForm((v) => ({ ...v, rentalPrice: e.target.value }))}
            disabled={saving}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Cena tisk a instalace (Kč bez DPH)</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            required
            value={form.productionPrice}
            onChange={(e) => setForm((v) => ({ ...v, productionPrice: e.target.value }))}
            disabled={saving}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          <span className="mb-1 block">Platnost od</span>
          <input
            className="input"
            type="date"
            required
            value={form.validFrom}
            onChange={(e) => setForm((v) => ({ ...v, validFrom: e.target.value }))}
            disabled={saving}
          />
        </label>

        <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4 pt-2">
          {form.id && (
            <button
              className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => setForm(emptyForm)}
              type="button"
              disabled={saving}
            >
              Zrušit úpravu
            </button>
          )}
          <button
            className="btn-primary inline-flex items-center gap-1.5"
            type="submit"
            disabled={saving}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            ) : (
              <Check size={16} />
            )}
            Uložit položku
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-slate-500">
              <th className="py-3 px-2">Název položky</th>
              <th className="px-2">Plocha / Nosič</th>
              <th className="px-2">Měsíce</th>
              <th className="px-2">Min. ks</th>
              <th className="px-2 text-right">Pronájem</th>
              <th className="px-2 text-right">Tisk a instalace</th>
              <th className="px-2 text-right">Celkem</th>
              <th className="px-2">Platnost od</th>
              <th className="px-2 text-right">Akce</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((price) => (
              <tr className="border-b last:border-0 hover:bg-slate-50/50" key={price.id}>
                <td className="py-3 px-2 font-medium text-slate-900">{price.name}</td>
                <td className="px-2 text-xs text-slate-600">
                  {price.mediaType || '—'} / {price.carrierType || '—'}
                </td>
                <td className="px-2">{price.rentalMonths}</td>
                <td className="px-2">{price.minQuantity}</td>
                <td className="px-2 text-right font-semibold text-slate-700">{money.format(parseFloat(price.rentalPrice))}</td>
                <td className="px-2 text-right text-slate-600">{money.format(parseFloat(price.productionPrice))}</td>
                <td className="px-2 text-right font-bold text-slate-950">{money.format(parseFloat(price.totalPrice))}</td>
                <td className="px-2 text-slate-500">{new Date(price.validFrom).toLocaleDateString('cs-CZ')}</td>
                <td className="px-2 space-x-1.5 text-right">
                  <button
                    aria-label={`Upravit ${price.name}`}
                    className="rounded-lg border p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                    onClick={() => handleEdit(price)}
                    type="button"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    aria-label={`Archivovat ${price.name}`}
                    className="rounded-lg border p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 transition"
                    onClick={() => void handleArchive(price.id)}
                    type="button"
                  >
                    <Archive size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  Ceník je prázdný. Přidejte položky pomocí formuláře výše.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
