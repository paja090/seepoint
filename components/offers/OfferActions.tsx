'use client';

import {
  CalendarCheck,
  Check,
  Copy,
  Eye,
  ExternalLink,
  FilePenLine,
  Link2,
  LoaderCircle,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type OfferActionsProps = {
  offerId: string;
  status: string;
  converted: boolean;
  canConvert: boolean;
  offerType: 'STANDARD_MEDIA' | 'NAVIGATION' | 'CITY_GALLERY';
  navigationProposalMode?: string;
  navigationSelectionSubmitted?: boolean;
  isNoPriceConcept?: boolean;
  hasPublicLink?: boolean;
  publicToken?: string | null;
};

const secondaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export function OfferActions({
  offerId,
  status,
  converted,
  canConvert,
  offerType,
  navigationProposalMode,
  navigationSelectionSubmitted,
  isNoPriceConcept,
  hasPublicLink,
  publicToken,
}: OfferActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [customToken, setCustomToken] = useState<string | null>(null);

  const activeToken = customToken || offerId;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const persistentPublicUrl = `${currentOrigin}/offer/${activeToken}`;

  async function action(name: string, body?: unknown) {
    setBusy(name);
    setMessage('');
    try {
      const response = await fetch(`/api/offers/${offerId}/${name}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json() as { error?: string; path?: string; token?: string; offer?: { id?: string } };
      if (!response.ok) throw new Error(data.error || 'Akci se nepodařilo dokončit.');
      if (data.token) setCustomToken(data.token);
      if (name === 'duplicate' && data.offer?.id) router.push(`/offers/${data.offer.id}`);
      else router.refresh();
      setMessage('Akce byla úspěšně dokončena.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akce selhala.');
    } finally {
      setBusy('');
    }
  }

  const disabled = Boolean(busy);
  const isNavigationLocationSelection = offerType === 'NAVIGATION' && navigationProposalMode !== 'PRICED_QUOTE';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Další krok</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Práce s nabídkou</h2>
      </div>

      <div className="space-y-3 p-5">
        {/* Toggle between No-Price Concept and Priced Proposal */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => void action('toggle-concept')}
          className={isNoPriceConcept ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm py-3 transition shadow-md' : 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs sm:text-sm py-3 transition'}
        >
          {isNoPriceConcept ? '💰 Převést na nabídku s cenovou kalkulací' : '🔒 Přepnout na nezávazný koncept bez cen'}
        </button>

        {isNavigationLocationSelection && navigationSelectionSubmitted ? (
          <a className={primaryButton} href={`/offers/${offerId}/navigation/edit`}>
            <FilePenLine aria-hidden="true" size={17} />
            Připravit cenovou nabídku (fáze 2)
          </a>
        ) : null}

        <a className={secondaryButton} href={offerType === 'NAVIGATION' ? `/offers/${offerId}/navigation/edit` : offerType === 'CITY_GALLERY' ? `/offers/${offerId}/city-gallery/edit` : `/offers/${offerId}/edit`}>
          <FilePenLine aria-hidden="true" size={17} />
          {isNavigationLocationSelection ? 'Upravit lokační návrh (přidat/odebrat body)' : 'Upravit nabídku (přidat/odebrat plochy)'}
        </a>

        {/* 🔗 Permanent Public Client Link Card */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-sky-950">
            <span className="flex items-center gap-1.5">
              <Link2 size={14} className="text-sky-600" />
              Veřejný odkaz pro klienta:
            </span>
            <span className="text-emerald-700 font-extrabold text-[11px] bg-emerald-100/80 px-2 py-0.5 rounded-md">
              ● Aktivní online
            </span>
          </div>

          <a
            className="block break-all text-xs text-sky-700 hover:text-sky-900 underline font-mono bg-white/80 p-2 rounded-lg border border-sky-100"
            href={persistentPublicUrl}
            target="_blank"
            rel="noreferrer"
          >
            {persistentPublicUrl}
          </a>

          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(persistentPublicUrl);
                setMessage('✓ Odkaz byl zkopírován do schránky!');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <Copy size={13} />
              Zkopírovat odkaz pro klienta
            </button>
            <a
              href={persistentPublicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white hover:bg-sky-50 text-sky-800 font-bold text-xs transition cursor-pointer"
            >
              <ExternalLink size={13} />
              Otevřít odkaz
            </a>
          </div>
        </div>

        <a className={primaryButton} href={`/offers/${offerId}/preview`}>
          <Eye aria-hidden="true" size={17} />
          Zkontrolovat klientský náhled
        </a>

        {status === 'SENT' && !isNavigationLocationSelection && (
          <>
            {canConvert && (
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50" disabled={disabled} onClick={() => void action('accept')} type="button">
                <Check aria-hidden="true" size={17} />
                Přijmout interně
              </button>
            )}
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50" disabled={disabled} onClick={() => void action('reject')} type="button">
              <X aria-hidden="true" size={17} />
              Zamítnout
            </button>
          </>
        )}

        {offerType === 'NAVIGATION' && status === 'ACCEPTED' && canConvert && !converted ? (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-xs cursor-pointer"
            disabled={disabled}
            onClick={async () => {
              setBusy('convert-navigation');
              try {
                const res = await fetch('/api/navigation/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ offerId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Převod do realizace selhal');
                router.push('/navigation?view=kanban');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Chyba při převodu nabídky');
              } finally {
                setBusy('');
              }
            }}
            type="button"
          >
            🚀 Převést do Realizace & Plánu montáží
          </button>
        ) : null}

        {status === 'ACCEPTED' && canConvert && offerType === 'STANDARD_MEDIA' && (
          <>
            <button className={primaryButton} disabled={disabled || converted} onClick={() => void action('convert-to-occupancy', { targetStatus: 'OCCUPIED' })} type="button">
              <CalendarCheck aria-hidden="true" size={17} />
              {converted ? 'Již převedeno' : 'Převést na obsazenost'}
            </button>
            <button className={secondaryButton} disabled={disabled || converted} onClick={() => void action('convert-to-occupancy', { targetStatus: 'RESERVED' })} type="button">
              Převést na rezervaci
            </button>
          </>
        )}

        <div className="border-t border-slate-100 pt-3 space-y-2">
          <button className={secondaryButton} disabled={disabled} onClick={() => void action('duplicate')} type="button">
            <Copy aria-hidden="true" size={17} />
            Duplikovat nabídku
          </button>
        </div>

        {message && (
          <p className="text-center text-xs font-semibold text-slate-600">{message}</p>
        )}
      </div>
    </section>
  );
}
