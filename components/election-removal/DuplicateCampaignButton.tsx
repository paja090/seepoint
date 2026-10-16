'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { DuplicateCampaignModal } from './DuplicateCampaignModal';

interface DuplicateCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  clientName?: string | null;
  totalPoints: number;
  variant?: 'button' | 'icon' | 'header';
}

export function DuplicateCampaignButton({
  campaignId,
  campaignName,
  clientName,
  totalPoints,
  variant = 'button',
}: DuplicateCampaignButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-slate-100 transition"
          title="Duplikovat zakázku"
        >
          <Copy className="w-4 h-4" />
        </button>
      ) : variant === 'header' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <Copy className="w-3.5 h-3.5 text-slate-500" />
          <span>Duplikovat zakázku</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="btn btn-sm bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 py-1 px-2"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Duplikovat</span>
        </button>
      )}

      <DuplicateCampaignModal
        campaignId={campaignId}
        campaignName={campaignName}
        clientName={clientName}
        totalPoints={totalPoints}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
