'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Archive, Pencil, Plus } from 'lucide-react';
import type { OfferPriceRuleOption } from '@/lib/offers/view-model';

type Rule = OfferPriceRuleOption & { active: boolean; sortOrder: number };
const emptyRule = { id: '', code: '', category: 'PRINT', label: '', description: '', mediaType: '', calculation: 'PER_SURFACE', unit: 'ks', unitPrice: '', defaultSelected: true, active: true, sortOrder: 0 } as const;
const categoryLabels = { RENTAL: 'Pronájem ploch', PRINT: 'Tisk, výroba a instalace', INSTALLATION: 'Samostatná instalace', REMOVAL: 'Deinstalace', PRODUCTION: 'Výroba a instalace (původní)', SERVICE: 'Ostatní služby' } as const;
const mediaTypes = ['NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'];

export function OfferPriceCatalogSettings() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({ ...emptyRule });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/offer-price-rules');
    const data = await response.json() as Rule[] | { error?: string };
    if (response.ok) setRules(data as Rule[]); else setMessage((data as { error?: string }).error ?? 'Ceník se nepodařilo načíst.');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const id = String(form.id || '');
    const response = await fetch(id ? `/api/offer-price-rules/${id}` : '/api/offer-price-rules', {
      method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setMessage(data.error ?? 'Sazbu se nepodařilo uložit.');
    setForm({ ...emptyRule });
    setMessage('Sazba byla uložena. Nové nabídky ji použijí automaticky.');
    await load();
  }

  function edit(rule: Rule) { setForm({ ...rule, description: rule.description ?? '', mediaType: rule.mediaType ?? '' }); document.getElementById('offer-price-form')?.scrollIntoView({ behavior: 'smooth' }); }
  async function archive(rule: Rule) {
    const response = await fetch(`/api/offer-price-rules/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rule, active: false }) });
    if (response.ok) await load(); else setMessage('Sazbu se nepodařilo archivovat.');
  }

  return (
    <section className="mt-8 space-y-5" aria-labelledby="offer-price-heading">
      <div><h2 className="text-2xl font-semibold text-slate-950" id="offer-price-heading">Ceník nabídek</h2><p className="mt-1 text-sm text-slate-500">Jedno místo pro pronájem médií, tisk, instalaci a služby. Již odeslané nabídky si zachovají původní ceny.</p></div>
      {message && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800" role="status">{message}</p>}
      <form className="card grid gap-4 md:grid-cols-2 xl:grid-cols-4" id="offer-price-form" onSubmit={save}>
        <h3 className="flex items-center gap-2 text-lg font-semibold md:col-span-2 xl:col-span-4"><Plus size={18} />{form.id ? 'Upravit sazbu' : 'Přidat sazbu'}</h3>
        <Field label="Kategorie"><select className="input" value={String(form.category)} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Název"><input className="input" required value={String(form.label)} onChange={(e) => setForm((v) => ({ ...v, label: e.target.value }))} placeholder="Tisk plakátu" /></Field>
        <Field label="Interní kód"><input className="input" required value={String(form.code)} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} placeholder="PRINT_CITY_POSTER" /></Field>
        <Field label="Typ média (volitelně)"><select className="input" value={String(form.mediaType)} onChange={(e) => setForm((v) => ({ ...v, mediaType: e.target.value }))}><option value="">Všechna média</option>{mediaTypes.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Výpočet"><select className="input" value={String(form.calculation)} onChange={(e) => setForm((v) => ({ ...v, calculation: e.target.value }))}><option value="PER_SURFACE">Za každou plochu</option><option value="FLAT">Paušál za nabídku</option></select></Field>
        <Field label="Cena bez DPH"><input className="input" min="0" required step="0.01" type="number" value={String(form.unitPrice)} onChange={(e) => setForm((v) => ({ ...v, unitPrice: e.target.value }))} /></Field>
        <Field label="Jednotka"><input className="input" required value={String(form.unit)} onChange={(e) => setForm((v) => ({ ...v, unit: e.target.value }))} placeholder="ks / projekt / kampaň" /></Field>
        <Field label="Popis pro klienta"><input className="input" value={String(form.description)} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} /></Field>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input checked={Boolean(form.defaultSelected)} onChange={(e) => setForm((v) => ({ ...v, defaultSelected: e.target.checked }))} type="checkbox" />Automaticky přidat do nové nabídky</label>
        <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4">{form.id && <button className="rounded-xl border px-4 py-2 text-sm font-semibold" onClick={() => setForm({ ...emptyRule })} type="button">Zrušit úpravu</button>}<button className="btn-primary" type="submit">Uložit sazbu</button></div>
      </form>
      <div className="card overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-3">Položka</th><th>Kategorie</th><th>Médium</th><th>Výpočet</th><th className="text-right">Cena</th><th className="text-right">Akce</th></tr></thead><tbody>{!loading && rules.map((rule) => <tr className={`border-b last:border-0 ${rule.active ? '' : 'opacity-45'}`} key={rule.id}><td className="py-3"><p className="font-semibold text-slate-900">{rule.label}</p><p className="text-xs text-slate-400">{rule.code}{rule.defaultSelected ? ' · automaticky' : ''}</p></td><td>{categoryLabels[rule.category]}</td><td>{rule.mediaType ?? 'Všechna'}</td><td>{rule.calculation === 'FLAT' ? 'Paušál' : 'Za plochu'}</td><td className="text-right font-semibold">{Number(rule.unitPrice).toLocaleString('cs-CZ')} Kč / {rule.unit}</td><td className="space-x-2 text-right"><button aria-label={`Upravit ${rule.label}`} className="rounded-lg border p-2" onClick={() => edit(rule)} type="button"><Pencil size={14} /></button>{rule.active && <button aria-label={`Archivovat ${rule.label}`} className="rounded-lg border p-2 text-amber-700" onClick={() => void archive(rule)} type="button"><Archive size={14} /></button>}</td></tr>)}</tbody></table>{loading && <p className="py-5 text-sm text-slate-500">Načítám ceník…</p>}{!loading && rules.length === 0 && <p className="py-5 text-sm text-slate-500">Ceník je prázdný. Přidejte nejprve pronájem podle média a potom tisk, instalaci nebo služby.</p>}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-sm font-medium text-slate-700"><span className="mb-1 block">{label}</span>{children}</label>; }
