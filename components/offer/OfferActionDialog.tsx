'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, PencilLine, X } from 'lucide-react';

export type OfferActionType = 'approve' | 'revision' | 'question';

const config: Record<
  OfferActionType,
  { title: string; description: string; submitLabel: string; Icon: typeof CheckCircle2; accent: string; placeholder: string }
> = {
  approve: {
    title: 'Schválit nabídku',
    description: 'Potvrďte prosím zájem o realizaci. Obchodník vás bude kontaktovat s dalšími kroky.',
    submitLabel: 'Odeslat schválení',
    Icon: CheckCircle2,
    accent: 'bg-emerald-600 hover:bg-emerald-700',
    placeholder: 'Volitelná poznámka ke schválení…',
  },
  revision: {
    title: 'Požádat o úpravu',
    description: 'Popište, co byste v nabídce rádi upravili (lokality, počet ploch, termín, cena).',
    submitLabel: 'Odeslat požadavek',
    Icon: PencilLine,
    accent: 'bg-sky-600 hover:bg-sky-700',
    placeholder: 'Např. rád bych přidal lokality v Karviné a upravil termín…',
  },
  question: {
    title: 'Mám dotaz',
    description: 'Napište svůj dotaz, obchodník vám odpoví co nejdříve.',
    submitLabel: 'Odeslat dotaz',
    Icon: HelpCircle,
    accent: 'bg-sky-600 hover:bg-sky-700',
    placeholder: 'Váš dotaz k nabídce…',
  },
};

export function OfferActionDialog({
  action,
  onClose,
}: {
  action: OfferActionType | null;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (action) {
      setMessage('');
      setSubmitted(false);
    }
  }, [action]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (action) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [action, onClose]);

  if (!action) return null;
  const { title, description, submitLabel, Icon, accent, placeholder } = config[action];

  return (
    <div
      aria-labelledby="offer-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
      role="dialog"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <button
          aria-label="Zavřít"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden size={18} />
        </button>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 aria-hidden size={28} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900" id="offer-dialog-title">
              Odesláno
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              Děkujeme. Toto je ukázková akce – ve finální verzi se požadavek propíše do systému a obchodník vás bude kontaktovat.
            </p>
            <button
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={onClose}
              type="button"
            >
              Zavřít
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                <Icon aria-hidden size={20} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900" id="offer-dialog-title">
                {title}
              </h2>
            </div>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <textarea
              className="mt-4 min-h-[120px] w-full resize-y rounded-xl border border-slate-200 p-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              value={message}
            />
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition ${accent}`}
                type="submit"
              >
                <Icon aria-hidden size={16} />
                {submitLabel}
              </button>
              <button
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={onClose}
                type="button"
              >
                Zrušit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
