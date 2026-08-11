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
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={`flex items-center gap-1 rounded-xl border text-xs font-bold transition active:scale-95 ${
          compact
            ? 'bg-slate-900 border-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-800'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20 px-3 py-1.5'
        }`}
        title="Přepnout roli"
      >
        <RefreshCw size={13} className={`text-emerald-400 ${switching ? 'animate-spin' : ''}`} />
        <span className="truncate max-w-[90px] sm:max-w-none">
          {compact ? roleLabel(currentRole) : `Přepnout roli: ${roleLabel(currentRole)}`}
        </span>
        <ChevronDown size={13} className="opacity-70" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl bg-slate-950 p-2 text-white shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-800 mb-1">
              <p className="text-[11px] font-black uppercase text-slate-400">Vaše funkce (Přepnutí zobrazení)</p>
              <p className="text-xs text-slate-300 font-medium">Zvolte aktivní roli pro rozhraní</p>
            </div>

            <div className="space-y-1">
              {allowedRoles.map((roleItem) => {
                const isActive = roleItem === currentRole;
                return (
                  <button
                    key={roleItem}
                    onClick={() => {
                      setOpen(false);
                      handleRoleSwitch(roleItem);
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} />
                      <span>{roleLabel(roleItem)}</span>
                    </div>
                    {isActive && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
