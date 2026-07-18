import { ChevronDown, Trash2 } from 'lucide-react';
import type { OfferSurfaceOption } from '@/lib/offers/view-model';

export type EditableOfferItem = {
  surfaceId: string;
  dateFrom: string;
  dateTo: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
  discountAmount: string;
  note: string;
  groupLabel: string;
  customTitle: string;
  clientDescription: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>{children}</label>;
}

export function OfferItemEditor({
  item,
  surface,
  mediaLabel,
  onChange,
  onRemove,
}: {
  item: EditableOfferItem;
  surface?: OfferSurfaceOption;
  mediaLabel: string;
  onChange: (key: keyof EditableOfferItem, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white" open>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:content-none">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">{surface?.carrier.code} · {item.customTitle || surface?.name}</p>
          <p className="truncate text-xs text-slate-500">{surface?.carrier.city} · {mediaLabel} · {item.dateFrom || 'bez termínu'}–{item.dateTo || 'bez termínu'}</p>
        </div>
        <span className="hidden text-sm font-semibold text-slate-800 sm:block">{Number(item.unitPrice || 0).toLocaleString('cs-CZ')} Kč / {item.unit}</span>
        <ChevronDown aria-hidden className="text-slate-400 transition group-open:rotate-180" size={17} />
      </summary>
      <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Množství"><input className="input" inputMode="decimal" min="0.01" onChange={(event) => onChange('quantity', event.target.value)} value={item.quantity} /></Field>
        <Field label="Jednotka"><input className="input" onChange={(event) => onChange('unit', event.target.value)} value={item.unit} /></Field>
        <Field label="Jednotková cena"><input className="input" inputMode="decimal" min="0" onChange={(event) => onChange('unitPrice', event.target.value)} value={item.unitPrice} /></Field>
        <Field label="Sleva %"><input className="input" inputMode="decimal" min="0" max="100" onChange={(event) => onChange('discountPercent', event.target.value)} value={item.discountPercent} /></Field>
        <Field label="Pevná sleva Kč"><input className="input" inputMode="decimal" min="0" onChange={(event) => onChange('discountAmount', event.target.value)} value={item.discountAmount} /></Field>
        <Field label="Od"><input className="input" onChange={(event) => onChange('dateFrom', event.target.value)} type="date" value={item.dateFrom} /></Field>
        <Field label="Do"><input className="input" onChange={(event) => onChange('dateTo', event.target.value)} type="date" value={item.dateTo} /></Field>
        <Field label="Skupina"><input className="input" onChange={(event) => onChange('groupLabel', event.target.value)} value={item.groupLabel} /></Field>
        <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-600">Vlastní název položky</span><input className="input" onChange={(event) => onChange('customTitle', event.target.value)} placeholder={surface?.name} value={item.customTitle} /></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-600">Popis pro klienta</span><input className="input" onChange={(event) => onChange('clientDescription', event.target.value)} value={item.clientDescription} /></label>
        <label className="sm:col-span-2 lg:col-span-3"><span className="mb-1 block text-xs font-medium text-slate-600">Interní poznámka položky</span><textarea className="input min-h-20" onChange={(event) => onChange('note', event.target.value)} value={item.note} /></label>
        <button className="inline-flex self-end items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" onClick={onRemove} type="button"><Trash2 size={15} /> Odebrat</button>
      </div>
    </details>
  );
}
