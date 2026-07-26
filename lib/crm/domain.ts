export function normalizeClientName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('cs-CZ');
}

export function nextCrmOrderNumber(year: number, lastOrderNumber?: string | null) {
  const prefix = `ZAK-${year}-`;
  const previous = lastOrderNumber?.startsWith(prefix)
    ? Number.parseInt(lastOrderNumber.slice(prefix.length), 10)
    : 0;
  const sequence = Number.isFinite(previous) ? previous + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}
