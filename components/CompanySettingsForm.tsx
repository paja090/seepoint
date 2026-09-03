'use client';

import { FormEvent, useState } from 'react';

type Company = Record<string, string | number | null>;

const fields = [
  ['name', 'Název firmy'], ['companyId', 'IČO'], ['vatId', 'DIČ'], ['street', 'Ulice'],
  ['city', 'Město'], ['postalCode', 'PSČ'], ['country', 'Země'], ['phone', 'Telefon'],
  ['email', 'Firemní e-mail'], ['website', 'Web'], ['logoUrl', 'URL loga'],
  ['bankAccount', 'Bankovní účet'], ['iban', 'IBAN'], ['swift', 'SWIFT'],
  ['defaultCurrency', 'Výchozí měna'], ['primaryColor', 'Primární barva'], ['secondaryColor', 'Sekundární barva'],
] as const;

export function CompanySettingsForm({ organization }: { organization: Company }) {
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch('/api/settings/company', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json() as { error?: string };
      setFeedback({ text: response.ok ? 'Firemní údaje byly uloženy.' : result.error || 'Uložení se nezdařilo.', ok: response.ok });
    } catch {
      setFeedback({ text: 'Spojení se serverem selhalo. Zkontrolujte připojení a zkuste to znovu.', ok: false });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card space-y-5" onSubmit={submit}>
      <div>
        <h2 className="text-lg font-bold text-slate-950">Firemní a fakturační údaje</h2>
        <p className="mt-1 text-sm text-slate-500">Údaje se použijí na vystavených dokladech. Před první fakturou zkontrolujte zejména IČO, adresu a bankovní spojení.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([name, label]) => <label className="text-sm font-semibold text-slate-700" key={name}>{label}<input className="input mt-1" defaultValue={organization[name] ?? ''} name={name} required={name === 'name'} /></label>)}
      </div>
      <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <legend className="px-2 text-sm font-bold text-slate-900">Výchozí nastavení vystavených faktur</legend>
        <p className="mb-4 text-xs text-slate-500">Změna platí pouze pro nové faktury. Již vystavené doklady zůstávají beze změny.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">Splatnost (dní)<input className="input mt-1" defaultValue={organization.invoiceDueDays ?? 14} max={365} min={1} name="invoiceDueDays" required type="number" /></label>
          <label className="text-sm font-semibold text-slate-700">Výchozí DPH (%)<input className="input mt-1" defaultValue={organization.defaultVatRate ?? 21} max={100} min={0} name="defaultVatRate" required step="0.01" type="number" /></label>
          <label className="text-sm font-semibold text-slate-700">Prefix číselné řady<input className="input mt-1 uppercase" defaultValue={organization.invoiceNumberPrefix ?? 'NAV'} maxLength={12} name="invoiceNumberPrefix" pattern="[A-Za-z0-9-]{1,12}" required /></label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Další číslo vznikne atomicky ve tvaru například NAV-000001. Pořadí je samostatné pro každou organizaci.</p>
      </fieldset>
      <label className="block text-sm font-semibold text-slate-700">E-mailový podpis<textarea className="input mt-1 min-h-28" defaultValue={organization.emailSignature ?? ''} name="emailSignature" /></label>
      {feedback ? <p aria-live="polite" className={`text-sm font-semibold ${feedback.ok ? 'text-emerald-700' : 'text-red-700'}`} role={feedback.ok ? 'status' : 'alert'}>{feedback.text}</p> : null}
      <button className="btn-primary" disabled={busy} type="submit">{busy ? 'Ukládám…' : 'Uložit firemní údaje'}</button>
    </form>
  );
}
