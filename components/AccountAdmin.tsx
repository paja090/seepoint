'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShieldCheck, Mail, Send, UserCheck, Lock } from 'lucide-react';
import { roles, roleLabel, type AppRole } from '@/lib/rbac';
import { temporaryPasswordError } from '@/lib/auth-onboarding';

interface AccountAdminProps {
  employeeId: string;
  status: string | null;
  role: AppRole;
  rolesList?: AppRole[];
  lastLoginAt: string | null;
  canSetAdmin: boolean;
  canResetPassword: boolean;
  protectedOwner: boolean;
}

export function AccountAdmin({
  employeeId,
  status,
  role: initialPrimaryRole,
  rolesList = [],
  lastLoginAt,
  canSetAdmin,
  canResetPassword,
  protectedOwner,
}: AccountAdminProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [temporaryPasswordConfirmation, setTemporaryPasswordConfirmation] = useState('');

  // Initial selected roles array
  const initialRoles = Array.from(
    new Set([initialPrimaryRole, ...(rolesList || [])])
  ) as AppRole[];

  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(initialRoles);
  const [primaryRole, setPrimaryRole] = useState<AppRole>(initialPrimaryRole);

  function toggleRole(targetRole: AppRole) {
    if (selectedRoles.includes(targetRole)) {
      if (selectedRoles.length === 1) return; // Must keep at least one role
      const next = selectedRoles.filter((r) => r !== targetRole);
      setSelectedRoles(next);
      if (primaryRole === targetRole && next.length > 0) {
        setPrimaryRole(next[0]);
      }
    } else {
      setSelectedRoles([...selectedRoles, targetRole]);
    }
  }

  async function saveRoles() {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/employees/${employeeId}/account`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'role',
          role: primaryRole,
          roles: selectedRoles,
        }),
      });
      const data = await res.json();
      setBusy(false);
      setMsg(data.error ?? data.warning ?? 'Přiřazené funkce a role byly úspěšně uloženy.');
      if (res.ok) router.refresh();
    } catch {
      setBusy(false);
      setMsg('Chyba při ukládání rolí.');
    }
  }

  async function act(action: string) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/employees/${employeeId}/account`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, role: primaryRole, roles: selectedRoles }),
      });
      const data = await res.json();
      setBusy(false);
      setMsg(
        data.error ??
          data.warning ??
          (data.activationUrl
            ? `✉️ Pozvánka odeslána! (Testovací odkaz: ${data.activationUrl})`
            : 'Změna účtu byla uložena.')
      );
      if (res.ok) router.refresh();
    } catch {
      setBusy(false);
      setMsg('Chyba při komunikaci se serverem.');
    }
  }

  async function setTemporaryAccessPassword() {
    setMsg('');
    const validationError = temporaryPasswordError(temporaryPassword, temporaryPasswordConfirmation);
    if (validationError) {
      setMsg(validationError);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}/account`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'setTemporaryPassword', temporaryPassword, temporaryPasswordConfirmation }),
      });
      const data = await res.json();
      setBusy(false);
      setMsg(data.error ?? data.message ?? 'Dočasné heslo bylo nastaveno.');
      if (res.ok) {
        setTemporaryPassword('');
        setTemporaryPasswordConfirmation('');
        router.refresh();
      }
    } catch {
      setBusy(false);
      setMsg('Dočasné heslo se nepodařilo nastavit.');
    }
  }

  function generateTemporaryPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const randomValues = crypto.getRandomValues(new Uint32Array(14));
    const generated = `Sp${Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('')}`;
    setTemporaryPassword(generated);
    setTemporaryPasswordConfirmation(generated);
    setMsg('Bezpečné dočasné heslo bylo vygenerováno. Předejte ho zaměstnanci bezpečným způsobem a poté ho uložte.');
  }

  const availableRoleOptions = roles.filter((r) => canSetAdmin || r !== 'ADMIN');

  return (
    <section className="card mt-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <ShieldCheck className="h-6 w-6 text-emerald-600" />
        <div>
          <h2 className="text-xl font-bold text-slate-950">Přístup do Aplikace & Přiřazené Funkce</h2>
          <p className="text-xs text-slate-500">
            Správa přihlašovacího účtu zaměstnance, pozvánky e-mailem a kombinování rolí (Obchodník, Pracovník, Admin...)
          </p>
        </div>
      </div>

      {!status ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-900 text-sm">
            <p className="font-bold">Účet zatím není vytvořen.</p>
            <p className="text-xs text-amber-800 mt-0.5">
              Po povolení přístupu bude pracovníkovi odeslána pozvánka s odkazem pro nastavení hesla.
            </p>
          </div>

          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
            onClick={() => act('enableAccess')}
          >
            <Send size={16} />
            <span>Povolit přístup & Odeslat pozvánku e-mailem</span>
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Account Status Badge & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
            <div>
              <p className="text-xs text-slate-500">Stav uživatelského účtu</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-black ${
                  status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  <UserCheck size={14} />
                  <span>{status === 'ACTIVE' ? 'Aktivní (Přihlašuje se)' : status === 'SUSPENDED' ? 'Pozastaven v této organizaci' : 'Pozván (INVITED)'}</span>
                </span>
                <span className="text-xs text-slate-500">
                  Poslední přihlášení: <b>{lastLoginAt ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Prague' }).format(new Date(lastLoginAt)) : 'Zatím nepřihlášen'}</b>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {status === 'INVITED' && (
                <button
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition active:scale-95"
                  onClick={() => act('invite')}
                >
                  <Mail size={14} />
                  <span>Odeslat novou pozvánku</span>
                </button>
              )}

              {status === 'SUSPENDED' ? (
                <button
                  disabled={busy}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 transition"
                  onClick={() => act('restore')}
                >
                  Obnovit účet
                </button>
              ) : !protectedOwner ? (
                <button
                  disabled={busy}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition"
                  onClick={() => act('suspend')}
                >
                  Pozastavit účet
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h3 className="text-sm font-black text-amber-950">Nastavit dočasné heslo</h3>
                <p className="mt-1 text-xs text-amber-800">{canResetPassword ? 'Zaměstnanec se tímto heslem přihlásí pouze pro první vstup. Aplikace ho ihned přesměruje na povinnou změnu hesla. Staré session a pozvánky se zneplatní.' : 'Tento účet je členem více organizací. Globální heslo si musí změnit uživatel nebo platformní administrátor.'}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-800">Dočasné heslo
                <input className="input mt-1" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={12} autoComplete="new-password" placeholder="Alespoň 12 znaků, písmeno a číslo" disabled={!canResetPassword} />
              </label>
              <label className="text-xs font-bold text-slate-800">Potvrzení hesla
                <input className="input mt-1" type="password" value={temporaryPasswordConfirmation} onChange={(event) => setTemporaryPasswordConfirmation(event.target.value)} minLength={12} autoComplete="new-password" disabled={!canResetPassword} />
              </label>
            </div>
            <p className="text-xs font-semibold text-amber-900">Heslo musí mít alespoň 12 znaků, jedno písmeno a jedno číslo.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateTemporaryPassword}
                disabled={busy || !canResetPassword}
                className="rounded-xl border border-amber-700 px-4 py-2.5 text-xs font-black text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Vygenerovat bezpečné heslo
              </button>
              <button
                type="button"
                disabled={busy || !canResetPassword || !temporaryPassword || !temporaryPasswordConfirmation}
                onClick={setTemporaryAccessPassword}
                className="rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Nastavit dočasné heslo a aktivovat účet
              </button>
            </div>
          </div>

          {/* Multiple Roles Selection Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>Přiřazené funkce & Role (Více rolí pro 1 zaměstnance)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Zaměstnanec může mít zároveň roli Pracovníka i Obchodníka či Administrátora a v mobilu si mezi nimi 1-klikem přepínat.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableRoleOptions.map((r) => {
                const isChecked = selectedRoles.includes(r);
                const isPrimary = primaryRole === r;

                return (
                  <div
                    key={r}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs font-bold transition ${
                      isChecked
                        ? 'border-emerald-500 bg-emerald-50/60 text-slate-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <button type="button" disabled={protectedOwner} onClick={() => toggleRole(r)} className="flex flex-1 items-center gap-2 text-left disabled:cursor-not-allowed">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check size={14} />}
                      </div>
                      <span>{roleLabel(r)}</span>
                    </button>

                    {isChecked && (
                      <button
                        type="button"
                        disabled={protectedOwner}
                        onClick={() => setPrimaryRole(r)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black transition ${
                          isPrimary
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                        title="Nastavit jako výchozí primární roli"
                      >
                        {isPrimary ? '★ Primární' : 'Nastavit primární'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Přiřazené role: <b>{selectedRoles.map((r) => roleLabel(r)).join(', ')}</b> (Primární: <b>{roleLabel(primaryRole)}</b>)
              </p>
              <button
                disabled={busy || protectedOwner}
                onClick={saveRoles}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition active:scale-95 shadow-md shadow-emerald-600/20"
              >
                Uložit přiřazené funkce
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-slate-900 p-3 text-xs font-semibold text-emerald-400 break-all">{msg}</p>}
    </section>
  );
}
