'use client';

import { Mail, X } from 'lucide-react';
import Image from 'next/image';
import { formatCzechBusinessSalutation } from '@/lib/czech-salutation';

export type OfferEmailPreviewData = {
  recipient: string;
  campaignName: string;
  contactName: string;
  validUntil?: string | null;
  locationSelection: boolean;
  salespersonName: string;
  salespersonEmail: string;
};

export function OfferEmailPreviewDialog({
  data,
  message,
  onClose,
  onMessageChange,
  onSubjectChange,
  subject,
}: {
  data: OfferEmailPreviewData;
  message: string;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  subject: string;
}) {
  const initials = data.salespersonName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const previewMessage = message.replace(/^Dobrý den,\s*[^,\n]+,\s*/i, '');

  return (
    <div aria-labelledby="offer-email-preview-title" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog">
      <button aria-label="Zavřít náhled e-mailu" className="fixed inset-0" onClick={onClose} type="button" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-5 rounded-3xl bg-slate-100 p-5 shadow-2xl lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Před odesláním</p>
              <h2 className="mt-1 text-xl font-black text-slate-950" id="offer-email-preview-title">Upravit e-mail</h2>
            </div>
            <button aria-label="Zavřít" className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><X size={18} /></button>
          </div>
          <label className="mt-5 block text-sm font-semibold text-slate-700">Komu
            <input className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" readOnly value={data.recipient} />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Předmět
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" maxLength={200} onChange={(event) => onSubjectChange(event.target.value)} value={subject} />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Hlavní text
            <textarea className="mt-1 min-h-56 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6" maxLength={4000} onChange={(event) => onMessageChange(event.target.value)} value={message} />
          </label>
          <p className="mt-2 text-xs text-slate-500">Oslovení, platnost, tlačítko a kontakt obchodníka doplní šablona automaticky.</p>
          <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white" onClick={onClose} type="button"><Mail size={17} />Použít text a zavřít náhled</button>
        </section>

        <section aria-label="Skutečný náhled e-mailu" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm">
          <div className="border-b border-slate-200 bg-white px-5 py-3 text-sm text-slate-600">
            <p><strong>Komu:</strong> {data.recipient}</p>
            <p className="mt-1"><strong>Předmět:</strong> {subject || 'Bez předmětu'}</p>
          </div>
          <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-2xl rounded-2xl bg-white p-7 shadow-sm sm:p-9">
              <Image alt="SeePOINT – Outdoor reklama" className="mb-6 h-auto w-48 max-w-full" height={64} src="/seepoint-logo.svg" width={190} />
              <h3 className="text-2xl font-black leading-tight text-slate-950">{data.campaignName}</h3>
              <p className="mt-5 text-sm text-slate-800">Dobrý den, {formatCzechBusinessSalutation(data.contactName)},</p>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{previewMessage || 'Doplňte hlavní text e-mailu.'}</p>
              {data.locationSelection ? <p className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-900"><strong>Nezávazná fáze bez cen:</strong> nejprve si klient vybere vhodné navigační body.</p> : null}
              {data.validUntil ? <p className="mt-5 text-sm text-slate-600">Nabídka je platná do <strong>{data.validUntil}</strong>.</p> : null}
              <span className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Otevřít nabídku</span>
              <div className="mt-8 flex items-center gap-4 border-t border-slate-200 pt-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-slate-950 text-lg font-bold text-white">{initials || 'SP'}</span>
                <div>
                  <p className="font-bold text-slate-950">{data.salespersonName}</p>
                  <p className="text-xs text-slate-500">Obchodní kontakt SeePOINT</p>
                  <p className="mt-1 text-sm text-sky-700">{data.salespersonEmail}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
