'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Loader2 } from 'lucide-react';

interface RealizationRefreshButtonProps {
  className?: string;
  label?: string;
}

export function RealizationRefreshButton({
  className = '',
  label = 'Obnovit přehled',
}: RealizationRefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isPending}
      title="Znovu načíst a aktualizovat stav všech realizačních zakázek"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer ${className}`}
    >
      {isPending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
          <span>Obnovuji přehled...</span>
        </>
      ) : (
        <>
          <RotateCcw className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:rotate-45" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
