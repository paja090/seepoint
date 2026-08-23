'use client';

import { FormEvent, useState } from 'react';

export function InviteOrganizationMemberForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null); setActivationUrl(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch('/api/organization/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json() as { error?: string; warning?: string; resent?: boolean; activationUrl?: string };
    setMessage(response.ok ? result.warning || (result.resent ? 'Pozvánka byla znovu odeslána.' : 'Pozvánka byla vytvořena.') : result.error || 'Pozvánku se nepodařilo vytvořit.');
    if (response.ok && result.activationUrl) setActivationUrl(result.activationUrl);
    if (response.ok) event.currentTarget.reset(); setBusy(false);
  }
  return <form className="card grid gap-4 md:grid-cols-[1fr_220px_auto]" onSubmit={submit}><label className="text-sm font-semibold">E-mail<input className="input mt-1" name="email" required type="email" /></label><label className="text-sm font-semibold">Role<select className="input mt-1" defaultValue="VIEWER" name="role"><option value="ADMIN">Administrátor</option><option value="MANAGER">Manažer</option><option value="SALES">Obchodník</option><option value="TECHNICIAN">Technik</option><option value="WORKER">Pracovník</option><option value="ACCOUNTANT">Účetní</option><option value="VIEWER">Náhled</option></select></label><button className="btn-primary self-end" disabled={busy} type="submit">{busy ? 'Odesílám…' : 'Pozvat'}</button>{message && <p className="md:col-span-3 text-sm font-semibold">{message}</p>}{activationUrl && <p className="md:col-span-3 text-sm"><a className="font-semibold text-sky-700 underline" href={activationUrl}>Otevřít testovací aktivační odkaz</a> <span className="text-slate-500">(pouze preview)</span></p>}</form>;
}
