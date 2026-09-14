'use client';

import { useState } from 'react';
import { RefreshCw, ShieldCheck, ChevronDown, Check } from 'lucide-react';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';

interface RoleSwitcherButtonProps {
  currentRole: AppRole;
  allowedRoles?: AppRole[];
  compact?: boolean;
}

export function RoleSwitcherButton({
  currentRole,
  allowedRoles = [],
  compact = false,
}: RoleSwitcherButtonProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // If user only has 1 role, don't display the switcher
  if (!allowedRoles || allowedRoles.length <= 1) {
    return null;
  }

  async function handleRoleSwitch(targetRole: AppRole) {
    if (targetRole === currentRole || switching) return;
    try {
      setSwitching(true);
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Přepnutí role se nepodařilo.');
        setSwitching(false);
        return;
      }
      window.location.reload();
    } catch {
      alert('Chyba při komunikaci se serverem.');
      setSwitching(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border text-xs font-bold transition active:scale-[0.98] ${
          compact
            ? 'bg-slate-900 border-slate-700 px-2.5 py-1.5 text-slate-200 hover:bg-slate-800'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 px-3 py-2'
        }`}
        title="Přepnout roli"
      >
        <div className="flex items-center gap-2 truncate">
          <RefreshCw size={13} className={`text-emerald-400 shrink-0 ${switching ? 'animate-spin' : ''}`} />
          <span className="truncate">
            {compact ? roleLabel(currentRole) : `Role: ${roleLabel(currentRole)}`}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 shrink-0">
          <span>Přepnout</span>
          <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-1 rounded-xl bg-slate-950 p-2 text-white border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-2.5 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Přepnutí role</span>
            <span className="text-[10px] text-slate-500">Zvolte pohled</span>
          </div>

          <div className="space-y-1">
            {allowedRoles.map((roleItem) => {
              const isActive = roleItem === currentRole;
              return (
                <button
                  type="button"
                  key={roleItem}
                  disabled={switching}
                  onClick={() => {
                    setOpen(false);
                    handleRoleSwitch(roleItem);
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className={isActive ? 'text-slate-950' : 'text-emerald-400'} />
                    <span>{roleLabel(roleItem)}</span>
                  </div>
                  {isActive && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
