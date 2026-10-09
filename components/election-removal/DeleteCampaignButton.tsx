'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  variant?: 'button' | 'icon';
  redirectAfterDelete?: boolean;
  onDeleted?: () => void;
  className?: string;
}

export function DeleteCampaignButton({
  campaignId,
  campaignName,
  variant = 'button',
  redirectAfterDelete = true,
  onDeleted,
  className = '',
}: DeleteCampaignButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Opravdu chcete smazat akci „${campaignName}“?\n\nBudou nevratně odstraněny všechny importované body, naplánované trasy a fotodokumentace.`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/election-removal/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se smazat kampaň.');
      }

      if (onDeleted) {
        onDeleted();
      }

      if (redirectAfterDelete) {
        router.push('/election-removal');
        router.refresh();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání kampaně.');
      setIsDeleting(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className={`p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50 ${className}`}
        title={`Smazat kampaň ${campaignName}`}
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className={`btn bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-sm font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-50 active:scale-95 ${className}`}
    >
      {isDeleting ? (
        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
      ) : (
        <Trash2 className="w-4 h-4 text-rose-600" />
      )}
      <span>{isDeleting ? 'Mažu…' : 'Smazat kampaň'}</span>
    </button>
  );
}
