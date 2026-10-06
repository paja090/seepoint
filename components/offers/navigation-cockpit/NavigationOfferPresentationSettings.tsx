'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Settings, Sliders, FileText } from 'lucide-react';
import type { PresentationSettings } from './types';

interface NavigationOfferPresentationSettingsProps {
  presentationSettings: PresentationSettings;
  onPresentationSettingsChange: (settings: PresentationSettings) => void;
  graphicArtworkUrl: string;
  onGraphicArtworkUrlChange: (url: string) => void;
  includeGraphicProof: boolean;
  onIncludeGraphicProofChange: (value: boolean) => void;
  internalNote: string;
  onInternalNoteChange: (note: string) => void;
  clientMessage: string;
  onClientMessageChange: (msg: string) => void;
}

export function NavigationOfferPresentationSettings({
  presentationSettings,
  onPresentationSettingsChange,
  graphicArtworkUrl,
  onGraphicArtworkUrlChange,
  includeGraphicProof,
  onIncludeGraphicProofChange,
  internalNote,
  onInternalNoteChange,
  clientMessage,
  onClientMessageChange,
}: NavigationOfferPresentationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  function updateSetting<K extends keyof PresentationSettings>(key: K, value: PresentationSettings[K]) {
    onPresentationSettingsChange({
      ...presentationSettings,
      [key]: value,
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left font-bold text-xs text-slate-800 hover:bg-slate-50 transition cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Sliders size={16} className="text-slate-500" />
          <span>⚙️ Pokročilé nastavení klientské prezentace a poznámky</span>
          <span className="text-[11px] font-normal text-slate-500">(grafický motiv, reference, zpráva)</span>
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 p-5 space-y-5 text-xs bg-slate-50/50">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Zpráva pro klienta */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Úvodní zpráva pro klienta (v klientském portálu)
              </label>
              <textarea
                rows={3}
                className="input text-xs"
                placeholder="Dobrý den, v příloze zasíláme návrh navigačního značení..."
                value={clientMessage}
                onChange={(e) => onClientMessageChange(e.target.value)}
              />
            </div>

            {/* Interní poznámka */}
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Interní poznámka k zakázce (pouze pro tým)
              </label>
              <textarea
                rows={3}
                className="input text-xs"
                placeholder="Poznámky obchodníka, kontakty na správce sloupů..."
                value={internalNote}
                onChange={(e) => onInternalNoteChange(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-4 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              Zobrazované klientské moduly
            </h4>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={presentationSettings.showGraphicProofBadge}
                  onChange={(e) => updateSetting('showGraphicProofBadge', e.target.checked)}
                />
                <span className="font-semibold text-slate-800">Odznak elektronické korektury</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={presentationSettings.showReferences}
                  onChange={(e) => updateSetting('showReferences', e.target.checked)}
                />
                <span className="font-semibold text-slate-800">Reference a partneři</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={presentationSettings.showRealizations}
                  onChange={(e) => updateSetting('showRealizations', e.target.checked)}
                />
                <span className="font-semibold text-slate-800">Ukázky realizací</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={presentationSettings.showPartnershipGuarantee}
                  onChange={(e) => updateSetting('showPartnershipGuarantee', e.target.checked)}
                />
                <span className="font-semibold text-slate-800">Garance partnerství</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={presentationSettings.showAboutCompany}
                  onChange={(e) => updateSetting('showAboutCompany', e.target.checked)}
                />
                <span className="font-semibold text-slate-800">O společnosti</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="rounded text-sky-600 focus:ring-sky-500"
                  checked={includeGraphicProof}
                  onChange={(e) => onIncludeGraphicProofChange(e.target.checked)}
                />
                <span className="font-semibold text-slate-800">Povolit klientovi nahrát grafiku</span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200/60 pt-4">
            <label className="block font-bold text-slate-800 mb-1">
              Odkaz na grafický vizuál / motiv nabídky (URL)
            </label>
            <input
              type="text"
              className="input text-xs"
              placeholder="https://..."
              value={graphicArtworkUrl}
              onChange={(e) => onGraphicArtworkUrlChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
