import { OfferValidationError } from './domain';

/** Resolve public point keys and legacy internal IDs through the same validation. */
export function resolveNavigationSelection(raw: unknown, points: readonly { id: string }[]): Set<string> {
  if (!Array.isArray(raw) || raw.length === 0) throw new OfferValidationError('Vyberte alespoň jeden navigační bod.');
  const mapping = new Map<string, string>();
  points.forEach((point, index) => { mapping.set(`point-${index + 1}`, point.id); mapping.set(point.id, point.id); });
  const result = new Set<string>();
  for (const key of raw) {
    const id = typeof key === 'string' ? mapping.get(key) : undefined;
    if (!id || result.has(id)) throw new OfferValidationError('Výběr obsahuje neplatný nebo duplicitní navigační bod.');
    result.add(id);
  }
  return result;
}
