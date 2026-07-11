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
  // Work order statuses
  NEW: 'bg-slate-100 text-slate-700 ring-slate-200',
  PLANNED: 'bg-blue-50 text-blue-700 ring-blue-200',
  HANDED_OVER: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-amber-200',
  DONE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  // Priorities
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200',
  NORMAL: 'bg-blue-50 text-blue-700 ring-blue-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
  URGENT: 'bg-red-50 text-red-700 ring-red-200',
  // Internal task / settlement statuses
  TODO: 'bg-slate-100 text-slate-700 ring-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  // Vehicle / employment states
  IN_USE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  SERVICE: 'bg-amber-50 text-amber-700 ring-amber-200',
  EMPLOYEE: 'bg-slate-100 text-slate-700 ring-slate-200',
  CONTRACTOR: 'bg-slate-100 text-slate-700 ring-slate-200',
  FREELANCER: 'bg-slate-100 text-slate-700 ring-slate-200',
  PART_TIME: 'bg-slate-100 text-slate-700 ring-slate-200',
  OTHER: 'bg-slate-100 text-slate-700 ring-slate-200',
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
  DRAFT: 'Koncept',
  SENT: 'Odesláno',
  ACCEPTED: 'Schváleno',
  REJECTED: 'Zamítnuto',
  EXPIRED: 'Expirováno',
  // Work order statuses
  NEW: 'Nový',
  PLANNED: 'Naplánovaný',
  HANDED_OVER: 'Předaný',
  IN_PROGRESS: 'Probíhá',
  DONE: 'Hotovo',
  // Priorities
  LOW: 'Nízká',
  NORMAL: 'Běžná',
  HIGH: 'Vysoká',
  URGENT: 'Urgentní',
  // Internal task / settlement statuses
  TODO: 'K řešení',
  SUBMITTED: 'Odesláno',
  APPROVED: 'Schváleno',
  PAID: 'Zaplaceno',
  // Vehicle / employment states
  IN_USE: 'V provozu',
  SERVICE: 'Servis',
  EMPLOYEE: 'Zaměstnanec',
  CONTRACTOR: 'Dodavatel',
  FREELANCER: 'OSVČ',
  PART_TIME: 'Částečný úvazek',
  OTHER: 'Jiné',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[value] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {labels[value] ?? value}
    </span>
  );
}
