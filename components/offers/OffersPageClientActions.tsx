'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { AiOfferGeneratorModal, ClientOption } from './AiOfferGeneratorModal';

export function OffersPageClientActions({ clients = [] }: { clients?: ClientOption[] }) {
  const [showAiModal, setShowAiModal] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setShowAiModal(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-4 py-2 text-xs font-black text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition"
      >
        <Sparkles size={16} />
        <span>✨ AI Copilot Generátor Nabídky</span>
      </button>

      <Link
        href="/offers/templates"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs"
      >
        <span>📚 Vzory & Šablony</span>
      </Link>

      <Link
        href="/offers/new"
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
      >
        <Plus size={16} />
        <span>Nový návrh kampaně</span>
      </Link>

      <AiOfferGeneratorModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        clients={clients}
      />
    </div>
  );
}
