'use client';

import { FormEvent, useState } from 'react';

type Company = Record<string, string | null>;

const fields = [
  ['name', 'Název firmy'], ['companyId', 'IČO'], ['vatId', 'DIČ'], ['street', 'Ulice'],
  ['city', 'Město'], ['postalCode', 'PSČ'], ['country', 'Země'], ['phone', 'Telefon'],
  ['email', 'Firemní e-mail'], ['website', 'Web'], ['logoUrl', 'URL loga'],
  ['bankAccount', 'Bankovní účet'], ['iban', 'IBAN'], ['swift', 'SWIFT'],
  ['defaultCurrency', 'Výchozí měna'], ['primaryColor', 'Primární barva'], ['secondaryColor', 'Sekundární barva'],
] as const;

export function CompanySettingsForm({ organization }: { organization: Company }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch('/api/settings/company', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? 'Firemní údaje byly uloženy.' : result.error || 'Uložení se nezdařilo.'); setBusy(false);
  }
  return (
    <form className="card space-y-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([name, label]) => <label className="text-sm font-semibold text-slate-700" key={name}>{label}<input className="input mt-1" defaultValue={organization[name] ?? ''} name={name} required={name === 'name'} /></label>)}
      </div>
      <label className="block text-sm font-semibold text-slate-700">E-mailový podpis<textarea className="input mt-1 min-h-28" defaultValue={organization.emailSignature ?? ''} name="emailSignature" /></label>
      {message && <p className="text-sm font-semibold text-slate-700">{message}</p>}
      <button className="btn-primary" disabled={busy} type="submit">{busy ? 'Ukládám…' : 'Uložit firemní údaje'}</button>
    </form>
  );
}

