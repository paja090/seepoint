'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Eye, Lock, Receipt, Save } from 'lucide-react';
import type { OfferPriceRuleOption, OfferView } from '@/lib/offers/view-model';
import { OfferProcessStepper } from './OfferProcessStepper';

const money = (value: string | number | null) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 }).format(Number(value ?? 0));
const categoryLabels = { PRINT: 'Tisk a výroba', INSTALLATION: 'Instalace', REMOVAL: 'Deinstalace', PRODUCTION: 'Výroba a instalace (původní)', SERVICE: 'Ostatní služby' } as const;

export function OfferPricing({ offer, priceRules }: { offer: OfferView; priceRules: OfferPriceRuleOption[] }) {
  const router = useRouter();
  const availableRules = priceRules.filter((rule) => rule.category !== 'RENTAL');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(offer.charges.map((charge) => charge.priceRuleId).filter((id): id is string => Boolean(id))));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const rentalTotal = offer.items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);
  const quantityFor = (rule: OfferPriceRuleOption) => rule.calculation === 'FLAT' ? 1 : rule.mediaType ? offer.items.filter((item) => item.surface.mediaType === rule.mediaType).length : offer.items.length;
  const draftCharges = availableRules.filter((rule) => selected.has(rule.id)).map((rule) => ({ ...rule, quantity: quantityFor(rule), subtotal: quantityFor(rule) * Number(rule.unitPrice) })).filter((rule) => rule.quantity > 0);
  const extraTotal = draftCharges.reduce((sum, row) => sum + row.subtotal, 0);
  const subtotal = rentalTotal + extraTotal;
  const discount = Number(offer.discountAmount ?? 0);
  const net = Math.max(0, subtotal - discount);
  const tax = net * Number(offer.taxRate ?? 0) / 100;

  async function save() {
    setSaving(true); setMessage('');
    const response = await fetch(`/api/offers/${offer.id}/pricing`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chargeSelections: draftCharges.map((rule) => ({ priceRuleId: rule.id, quantity: String(rule.quantity) })) }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setMessage(data.error ?? 'Kalkulaci se nepodařilo uložit.'); else { setMessage('Kalkulace je uložená.'); router.refresh(); }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <OfferProcessStepper current="pricing" offerId={offer.id!} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <PriceSection title="Pronájem ploch" total={rentalTotal}>{offer.items.map((item) => <PriceLine detail={`${Number(item.quantity).toLocaleString('cs-CZ')} ${item.unit} × ${money(item.unitPrice)}`} key={item.id ?? item.surfaceId} label={item.customTitle || `${item.surface.carrier.code} · ${item.surface.name}`} value={Number(item.subtotal ?? 0)} />)}</PriceSection>
          {(['PRINT', 'INSTALLATION', 'REMOVAL', 'PRODUCTION', 'SERVICE'] as const).map((category) => <PriceSection key={category} title={categoryLabels[category]} total={draftCharges.filter((rule) => rule.category === category).reduce((sum, rule) => sum + rule.subtotal, 0)}>{availableRules.filter((rule) => rule.category === category).map((rule) => { const quantity = quantityFor(rule); const checked = selected.has(rule.id); return <label className={`flex cursor-pointer items-center gap-3 py-3 ${quantity === 0 ? 'opacity-50' : ''}`} key={rule.id}><input checked={checked} disabled={quantity === 0} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(rule.id)) next.delete(rule.id); else next.add(rule.id); return next; })} type="checkbox" /><span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{rule.label}</span><span className="block text-xs text-slate-500">{rule.description || `${quantity} ${rule.unit} × ${money(rule.unitPrice)}`}</span></span><span className="font-semibold tabular-nums text-slate-950">{money(quantity * Number(rule.unitPrice))}</span></label>; })}{availableRules.every((rule) => rule.category !== category) && <p className="py-4 text-sm text-slate-500">Tato část ceníku ještě není nastavena.</p>}</PriceSection>)}
          <section className="card border-dashed !border-slate-300 bg-slate-50/60"><div className="flex items-center gap-2"><Lock size={16} /><span className="text-sm font-semibold">Interní rozpočtová kontrola</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Neviditelné klientovi</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><InternalStat label="Rozpočet klienta" value={offer.budget ? money(offer.budget) : 'Neuveden'} /><InternalStat label="Cena bez DPH" value={money(net)} /><InternalStat label="Rozdíl" value={offer.budget ? money(Number(offer.budget) - net) : '—'} /></div></section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start"><section className="card"><div className="mb-4 flex items-center gap-2"><Receipt size={18} /><h2 className="font-semibold">Souhrn nabídky</h2></div><dl className="space-y-2.5 text-sm"><PriceRow label="Pronájem ploch" value={money(rentalTotal)} /><PriceRow label="Výroba a služby" value={money(extraTotal)} /><PriceRow label="Sleva" value={`−${money(discount)}`} /><PriceRow border label="Cena bez DPH" value={money(net)} /><PriceRow label={`DPH (${offer.taxRate ?? 0} %)`} value={money(tax)} /></dl><div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-white"><span className="text-sm">Celkem s DPH</span><span className="text-xl font-semibold">{money(net + tax)}</span></div><button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => void save()} type="button"><Save size={16} />{saving ? 'Ukládám…' : 'Uložit kalkulaci'}</button>{message && <p className="mt-3 text-center text-sm text-slate-600" role="status">{message}</p>}<Link className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white" href={`/offers/${offer.id}/preview`}><Eye size={15} />Pokračovat na klientský náhled</Link></section></aside>
      </div>
      <footer className="flex justify-between border-t pt-6"><Link className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold" href={`/offers/${offer.id}/planner`}>← Zpět: Plánování</Link><Link className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white" href={`/offers/${offer.id}/preview`}>Pokračovat: Klientský náhled →</Link></footer>
    </div>
  );
}

function PriceSection({ title, total, children }: { title: string; total: number; children: React.ReactNode }) { return <section className="card"><div className="mb-2 flex justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2><span className="font-semibold">{money(total)}</span></div><div className="divide-y divide-slate-100">{children}</div></section>; }
function PriceLine({ label, detail, value }: { label: string; detail: string; value: number }) { return <div className="flex items-center gap-3 py-3"><Check className="text-emerald-600" size={16} /><div className="min-w-0 flex-1"><p className="font-medium">{label}</p><p className="text-xs text-slate-500">{detail}</p></div><span className="font-semibold tabular-nums">{money(value)}</span></div>; }
function PriceRow({ label, value, border }: { label: string; value: string; border?: boolean }) { return <div className={`flex justify-between ${border ? 'border-t pt-2.5' : ''}`}><dt className="text-slate-600">{label}</dt><dd className="font-medium">{value}</dd></div>; }
function InternalStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
