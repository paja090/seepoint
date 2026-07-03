'use client';

import type { WorkPriority, WorkType } from '@prisma/client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workPriorityLabels, workRequesters, workTypeLabels } from '@/lib/work';

type Option = { id: string; label: string };
type CarrierOption = Option & { code: string };
type EditableOrder = {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  deadlineAt: string;
  campaignDateFrom: string;
  campaignDateTo: string;
  workType: WorkType;
  priority: WorkPriority;
  price: string;
  clientId: string;
  clientName: string;
  requestedBy: string;
  workerNames: string;
  carrierCode: string;
  mediaLabel: string;
  quantity: string;
  contactName: string;
  contactPhone: string;
  locationNote: string;
  referenceUrl: string;
  ftdUrl: string;
};

type WorkOrderEditFormProps = { order: EditableOrder; clients: Option[]; carriers: CarrierOption[] };

export function WorkOrderEditForm({ order, clients, carriers }: WorkOrderEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    for (const field of ['scheduledAt', 'deadlineAt']) {
      const value = payload[field];
      if (typeof value === 'string' && value) payload[field] = new Date(value).toISOString();
    }
    setSaving(true);
    setSaved(false);
    setError('');
    const response = await fetch(`/api/work-orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
    setSaving(false);
    if (!response.ok || !result?.id) {
      setError(result?.error || 'Úkol se nepodařilo upravit.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <details className="card">
      <summary className="cursor-pointer text-lg font-bold">Upravit celý úkol</summary>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="lg:col-span-2">Název úkolu<input className="input mt-1" defaultValue={order.title} name="title" required /></label>
        <label>Datum a čas práce<input className="input mt-1" defaultValue={order.scheduledAt} name="scheduledAt" required type="datetime-local" /></label>
        <label>Dokončit nejpozději<input className="input mt-1" defaultValue={order.deadlineAt} name="deadlineAt" type="datetime-local" /></label>
        <label>Typ práce<select className="input mt-1" defaultValue={order.workType} name="workType">{Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Priorita<select className="input mt-1" defaultValue={order.priority} name="priority">{Object.entries(workPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Úkol zadal/a<select className="input mt-1" defaultValue={order.requestedBy} name="requestedBy" required>{workRequesters.map((requester) => <option key={requester} value={requester}>{requester}</option>)}</select></label>
        <label>Cena za úkol v Kč<input className="input mt-1" defaultValue={order.price} min="0" name="price" step="0.01" type="number" /></label>
        <label>Pracovníci<input className="input mt-1" defaultValue={order.workerNames} name="workerNames" placeholder="Pavel, Mirek" /></label>
        <label>Existující klient<select className="input mt-1" defaultValue={order.clientId} name="clientId"><option value="">Bez vybraného klienta</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}</select></label>
        <label>Jiný nebo nový klient<input className="input mt-1" defaultValue={order.clientId ? '' : order.clientName} name="clientName" placeholder="Název klienta" /></label>
        <label>Typ média<input className="input mt-1" defaultValue={order.mediaLabel} name="mediaLabel" /></label>
        <label>Počet kusů<input className="input mt-1" defaultValue={order.quantity} min="1" name="quantity" type="number" /></label>
        <label className="lg:col-span-2">Propojený nosič<input className="input mt-1" defaultValue={order.carrierCode} list="edit-work-carriers" name="carrierCode" /><datalist id="edit-work-carriers">{carriers.map((carrier) => <option key={carrier.id} value={carrier.code}>{carrier.label}</option>)}</datalist></label>
        <label>Platnost kampaně od<input className="input mt-1" defaultValue={order.campaignDateFrom} name="campaignDateFrom" type="date" /></label>
        <label>Platnost kampaně do<input className="input mt-1" defaultValue={order.campaignDateTo} name="campaignDateTo" type="date" /></label>
        <label>Kontaktní osoba<input className="input mt-1" defaultValue={order.contactName} name="contactName" /></label>
        <label>Telefon<input className="input mt-1" defaultValue={order.contactPhone} name="contactPhone" type="tel" /></label>
        <label className="lg:col-span-2">Místo a pokyny<input className="input mt-1" defaultValue={order.locationNote} name="locationNote" /></label>
        <label className="lg:col-span-2">Podrobné zadání<textarea className="input mt-1 min-h-28" defaultValue={order.description} name="description" required /></label>
        <label className="lg:col-span-2">Složka fotodokumentace na Google Disku<input className="input mt-1" defaultValue={order.ftdUrl} name="ftdUrl" type="url" placeholder="https://drive.google.com/…" /></label>
        <label className="lg:col-span-2">Odkaz na podklady<input className="input mt-1" defaultValue={order.referenceUrl} name="referenceUrl" type="url" /></label>
        {error && <p className="lg:col-span-2 text-sm text-red-700" role="alert">{error}</p>}
        {saved && <p className="lg:col-span-2 text-sm font-medium text-emerald-700" role="status">Změny byly uloženy.</p>}
        <div className="lg:col-span-2"><button className="rounded-xl bg-slate-950 px-5 py-3 font-medium text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Ukládám…' : 'Uložit celý úkol'}</button></div>
      </form>
    </details>
  );
}
