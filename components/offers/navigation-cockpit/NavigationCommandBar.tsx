'use client';

import { ArrowLeft, ArrowRight, Save, Check, RefreshCw } from 'lucide-react';
import type { NavigationWorkflowStep } from './types';

interface NavigationCommandBarProps {
  currentStep: NavigationWorkflowStep;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSave: () => void;
  saving: boolean;
  hasUnsavedChanges?: boolean;
  message?: string;
  isLastStep: boolean;
}

export function NavigationCommandBar({
  currentStep,
  onPrevStep,
  onNextStep,
  onSave,
  saving,
  hasUnsavedChanges,
  message,
  isLastStep,
}: NavigationCommandBarProps) {
  const isFirstStep = currentStep === 'BASICS';

  return (
    <div className="sticky bottom-0 z-40 -mx-4 -mb-6 mt-8 border-t border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-md shadow-lg sm:-mx-6 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Left: Back button & Status Message */}
        <div className="flex items-center gap-3 min-w-0">
          {!isFirstStep && (
            <button
              type="button"
              onClick={onPrevStep}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Zpět</span>
            </button>
          )}

          {message ? (
            <span className="text-xs font-semibold text-slate-700 truncate max-w-md">
              {message}
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              ● Máte neuložené změny
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">
              Všechny změny lze průběžně ukládat jako koncept.
            </span>
          )}
        </div>

        {/* Right: Save Draft & Next / Complete button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{saving ? 'Ukládám...' : 'Uložit nabídku navigace'}</span>
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={onNextStep}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
            >
              <span>Pokračovat</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Check size={15} />
              <span>{saving ? 'Ukládám...' : 'Uložit nabídku navigace'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
