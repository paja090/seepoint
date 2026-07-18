import { CheckCircle2, Clock3, FileText, Send, XCircle } from 'lucide-react';
import type { ProposalStatus } from '@/lib/offers/presentation';

const meta: Record<ProposalStatus, { label: string; className: string; Icon: typeof Send }> = {
  DRAFT: { label: 'Rozpracováno', className: 'bg-slate-100 text-slate-700 ring-slate-200', Icon: FileText },
  SENT: { label: 'Odesláno klientovi', className: 'bg-sky-50 text-sky-700 ring-sky-200', Icon: Send },
  ACCEPTED: { label: 'Schváleno', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2 },
  REJECTED: { label: 'Zamítnuto', className: 'bg-red-50 text-red-700 ring-red-200', Icon: XCircle },
  EXPIRED: { label: 'Expirováno', className: 'bg-zinc-100 text-zinc-700 ring-zinc-200', Icon: Clock3 },
};

export function OfferStatusBadge({ status }: { status: ProposalStatus }) {
  const { label, className, Icon } = meta[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}
    >
      <Icon aria-hidden size={14} />
      {label}
    </span>
  );
}
