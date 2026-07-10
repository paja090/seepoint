const styles: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-700 ring-slate-200',
  MAINTENANCE: 'bg-amber-50 text-amber-700 ring-amber-200',
  ARCHIVED: 'bg-zinc-200 text-zinc-800 ring-zinc-300',
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  RESERVED: 'bg-orange-50 text-orange-700 ring-orange-200',
  OCCUPIED: 'bg-red-50 text-red-700 ring-red-200',
  NEGOTIATION: 'bg-blue-50 text-blue-700 ring-blue-200',
  OUT_OF_SERVICE: 'bg-slate-100 text-slate-700 ring-slate-200',
  NEEDS_LOCATION_REVIEW: 'bg-purple-50 text-purple-700 ring-purple-200',
  MISSING: 'bg-purple-50 text-purple-700 ring-purple-200',
  UNVERIFIED: 'bg-purple-50 text-purple-700 ring-purple-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FINISHED: 'bg-slate-100 text-slate-700 ring-slate-200',
  CANCELLED: 'bg-zinc-200 text-zinc-800 ring-zinc-300',
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  SENT: 'bg-blue-50 text-blue-700 ring-blue-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  EXPIRED: 'bg-zinc-200 text-zinc-800 ring-zinc-300',
};

const labels: Record<string, string> = {
  ACTIVE: 'Aktivní',
  INACTIVE: 'Neaktivní',
  MAINTENANCE: 'Údržba',
  ARCHIVED: 'Archivováno',
  AVAILABLE: 'Volná',
  RESERVED: 'Rezervovaná',
  OCCUPIED: 'Obsazená',
  NEGOTIATION: 'V jednání',
  OUT_OF_SERVICE: 'Mimo provoz',
  NEEDS_LOCATION_REVIEW: 'Chybí GPS',
  MISSING: 'Chybí GPS',
  UNVERIFIED: 'Ke kontrole',
  VERIFIED: 'Ověřeno',
  FINISHED: 'Dokončeno',
  CANCELLED: 'Zrušeno',
  DRAFT: 'Draft',
  SENT: 'Odesláno',
  ACCEPTED: 'Schváleno',
  REJECTED: 'Zamítnuto',
  EXPIRED: 'Expirováno',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[value] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {labels[value] ?? value}
    </span>
  );
}
