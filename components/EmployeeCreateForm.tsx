'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roleLabel, roles } from '@/lib/rbac';
import { statusLabel } from '@/lib/internal-format';

const employmentTypes = ['EMPLOYEE', 'CONTRACTOR', 'FREELANCER', 'PART_TIME', 'OTHER'] as const;

type EmployeeCreateFormProps = {
  canCreate: boolean;
};

export function EmployeeCreateForm({ canCreate }: EmployeeCreateFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries());
    setSaving(true);
    setError('');

    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as { id?: string; error?: string } | null;
    setSaving(false);

    if (!response.ok || !result?.id) {
      setError(result?.error || 'Zaměstnance se nepodařilo uložit.');
      return;
    }

    formElement.reset();
    router.push(`/employees/${result.id}`);
    router.refresh();
  }

  return (
    <details className="card mb-6" open>
      <summary className="cursor-pointer text-lg font-bold">Nový zaměstnanec</summary>
      <p className="mt-2 text-sm text-slate-600">Pro párování s plánem práce musí jméno pracovníka v zakázce odpovídat jménu a příjmení zaměstnance, případně jeho e-mailu.</p>
      {!canCreate ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Nové zaměstnance může zakládat jen admin nebo manažer.</p> : (
        <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit}>
          <label>Jméno<input className="input mt-1" name="firstName" required placeholder="Např. Pavel" /></label>
          <label>Příjmení<input className="input mt-1" name="lastName" required placeholder="Např. Novák" /></label>
          <label>E-mail<input className="input mt-1" name="email" type="email" placeholder="pavel@seepoint.local" /><span className="mt-1 block text-xs text-slate-500">Když bude později mock nebo reálný uživatel používat stejný e-mail, uvidí svoje úkoly v Moje úkoly.</span></label>
          <label>Telefon<input className="input mt-1" name="phone" type="tel" /></label>
          <label>Pozice<input className="input mt-1" name="position" placeholder="Technik, obchodník, pracovník montáže…" /></label>
          <label>Role<select className="input mt-1" name="role" defaultValue="WORKER">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <label className="flex items-center gap-3 rounded-xl border p-3"><input name="allowAccess" type="checkbox" value="true" /><span><b>Povolit přístup do aplikace</b><small className="block text-slate-500">Vytvoří účet a jednorázovou pozvánku.</small></span></label>
          <label>Typ spolupráce<select className="input mt-1" name="employmentType" defaultValue="EMPLOYEE">{employmentTypes.map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}</select></label>
          <label>Datum nástupu<input className="input mt-1" name="startDate" type="date" /></label>
          <label>IČO<input className="input mt-1" name="ico" inputMode="numeric" /><span className="mt-1 block text-xs text-slate-500">Citlivější údaj, v přehledu ho vidí jen oprávněné role.</span></label>
          <label>Datum narození<input className="input mt-1" name="dateOfBirth" type="date" /></label>
          <label className="lg:col-span-2">Poznámka<textarea className="input mt-1 min-h-24" name="note" /></label>
          {error && <p className="lg:col-span-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="lg:col-span-2"><button className="rounded-xl bg-slate-950 px-5 py-3 font-medium text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Ukládám…' : 'Založit zaměstnance'}</button></div>
        </form>
      )}
    </details>
  );
}
