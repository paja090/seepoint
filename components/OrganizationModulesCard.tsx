'use client';

import { useState, useTransition } from 'react';
import {
  SYSTEM_MODULES,
  CATEGORY_LABELS,
  PLAN_MODULE_PRESETS,
  getOrganizationEnabledModules,
  type ModuleCategory,
} from '@/lib/organization-modules';
import { Check, Loader2, Sparkles, Layers, ShieldCheck, RefreshCw } from 'lucide-react';

interface Props {
  organizationId: string;
  initialPlan: string;
  initialEnabledModules: unknown;
}

export function OrganizationModulesCard({
  organizationId,
  initialPlan,
  initialEnabledModules,
}: Props) {
  const [currentPlan, setCurrentPlan] = useState<string>(initialPlan);
  const [modulesMap, setModulesMap] = useState<Record<string, boolean>>(() =>
    getOrganizationEnabledModules({
      plan: initialPlan,
      enabledModules: initialEnabledModules,
    })
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categories: ModuleCategory[] = ['overview', 'sales', 'networks', 'operations', 'management'];

  function handleApplyPreset(planKey: string) {
    setCurrentPlan(planKey);
    const defaultList = PLAN_MODULE_PRESETS[planKey] || PLAN_MODULE_PRESETS.PRO;
    const defaultSet = new Set(defaultList);

    const updated: Record<string, boolean> = {};
    SYSTEM_MODULES.forEach((mod) => {
      updated[mod.id] = defaultSet.has(mod.id);
    });
    setModulesMap(updated);
    setMessage({
      type: 'success',
      text: `Aplikována šablona tarifu ${planKey}. Nezapomeňte uložit změny.`,
    });
  }

  function handleToggleModule(moduleId: string) {
    setModulesMap((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  }

  function handleEnableAll() {
    const updated: Record<string, boolean> = {};
    SYSTEM_MODULES.forEach((mod) => {
      updated[mod.id] = true;
    });
    setModulesMap(updated);
  }

  function handleReset() {
    const fresh = getOrganizationEnabledModules({
      plan: initialPlan,
      enabledModules: initialEnabledModules,
    });
    setModulesMap(fresh);
    setCurrentPlan(initialPlan);
    setMessage(null);
  }

  async function handleSave() {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/organizations/${organizationId}/modules`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: currentPlan,
            enabledModules: modulesMap,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Uložení selhalo.');
        }

        setMessage({
          type: 'success',
          text: 'Nastavení modulů bylo úspěšně uloženo a aplikováno pro celou organizaci.',
        });
      } catch (err: unknown) {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Nastala chyba při ukládání.',
        });
      }
    });
  }

  const activeCount = Object.values(modulesMap).filter(Boolean).length;
  const totalCount = SYSTEM_MODULES.length;

  return (
    <div className="card border-slate-200 bg-white p-6 rounded-3xl shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-black text-slate-900">Aktivní moduly & Funkce organizace</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Aktivujte nebo skryjte jednotlivé moduly SeePoint pro tuto firmu dle sjednaného tarifu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            {activeCount} z {totalCount} modulů aktivních
          </span>
        </div>
      </div>

      {/* Preset Plan Selector */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Rychlé šablony tarifů (Předvolby):
          </span>
          <span className="text-[11px] text-slate-400">Aplikuje výchozí sadu modulů pro vybraný tarif</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'START', label: '🟣 START (Základní)', color: 'border-purple-200 hover:border-purple-400' },
            { key: 'BUSINESS', label: '🔵 BUSINESS (Provozní)', color: 'border-blue-200 hover:border-blue-400' },
            { key: 'PRO', label: '🟢 PRO (Plná Agentura)', color: 'border-emerald-200 hover:border-emerald-400' },
            { key: 'ENTERPRISE', label: '🟡 ENTERPRISE (Vše)', color: 'border-amber-200 hover:border-amber-400' },
            { key: 'INTERNAL', label: '🛡️ INTERNAL (Firemní)', color: 'border-slate-300 hover:border-slate-500' },
          ].map((preset) => {
            const isSelected = currentPlan.toUpperCase() === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleApplyPreset(preset.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-purple-950 text-white border-purple-950 shadow-xs'
                    : `bg-white text-slate-700 ${preset.color} hover:bg-slate-100`
                }`}
              >
                {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Matrix by Category */}
      <div className="space-y-6">
        {categories.map((catKey) => {
          const catModules = SYSTEM_MODULES.filter((m) => m.category === catKey);
          if (catModules.length === 0) return null;

          return (
            <div key={catKey} className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
                {CATEGORY_LABELS[catKey]}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {catModules.map((mod) => {
                  const isEnabled = !!modulesMap[mod.id];
                  return (
                    <div
                      key={mod.id}
                      onClick={() => handleToggleModule(mod.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 select-none ${
                        isEnabled
                          ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50/70'
                          : 'border-slate-200/70 bg-slate-50/50 opacity-60 hover:opacity-90 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate">{mod.name}</span>
                            {mod.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                {mod.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                            {mod.description}
                          </p>
                        </div>

                        {/* Modern Switch UI */}
                        <div
                          className={`w-10 h-6 rounded-full transition-colors p-0.5 shrink-0 relative flex items-center ${
                            isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                              isEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Feedback */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <span className="text-rose-600 font-bold shrink-0">⚠️</span>
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleEnableAll}
            className="text-slate-600 hover:text-slate-900 font-semibold underline cursor-pointer"
          >
            Povolit všechny moduly
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Resetovat
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Ukládám nastavení...</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Uložit změny modulů</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
