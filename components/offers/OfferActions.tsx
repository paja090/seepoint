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
};

const secondaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export function OfferActions({ offerId, status, converted, canConvert, offerType }: OfferActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [publicUrl, setPublicUrl] = useState('');

  async function action(name: string, body?: unknown) {
    setBusy(name);
    setMessage('');
    try {
      const response = await fetch(`/api/offers/${offerId}/${name}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json() as { error?: string; path?: string; offer?: { id?: string } };
      if (!response.ok) throw new Error(data.error || 'Akci se nepodařilo dokončit.');
      if (data.path) setPublicUrl(`${window.location.origin}${data.path}`);
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

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Další krok</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Práce s nabídkou</h2>
      </div>

      <div className="space-y-3 p-5">
        {status === 'DRAFT' && (
          <>
            <a className={secondaryButton} href={offerType === 'NAVIGATION' ? `/offers/${offerId}/navigation/edit` : offerType === 'CITY_GALLERY' ? `/offers/${offerId}/city-gallery/edit` : `/offers/${offerId}/edit`}>
              <FilePenLine aria-hidden="true" size={17} />
              Upravit návrh
            </a>
            <a className={primaryButton} href={`/offers/${offerId}/preview`}>
              <Eye aria-hidden="true" size={17} />
              Zkontrolovat klientský náhled
            </a>
          </>
        )}

        {status === 'SENT' && (
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

        {status !== 'DRAFT' && <div className="border-t border-slate-100 pt-3">
          <button className={secondaryButton} disabled={disabled} onClick={() => void action('publish')} type="button">
            <Link2 aria-hidden="true" size={17} />
            Vytvořit veřejný odkaz
          </button>
        </div>}

        {offerType === 'STANDARD_MEDIA' && <button className={secondaryButton} disabled={disabled} onClick={() => void action('duplicate')} type="button">
          <Copy aria-hidden="true" size={17} />
          Duplikovat nabídku
        </button>}

        {(status === 'DRAFT' || status === 'SENT') && (
          <button className="w-full px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-red-700 disabled:opacity-50" disabled={disabled} onClick={() => void action('expire')} type="button">
            Označit jako expirovanou
          </button>
        )}

        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500" role="status">
            <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
            Provádím akci…
          </p>
        )}
      </div>

      {publicUrl && (
        <div className="border-t border-emerald-100 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-950">Nový veřejný odkaz</p>
          <p className="mt-1 text-xs leading-5 text-emerald-700">Z bezpečnostních důvodů se zobrazí pouze nyní.</p>
          <div className="mt-3 flex gap-2">
            <input aria-label="Veřejný odkaz nabídky" className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-700" readOnly value={publicUrl} />
            <button aria-label="Kopírovat veřejný odkaz" className="rounded-lg bg-emerald-700 px-3 text-white" onClick={() => void navigator.clipboard.writeText(publicUrl)} type="button">
              <Copy aria-hidden="true" size={16} />
            </button>
            <a aria-label="Otevřít veřejnou nabídku" className="flex items-center rounded-lg border border-emerald-200 bg-white px-3 text-emerald-800" href={publicUrl} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          </div>
        </div>
      )}

      {message && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600" aria-live="polite">{message}</p>}
    </section>
  );
}
