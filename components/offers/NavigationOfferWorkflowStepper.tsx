import { Check, Circle } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';

interface NavigationOfferWorkflowStepperProps {
  offer: OfferView;
}

export function NavigationOfferWorkflowStepper({ offer }: NavigationOfferWorkflowStepperProps) {
  const nav = offer.navigation;
  const isPriced = nav?.proposalMode === 'PRICED_QUOTE';
  const selectionSubmitted = nav?.selectionSubmitted === true;
  const wasSent = offer.status !== 'DRAFT';
  const isAccepted = offer.status === 'ACCEPTED';
  const isRealization = Boolean(offer.converted || (nav as { navigationOrderStatus?: string | null })?.navigationOrderStatus);

  // Derive the 6 navigation workflow stages:
  // 1. Lokační návrh
  // 2. Klient vybírá body
  // 3. Body vybrány
  // 4. Cenová nabídka
  // 5. Schváleno
  // 6. Realizace
  const stages = [
    {
      label: 'Lokační návrh',
      complete: true,
      description: 'Příprava bodů',
    },
    {
      label: 'Klient vybírá body',
      complete: wasSent || isPriced,
      description: wasSent ? 'Odesláno klientovi' : 'Koncept',
    },
    {
      label: 'Body vybrány',
      complete: selectionSubmitted || isPriced,
      description: selectionSubmitted ? 'Potvrzeno klientem' : 'Čeká se',
    },
    {
      label: 'Cenová nabídka',
      complete: isPriced || isAccepted,
      description: isPriced ? 'Fáze 2 naceněna' : 'Fáze 1',
    },
    {
      label: 'Schváleno',
      complete: isAccepted,
      description: isAccepted ? 'Akceptováno' : 'Čeká na podpis',
    },
    {
      label: 'Realizace',
      complete: isRealization,
      description: isRealization ? 'V zakázce' : 'Před realizací',
    },
  ];

  const activeIndex = Math.min(
    stages.findIndex((stage) => !stage.complete),
    stages.length - 1
  );

  return (
    <nav aria-label="Průběh navigační nabídky" className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
          🧭 Workflow navigační kampaně
        </span>
        <span className="text-xs font-bold text-sky-800">
          {isPriced ? 'Fáze 2: Cenová nabídka' : 'Fáze 1: Lokační výběr'}
        </span>
      </div>

      <ol className="grid grid-cols-6 gap-1 sm:gap-2">
        {stages.map((stage, index) => {
          const active = index === activeIndex;
          return (
            <li className="relative flex min-w-0 flex-col items-center text-center" key={stage.label}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 h-px w-full ${
                    stage.complete ? 'bg-sky-600' : 'bg-slate-200'
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full border transition ${
                  stage.complete
                    ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                    : active
                    ? 'border-sky-600 text-sky-700 ring-4 ring-sky-100 bg-white font-bold'
                    : 'border-slate-200 text-slate-300 bg-white'
                }`}
              >
                {stage.complete ? (
                  <Check aria-hidden="true" size={15} />
                ) : (
                  <Circle aria-hidden="true" size={10} fill="currentColor" />
                )}
              </span>
              <span
                className={`mt-2 hidden w-full max-w-full truncate text-[11px] font-bold sm:block ${
                  active || stage.complete ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {stage.label}
              </span>
              <span className="mt-0.5 hidden w-full max-w-full truncate text-[10px] text-slate-400 md:block">
                {stage.description}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Dedicated active step indicator for mobile screens to eliminate text overlap */}
      <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-center sm:hidden">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-900">
          <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[10px] font-black text-white">
            {activeIndex + 1}
          </span>
          <span>Krok {activeIndex + 1} z {stages.length}:</span>
          <span className="font-extrabold text-sky-700">{stages[activeIndex]?.label}</span>
        </div>
        {stages[activeIndex]?.description ? (
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            {stages[activeIndex]?.description}
          </p>
        ) : null}
      </div>
    </nav>
  );
}
