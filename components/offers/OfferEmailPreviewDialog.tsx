import { useState } from 'react';
import { Columns, Edit3, Eye, Mail, Send, X, LoaderCircle } from 'lucide-react';
import { OfferBrandMark } from '@/components/offer/OfferBrandMark';
import type { OfferBranding } from '@/lib/offers/branding';
import { formatCzechBusinessSalutation } from '@/lib/czech-salutation';

export type OfferEmailPreviewData = {
  branding?: OfferBranding;
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
  onSend,
  canSend = true,
  sending = false,
}: {
  data: OfferEmailPreviewData;
  message: string;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  subject: string;
  onSend?: () => void;
  canSend?: boolean;
  sending?: boolean;
}) {
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const initials = data.salespersonName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const previewMessage = message.replace(/^Dobrý den,\s*[^,\n]+,\s*/i, '');

  return (
    <div aria-labelledby="offer-email-preview-title" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4" role="dialog">
      <button aria-label="Zavřít náhled e-mailu" className="fixed inset-0" onClick={onClose} type="button" />
      <div className="relative mx-auto flex max-h-[95vh] w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header with View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Před odesláním</p>
            <h2 className="text-base font-bold text-slate-950" id="offer-email-preview-title">
              Náhled a úprava e-mailu s nabídkou
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns size={14} /> Vedle sebe
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'edit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={14} /> Formulář
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={14} /> Náhled e-mailu
              </button>
            </div>

            <button
              aria-label="Zavřít"
              className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 transition"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
          <div
            className={`grid gap-6 ${
              viewMode === 'split' ? 'lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]' : 'grid-cols-1 max-w-2xl mx-auto'
            }`}
          >
            {(viewMode === 'split' || viewMode === 'edit') && (
              <section className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Edit3 size={14} className="text-sky-600" /> Parametry e-mailu
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Příjemce</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                    readOnly
                    value={data.recipient}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Předmět zprávy</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                    maxLength={200}
                    onChange={(event) => onSubjectChange(event.target.value)}
                    value={subject}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hlavní text e-mailu</label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed focus:border-sky-500 focus:outline-none"
                    rows={8}
                    maxLength={4000}
                    onChange={(event) => onMessageChange(event.target.value)}
                    value={message}
                  />
                </div>

                <p className="text-[11px] text-slate-500">
                  Oslovení, platnost, interaktivní odkaz na kampaň a kontakt obchodníka doplní šablona automaticky.
                </p>
              </section>
            )}

            {(viewMode === 'split' || viewMode === 'preview') && (
              <section aria-label="Skutečný náhled e-mailu" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-200/80 shadow-xs">
          <div className="border-b border-slate-200 bg-white px-5 py-3 text-sm text-slate-600">
            <p><strong>Komu:</strong> {data.recipient}</p>
            <p className="mt-1"><strong>Předmět:</strong> {subject || 'Bez předmětu'}</p>
          </div>
          <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-2xl rounded-2xl bg-white p-7 shadow-sm sm:p-9">
              <div className="mb-6"><OfferBrandMark branding={data.branding} className="h-auto w-48 max-w-full" /></div>
              <h3 className="text-2xl font-black leading-tight text-slate-950">{data.campaignName}</h3>
              <p className="mt-5 text-sm text-slate-800">Dobrý den, {formatCzechBusinessSalutation(data.contactName)},</p>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{previewMessage || 'Doplňte hlavní text e-mailu.'}</p>
              {data.locationSelection ? <p className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-900"><strong>Nezávazná fáze bez cen:</strong> nejprve si klient vybere vhodné navigační body.</p> : null}
              {data.validUntil ? <p className="mt-5 text-sm text-slate-600">Nabídka je platná do <strong>{data.validUntil}</strong>.</p> : null}
              <span className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Otevřít nabídku</span>
              <div className="mt-8 flex items-center gap-4 border-t border-slate-200 pt-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-slate-950 text-lg font-bold text-white">{initials || 'OK'}</span>
                <div>
                  <p className="font-bold text-slate-950">{data.salespersonName}</p>
                  <p className="text-xs text-slate-500">Obchodní kontakt</p>
                  <p className="mt-1 text-sm text-sky-700">{data.salespersonEmail}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  </div>

  {/* Modal Footer Actions */}
  <div className="flex flex-wrap items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 gap-3">
    <div className="text-xs text-slate-500">
      E-mail bude odeslán na: <strong className="text-slate-800">{data.recipient}</strong>
    </div>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
      >
        Použít text a zavřít
      </button>

      {onSend && (
        <button
          type="button"
          disabled={!canSend || sending}
          onClick={() => {
            onSend();
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {sending ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {sending ? 'Odesílám nabídku…' : 'Odeslat nabídku klientovi'}
        </button>
      )}
    </div>
  </div>
</div>
</div>
);
}
