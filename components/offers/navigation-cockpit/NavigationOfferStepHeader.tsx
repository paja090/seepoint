'use client';

import { Check, Compass, MapPin, DollarSign, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { NavigationWorkflowStep } from './types';

interface NavigationOfferStepHeaderProps {
  currentStep: NavigationWorkflowStep;
  onStepChange: (step: NavigationWorkflowStep) => void;
  proposalMode: 'LOCATION_SELECTION' | 'PRICED_QUOTE';
  onProposalModeChange: (mode: 'LOCATION_SELECTION' | 'PRICED_QUOTE') => void;
  targetCount: number;
  pointCount: number;
  hasSelectionSubmitted?: boolean;
}

export function NavigationOfferStepHeader({
  currentStep,
  onStepChange,
  proposalMode,
  onProposalModeChange,
  targetCount,
  pointCount,
  hasSelectionSubmitted,
}: NavigationOfferStepHeaderProps) {
  const steps: Array<{
    id: NavigationWorkflowStep;
    label: string;
    description: string;
    badge?: string;
  }> = [
    {
      id: 'BASICS',
      label: '1. Klient a nabídka',
      description: proposalMode === 'LOCATION_SELECTION' ? 'Fáze 1 · Návrh' : 'Fáze 2 · Cenová',
    },
    {
      id: 'TARGETS',
      label: '2. Provozovny',
      description: `${targetCount} ${targetCount === 1 ? 'cíl' : targetCount < 5 ? 'cíle' : 'cílů'}`,
    },
    {
      id: 'MAP_POINTS',
      label: '3. Mapa a body',
      description: `${pointCount} ${pointCount === 1 ? 'bod' : pointCount < 5 ? 'body' : 'bodů'}`,
    },
    {
      id: 'PRICING_OR_REVIEW',
      label: proposalMode === 'PRICED_QUOTE' ? '4. Ceny a kalkulace' : '4. Kontrola a odeslání',
      description: proposalMode === 'PRICED_QUOTE' ? 'Rozpočet & DPH' : 'Klientský náhled',
    },
  ];

  const stepOrder: NavigationWorkflowStep[] = ['BASICS', 'TARGETS', 'MAP_POINTS', 'PRICING_OR_REVIEW'];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="space-y-4">
      {/* 4-Step Stepper Bar */}
      <nav aria-label="Kroky navigace" className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {steps.map((s, idx) => {
            const isActive = s.id === currentStep;
            const isCompleted = idx < currentIndex;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onStepChange(s.id)}
                className={`flex items-center gap-3 rounded-xl p-2.5 text-left transition cursor-pointer ${
                  isActive
                    ? 'bg-sky-50 border border-sky-300 ring-2 ring-sky-500/20 shadow-xs'
                    : isCompleted
                    ? 'hover:bg-slate-50 text-slate-800'
                    : 'hover:bg-slate-50 text-slate-500'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-black text-xs transition ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check size={14} className="stroke-[3]" /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{s.label}</span>
                  </div>
                  <div className="truncate text-[11px] font-medium text-slate-500">
                    {s.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Prominent Workflow Variant Switcher (Visible in Step 1 or sticky highlight) */}
      {currentStep === 'BASICS' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">
                Pracovní režim nabídky navigace
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Zvolte, v jaké fázi se obchod nachází. Tento výběr určuje, zda řešíte lokační návrh nebo finální kalkulaci.
              </p>
            </div>
            {hasSelectionSubmitted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 border border-emerald-300">
                ✓ Klient již potvrdil výběr bodů
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Varianta A */}
            <button
              type="button"
              onClick={() => onProposalModeChange('LOCATION_SELECTION')}
              className={`relative rounded-xl border p-4 text-left transition cursor-pointer ${
                proposalMode === 'LOCATION_SELECTION'
                  ? 'border-sky-500 bg-white ring-2 ring-sky-500/20 shadow-md'
                  : 'border-slate-200 bg-white/80 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 font-black text-xs">
                    A
                  </span>
                  <div>
                    <span className="text-sm font-extrabold text-slate-900 block">
                      Fáze 1 – Návrh rozmístění
                    </span>
                    <span className="text-[11px] font-semibold text-sky-700">
                      Lokační koncept (LOCATION_SELECTION)
                    </span>
                  </div>
                </div>
                {proposalMode === 'LOCATION_SELECTION' && (
                  <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Aktivní
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-xs text-slate-600 leading-relaxed font-medium">
                Připravíme návrh navigačních bodů na trase. Klient si v interaktivním portálu vybere vhodné pozice. Ceny se v této fázi neřeší a klienta jimi nezatěžujeme.
              </p>
            </button>

            {/* Varianta B */}
            <button
              type="button"
              onClick={() => onProposalModeChange('PRICED_QUOTE')}
              className={`relative rounded-xl border p-4 text-left transition cursor-pointer ${
                proposalMode === 'PRICED_QUOTE'
                  ? 'border-purple-600 bg-white ring-2 ring-purple-600/20 shadow-md'
                  : 'border-slate-200 bg-white/80 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 font-black text-xs">
                    B
                  </span>
                  <div>
                    <span className="text-sm font-extrabold text-slate-900 block">
                      Fáze 2 – Cenová nabídka
                    </span>
                    <span className="text-[11px] font-semibold text-purple-700">
                      Závazná kalkulace (PRICED_QUOTE)
                    </span>
                  </div>
                </div>
                {proposalMode === 'PRICED_QUOTE' && (
                  <span className="rounded-full bg-purple-700 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Aktivní
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-xs text-slate-600 leading-relaxed font-medium">
                Vybrané navigační body naceníme podle ceníkových sazeb (nájem, rámy, tisk, montáž, demontáž) a připravíme finální obchodní nabídku včetně PDF a DPH.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
