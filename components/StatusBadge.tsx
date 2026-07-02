const styles: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-200 text-slate-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  RESERVED: 'bg-orange-100 text-orange-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  NEGOTIATION: 'bg-yellow-100 text-yellow-700',
  OUT_OF_SERVICE: 'bg-slate-200 text-slate-700',
};

const labels: Record<string, string> = {
  ACTIVE: 'Aktivní',
  INACTIVE: 'Neaktivní',
  MAINTENANCE: 'Údržba',
  AVAILABLE: 'Volná',
  RESERVED: 'Rezervovaná',
  OCCUPIED: 'Obsazená',
  NEGOTIATION: 'V jednání',
  OUT_OF_SERVICE: 'Mimo provoz',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[value] ?? 'bg-slate-100 text-slate-700'}`}>
      {labels[value] ?? value}
    </span>
  );
}
