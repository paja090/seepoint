import { CheckCircle2, HelpCircle, PencilLine, XCircle } from 'lucide-react';

export function OfferCta({
  onApprove,
  onReject,
  onRevision,
  onQuestion,
}: {
  onApprove: () => void;
  onReject: () => void;
  onRevision: () => void;
  onQuestion: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-10 print:hidden">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Máte zájem o tuto kampaň?
          </h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-slate-300">
            Dejte nám vědět a připravíme pro vás všechny podklady k realizaci. Rádi nabídku upravíme přesně podle vašich potřeb.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <button
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            onClick={onApprove}
            type="button"
          >
            <CheckCircle2 aria-hidden size={18} />
            Schválit nabídku
          </button>
          <button
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            onClick={onRevision}
            type="button"
          >
            <PencilLine aria-hidden size={18} />
            Chci upravit
          </button>
          <button
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            onClick={onQuestion}
            type="button"
          >
            <HelpCircle aria-hidden size={18} />
            Mám dotaz
          </button>
          <button
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
            onClick={onReject}
            type="button"
          >
            <XCircle aria-hidden size={18} />
            Odmítnout
          </button>
        </div>
      </div>
    </section>
  );
}
