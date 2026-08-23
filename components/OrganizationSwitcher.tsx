'use client';

import { Building2 } from 'lucide-react';
import { useState } from 'react';

type OrganizationOption = { id: string; name: string; slug: string };

export function OrganizationSwitcher({ activeId, organizations }: { activeId: string; organizations: OrganizationOption[] }) {
  const [busy, setBusy] = useState(false);
  if (organizations.length === 0) return null;

  async function switchOrganization(organizationId: string) {
    if (organizationId === activeId) return;
    setBusy(true);
    const response = await fetch('/api/auth/switch-organization', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });
    if (response.ok) window.location.assign('/dashboard');
    else setBusy(false);
  }

  return (
    <label className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
      <Building2 aria-hidden="true" className="shrink-0 text-sky-700" size={16} />
      <span className="sr-only">Aktivní organizace</span>
      <select
        aria-label="Aktivní organizace"
        className="max-w-44 bg-transparent pr-1 outline-none"
        disabled={busy || organizations.length === 1}
        onChange={(event) => void switchOrganization(event.target.value)}
        value={activeId}
      >
        {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </select>
    </label>
  );
}

