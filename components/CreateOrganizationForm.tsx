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
  return (
    <form className="card grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <label className="text-sm font-semibold">Název<input className="input mt-1" name="name" required /></label>
      <label className="text-sm font-semibold">Slug<input className="input mt-1" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
      <label className="text-sm font-semibold">E-mail OWNERA<input className="input mt-1" name="ownerEmail" required type="email" /></label>
      <label className="text-sm font-semibold">Firemní e-mail<input className="input mt-1" name="email" type="email" /></label>
      <label className="text-sm font-semibold">IČO<input className="input mt-1" name="companyId" /></label>
      <label className="text-sm font-semibold">DIČ<input className="input mt-1" name="vatId" /></label>
      
      {/* Branding */}
      <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
        <h3 className="font-bold text-slate-800 mb-4">Firemní identita (White-label)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold">
            URL loga společnosti
            <input className="input mt-1" name="logoUrl" type="url" placeholder="https://..." />
            <span className="text-xs text-slate-500 block mt-1">Logo se zobrazí v menu, na PDF nabídkách a portálech pro klienty.</span>
          </label>
          <label className="text-sm font-semibold">
            Hlavní firemní barva (HEX)
            <div className="flex gap-2 mt-1">
              <input type="color" name="primaryColor" defaultValue="#0ea5e9" className="h-10 w-14 rounded cursor-pointer border border-slate-200" />
              <input type="text" name="primaryColorText" placeholder="#0ea5e9" className="input flex-1" onChange={(e) => {
                const colorInput = e.target.previousSibling as HTMLInputElement;
                if (colorInput && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  colorInput.value = e.target.value;
                }
              }} />
            </div>
            <span className="text-xs text-slate-500 block mt-1">Tlačítka a hlavičky budou v této barvě.</span>
          </label>
        </div>
      </div>

      <div className="md:col-span-2 mt-4">
        <button className="btn-primary" disabled={busy} type="submit">{busy ? 'Zakládám…' : 'Založit organizaci a OWNER účet'}</button>
        {result ? (
          <div aria-live="polite" className="mt-3 space-y-2 text-sm font-semibold">
            <p className={result.organizationId ? "text-emerald-700" : "text-rose-600"}>{result.message}</p>
            {result.organizationId ? <Link className="text-blue-700 underline" href={`/admin/organizations/${result.organizationId}`}>Otevřít detail organizace</Link> : null}
            {result.activationUrl ? <p><a className="text-blue-700 underline" href={result.activationUrl}>Preview aktivační odkaz</a></p> : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
