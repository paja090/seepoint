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
  const [allowAccess, setAllowAccess] = useState(false);
  const [accessMode, setAccessMode] = useState<'invite' | 'manual'>('invite');

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
    const result = await response.json().catch(() => null) as { id?: string; error?: string; warning?: string } | null;
    setSaving(false);

    if (!response.ok || !result?.id) {
      setError(result?.error || 'Zaměstnance se nepodařilo uložit.');
      return;
    }

    if (result.warning) window.alert(result.warning);
    formElement.reset();
    setAllowAccess(false);
    setAccessMode('invite');
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
          <label>E-mail<input className="input mt-1" name="email" type="email" placeholder="jmeno@vase-firma.cz" /><span className="mt-1 block text-xs text-slate-500">Použijte e-mail pracovníka. Pokud níže povolíte přístup, odešle se na něj aktivační pozvánka.</span></label>
          <label>Telefon<input className="input mt-1" name="phone" type="tel" /></label>
          <label>Pozice<input className="input mt-1" name="positions" placeholder="Technik, obchodník, pracovník montáže…" /><span className="mt-1 block text-xs text-slate-500">Více pozic oddělte čárkou.</span></label>
          <label>Role<select className="input mt-1" name="role" defaultValue="WORKER">{roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                checked={allowAccess}
                name="allowAccess"
                onChange={(event) => setAllowAccess(event.target.checked)}
                type="checkbox"
                value="true"
                className="mt-1"
              />
              <div>
                <b className="text-slate-900 block text-sm">Povolit přístup do aplikace</b>
                <span className="text-xs text-slate-500">
                  Vytvoří přihlašovací účet pro zaměstnance podle vybrané role.
                </span>
              </div>
            </label>

            {allowAccess && (
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                      accessMode === 'invite'
                        ? 'border-sky-500 bg-sky-50 text-sky-950 font-medium shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="accessMode"
                      value="invite"
                      checked={accessMode === 'invite'}
                      onChange={() => setAccessMode('invite')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold block text-sm">✉️ Odeslat pozvánku na e-mail (Doporučeno)</span>
                      <span className="text-slate-500 block mt-0.5">
                        Zaměstnanci přijde e-mail s odkazem. Heslo si nastaví sám, nemusíte nic vymýšlet.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                      accessMode === 'manual'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 font-medium shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="accessMode"
                      value="manual"
                      checked={accessMode === 'manual'}
                      onChange={() => setAccessMode('manual')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold block text-sm">🔑 Nastavit dočasné heslo ručně</span>
                      <span className="text-slate-500 block mt-0.5">
                        Pouze pro osobní předání (ústně/SMS). E-mail se v tomto případě neposílá.
                      </span>
                    </div>
                  </label>
                </div>

                {accessMode === 'manual' && (
                  <label className="block text-xs font-bold text-slate-800">
                    Dočasné heslo
                    <input
                      className="input mt-1"
                      name="temporaryPassword"
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                      required={accessMode === 'manual'}
                      placeholder="Alespoň 12 znaků, písmeno a číslo"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Alespoň 12 znaků, písmeno a číslo. Zaměstnanci ho musíte předat osobně. Po prvním přihlášení si ho povinně změní.
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>
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
