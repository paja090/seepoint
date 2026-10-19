'use client';

import { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Mail,
  X,
  ShieldCheck,
  Image as ImageIcon,
  Send,
} from 'lucide-react';

export interface ShareModalData {
  title: string;
  clientName?: string | null;
  photosCount: number;
  publicShareUrl: string;
  sourceLabel?: string;
  isDraft?: boolean;
}

interface PhotoAlbumShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: ShareModalData | null;
}

export function PhotoAlbumShareModal({ isOpen, onClose, album }: PhotoAlbumShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !album) return null;

  const fullUrl = typeof window !== 'undefined'
    ? (album.publicShareUrl.startsWith('http')
        ? album.publicShareUrl
        : `${window.location.origin}${album.publicShareUrl}`)
    : album.publicShareUrl;

  const handleCopy = async () => {
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
        success = true;
      }
    } catch {
      // Fallback
    }

    if (!success) {
      try {
        const input = document.createElement('textarea');
        input.value = fullUrl;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.top = '-9999px';
        document.body.appendChild(input);
        input.focus();
        input.select();
        success = document.execCommand('copy');
        document.body.removeChild(input);
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } else {
      window.prompt('Zkopírujte tento odkaz:', fullUrl);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Fotodokumentace – ${album.title}`,
          text: `Dobrý den, posílám odkaz na fotodokumentaci zakázky ${album.title}.`,
          url: fullUrl,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Share failed', err);
        }
      }
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Dobrý den, posílám odkaz na fotodokumentaci ${album.title}:\n${fullUrl}`
  )}`;

  const emailUrl = `mailto:?subject=${encodeURIComponent(
    `Fotodokumentace – ${album.title}`
  )}&body=${encodeURIComponent(
    `Dobrý den,\n\nv příloze zasílám zabezpečený odkaz na klientské fotoalbum zakázky:\n${album.title}\n\nOdkaz: ${fullUrl}\n\nV albu si můžete prohlédnout realizované fotografie v plné kvalitě a stáhnout kompletní ZIP archiv.\n\nS pozdravem,\nSeePoint`
  )}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-linear-to-r from-sky-50/50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sdílet fotoalbum pro klienta</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Veřejný přístupový odkaz pro zobrazení a stažení fotografií
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Album summary badge */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{album.title}</p>
              {album.clientName && (
                <p className="text-[11px] text-slate-500 truncate mt-0.5">Klient: {album.clientName}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>{album.photosCount} fotek</span>
            </div>
          </div>

          {album.isDraft ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <span>⚠️ Tento report je zatím ve stavu Koncept</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Veřejný odkaz pro klienta zatím není aktivní, protože report ještě nebyl publikován. Před odesláním odkazu klientovi prosím nejprve report zkontrolujte a publikujte.
              </p>
              <a
                href={album.publicShareUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Otevřít správu fotodokumentace k publikování →</span>
              </a>
            </div>
          ) : (
            <>
              {/* Share link input & copy button */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Veřejný odkaz pro klienta
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fullUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs shrink-0 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-sky-600 hover:bg-sky-700 text-white'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Zkopírováno!' : 'Kopírovat'}</span>
                  </button>
                </div>
                {copied && (
                  <p className="text-xs font-semibold text-emerald-600 animate-in fade-in flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Odkaz byl úspěšně zkopírován do schránky. Můžete jej vložit a odeslat.</span>
                  </p>
                )}
              </div>

              {/* Quick Share Action Buttons */}
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Rychlé možnosti sdílení
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Native device share */}
                  {canShare && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition"
                    >
                      <Share2 className="w-4 h-4 text-sky-600" />
                      <span>Sdílet v telefonu / aplikacích</span>
                    </button>
                  )}

                  {/* Direct Client Preview */}
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition"
                  >
                    <ExternalLink className="w-4 h-4 text-sky-600" />
                    <span>Otevřít náhled pro klienta</span>
                  </a>

                  {/* WhatsApp */}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition"
                  >
                    <Send className="w-4 h-4 text-emerald-600" />
                    <span>Odeslat přes WhatsApp</span>
                  </a>

                  {/* Email */}
                  <a
                    href={emailUrl}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition"
                  >
                    <Mail className="w-4 h-4 text-slate-600" />
                    <span>Odeslat e-mailem</span>
                  </a>
                </div>
              </div>
            </>
          )}

          {/* Privacy Note */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Bezpečné zobrazení pro klienta:</strong> Klient má přístup výhradně k fotografiím
              přiřazeným k tomuto fotoalbu. Nemá přístup do vaší administrace ani k interním poznámkám techniků.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
