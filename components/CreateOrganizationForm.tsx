'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
export function CreateOrganizationForm() {
  const [result, setResult] = useState<{ message: string; organizationId?: string; activationUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setResult(null);
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const response = await fetch('/api/admin/organizations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string; warning?: string; activationUrl?: string; organization?: { id: string } };
      setResult(response.ok
        ? { message: payload.warning || 'Organizace byla založena.', organizationId: payload.organization?.id, activationUrl: payload.activationUrl }
        : { message: payload.error || 'Založení selhalo.' });
      if (response.ok) form.reset();
    } catch {
      setResult({ message: 'Založení selhalo.' });
    } finally {
      setBusy(false);
    }
  }
  return <form className="card grid gap-4 md:grid-cols-2" onSubmit={submit}><label className="text-sm font-semibold">Název<input className="input mt-1" name="name" required /></label><label className="text-sm font-semibold">Slug<input className="input mt-1" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label className="text-sm font-semibold">E-mail OWNERA<input className="input mt-1" name="ownerEmail" required type="email" /></label><label className="text-sm font-semibold">Firemní e-mail<input className="input mt-1" name="email" type="email" /></label><label className="text-sm font-semibold">IČO<input className="input mt-1" name="companyId" /></label><label className="text-sm font-semibold">DIČ<input className="input mt-1" name="vatId" /></label><div className="md:col-span-2"><button className="btn-primary" disabled={busy} type="submit">{busy ? 'Zakládám…' : 'Založit organizaci a OWNER účet'}</button>{result ? <div aria-live="polite" className="mt-3 space-y-2 text-sm font-semibold"><p>{result.message}</p>{result.organizationId ? <Link className="text-blue-700 underline" href={`/admin/organizations/${result.organizationId}`}>Otevřít detail organizace</Link> : null}{result.activationUrl ? <p><a className="text-blue-700 underline" href={result.activationUrl}>Preview aktivační odkaz</a></p> : null}</div> : null}</div></form>;
}
