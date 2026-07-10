export function dateOnly(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : '-';
}

export function money(value: { toNumber(): number } | number | null | undefined) {
  if (value == null) return '-';
  const amount = typeof value === 'number' ? value : value.toNumber();
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(amount);
}

export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    TODO: 'K řešení',
    IN_PROGRESS: 'Probíhá',
    DONE: 'Hotovo',
    CANCELLED: 'Zrušeno',
    LOW: 'Nízká',
    NORMAL: 'Normální',
    HIGH: 'Vysoká',
    URGENT: 'Urgentní',
    DRAFT: 'Koncept',
    SUBMITTED: 'Odesláno',
    APPROVED: 'Schváleno',
    PAID: 'Zaplaceno',
    REJECTED: 'Zamítnuto',
    AVAILABLE: 'Volné',
    RESERVED: 'Rezervované',
    ACTIVE: 'Aktivní',
    FINISHED: 'Dokončeno',
    IN_USE: 'V provozu',
    SERVICE: 'Servis',
    OUT_OF_SERVICE: 'Mimo provoz',
    EMPLOYEE: 'Zaměstnanec',
    CONTRACTOR: 'Dodavatel',
    FREELANCER: 'OSVČ',
    PART_TIME: 'Částečný úvazek',
    OTHER: 'Jiné',
  };
  return labels[value] ?? value;
}

export function StatusPill({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{statusLabel(value)}</span>;
}
