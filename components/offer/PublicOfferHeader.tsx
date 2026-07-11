'use client';

import { useState } from 'react';
import { Download, Mail, Menu, Phone, Share2, X } from 'lucide-react';
import type { MockSalesperson } from '@/lib/mock-offer-data';

export function PublicOfferHeader({
  salesperson,
  onDownloadPdf,
  onShare,
}: {
  salesperson: MockSalesperson;
  onDownloadPdf: () => void;
  onShare: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="SeePOINT" className="h-9 w-auto" src="/seepoint-logo.svg" />
          <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">
            Nabídka reklamní kampaně
          </span>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <a
            className="flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
            href={`tel:${salesperson.phone.replace(/\s/g, '')}`}
          >
            <Phone aria-hidden size={16} />
            {salesperson.phone}
          </a>
          <a
            className="flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
            href={`mailto:${salesperson.email}`}
          >
            <Mail aria-hidden size={16} />
            {salesperson.email}
          </a>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          <button
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={onDownloadPdf}
            type="button"
          >
            <Download aria-hidden size={16} />
            Stáhnout PDF
          </button>
          <button
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            onClick={onShare}
            type="button"
          >
            <Share2 aria-hidden size={16} />
            Sdílet nabídku
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Zavřít menu' : 'Otevřít menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            <a className="flex items-center gap-2 text-sm text-slate-700" href={`tel:${salesperson.phone.replace(/\s/g, '')}`}>
              <Phone aria-hidden size={16} />
              {salesperson.phone}
            </a>
            <a className="flex items-center gap-2 text-sm text-slate-700" href={`mailto:${salesperson.email}`}>
              <Mail aria-hidden size={16} />
              {salesperson.email}
            </a>
            <button
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
              onClick={() => {
                setMenuOpen(false);
                onDownloadPdf();
              }}
              type="button"
            >
              <Download aria-hidden size={16} />
              Stáhnout PDF
            </button>
            <button
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setMenuOpen(false);
                onShare();
              }}
              type="button"
            >
              <Share2 aria-hidden size={16} />
              Sdílet nabídku
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
