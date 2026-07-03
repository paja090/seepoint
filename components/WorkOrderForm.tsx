'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { workRequesters, workTypeLabels } from '@/lib/work';

type Option = { id: string; label: string };
type CarrierOption = Option & { code: string };
type WorkOrderFormProps = { clients: Option[]; carriers: CarrierOption[] };

export function WorkOrderForm({ clients, carriers }: WorkOrderFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError('');
    const form = new FormData(formElement);
    const response = await fetch('/api/work-orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
    setSubmitting(false);
    if (!response.ok || !result?.id) {
      setError(result?.error || 'Pracovní úkol se nepodařilo uložit.');
      return;
    }
    formElement.reset();
    router.push(`/work/${result.id}`);
    router.refresh();
  }

  return (
    <details className="card" open>
      <summary className="cursor-pointer text-lg font-bold">Nový pracovní úkol</summary>
      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
        <label className="lg:col-span-2">Název úkolu<input className="input mt-1" name="title" required placeholder="Např. Instalace navigací Lemon" /></label>
        <label>Datum a čas práce<input className="input mt-1" name="scheduledAt" required type="datetime-local" /></label>
        <label>Dokončit nejpozději<input className="input mt-1" name="deadlineAt" type="datetime-local" /></label>
        <label>Typ práce<select className="input mt-1" name="workType" defaultValue="INSTALLATION">{Object.entries(workTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Úkol zadal/a<select className="input mt-1" name="requestedBy" defaultValue="" required><option disabled value="">Vyberte zadavatele</option>{workRequesters.map((requester) => <option key={requester} value={requester}>{requester}</option>)}</select></label>
        <label>Pracovníci<input className="input mt-1" name="workerNames" placeholder="Pavel, Mirek" /><span className="mt-1 block text-xs text-slate-500">Pracovník po dokončení potvrzuje nahrání fotodokumentace.</span></label>
        <label>Existující klient<select className="input mt-1" name="clientId" defaultValue=""><option value="">Bez vybraného klienta</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}</select></label>
        <label>Jiný nebo nový klient<input className="input mt-1" name="clientName" placeholder="Název klienta" /></label>
        <label>Typ média<input className="input mt-1" name="mediaLabel" placeholder="Navigace, billboard, city poster…" /></label>
        <label>Počet kusů<input className="input mt-1" min="1" name="quantity" type="number" /></label>
        <label className="lg:col-span-2">Propojený nosič<input className="input mt-1" list="work-carriers" name="carrierCode" placeholder="Začněte psát kód, město nebo název" /><datalist id="work-carriers">{carriers.map((carrier) => <option key={carrier.id} value={carrier.code}>{carrier.label}</option>)}</datalist><span className="mt-1 block text-xs text-slate-500">Pole můžete nechat prázdné pro obecnou práci bez konkrétního nosiče.</span></label>
        <label>Platnost kampaně od<input className="input mt-1" name="campaignDateFrom" type="date" /></label>
        <label>Platnost kampaně do<input className="input mt-1" name="campaignDateTo" type="date" /></label>
        <label>Kontaktní osoba<input className="input mt-1" name="contactName" /></label>
        <label>Telefon<input className="input mt-1" name="contactPhone" type="tel" /></label>
        <label className="lg:col-span-2">Místo a pokyny<input className="input mt-1" name="locationNote" placeholder="Adresa, příjezd, čas srazu…" /></label>
        <label className="lg:col-span-2">Podrobné zadání<textarea className="input mt-1 min-h-28" name="description" required /></label>
        <label className="lg:col-span-2">Odkaz na podklady<input className="input mt-1" name="referenceUrl" type="url" placeholder="https://…" /></label>
        {error && <p className="lg:col-span-2 text-sm text-red-700" role="alert">{error}</p>}
        <div className="lg:col-span-2"><button className="rounded-xl bg-slate-950 px-5 py-3 font-medium text-white disabled:opacity-50" disabled={submitting} type="submit">{submitting ? 'Ukládám…' : 'Vytvořit pracovní úkol'}</button></div>
      </form>
    </details>
  );
}
