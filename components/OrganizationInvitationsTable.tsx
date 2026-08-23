'use client';

import type { OrganizationRole } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Invitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAtLabel: string;
  createdAtLabel: string;
  expired: boolean;
};

const roles: Array<{ value: OrganizationRole; label: string }> = [
  { value: 'OWNER', label: 'Vlastník' },
  { value: 'ADMIN', label: 'Administrátor' },
  { value: 'MANAGER', label: 'Manažer' },
  { value: 'SALES', label: 'Obchodník' },
  { value: 'TECHNICIAN', label: 'Technik' },
  { value: 'WORKER', label: 'Pracovník' },
  { value: 'ACCOUNTANT', label: 'Účetní' },
  { value: 'VIEWER', label: 'Náhled' },
];

function InvitationRow({ invitation, canManageOwner }: { invitation: Invitation; canManageOwner: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState(invitation.role);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);

  async function run(action: 'resend' | 'revoke' | 'update-role') {
    if (action === 'revoke' && !window.confirm(`Opravdu zrušit pozvánku pro ${invitation.email}?`)) return;
    setBusy(action); setMessage(null); setActivationUrl(null);
    const response = await fetch(`/api/organization/invitations/${invitation.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, role }),
    });
    const result = await response.json() as { error?: string; warning?: string; activationUrl?: string };
    if (!response.ok) setMessage(result.error || 'Akci se nepodařilo dokončit.');
    else if (result.activationUrl) { setMessage(result.warning || 'Pozvánka byla obnovena.'); setActivationUrl(result.activationUrl); }
    else setMessage(result.warning || (action === 'revoke' ? 'Pozvánka byla zrušena.' : action === 'resend' ? 'Pozvánka byla znovu odeslána.' : 'Role byla změněna.'));
    setBusy(null);
    if (response.ok) router.refresh();
  }

  return <tr className="border-t align-top">
    <td className="p-2"><div className="font-semibold">{invitation.email}</div><div className="text-xs text-slate-500">Vytvořeno {invitation.createdAtLabel}</div></td>
    <td className="p-2"><select aria-label={`Role pro ${invitation.email}`} className="input min-w-40" disabled={Boolean(busy)} onChange={(event) => setRole(event.target.value as OrganizationRole)} value={role}>{roles.map((item) => <option disabled={item.value === 'OWNER' && !canManageOwner} key={item.value} value={item.value}>{item.label}</option>)}</select></td>
    <td className="p-2"><span className={invitation.expired ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>{invitation.expired ? 'EXPIROVANÁ' : 'ČEKÁ NA AKTIVACI'}</span><div className="text-xs text-slate-500">do {invitation.expiresAtLabel}</div></td>
    <td className="p-2"><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={Boolean(busy) || role === invitation.role} onClick={() => run('update-role')} type="button">Uložit roli</button><button className="btn-secondary" disabled={Boolean(busy)} onClick={() => run('resend')} type="button">Znovu odeslat</button><button className="btn-secondary text-red-700" disabled={Boolean(busy)} onClick={() => run('revoke')} type="button">Zrušit</button></div>{message && <p aria-live="polite" className="mt-2 max-w-xl text-xs font-semibold">{message}</p>}{activationUrl && <a className="mt-1 block break-all text-xs font-semibold text-sky-700 underline" href={activationUrl}>Otevřít testovací aktivační odkaz</a>}</td>
  </tr>;
}

export function OrganizationInvitationsTable({ invitations, canManageOwner }: { invitations: Invitation[]; canManageOwner: boolean }) {
  if (!invitations.length) return <div className="card mt-6"><h2 className="text-lg font-bold">Aktivní pozvánky</h2><p className="mt-2 text-sm text-slate-600">Žádné čekající ani expirované pozvánky.</p></div>;
  return <div className="card mt-6 overflow-x-auto"><h2 className="mb-3 text-lg font-bold">Aktivní pozvánky</h2><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Uživatel</th><th className="p-2">Role</th><th className="p-2">Stav</th><th className="p-2">Akce</th></tr></thead><tbody>{invitations.map((invitation) => <InvitationRow canManageOwner={canManageOwner} invitation={invitation} key={invitation.id} />)}</tbody></table></div>;
}
